# AirCanvas.py
import time

import cv2
import mediapipe as mp
import numpy as np

from SaveFile import default_path, save
from camera import Camera
from ui import BUTTONS, Toolbar, draw_cursor, draw_hand, draw_hud

WINDOW = "AirCanvas"
COLORS = {"RED": (60, 60, 240), "GREEN": (90, 210, 90), "BLUE": (240, 140, 50), "YELLOW": (40, 220, 250)}
DWELL_SECONDS = 0.6      # hold a fingertip on a button this long to press it
SMOOTHING = 0.5          # 0 = raw, closer to 1 = smoother but laggier
MODE_HOLD_FRAMES = 2     # a gesture must persist this many frames before it counts
MAX_UNDO = 20
PROCESS_WIDTH = 640      # hand tracking runs on a downscaled copy for speed

# (MCP, PIP, DIP, TIP) landmark ids for index, middle
FINGERS = {"index": (5, 6, 7, 8), "middle": (9, 10, 11, 12)}
EXTEND_DEG = 150         # PIP joint angle above this = finger straight
CURL_DEG = 120           # below this = finger bent (between the two keeps the last state)
LOST_GRACE = 0.3         # seconds to ride out a missed detection before lifting the pen


def angle(a, b, c):
    """Angle in degrees at b, using 3D landmarks so pointing at the camera still works."""
    v1, v2 = np.subtract(a, b), np.subtract(c, b)
    n = np.linalg.norm(v1) * np.linalg.norm(v2)
    if n < 1e-6:
        return 180.0
    return float(np.degrees(np.arccos(np.clip(np.dot(v1, v2) / n, -1.0, 1.0))))


def classify(p3, prev):
    """Index straight + middle bent = DRAW, both straight = SELECT. Ring/pinky are ignored.

    Hysteresis: a finger flips state only when clearly straight or clearly bent.
    """
    state = {}
    for name, (mcp, pip_, dip, tip) in FINGERS.items():
        ang = min(angle(p3[mcp], p3[pip_], p3[dip]), angle(p3[pip_], p3[dip], p3[tip]) + 25)
        if ang >= EXTEND_DEG:
            state[name] = True
        elif ang <= CURL_DEG:
            state[name] = False
        else:
            state[name] = prev.get(name, False)
    if state["index"] and not state["middle"]:
        return "DRAW", state
    if state["index"] and state["middle"]:
        return "SELECT", state
    return "IDLE", state


class App:
    def __init__(self):
        self.cam = Camera()
        self.w, self.h = self.cam.width, self.cam.height
        self.toolbar = Toolbar(self.w, self.h)
        self.hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.layer = np.zeros((self.h, self.w, 3), np.uint8)   # drawing only, black = empty
        self.undo = []
        self.tool = "BLUE"
        self.size = max(4, self.w // 200)
        self.smooth = None
        self.prev = None
        self.fstate = {}
        self.last_pts, self.last_seen = None, 0.0
        self.mode, self._cand, self._cand_n = "IDLE", "IDLE", 0
        self.hover, self.hover_since = None, 0.0
        self.toast, self.toast_until = None, 0.0
        self.fps, self._t = 0.0, time.time()

    # ---- helpers -------------------------------------------------------
    def notify(self, msg):
        self.toast, self.toast_until = msg, time.time() + 1.5

    def push_undo(self):
        self.undo.append(self.layer.copy())
        del self.undo[:-MAX_UNDO]

    def clear(self):
        self.push_undo()
        self.layer[:] = 0
        self.notify("Canvas cleared")

    def save_image(self):
        out = np.full_like(self.layer, 255)
        mask = self.layer.any(axis=2)
        out[mask] = self.layer[mask]
        out = out[self.toolbar.bar_h:]
        path = save()
        if path is None:
            self.notify("Save cancelled")
            return
        if not cv2.imwrite(path, out):
            path = default_path()
            cv2.imwrite(path, out)
        self.notify("Saved " + path.replace("\\", "/").split("/")[-1])

    def press(self, name):
        if name == "CLEAR":
            self.clear()
        elif name == "SAVE":
            self.save_image()
        else:
            self.tool = name
            self.notify(name.title())

    def set_mode(self, new):
        """Debounce gesture changes so one noisy frame cannot drop or start a stroke."""
        if new == self.mode:
            self._cand, self._cand_n = new, 0
            return
        if new == self._cand:
            self._cand_n += 1
        else:
            self._cand, self._cand_n = new, 1
        if self._cand_n >= MODE_HOLD_FRAMES:
            self.mode, self._cand_n = new, 0
            self.prev = None   # never join strokes across a gesture change

    def draw_segment(self, p):
        if self.prev is None:
            self.push_undo()
            self.prev = p
        erase = self.tool == "ERASER"
        color = (0, 0, 0) if erase else COLORS[self.tool]
        width = self.size * 4 if erase else self.size
        cv2.line(self.layer, self.prev, p, color, width, cv2.LINE_AA)
        cv2.circle(self.layer, p, width // 2, color, -1, cv2.LINE_AA)
        self.prev = p

    # ---- per-frame -----------------------------------------------------
    def update(self, frame):
        small = cv2.resize(frame, (PROCESS_WIDTH, int(PROCESS_WIDTH * self.h / self.w)))
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        res = self.hands.process(rgb)

        pts, tip, fresh = None, None, False
        now = time.time()
        if res.multi_hand_landmarks:
            lm = res.multi_hand_landmarks[0].landmark
            pts = [(int(p.x * self.w), int(p.y * self.h)) for p in lm]
            p3 = [(p.x * self.w, p.y * self.h, p.z * self.w) for p in lm]
            self.last_pts, self.last_seen, fresh = pts, now, True
            raw = pts[8]
            if self.smooth is None:
                self.smooth = raw
            else:
                a = SMOOTHING
                self.smooth = (int(a * self.smooth[0] + (1 - a) * raw[0]),
                               int(a * self.smooth[1] + (1 - a) * raw[1]))
            tip = self.smooth
            gesture, self.fstate = classify(p3, self.fstate)
            self.set_mode(gesture)
        elif self.last_pts is not None and now - self.last_seen < LOST_GRACE:
            # brief dropout: keep the last pose so the stroke does not break
            pts, tip = self.last_pts, self.smooth
        else:
            self.smooth, self.last_pts, self.fstate = None, None, {}
            self.mode, self._cand_n = "IDLE", 0
            self.prev = None

        in_bar = tip is not None and tip[1] <= self.toolbar.bar_h
        target = self.toolbar.hit(tip) if in_bar else None

        if tip is not None and self.mode == "DRAW" and not in_bar and fresh:
            self.draw_segment(tip)
        else:
            self.prev = None

        # dwell-to-press on toolbar buttons
        progress = 0.0
        if target is not None and self.mode != "IDLE":
            if target != self.hover:
                self.hover, self.hover_since = target, now
            progress = min(1.0, max(0.0, (now - self.hover_since) / DWELL_SECONDS))
            if progress >= 1.0:
                self.press(BUTTONS[target][0])
                self.hover, self.hover_since = None, now + 1.0   # cool-down before re-press
                progress = 0.0
        else:
            self.hover = None

        return pts, tip, target, progress

    def render(self, frame, pts, tip, target, progress):
        mask = self.layer.any(axis=2)
        frame[mask] = self.layer[mask]
        if pts:
            draw_hand(frame, pts)
        self.toolbar.draw(frame, self.tool, target, progress)
        if tip is not None:
            color = (0, 0, 0) if self.tool == "ERASER" else COLORS[self.tool]
            size = self.size * 4 if self.tool == "ERASER" else self.size
            draw_cursor(frame, tip, self.mode, color, size)
        toast = self.toast if time.time() < self.toast_until else None
        draw_hud(frame, self.mode, self.fps, self.size, pts is not None, toast)

    def run(self):
        cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(WINDOW, min(self.w, 1280), min(self.h, 720))
        seq = -1
        while True:
            seq, frame = self.cam.read(seq)
            if frame is None:
                if cv2.waitKey(30) & 0xFF == ord("q"):
                    break
                continue
            frame = cv2.flip(frame, 1)

            now = time.time()
            self.fps = 0.9 * self.fps + 0.1 / max(now - self._t, 1e-3)
            self._t = now

            state = self.update(frame)
            self.render(frame, *state)
            cv2.imshow(WINDOW, frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:
                break
            elif key == ord("c"):
                self.clear()
            elif key == ord("s"):
                self.save_image()
            elif key == ord("u") and self.undo:
                self.layer = self.undo.pop()
            elif key in (ord("+"), ord("=")):
                self.size = min(40, self.size + 2)
            elif key in (ord("-"), ord("_")):
                self.size = max(2, self.size - 2)

        self.cam.release()
        self.hands.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    App().run()
