# camera.py
import sys
import threading
import time

import cv2


class Camera:
    """Webcam reader that always serves the newest frame.

    Grabbing runs on its own thread so slow hand-tracking never causes the
    driver buffer to fill up (which shows up as laggy, out-of-date video).
    Requests MJPG at 640x480/30fps, which most webcams only deliver in that mode.
    """

    def __init__(self, index=0, width=1280, height=720, fps=50):
        backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY
        self.cap = cv2.VideoCapture(index, backend)
        if not self.cap.isOpened():
            raise RuntimeError(f"Could not open camera {index}. Is it in use by another app?")

        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)

        # The camera may not honour the request; use whatever it actually gives.
        ok, frame = self.cap.read()
        if not ok:
            self.cap.release()
            raise RuntimeError("Camera opened but returned no frames.")
        self.height, self.width = frame.shape[:2]

        self._frame = frame
        self._seq = 0
        self._lock = threading.Lock()
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        while self._running:
            ok, frame = self.cap.read()
            if not ok:
                time.sleep(0.01)
                continue
            with self._lock:
                self._frame = frame
                self._seq += 1

    def read(self, last_seq=-1, timeout=1.0):
        """Return (seq, frame) once a frame newer than last_seq is available."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self._lock:
                if self._seq != last_seq:
                    return self._seq, self._frame.copy()
            time.sleep(0.002)
        return last_seq, None

    def release(self):
        self._running = False
        self._thread.join(timeout=1.0)
        self.cap.release()
