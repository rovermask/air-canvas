// AirCanvas Web: hand-tracking air drawing in the browser.
// Port of the desktop app (../AirCanvas.py) using MediaPipe Tasks Vision.

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
const MODEL_URL = "models/hand_landmarker.task"; // bundled copy of Google's float16 hand_landmarker model

// ---- tunables (same meaning as in the desktop app) -----------------------
const CAM_W = 1280;
const CAM_H = 720;
const DWELL_MS = 600;       // hold a fingertip on a button this long to press it
const SMOOTHING = 0.5;      // 0 = raw, closer to 1 = smoother but laggier
const MODE_HOLD_FRAMES = 2; // a gesture must persist this many frames before it counts
const EXTEND_DEG = 150;     // PIP angle above this = finger straight
const CURL_DEG = 120;       // below this = finger bent
const LOST_GRACE_MS = 300;  // ride out a missed detection before lifting the pen
const MAX_UNDO = 20;

const COLORS = {
  RED: "rgb(240,60,60)",
  GREEN: "rgb(90,210,90)",
  BLUE: "rgb(50,140,240)",
  YELLOW: "rgb(250,220,40)",
};
const BUTTONS = ["CLEAR", "RED", "GREEN", "BLUE", "YELLOW", "ERASER", "SAVE"];
const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12] }; // MCP, PIP, DIP, TIP
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

// ---- DOM -----------------------------------------------------------------
const view = document.getElementById("view");
const ctx = view.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start");
const statusEl = document.getElementById("status");

const video = document.createElement("video");
video.playsInline = true;
video.muted = true;

let W = CAM_W;
let H = CAM_H;
const u = () => W / 640; // UI scale: text and cursors are designed at 640px wide
let layer, lctx; // drawing layer (transparent canvas)
let barH = 64;
let rects = [];

// ---- state ---------------------------------------------------------------
let landmarker = null;
let tool = "BLUE";
let size = 4;
let undo = [];
let smooth = null;
let prev = null;
let mode = "IDLE";
let candMode = "IDLE";
let candN = 0;
let fstate = {};
let lastPts = null;
let lastSeen = 0;
let hover = null;
let hoverSince = 0;
let pressedTarget = null; // a pressed button stays disarmed until the fingertip leaves it
let toast = "";
let toastUntil = 0;
let fps = 0;
let lastFrameT = performance.now();
let lastVideoTime = -1;

// ---- helpers -------------------------------------------------------------
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function notify(msg) {
  toast = msg;
  toastUntil = performance.now() + 1500;
}

function angle(a, b, c) {
  const v1 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (n < 1e-6) return 180;
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  return (Math.acos(Math.min(1, Math.max(-1, dot / n))) * 180) / Math.PI;
}

// Index straight + middle bent = DRAW, both straight = SELECT. Ring/pinky are ignored.
// Hysteresis: a finger flips state only when clearly straight or clearly bent.
function classify(p3) {
  const state = {};
  for (const [name, [mcp, pip, dip, tip]] of Object.entries(FINGERS)) {
    const ang = Math.min(angle(p3[mcp], p3[pip], p3[dip]), angle(p3[pip], p3[dip], p3[tip]) + 25);
    if (ang >= EXTEND_DEG) state[name] = true;
    else if (ang <= CURL_DEG) state[name] = false;
    else state[name] = fstate[name] ?? false;
  }
  fstate = state;
  if (state.index && !state.middle) return "DRAW";
  if (state.index && state.middle) return "SELECT";
  return "IDLE";
}

function setMode(next) {
  if (next === mode) {
    candMode = next;
    candN = 0;
    return;
  }
  if (next === candMode) candN++;
  else {
    candMode = next;
    candN = 1;
  }
  if (candN >= MODE_HOLD_FRAMES) {
    mode = next;
    candN = 0;
    prev = null; // never join strokes across a gesture change
  }
}

// ---- layout / toolbar ----------------------------------------------------
function layout() {
  barH = Math.max(64, Math.round(H / 10));
  const n = BUTTONS.length;
  const pad = Math.max(6, Math.round(W / 160));
  const bw = Math.floor((W - pad * (n + 1)) / n);
  rects = BUTTONS.map((_, i) => {
    const x0 = pad + i * (bw + pad);
    return [x0, pad, x0 + bw, barH - pad];
  });
}

function hitButton(pt) {
  if (pt[1] > barH) return null;
  for (let i = 0; i < rects.length; i++) {
    const [x0, , x1] = rects[i];
    if (pt[0] >= x0 && pt[0] <= x1) return i;
  }
  return null;
}

function press(name) {
  if (name === "CLEAR") clearCanvas();
  else if (name === "SAVE") saveImage();
  else {
    tool = name;
    notify(name[0] + name.slice(1).toLowerCase());
  }
}

// ---- canvas actions ------------------------------------------------------
function pushUndo() {
  undo.push(lctx.getImageData(0, 0, W, H));
  if (undo.length > MAX_UNDO) undo.shift();
}

function clearCanvas() {
  pushUndo();
  lctx.clearRect(0, 0, W, H);
  notify("Canvas cleared");
}

function doUndo() {
  const snap = undo.pop();
  if (snap) lctx.putImageData(snap, 0, 0);
}

function isEmpty() {
  const d = lctx.getImageData(0, 0, W, H).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
  return true;
}

function saveImage() {
  if (isEmpty()) {
    notify("Nothing to save: canvas is empty");
    return;
  }
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H - barH;
  const o = out.getContext("2d");
  o.fillStyle = "#fff";
  o.fillRect(0, 0, out.width, out.height);
  o.drawImage(layer, 0, -barH);
  out.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aircanvas_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify("Saved");
  }, "image/png");
}

function drawSegment(p) {
  if (!prev) {
    pushUndo();
    prev = p;
  }
  const erase = tool === "ERASER";
  const width = erase ? size * 4 : size;
  lctx.lineCap = "round";
  lctx.lineJoin = "round";
  lctx.lineWidth = width;
  lctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  lctx.strokeStyle = erase ? "#000" : COLORS[tool];
  lctx.beginPath();
  lctx.moveTo(prev[0], prev[1]);
  lctx.lineTo(p[0], p[1]);
  lctx.stroke();
  lctx.globalCompositeOperation = "source-over";
  prev = p;
}

// ---- per-frame logic -----------------------------------------------------
function update(now) {
  let pts = null;
  let tip = null;
  let fresh = false;

  let res = null;
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    res = landmarker.detectForVideo(video, now);
  }

  if (res && res.landmarks.length) {
    const lm = res.landmarks[0];
    // The video is shown mirrored, so mirror x here too.
    pts = lm.map((p) => [(1 - p.x) * W, p.y * H]);
    const p3 = lm.map((p) => [p.x * W, p.y * H, p.z * W]);
    lastPts = pts;
    lastSeen = now;
    fresh = true;
    const raw = pts[8];
    smooth = smooth
      ? [SMOOTHING * smooth[0] + (1 - SMOOTHING) * raw[0], SMOOTHING * smooth[1] + (1 - SMOOTHING) * raw[1]]
      : raw;
    tip = smooth;
    setMode(classify(p3));
  } else if (lastPts && now - lastSeen < LOST_GRACE_MS) {
    // no new inference this frame, or a brief dropout: keep the last pose
    pts = lastPts;
    tip = smooth;
  } else {
    smooth = null;
    lastPts = null;
    fstate = {};
    mode = "IDLE";
    candN = 0;
    prev = null;
  }

  const inBar = tip !== null && tip[1] <= barH;
  const target = inBar ? hitButton(tip) : null;

  if (tip && mode === "DRAW" && !inBar && fresh) drawSegment(tip);
  else if (!(tip && mode === "DRAW" && !inBar)) prev = null;

  // dwell-to-press
  if (target !== pressedTarget) pressedTarget = null;
  let progress = 0;
  if (target !== null && mode !== "IDLE" && target !== pressedTarget) {
    if (target !== hover) {
      hover = target;
      hoverSince = now;
    }
    progress = Math.min(1, (now - hoverSince) / DWELL_MS);
    if (progress >= 1) {
      press(BUTTONS[target]);
      hover = null;
      pressedTarget = target;
      progress = 0;
    }
  } else {
    hover = null;
  }

  return { pts, tip, target, progress };
}

// ---- rendering -----------------------------------------------------------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function drawToolbar(target, progress) {
  ctx.fillStyle = "rgba(28,30,38,0.78)";
  ctx.fillRect(0, 0, W, barH);
  ctx.font = `600 ${14 * u()}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  BUTTONS.forEach((name, i) => {
    const [x0, y0, x1, y1] = rects[i];
    const isColor = name in COLORS;
    roundRect(x0, y0, x1 - x0, y1 - y0, 8);
    ctx.fillStyle = isColor ? COLORS[name] : "rgb(70,75,90)";
    ctx.fill();
    if (name === tool) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
    ctx.fillStyle = isColor ? "#141414" : "#f0f0f0";
    ctx.fillText(name, (x0 + x1) / 2, (y0 + y1) / 2);
    if (i === target && progress > 0) {
      ctx.fillStyle = "#50c8ff";
      ctx.fillRect(x0, y1 - 6, (x1 - x0) * progress, 6);
    }
  });
}

function drawHand(pts) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(210,210,210,0.9)";
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(pts[a][0], pts[a][1]);
    ctx.lineTo(pts[b][0], pts[b][1]);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(60,60,60,0.9)";
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3 * u(), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCursor(tip) {
  const erase = tool === "ERASER";
  const s = erase ? size * 4 : size;
  if (mode === "DRAW") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], s / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = erase ? "#000" : COLORS[tool];
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], Math.max(2, s / 2), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#50c8ff";
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 14 * u(), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(tracking, now) {
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(28,30,38,0.85)";
  ctx.fillRect(0, H - 30 * u(), W, 30 * u());
  const status = tracking
    ? { DRAW: "Drawing", SELECT: "Pen up / select", IDLE: "Idle" }[mode]
    : "No hand detected";
  ctx.fillStyle = "#f0f0f0";
  ctx.font = `${13 * u()}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(`${status}   |   Brush ${size}px   |   ${fps.toFixed(0)} FPS`, 10 * u(), H - 15 * u());
  ctx.textAlign = "right";
  ctx.fillStyle = "#b4b4b4";
  ctx.font = `${11 * u()}px system-ui, sans-serif`;
  ctx.fillText("u undo | +/- size | c clear | s save", W - 10 * u(), H - 15 * u());

  if (now < toastUntil) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#50c8ff";
    ctx.font = `600 ${18 * u()}px system-ui, sans-serif`;
    ctx.fillText(toast, W / 2, H - 52 * u());
  }
}

function render(state, now) {
  // mirrored camera
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();

  ctx.drawImage(layer, 0, 0);
  if (state.pts) drawHand(state.pts);
  drawToolbar(state.target, state.progress);
  if (state.tip) drawCursor(state.tip);
  drawHud(!!state.pts, now);
}

function loop(now) {
  const dt = now - lastFrameT;
  lastFrameT = now;
  if (dt > 0) fps = 0.9 * fps + 0.1 * (1000 / dt);

  const state = update(now);
  render(state, now);
  requestAnimationFrame(loop);
}

// ---- startup -------------------------------------------------------------
async function start() {
  startBtn.disabled = true;
  try {
    setStatus("Loading hand-tracking model...");
    const { FilesetResolver, HandLandmarker } = await import(`${VISION_URL}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
    const make = (delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      landmarker = await make("GPU");
    } catch {
      landmarker = await make("CPU");
    }

    setStatus("Starting camera...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: CAM_W }, height: { ideal: CAM_H }, frameRate: { ideal: 30 }, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    W = video.videoWidth || CAM_W;
    H = video.videoHeight || CAM_H;
    view.width = W;
    view.height = H;
    view.parentElement.style.aspectRatio = `${W} / ${H}`;
    layer = document.createElement("canvas");
    layer.width = W;
    layer.height = H;
    lctx = layer.getContext("2d", { willReadFrequently: true });
    size = Math.max(4, Math.round(W / 160));
    layout();

    overlay.classList.add("hidden");
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    const missing = err && err.name === "NotFoundError";
    setStatus(
      denied
        ? "Camera access was blocked. Allow it in the address bar and try again."
        : missing
          ? "No camera found."
          : `Could not start: ${err && err.message ? err.message : err}`,
      true
    );
    startBtn.disabled = false;
    startBtn.textContent = "Try again";
  }
}

startBtn.addEventListener("click", start);

window.addEventListener("keydown", (e) => {
  if (!lctx) return;
  switch (e.key.toLowerCase()) {
    case "u": doUndo(); break;
    case "c": clearCanvas(); break;
    case "s": saveImage(); break;
    case "+":
    case "=": size = Math.min(40, size + 2); break;
    case "-":
    case "_": size = Math.max(2, size - 2); break;
  }
});
