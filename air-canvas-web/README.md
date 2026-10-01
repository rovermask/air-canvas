# AirCanvas Web 🎨🖐️

Browser version of AirCanvas: draw in the air with your index finger. Hand tracking runs fully client-side with [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker). No video leaves your device, and there is no build step.

## Run

The camera only works on `localhost` or HTTPS, so serve the folder instead of opening the file directly:

```bash
cd air-canvas-web
python -m http.server 8000
```

Open <http://localhost:8000> and click **Start camera**.

## Gestures

| Gesture | Action |
|---|---|
| Index up, middle bent | **Draw** |
| Index and middle both up | **Pen up / select**: hold your fingertip on a toolbar button for ~0.6s to press it |
| Fist / open palm | Idle |

Toolbar: `CLEAR` · `RED` · `GREEN` · `BLUE` · `YELLOW` · `ERASER` · `SAVE`

Keys: `U` undo · `C` clear · `S` save (downloads a PNG) · `+` / `-` brush size

## Files

```
air-canvas-web/
├── index.html                    # Page
├── style.css
├── app.js                        # Camera, gestures, drawing, toolbar
└── models/hand_landmarker.task   # Bundled MediaPipe hand model (~7.8 MB)
```

`app.js` loads the MediaPipe runtime from the jsDelivr CDN (pinned to 0.10.21), so an internet connection is needed on first load. The gesture logic and tunables (`SMOOTHING`, `DWELL_MS`, `EXTEND_DEG`, `CURL_DEG`, `LOST_GRACE_MS`) mirror the desktop app. It uses the GPU delegate when available and falls back to CPU.

## Camera

Requests 1280x720 at 30 fps (the browser picks the closest mode your camera supports). To change it, edit `CAM_W` and `CAM_H` at the top of `app.js`; text, cursors and the toolbar scale automatically.

## Browser support

Current Chrome, Edge, Firefox and Safari. Drawing is mirrored like a selfie view.
