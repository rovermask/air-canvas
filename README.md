# AirCanvas 🎨🖐️

[![Deployed](https://img.shields.io/badge/Live-Demo-green)](https://github.com/rovermask/air-canvas)  
🔗 **Live App:** [https://github.com/rovermask/air-canvas](https://github.com/rovermask/air-canvas) 

---

## 🫁 Overview

**AirCanvas** is a hand-tracking virtual drawing app that lets you draw in the air using just your hand. Using **MediaPipe** for hand detection and **OpenCV** for rendering, you can create art without touching a screen!

---

## Features ✨

* Draw in real time with just your index finger, no markers or gloves
* Toolbar with 4 colours, an eraser, clear and save, pressed by holding your fingertip on a button
* Rotation-proof gesture detection that also works when you point toward the camera
* Smoothed fingertip tracking and short-dropout recovery, so strokes don't break or jitter
* Undo (up to 20 steps) and adjustable brush size
* Live overlay of the hand skeleton, current gesture, brush size and FPS
* Save your drawing as PNG or JPG on a white background
* Runs on a standard webcam at 1280x720

---

## Web Version 🌐

There is also a browser version in [`air-canvas-web/`](air-canvas-web/). It has the same gestures, toolbar and shortcuts, with hand tracking running entirely in your browser (no install, no video uploaded).

```bash
cd air-canvas-web
python -m http.server 8000
```

Open <http://localhost:8000> and click **Start camera**. See [`air-canvas-web/README.md`](air-canvas-web/README.md) for details.

---

## Installation (Desktop) 🛠️

1. Clone the repo:

```bash
git clone https://github.com/rovermask/air-canvas.git
cd air-canvas
```

2. Create a virtual environment (optional but recommended):

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

---

## Usage (Desktop) 🚀

Run the app:

```bash
python AirCanvas.py
```

### Gestures

| Gesture | Action |
|---|---|
| Index finger up, middle finger bent | **Draw** |
| Index and middle finger both up | **Pen up / select**: move without drawing; hold the fingertip on a toolbar button for ~0.6s to press it |
| Anything else (fist, open palm) | Idle |

Ring and pinky fingers are ignored, so you don't have to hold them perfectly still.

### Toolbar

`CLEAR` · `RED` · `GREEN` · `BLUE` · `YELLOW` · `ERASER` · `SAVE`

### Keyboard shortcuts

| Key | Action |
|---|---|
| `u` | Undo last stroke |
| `+` / `-` | Brush size |
| `c` | Clear canvas |
| `s` | Save drawing |
| `q` | Quit |

### Tips for reliable tracking

* Light your hand from the front; avoid a bright window behind you
* Use a plain background
* Stay roughly 40 to 80 cm from the camera, palm facing it
* Close other apps that use the webcam

---

## Configuration ⚙️

Tunable constants are at the top of `AirCanvas.py` and `camera.py`:

| Setting | File | Effect |
|---|---|---|
| `width`, `height`, `fps` | `camera.py` | Capture resolution (default 1280x720, 60 fps) |
| `SMOOTHING` | `AirCanvas.py` | Higher = steadier line, more lag |
| `DWELL_SECONDS` | `AirCanvas.py` | Hold time to press a toolbar button |
| `EXTEND_DEG` / `CURL_DEG` | `AirCanvas.py` | How straight or bent a finger must be to count |
| `LOST_GRACE` | `AirCanvas.py` | Seconds a missed detection is tolerated |

---

## Requirements 📦

* Python 3.9 to 3.12 (required by MediaPipe 0.10.21)
* A webcam
* MediaPipe, OpenCV (`opencv-contrib-python`) and NumPy 1.x, with exact versions pinned in `requirements.txt`

> If `pip` times out on the large wheels, retry with `pip install -r requirements.txt --default-timeout=120 --retries 10`.

---

## Folder Structure 🗂️

```
air-canvas/
├── AirCanvas.py       # Main app: tracking, gestures, drawing
├── camera.py          # Threaded 1280x720 MJPG webcam capture
├── ui.py              # Toolbar, hand overlay, HUD
├── SaveFile.py        # Save dialog
├── requirements.txt
├── README.md
└── air-canvas-web/    # Browser version (HTML/CSS/JS, no build step)
```

---

## Contributing 🤝

Feel free to open issues or submit pull requests. Let's make AirCanvas even cooler!

---

🙋‍♂️ Author

📌 Name: Vibhum Sharma

📧 Contact: vibhum10sharma@gmail.com
