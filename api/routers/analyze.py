"""
routers/analyze.py — Swing video upload, pose analysis, Claude feedback
"""
import uuid, json, aiofiles, io, tempfile, asyncio
from datetime import datetime
from pathlib import Path
from functools import lru_cache
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from models.db import get_db, User, Analysis, UserProfile
from services.pose import extract_pose_data
from services.feedback import generate_feedback, PRO_REFERENCES
from config import settings

router  = APIRouter(tags=["analysis"])
bearer  = HTTPBearer()
UPLOAD  = Path(settings.upload_dir)
UPLOAD.mkdir(parents=True, exist_ok=True)


# ── Auth dependency ───────────────────────────────────────────────────────────
async def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db:    AsyncSession                 = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(creds.credentials, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


# ── Helper: check & decrement monthly limit ───────────────────────────────────
def _check_limit(user: User):
    if user.subscription == "pro":
        return  # unlimited

    now = datetime.utcnow()
    # Reset counter if it's a new month
    if not user.month_reset_at or user.month_reset_at.month != now.month:
        user.analyses_this_month = 0
        user.month_reset_at = now

    if user.analyses_this_month >= settings.free_analyses_per_month:
        raise HTTPException(
            status_code=402,
            detail=f"Monthly limit of {settings.free_analyses_per_month} analyses reached. Upgrade to Pro for unlimited analyses."
        )


# ── POST /analyze ─────────────────────────────────────────────────────────────
@router.post("/analyze")
async def analyze_swing(
    video:         UploadFile      = File(...),
    club_type:     str             = Form("driver"),
    pro_reference: str             = Form("rory_mcilroy"),
    trim_start_s:  Optional[float] = Form(None),
    trim_end_s:    Optional[float] = Form(None),
    user:          User            = Depends(current_user),
    db:            AsyncSession    = Depends(get_db),
):
    _check_limit(user)

    # Validate inputs
    valid_clubs = {"driver", "iron", "wedge", "putter"}
    if club_type not in valid_clubs:
        raise HTTPException(status_code=400, detail=f"club_type must be one of: {valid_clubs}")
    if pro_reference not in PRO_REFERENCES:
        raise HTTPException(status_code=400, detail=f"Unknown pro reference: {pro_reference}")

    # Save video to disk
    analysis_id = str(uuid.uuid4())
    video_path  = UPLOAD / f"{analysis_id}.mp4"
    async with aiofiles.open(video_path, "wb") as f:
        while chunk := await video.read(1024 * 1024):  # 1MB chunks
            await f.write(chunk)

    # Run pose extraction
    try:
        pose_data = extract_pose_data(
            str(video_path),
            trim_start_s=trim_start_s,
            trim_end_s=trim_end_s,
            pro_id=pro_reference,
        )
    except Exception as e:
        video_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Could not process video: {e}")

    if not pose_data.get("frames") and not pose_data.get("phases_summary"):
        video_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail="No golfer detected in the video. Make sure the full body is visible and well-lit."
        )

    # Load golfer profile for personalised feedback (optional — analysis still works without it)
    profile_row = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )).scalar_one_or_none()

    profile_dict = None
    if profile_row:
        profile_dict = {
            "first_name":      profile_row.first_name,
            "handicap":        profile_row.handicap,
            "rounds_per_year": profile_row.rounds_per_year,
            "age":             profile_row.age,
            "height_in":       profile_row.height_in,
            "weight_lbs":      profile_row.weight_lbs,
            "handedness":      profile_row.handedness,
            "primary_goal":    profile_row.primary_goal,
            "secondary_goal":  profile_row.secondary_goal,
        }

    # Get Claude feedback
    try:
        feedback = await generate_feedback(pose_data, pro_reference, club_type, profile_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback generation failed: {e}")

    pro = PRO_REFERENCES[pro_reference]

    # Save to DB
    row = Analysis(
        id=analysis_id,
        user_id=user.id,
        club_type=club_type,
        pro_reference=pro_reference,
        pro_name=pro["name"],
        overall_score=feedback["overall_score"],
        summary=feedback.get("summary", ""),
        positives_json=json.dumps(feedback.get("positives", [])),
        issues_json=json.dumps(feedback.get("issues", [])),
        drills_json=json.dumps(feedback.get("drills", [])),
        angles_json=json.dumps(feedback.get("angle_comparisons", [])),
        coaching_script=feedback.get("coaching_script", ""),
        video_path=str(video_path),
        swing_frames_json=json.dumps(pose_data.get("phase_frame_indices", {})),
        phase_images_json=json.dumps(pose_data.get("phase_images", {})),
        issue_count=len(feedback.get("issues", [])),
        drill_count=len(feedback.get("drills", [])),
    )
    db.add(row)

    # Update user stats
    user.analyses_this_month += 1
    user.total_analyses      += 1
    all_scores = [row.overall_score]
    if user.avg_score:
        # Rolling average
        n = user.total_analyses
        user.avg_score = ((user.avg_score * (n - 1)) + row.overall_score) / n
    else:
        user.avg_score = row.overall_score

    await db.commit()

    # Pass annotated frame images from pose extraction (not stored in DB — generated fresh each time)
    phase_images = pose_data.get("phase_images", {})
    return _format_analysis(row, feedback, phase_images)


# ── GET /analyses ─────────────────────────────────────────────────────────────
@router.get("/analyses")
async def list_analyses(
    limit: int  = 20,
    user:  User = Depends(current_user),
    db:    AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
    )).scalars().all()

    return {
        "analyses": [_format_analysis_summary(r) for r in rows],
        "total":    len(rows),
    }


# ── GET /analyses/{id} ────────────────────────────────────────────────────────
@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    user:        User = Depends(current_user),
    db:          AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    feedback = {
        "overall_score":      row.overall_score,
        "summary":            row.summary,
        "positives":          json.loads(row.positives_json or "[]"),
        "issues":             json.loads(row.issues_json or "[]"),
        "drills":             json.loads(row.drills_json or "[]"),
        "angle_comparisons":  json.loads(row.angles_json or "[]"),
        "coaching_script":    row.coaching_script or "",
    }
    phase_images = json.loads(row.phase_images_json or "{}")
    return _format_analysis(row, feedback, phase_images)


# ── GET /pros ─────────────────────────────────────────────────────────────────
@router.get("/pros")
async def list_pros(club_type: str = "driver"):
    from services.feedback import PRO_REFERENCES
    return [
        {"id": pid, "name": p["name"], "note": p["style"][:80] + "…"}
        for pid, p in PRO_REFERENCES.items()
    ]


# ── DELETE /analyses/{id} ─────────────────────────────────────────────────────
@router.delete("/analyses/{analysis_id}", status_code=204)
async def delete_analysis(
    analysis_id: str,
    user:        User = Depends(current_user),
    db:          AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    # Remove video file from disk
    if row.video_path:
        Path(row.video_path).unlink(missing_ok=True)

    # Evict any cached clips for this analysis
    for key in list(_clip_cache.keys()):
        if key.startswith(f"{analysis_id}:"):
            del _clip_cache[key]

    await db.delete(row)
    await db.commit()


# ── GET /analyses/{id}/clip/{phase_name} ─────────────────────────────────────
# Lazy video clip extraction.  Auth via ?token= query param so expo-video can
# fetch the URL directly (it doesn't support custom request headers).
# Clips are extracted on first request and cached in-memory (per process).

_clip_cache: dict[str, bytes] = {}   # key: "{analysis_id}:{phase_name}"


def _extract_clip_bytes(video_path: str, center_frame: int, fps: float,
                        duration_s: float = 2.0) -> bytes:
    """
    Extract a short MP4 clip centred on `center_frame` from `video_path`.
    Returns raw MP4 bytes.
    """
    import cv2

    half = int(fps * duration_s / 2)
    start = max(0, center_frame - half)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    end   = min(total - 1, center_frame + half)
    w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Write to a temp file; cv2 VideoWriter needs a file path
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out    = cv2.VideoWriter(tmp_path, fourcc, fps, (w, h))

    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    for _ in range(end - start + 1):
        ok, frame = cap.read()
        if not ok:
            break
        out.write(frame)

    cap.release()
    out.release()

    data = Path(tmp_path).read_bytes()
    Path(tmp_path).unlink(missing_ok=True)
    return data


@router.get("/analyses/{analysis_id}/clip/{phase_name}")
async def get_phase_clip(
    analysis_id: str,
    phase_name:  str,
    token:       str = Query(..., description="JWT access token"),
    request:     Request = None,
    db:          AsyncSession = Depends(get_db),
):
    # Verify token manually (no Bearer header — expo-video fetches plain URLs)
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    row = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if not row.video_path or not Path(row.video_path).exists():
        raise HTTPException(status_code=404, detail="Source video not available.")

    frame_indices = json.loads(row.swing_frames_json or "{}")
    if phase_name not in frame_indices:
        raise HTTPException(status_code=404, detail=f"No frame data for phase: {phase_name}")

    cache_key = f"{analysis_id}:{phase_name}"
    if cache_key not in _clip_cache:
        import cv2
        cap = cv2.VideoCapture(row.video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        cap.release()

        # Run blocking extraction in a thread so we don't block the event loop
        clip_bytes = await asyncio.get_event_loop().run_in_executor(
            None,
            _extract_clip_bytes,
            row.video_path,
            frame_indices[phase_name],
            fps,
            2.0,
        )
        _clip_cache[cache_key] = clip_bytes

    data  = _clip_cache[cache_key]
    total = len(data)

    # iOS AVPlayer always sends a Range header and requires 206 Partial Content.
    # Returning 200 OK causes AVPlayer to silently reject the stream.
    range_header = request.headers.get("range") if request else None
    if range_header:
        try:
            range_val = range_header.replace("bytes=", "").strip()
            parts     = range_val.split("-")
            start     = int(parts[0]) if parts[0] else 0
            end       = int(parts[1]) if len(parts) > 1 and parts[1] else total - 1
        except (ValueError, IndexError):
            start, end = 0, total - 1
        end   = min(end, total - 1)
        chunk = data[start : end + 1]
        return Response(
            chunk,
            status_code=206,
            media_type="video/mp4",
            headers={
                "Content-Range":  f"bytes {start}-{end}/{total}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(len(chunk)),
                "Cache-Control":  "private, max-age=3600",
            },
        )

    # No Range header — return full video
    return Response(
        data,
        status_code=200,
        media_type="video/mp4",
        headers={
            "Content-Length": str(total),
            "Accept-Ranges":  "bytes",
            "Cache-Control":  "private, max-age=3600",
        },
    )


# ── Formatters ────────────────────────────────────────────────────────────────
def _format_analysis(row: Analysis, feedback: dict, phase_images: dict = None) -> dict:
    return {
        "id":                  row.id,
        "club_type":           row.club_type,
        "pro_name":            row.pro_name,
        "overall_score":       feedback["overall_score"],
        "summary":             feedback.get("summary"),
        "positives":           feedback.get("positives", []),
        "issues":              feedback.get("issues", []),
        "drills":              feedback.get("drills", []),
        "angle_comparisons":   feedback.get("angle_comparisons", []),
        "coaching_script":     feedback.get("coaching_script", ""),
        "phase_images":        phase_images or {},   # base64 JPEG per phase name
        "issue_count":         row.issue_count,
        "drill_count":         row.drill_count,
        "created_at":          row.created_at.isoformat(),
    }

def _format_analysis_summary(row: Analysis) -> dict:
    return {
        "id":            row.id,
        "club_type":     row.club_type,
        "pro_name":      row.pro_name,
        "overall_score": row.overall_score,
        "issue_count":   row.issue_count,
        "drill_count":   row.drill_count,
        "created_at":    row.created_at.isoformat(),
    }
