# AirCanvas 🎨🖐️

[![Deployed](https://img.shields.io/badge/Live-Demo-green)](https://github.com/rovermask/air-canvas)  
🔗 **Live App:** [https://github.com/rovermask/air-canvas](https://github.com/rovermask/air-canvas) 

---

## 🫁 Overview

**AirCanvas** is a hand-tracking virtual drawing app that lets you draw in the air using just your hand. Using **MediaPipe** for hand detection and **OpenCV** for rendering, you can create art without touching a screen!

---

## Features ✨

* Draw in real-time using hand gestures
* Erase and clear canvas with simple gestures
* Supports different brush thicknesses
* Save your masterpieces locally
* Lightweight and works on standard webcams

---

## Demo

<img width="1526" height="611" alt="air canvas ss" src="https://github.com/user-attachments/assets/3c9f134f-48e4-4652-8063-d48d90b591cd" />

---

## Installation 🛠️

1. Clone the repo:

```bash
git clone https://github.com/rovermask/air-canvas.git
cd AirCanvas
```

2. Create a virtual environment (optional but recommended):

```bash
py3.11 -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

---

## Usage 🚀

1. Run the main script:

```bash
python AirCanvas.py
```

2. Gestures:
   * **Index finger up** - draw
   * **Index + middle finger up** - pen lifted; hold the fingertip on a toolbar button for ~0.6s to press it
   * Any other pose (fist, open palm) - idle
3. Keys: `u` undo, `+`/`-` brush size, `c` clear, `s` save, `q` quit

---

## Requirements 📦

* Python 3.11
* OpenCV
* MediaPipe
* NumPy

*(Check `requirements.txt` for exact versions)*

---

## Folder Structure 🗂️

```
AirCanvas/
├── AirCanvas.py       # Main app: tracking, gestures, drawing
├── camera.py          # Threaded 640x480 MJPG webcam capture
├── ui.py              # Toolbar, hand overlay, HUD
├── Distance.py        # Point distance helper
├── SaveFile.py        # Save dialog
├── requirements.txt
└── README.md
```

---

## Contributing 🤝

Feel free to open issues or submit pull requests. Let's make AirCanvas even cooler!

---

🙋‍♂️ Author

📌 Name: Vibhum Sharma

📧 Contact: vibhum10sharma@gmail.com
