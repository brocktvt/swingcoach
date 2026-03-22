"""
services/pose.py — MediaPipe pose extraction from swing video

Pipeline:
  1. Auto-detect the actual swing window within the video (ignores walk-up/setup time)
  2. Sample 25 frames across the swing window with density clustered around impact
  3. Run MediaPipe Pose on each frame to get 33 body landmark coordinates
  4. Calculate key angles: hip rotation, shoulder tilt, wrist hinge, spine angle, knee flex
  5. Return structured data for Claude to interpret

Swing detection strategy:
  - Compute frame-to-frame motion across the video at regular intervals
  - Find the peak-motion frame (likely near impact — fastest point of the swing)
  - Search backwards from peak to find the last stable period (address position)
  - Search forwards from peak to find when motion settles (finish held)
  - Crop analysis to just that window; fall back to full video if detection fails
"""
import cv2
import math
import logging
import mediapipe as mp

log = logging.getLogger(__name__)

mp_pose = mp.solutions.pose

# ── Phase sample definitions ─────────────────────────────────────────────────
# Each tuple: (phase_name, pct_through_swing_window)
# 25 total, clustered densely around impact (most consequential zone)
# Address and finish each get 3+ frames so they can be properly analysed
PHASE_SAMPLES = [
    # Address — 3 frames; capture setup in detail
    ("address",         0.02),
    ("address",         0.06),
    ("address",         0.10),
    # Takeaway — 3 frames
    ("takeaway",        0.17),
    ("takeaway",        0.23),
    ("takeaway",        0.29),
    # Top of backswing — 3 frames
    ("top",             0.35),
    ("top",             0.40),
    ("top",             0.45),
    # Downswing — 3 frames
    ("downswing",       0.52),
    ("downswing",       0.57),
    ("downswing",       0.63),
    # Impact zone — 6 frames (densest; impact is the most critical moment)
    ("impact",          0.67),
    ("impact",          0.71),
    ("impact",          0.74),
    ("impact",          0.77),
    ("impact",          0.80),
    ("impact",          0.83),
    # Follow-through — 4 frames
    ("follow_through",  0.87),
    ("follow_through",  0.90),
    ("follow_through",  0.93),
    ("follow_through",  0.96),
    # Finish — 2 frames
    ("finish",          0.98),
    ("finish",          1.00),
]

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
            "hip_rotation":  round(_angle(pt(LM.LEFT_HIP),       pt(LM.RIGHT_HIP),      pt(LM.RIGHT_KNEE)),  1),
            # Shoulder tilt
            "shoulder_tilt": round(_angle(pt(LM.LEFT_SHOULDER),  pt(LM.RIGHT_SHOULDER), pt(LM.RIGHT_HIP)),   1),
            # Trail arm elbow angle
            "trail_elbow":   round(_angle(pt(LM.RIGHT_SHOULDER), pt(LM.RIGHT_ELBOW),    pt(LM.RIGHT_WRIST)), 1),
            # Lead arm elbow angle
            "lead_elbow":    round(_angle(pt(LM.LEFT_SHOULDER),  pt(LM.LEFT_ELBOW),     pt(LM.LEFT_WRIST)),  1),
            # Lead knee flex
            "lead_knee":     round(_angle(pt(LM.LEFT_HIP),       pt(LM.LEFT_KNEE),      pt(LM.LEFT_ANKLE)),  1),
            # Trail knee flex
            "trail_knee":    round(_angle(pt(LM.RIGHT_HIP),      pt(LM.RIGHT_KNEE),     pt(LM.RIGHT_ANKLE)), 1),
            # Spine angle (hip to shoulder to ear)
            "spine_angle":   round(_angle(pt(LM.LEFT_HIP),       pt(LM.LEFT_SHOULDER),  pt(LM.LEFT_EAR)),    1),
        }
    except Exception as e:
        log.warning(f"Angle extraction partial failure: {e}")
        return {}


def _compute_motion_scores(cap, total_frames: int, sample_every: int):
    """
    Compute frame-to-frame motion (mean pixel diff) at regular intervals.
    Returns (frame_indices, motion_scores) — both same length.
    Rewinds cap back to frame 0 when done.
    """
    frame_indices = []
    motion_scores = []
    prev_gray = None

    for frame_idx in range(0, total_frames, sample_every):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ok, frame = cap.read()
        if not ok:
            break

        # Downsample for speed before computing diff
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (160, 90))

        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            motion_scores.append(float(diff.mean()))
            frame_indices.append(frame_idx)

        prev_gray = gray

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    return frame_indices, motion_scores


def detect_swing_window(cap, total_frames: int, fps: float):
    """
    Auto-detect the actual swing window within the video.

    Strategy:
    - Find the PEAK motion frame (likely near impact — fastest point of the swing)
    - Scan backwards to find address: last stable (low-motion) frame before peak
    - Scan forwards to find finish: first stable frame after peak
    - Add small buffers on each side

    Returns (start_frame, end_frame).
    Falls back to (0, total_frames-1) if detection confidence is low.
    """
    if total_frames < 10:
        return 0, total_frames - 1

    # Sample ~6 frames/second (e.g. every 5 frames at 30fps)
    sample_every = max(1, int(fps / 6))
    frame_indices, motion_scores = _compute_motion_scores(cap, total_frames, sample_every)

    if len(motion_scores) < 4:
        log.warning("Too few motion samples — using full video")
        return 0, total_frames - 1

    max_motion = max(motion_scores)
    if max_motion < 1.0:
        log.warning("Very low motion throughout — using full video")
        return 0, total_frames - 1

    # Normalise to [0, 1]
    norm = [s / max_motion for s in motion_scores]

    # Find the global peak (impact)
    peak_idx   = norm.index(max(norm))
    peak_frame = frame_indices[peak_idx]

    STABLE   = 0.12   # < 12% of max = stable (address hold / finish hold)
    MODERATE = 0.25   # < 25% = swing is winding down

    # Scan backwards from peak → find address (last stable period before peak)
    start_frame = 0
    for i in range(peak_idx - 1, -1, -1):
        if norm[i] <= STABLE:
            start_frame = max(0, frame_indices[i] - int(fps * 0.25))
            break

    # Scan forwards from peak → find finish (consecutive stable frames after peak)
    end_frame = total_frames - 1
    consecutive_stable = 0
    for i in range(peak_idx + 1, len(frame_indices)):
        if norm[i] <= MODERATE:
            consecutive_stable += 1
        else:
            consecutive_stable = 0
        if consecutive_stable >= 2:
            end_frame = min(total_frames - 1, frame_indices[i] + int(fps * 0.3))
            break

    window_s = (end_frame - start_frame) / fps
    log.info(
        f"Swing window: frames {start_frame}–{end_frame} "
        f"({window_s:.1f}s), peak at frame {peak_frame}"
    )

    # Sanity check: a real golf swing + address + finish is 1.5–12 seconds
    if window_s < 0.8 or window_s > 12.0:
        log.warning(f"Detected window ({window_s:.1f}s) out of expected range — using full video")
        return 0, total_frames - 1

    return start_frame, end_frame


def extract_pose_data(video_path: str) -> dict:
    """
    Extract pose landmarks and angles from 25 frames across the detected swing window.

    Returns:
        {
          "frames": [
            {
              "phase":      "address",
              "sample":     1,       # 1-based sample within this phase
              "pct":        0.02,    # % through detected swing window
              "angles":     { hip_rotation, shoulder_tilt, ... },
              "visibility": float,
            },
            ...  (up to 25 entries)
          ],
          "phases_summary": {        # best-visibility frame per named phase (for angle_comparisons)
            "address":       { angles, visibility },
            "takeaway":      { angles, visibility },
            ...
          },
          "frame_count":   int,
          "fps":           float,
          "duration_s":    float,
          "swing_start_s": float,
          "swing_end_s":   float,
          "swing_detected": bool,
        }
    """
    video_path = str(video_path)
    log.info(f"Extracting pose from: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
    duration_s   = total_frames / fps

    # ── Step 1: Detect swing window ───────────────────────────────────────────
    swing_start, swing_end = detect_swing_window(cap, total_frames, fps)
    swing_detected = not (swing_start == 0 and swing_end == total_frames - 1)
    swing_length   = max(1, swing_end - swing_start)

    result = {
        "frames":         [],
        "phases_summary": {},
        "frame_count":    total_frames,
        "fps":            round(fps, 1),
        "duration_s":     round(duration_s, 2),
        "swing_start_s":  round(swing_start / fps, 2),
        "swing_end_s":    round(swing_end / fps, 2),
        "swing_detected": swing_detected,
    }

    # ── Step 2: Sample 25 frames within the window ────────────────────────────
    phase_counters = {}   # sample count per phase name
    phase_best     = {}   # best-visibility entry per phase name

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        min_detection_confidence=0.5,
    ) as pose:
        for phase_name, pct in PHASE_SAMPLES:
            target_frame = int(swing_start + swing_length * pct)
            target_frame = max(0, min(total_frames - 1, target_frame))

            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            ok, frame = cap.read()
            if not ok:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pr  = pose.process(rgb)

            if not pr.pose_landmarks:
                log.debug(f"No pose at {phase_name} pct={pct:.2f} frame={target_frame}")
                continue

            lm_list  = pr.pose_landmarks.landmark
            avg_vis  = sum(lm.visibility for lm in lm_list) / len(lm_list)
            angles   = _extract_angles(pr.pose_landmarks)

            phase_counters[phase_name] = phase_counters.get(phase_name, 0) + 1

            result["frames"].append({
                "phase":      phase_name,
                "sample":     phase_counters[phase_name],
                "pct":        round(pct, 2),
                "angles":     angles,
                "visibility": round(avg_vis, 2),
            })

            # Track best-visibility frame per phase for angle_comparisons
            if phase_name not in phase_best or avg_vis > phase_best[phase_name]["visibility"]:
                phase_best[phase_name] = {"angles": angles, "visibility": round(avg_vis, 2)}

    cap.release()
    result["phases_summary"] = phase_best

    log.info(
        f"Pose extraction complete: {len(result['frames'])} frames, "
        f"phases: {list(phase_best.keys())}"
    )
    return result
