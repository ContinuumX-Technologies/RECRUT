import sys
import json
import os
import argparse
import traceback
from typing import Any, Dict, List, Optional, Tuple, Set
from collections import deque

import cv2
import numpy as np
import mediapipe as mp
from ultralytics import YOLO

# -----------------------------
# Optional face recognition
# -----------------------------
try:
    import face_recognition  # type: ignore
    FACE_REC_AVAILABLE = True
except ImportError:
    FACE_REC_AVAILABLE = False
    print("[WARNING] face_recognition not available.", file=sys.stderr)

# Redirect stdout → stderr (JSON only on original stdout)
original_stdout = sys.stdout
sys.stdout = sys.stderr

# -----------------------------
# Configuration (env overridable)
# -----------------------------
CONF_THRESHOLD = float(os.getenv("PROCTOR_CONF_THRESHOLD", "0.25"))
GAZE_THRESHOLD_X = float(os.getenv("PROCTOR_GAZE_THRESHOLD_X", "10"))
GAZE_THRESHOLD_Y = float(os.getenv("PROCTOR_GAZE_THRESHOLD_Y", "8"))
MOUTH_OPEN_THRESHOLD = float(os.getenv("PROCTOR_MOUTH_THRESHOLD", "0.3"))
SAMPLE_EVERY = int(os.getenv("PROCTOR_SAMPLE_EVERY", "5"))
FACE_MISMATCH_THRESHOLD = float(os.getenv("PROCTOR_FACE_MISMATCH_THRESHOLD", "0.2"))

GAZE_WINDOW = 30   # temporal window
REFLECTION_THRESHOLD = 220

# -----------------------------
# CLI
# -----------------------------
def get_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser("Video Proctoring Analysis")
    parser.add_argument("video_path")
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--reference", help="Reference face image")
    return parser.parse_args()

# -----------------------------
# Geometry helpers
# -----------------------------
def get_head_pose(landmarks, w, h) -> Tuple[float, float]:
    key_points = [1, 152, 33, 263, 61, 291]
    face_2d, face_3d = [], []

    for i in key_points:
        lm = landmarks[i]
        x, y = int(lm.x * w), int(lm.y * h)
        face_2d.append([x, y])
        face_3d.append([x, y, lm.z])

    face_2d = np.array(face_2d, np.float64)
    face_3d = np.array(face_3d, np.float64)

    cam = np.array([[w, 0, w/2], [0, w, h/2], [0, 0, 1]])
    dist = np.zeros((4, 1))

    ok, rot, _ = cv2.solvePnP(face_3d, face_2d, cam, dist)
    if not ok:
        return 0.0, 0.0

    rmat, _ = cv2.Rodrigues(rot)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    return angles[0]*360, angles[1]*360

def get_mouth_ratio(landmarks) -> float:
    v = abs(landmarks[13].y - landmarks[14].y)
    h = abs(landmarks[78].x - landmarks[308].x)
    return v / h if h > 0 else 0.0

def eye_aspect_ratio(landmarks) -> float:
    top = landmarks[159].y
    bottom = landmarks[145].y
    left = landmarks[33].x
    right = landmarks[133].x
    return abs(top-bottom)/abs(right-left) if right-left != 0 else 0.0

def eye_reflection_score(frame, landmarks, w, h) -> float:
    iris = landmarks[468]
    x, y = int(iris.x*w), int(iris.y*h)
    crop = frame[max(0,y-8):y+8, max(0,x-8):x+8]
    return float(np.mean(crop)) if crop.size else 0.0

def infer_eye_intent(buf) -> str:
    if len(buf["yaw"]) < 10:
        return "insufficient_data"

    yaw_var = np.var(buf["yaw"])
    gaze_var = np.var(buf["gaze_x"])
    blink_rate = sum(buf["blink"]) / len(buf["blink"])

    if gaze_var < 0.0005 and blink_rate < 0.05:
        return "memorized_answer"
    if gaze_var > 0.005 and blink_rate > 0.2:
        return "confusion"
    if yaw_var < 2 and blink_rate < 0.1:
        return "confidence"
    if gaze_var > 0.003:
        return "reading_or_searching"
    return "neutral"

def load_reference_face(path) -> Optional[np.ndarray]:
    if not FACE_REC_AVAILABLE or not path or not os.path.exists(path):
        return None
    img = face_recognition.load_image_file(path)
    enc = face_recognition.face_encodings(img)
    return enc[0] if enc else None

# -----------------------------
# MAIN
# -----------------------------
def process_video():
    args = get_args()
    known_face = load_reference_face(args.reference)

    yolo = YOLO(args.model)
    face_mesh = mp.solutions.face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        raise RuntimeError("Cannot open video")

    stats = {
        "processed_frames": 0,
        "looking_away": 0,
        "talking": 0,
        "phone": 0,
        "multi_face": 0,
        "face_mismatch": 0,
        "reflection_hits": 0,
        "hand_motion": 0,
        "forbidden_objects": set()
    }

    intent_buf = {
        "yaw": deque(maxlen=GAZE_WINDOW),
        "pitch": deque(maxlen=GAZE_WINDOW),
        "blink": deque(maxlen=GAZE_WINDOW),
        "gaze_x": deque(maxlen=GAZE_WINDOW),
    }

    prev_gray = None
    frame_idx = 0

    TARGET = {0:"person",67:"cell phone",63:"laptop",73:"book",62:"tv"}

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame_idx += 1
        if frame_idx % SAMPLE_EVERY != 0:
            continue

        stats["processed_frames"] += 1
        h, w, _ = frame.shape

        # ---- YOLO ----
        res = yolo.predict(frame, conf=CONF_THRESHOLD, verbose=False)[0]
        persons = 0
        for b in res.boxes:
            name = TARGET.get(int(b.cls[0]))
            if name == "person":
                persons += 1
            elif name == "cell phone":
                stats["phone"] += 1
            elif name:
                stats["forbidden_objects"].add(name)

        if persons > 1:
            stats["multi_face"] += 1

        # ---- Mediapipe ----
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_res = face_mesh.process(rgb)

        if mp_res.multi_face_landmarks:
            lm = mp_res.multi_face_landmarks[0].landmark
            pitch, yaw = get_head_pose(lm, w, h)
            if abs(yaw) > GAZE_THRESHOLD_X or abs(pitch) > GAZE_THRESHOLD_Y:
                stats["looking_away"] += 1

            if get_mouth_ratio(lm) > MOUTH_OPEN_THRESHOLD:
                stats["talking"] += 1

            blink = 1 if eye_aspect_ratio(lm) < 0.18 else 0
            intent_buf["yaw"].append(yaw)
            intent_buf["pitch"].append(pitch)
            intent_buf["blink"].append(blink)
            intent_buf["gaze_x"].append(lm[1].x)

            if eye_reflection_score(frame, lm, w, h) > REFLECTION_THRESHOLD:
                stats["reflection_hits"] += 1

        # ---- Optical Flow (AirSpace) ----
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5,3,15,3,5,1.2,0)
            mag,_ = cv2.cartToPolar(flow[...,0], flow[...,1])
            edge_motion = np.mean(mag[:, :40]) + np.mean(mag[:, -40:])
            if edge_motion > 2.5:
                stats["hand_motion"] += 1
        prev_gray = gray

    cap.release()
    face_mesh.close()

    total = stats["processed_frames"]
    eye_intent = infer_eye_intent(intent_buf)

    summary = {
        "frames": total,
        "eye_intent": eye_intent,
        "forbidden_objects": list(stats["forbidden_objects"]),
        "ratios": {
            "looking_away": stats["looking_away"]/total,
            "talking": stats["talking"]/total,
            "phone": stats["phone"]/total,
            "multi_face": stats["multi_face"]/total,
            "hand_motion": stats["hand_motion"]/total,
            "reflection": stats["reflection_hits"]/total,
        }
    }

    events = []

    def ev(t,m,l="warning"):
        events.append({"type":t,"payload":{"level":l,"message":m,"summary":summary}})

    if summary["ratios"]["phone"] > 0.05:
        ev("proctor_phone","Phone detected","critical")
    if summary["ratios"]["multi_face"] > 0.1:
        ev("proctor_multiple_people","Multiple people detected","critical")
    if summary["ratios"]["reflection"] > 0.05:
        ev("proctor_reflection","Suspicious reflections detected","warning")
    if summary["ratios"]["hand_motion"] > 0.1:
        ev("proctor_airspace","Out-of-frame hand activity","warning")
    if eye_intent in ("memorized_answer","reading_or_searching"):
        ev("proctor_eye_intent",f"Eye intent: {eye_intent}","info")

    original_stdout.write(json.dumps({"summary":summary,"events":events}))
    original_stdout.flush()

# -----------------------------
# Entry
# -----------------------------
if __name__ == "__main__":
    try:
        process_video()
    except Exception as e:
        original_stdout.write(json.dumps({
            "error": str(e),
            "trace": traceback.format_exc()
        }))
        sys.exit(1)