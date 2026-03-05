"""
services/pose.py — MediaPipe pose extraction from swing video

Pipeline:
  1. Extract frames at key swing positions (address, takeaway, top, downswing, impact, follow-through)
  2. Run MediaPipe Pose on each frame to get 33 body landmark coordinates
  3. Calculate key angles: hip rotation, shoulder tilt, wrist hinge, spine angle, knee flex
  4. Return structured landmark data for Claude to interpret
"""
import cv2
import math
import logging
import mediapipe as mp
from pathlib import Path

log = logging.getLogger(__name__)

mp_pose = mp.solutions.pose

# Key swing phases — we sample frames at these percentages through the video
PHASE_POSITIONS = {
    "address":     0.05,   # setup / address
    "takeaway":    0.20,   # early backswing
    "top":         0.40,   # top of backswing
    "downswing":   0.60,   # transition / downswing
    "impact":      0.75,   # impact zone
    "follow_through": 0.90, # follow-through
}

# MediaPipe landmark indices
LM = mp_pose.PoseLandmark

def _angle(a, b, c) -> float:
    """
    Calculate the angle at point B formed by points A-B-C.
    Returns angle in degrees (0-180).
    """
    ax, ay = a.x - b.x, a.y - b.y
    cx, cy = c.x - b.x, c.y - b.y
    dot    = ax * cx + ay * cy
    mag    = math.sqrt(ax**2 + ay**2) * math.sqrt(cx**2 + cy**2)
    if mag == 0:
        return 0.0
    return math.degrees(math.acos(max(-1, min(1, dot / mag))))


def _extract_angles(landmarks) -> dict:
    """
    Given MediaPipe pose landmarks, calculate golf-relevant angles.
    """
    lm = landmarks.landmark

    def pt(idx):
        return lm[idx]

    try:
        return {
            # Hip rotation (horizontal angle between hips)
            "hip_rotation": round(_angle(pt(LM.LEFT_HIP), pt(LM.RIGHT_HIP), pt(LM.RIGHT_KNEE)), 1),
            # Shoulder tilt
            "shoulder_tilt": round(_angle(pt(LM.LEFT_SHOULDER), pt(LM.RIGHT_SHOULDER), pt(LM.RIGHT_HIP)), 1),
            # Trail arm angle (elbow bend at top of backswing)
            "trail_elbow": round(_angle(pt(LM.RIGHT_SHOULDER), pt(LM.RIGHT_ELBOW), pt(LM.RIGHT_WRIST)), 1),
            # Lead arm angle
            "lead_elbow": round(_angle(pt(LM.LEFT_SHOULDER), pt(LM.LEFT_ELBOW), pt(LM.LEFT_WRIST)), 1),
            # Knee flex (lead leg)
            "lead_knee": round(_angle(pt(LM.LEFT_HIP), pt(LM.LEFT_KNEE), pt(LM.LEFT_ANKLE)), 1),
            # Knee flex (trail leg)
            "trail_knee": round(_angle(pt(LM.RIGHT_HIP), pt(LM.RIGHT_KNEE), pt(LM.RIGHT_ANKLE)), 1),
            # Spine angle (hip to shoulder vertical)
            "spine_angle": round(_angle(pt(LM.LEFT_HIP), pt(LM.LEFT_SHOULDER), pt(LM.LEFT_EAR)), 1),
        }
    except Exception as e:
        log.warning(f"Angle extraction partial failure: {e}")
        return {}


def extract_pose_data(video_path: str) -> dict:
    """
    Extract pose landmarks and calculated angles from key swing phases.

    Returns:
        {
          "phases": {
            "address": { "angles": {...}, "visibility": float },
            "top":     { "angles": {...}, "visibility": float },
            ...
          },
          "frame_count": int,
          "fps": float,
          "duration_s": float,
        }
    """
    video_path = str(video_path)
    log.info(f"Extracting pose from: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps          = cap.get(cv2.CAP_PROP_FPS) or 30
    duration_s   = total_frames / fps

    result = {
        "phases":      {},
        "frame_count": total_frames,
        "fps":         round(fps, 1),
        "duration_s":  round(duration_s, 2),
    }

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        min_detection_confidence=0.5,
    ) as pose:
        for phase_name, pct in PHASE_POSITIONS.items():
            target_frame = int(total_frames * pct)
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            ok, frame = cap.read()
            if not ok:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pr  = pose.process(rgb)

            if not pr.pose_landmarks:
                log.debug(f"No pose detected at {phase_name} (frame {target_frame})")
                continue

            lm_list = pr.pose_landmarks.landmark
            avg_vis  = sum(lm.visibility for lm in lm_list) / len(lm_list)

            result["phases"][phase_name] = {
                "angles":     _extract_angles(pr.pose_landmarks),
                "visibility": round(avg_vis, 2),
            }

    cap.release()
    log.info(f"Pose extraction complete. Phases found: {list(result['phases'].keys())}")
    return result
