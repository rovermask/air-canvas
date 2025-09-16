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

🎥 *Add GIF or short video showing AirCanvas in action*

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

2. Move your hand in front of the camera to start drawing
3. Use gestures for **erase** and **clear** (details in the code)
4. Press `q` to quit and save your drawing

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
├── AirCanvas.py       # Main app
├── Distance.py        # Utility for point distance calculation
├── PrepareCanvas.py   # Canvas preparation
├── SaveFile.py        # Saving drawings
├── requirements.txt   # Dependencies
└── README.md
```

---

## Contributing 🤝

Feel free to open issues or submit pull requests. Let's make AirCanvas even cooler!

---

🙋‍♂️ Author
📌 Name: Vibhum Sharma
📧 Contact: vibhum10sharma@gmail.com