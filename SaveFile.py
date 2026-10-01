# SaveFile.py
import os
import time
from tkinter import Tk
from tkinter.filedialog import asksaveasfilename


def save():
    """Ask where to save the drawing. Returns a path, or None if cancelled."""
    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        path = asksaveasfilename(
            parent=root,
            initialfile=time.strftime("aircanvas_%Y%m%d_%H%M%S.png"),
            defaultextension=".png",
            filetypes=[("PNG File", "*.png"), ("JPEG File", "*.jpg")],
        )
    finally:
        root.destroy()
    return path or None


def default_path():
    return os.path.join(os.getcwd(), time.strftime("aircanvas_%Y%m%d_%H%M%S.png"))
