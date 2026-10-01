# ui.py
import cv2

FONT = cv2.FONT_HERSHEY_SIMPLEX
BAR_BG = (38, 30, 28)
TEXT = (240, 240, 240)
ACCENT = (255, 200, 80)

# name, BGR colour (None = action button)
BUTTONS = [
    ("CLEAR", None),
    ("RED", (60, 60, 240)),
    ("GREEN", (90, 210, 90)),
    ("BLUE", (240, 140, 50)),
    ("YELLOW", (40, 220, 250)),
    ("ERASER", None),
    ("SAVE", None),
]

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12), (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17),
]


class Toolbar:
    def __init__(self, width, height):
        self.width = width
        self.bar_h = max(64, height // 10)
        self.rects = []
        n = len(BUTTONS)
        pad = max(6, width // 160)
        bw = (width - pad * (n + 1)) // n
        for i in range(n):
            x0 = pad + i * (bw + pad)
            self.rects.append((x0, pad, x0 + bw, self.bar_h - pad))

    def hit(self, pt):
        """Index of the button under pt, or None."""
        x, y = pt
        for i, (x0, y0, x1, y1) in enumerate(self.rects):
            if x0 <= x <= x1 and y <= self.bar_h:
                return i
        return None

    def draw(self, frame, active, hover=None, progress=0.0):
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (self.width, self.bar_h), BAR_BG, -1)
        cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

        for i, ((name, color), (x0, y0, x1, y1)) in enumerate(zip(BUTTONS, self.rects)):
            if color is not None:
                cv2.rectangle(frame, (x0, y0), (x1, y1), color, -1)
                label_col = (20, 20, 20)
            else:
                cv2.rectangle(frame, (x0, y0), (x1, y1), (85, 75, 70), -1)
                label_col = TEXT
            if name == active:
                cv2.rectangle(frame, (x0, y0), (x1, y1), (255, 255, 255), 3)
            (tw, th), _ = cv2.getTextSize(name, FONT, 0.6, 2)
            cv2.putText(frame, name, (x0 + (x1 - x0 - tw) // 2, y0 + (y1 - y0 + th) // 2),
                        FONT, 0.6, label_col, 2, cv2.LINE_AA)
            if i == hover and progress > 0:
                cv2.rectangle(frame, (x0, y1 - 6), (x0 + int((x1 - x0) * progress), y1), ACCENT, -1)


def draw_hand(frame, pts):
    for a, b in HAND_CONNECTIONS:
        cv2.line(frame, pts[a], pts[b], (200, 200, 200), 1, cv2.LINE_AA)
    for p in pts:
        cv2.circle(frame, p, 3, (60, 60, 60), -1, cv2.LINE_AA)


def draw_cursor(frame, pt, mode, color, size):
    if mode == "DRAW":
        cv2.circle(frame, pt, size // 2 + 4, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.circle(frame, pt, max(2, size // 2), color, -1, cv2.LINE_AA)
    else:
        cv2.circle(frame, pt, 14, ACCENT, 2, cv2.LINE_AA)


def draw_hud(frame, mode, fps, size, tracking, toast=None):
    h, w = frame.shape[:2]
    status = {"DRAW": "Drawing", "SELECT": "Pen up / select", "IDLE": "Idle"}[mode] if tracking else "No hand detected"
    line = f"{status}   |   Brush {size}px   |   {fps:.0f} FPS"
    cv2.rectangle(frame, (0, h - 34), (w, h), BAR_BG, -1)
    cv2.putText(frame, line, (12, h - 11), FONT, 0.6, TEXT, 1, cv2.LINE_AA)
    hint = "index: draw | index+middle: select | u undo | +/- size | c clear | s save | q quit"
    (tw, _), _ = cv2.getTextSize(hint, FONT, 0.5, 1)
    cv2.putText(frame, hint, (w - tw - 12, h - 11), FONT, 0.5, (180, 180, 180), 1, cv2.LINE_AA)
    if toast:
        (tw, th), _ = cv2.getTextSize(toast, FONT, 0.8, 2)
        cv2.putText(frame, toast, ((w - tw) // 2, h - 60), FONT, 0.8, ACCENT, 2, cv2.LINE_AA)
