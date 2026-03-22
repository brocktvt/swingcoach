"""
routers/analyze.py — Swing video upload, pose analysis, Claude feedback
"""
import uuid, json, aiofiles
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
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
    video:         UploadFile = File(...),
    club_type:     str        = Form("driver"),
    pro_reference: str        = Form("rory_mcilroy"),
    user:          User       = Depends(current_user),
    db:            AsyncSession = Depends(get_db),
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
        pose_data = extract_pose_data(str(video_path))
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
            "handicap":        profile_row.handicap,
            "rounds_per_year": profile_row.rounds_per_year,
            "age":             profile_row.age,
            "height_in":       profile_row.height_in,
            "weight_lbs":      profile_row.weight_lbs,
            "handedness":      profile_row.handedness,
            "primary_goal":    profile_row.primary_goal,
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

    return _format_analysis(row, feedback)


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
        "issues":             json.loads(row.issues_json or "[]"),
        "drills":             json.loads(row.drills_json or "[]"),
        "angle_comparisons":  json.loads(row.angles_json or "[]"),
    }
    return _format_analysis(row, feedback)


# ── GET /pros ─────────────────────────────────────────────────────────────────
@router.get("/pros")
async def list_pros(club_type: str = "driver"):
    from services.feedback import PRO_REFERENCES
    return [
        {"id": pid, "name": p["name"], "note": p["style"][:80] + "…"}
        for pid, p in PRO_REFERENCES.items()
    ]


# ── Formatters ────────────────────────────────────────────────────────────────
def _format_analysis(row: Analysis, feedback: dict) -> dict:
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
