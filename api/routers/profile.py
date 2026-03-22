"""
routers/profile.py — Golfer profile management

GET  /profile        → return current user's profile + suggested pro
PUT  /profile        → create or update profile, recompute suggested pro
GET  /profile/suggest → return the suggested pro for given profile data (no auth required)
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from models.db import get_db, User, UserProfile
from routers.analyze import current_user   # reuse auth dependency
from services.feedback import PRO_REFERENCES

router = APIRouter(prefix="/profile", tags=["profile"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    handicap:        Optional[float]  = Field(None, ge=0,  le=54,  description="Handicap index. Null = 'I don't have one'")
    rounds_per_year: Optional[int]    = Field(None, ge=0,  le=500)
    age:             Optional[int]    = Field(None, ge=5,  le=100)
    height_in:       Optional[float]  = Field(None, ge=36, le=96,  description="Height in total inches (e.g. 5'10\" = 70)")
    weight_lbs:      Optional[float]  = Field(None, ge=60, le=500)
    handedness:      Optional[str]    = Field("right", pattern="^(right|left)$")
    primary_goal:    Optional[str]    = Field(None, pattern="^(distance|consistency|short_game|course_management)$")


# ── Suggested-pro algorithm ───────────────────────────────────────────────────

PRO_META = {
    "rory_mcilroy": {
        "match_reason": "Tall, powerful rotational swing. Great model for distance-seekers and athletic, low-handicap players.",
    },
    "tiger_woods": {
        "match_reason": "All-around excellence — powerful hip drive with classic fundamentals. Ideal for mid-to-low handicappers wanting a complete game.",
    },
    "adam_scott": {
        "match_reason": "Textbook upright swing with perfect posture and smooth tempo. The easiest pro swing for amateurs to model.",
    },
    "jon_rahm": {
        "match_reason": "Compact backswing with explosive power through impact. Great for players who want maximum power from a controlled motion.",
    },
    "nelly_korda": {
        "match_reason": "Picture-perfect tempo and balance — a consistency-first swing that's easy on the body. Great for players of any age focused on repeatable ball-striking.",
    },
}


def suggest_pro(
    handicap:        Optional[float],
    age:             Optional[int],
    height_in:       Optional[float],
    weight_lbs:      Optional[float],
    primary_goal:    Optional[str],
) -> str:
    """
    Score each pro based on how well they match the golfer's characteristics.
    Returns the pro ID with the highest score.
    """
    scores = {pro: 0 for pro in PRO_REFERENCES}

    # ── Skill level (handicap) ────────────────────────────────────────────────
    if handicap is None or handicap > 20:          # beginner / no handicap
        scores["adam_scott"]   += 4   # most textbook, easiest fundamentals
        scores["nelly_korda"]  += 3   # smooth tempo, forgiving
    elif handicap > 10:                             # mid-high
        scores["adam_scott"]   += 3
        scores["nelly_korda"]  += 2
        scores["tiger_woods"]  += 1
    elif handicap > 5:                              # mid
        scores["tiger_woods"]  += 2
        scores["adam_scott"]   += 1
        scores["jon_rahm"]     += 1
    else:                                           # low / scratch
        scores["rory_mcilroy"] += 3
        scores["tiger_woods"]  += 2
        scores["jon_rahm"]     += 1

    # ── Height ────────────────────────────────────────────────────────────────
    if height_in:
        if height_in >= 73:          # 6'1"+
            scores["rory_mcilroy"] += 2
            scores["tiger_woods"]  += 1
        elif height_in >= 69:        # 5'9"–6'1"
            scores["adam_scott"]   += 1
            scores["tiger_woods"]  += 1
        else:                        # under 5'9"
            scores["jon_rahm"]     += 2
            scores["nelly_korda"]  += 1

    # ── Weight / build ────────────────────────────────────────────────────────
    if weight_lbs:
        if weight_lbs >= 200:        # heavier / more powerful build
            scores["jon_rahm"]     += 1
            scores["tiger_woods"]  += 1
        elif weight_lbs <= 160:      # lighter / lean
            scores["rory_mcilroy"] += 1
            scores["nelly_korda"]  += 1

    # ── Primary goal ──────────────────────────────────────────────────────────
    if primary_goal == "distance":
        scores["rory_mcilroy"] += 3
        scores["jon_rahm"]     += 2
        scores["tiger_woods"]  += 1
    elif primary_goal == "consistency":
        scores["adam_scott"]   += 3
        scores["nelly_korda"]  += 3
    elif primary_goal == "short_game":
        scores["tiger_woods"]  += 3   # Tiger's short game is legendary
        scores["adam_scott"]   += 1
    elif primary_goal == "course_management":
        scores["tiger_woods"]  += 3
        scores["adam_scott"]   += 1

    # ── Age ───────────────────────────────────────────────────────────────────
    if age:
        if age >= 55:               # smooth tempo is kinder on the body
            scores["nelly_korda"]  += 3
            scores["adam_scott"]   += 2
        elif age >= 40:
            scores["adam_scott"]   += 2
            scores["nelly_korda"]  += 1
        elif age <= 28:             # young players often want power
            scores["rory_mcilroy"] += 1
            scores["jon_rahm"]     += 1

    best = max(scores, key=lambda k: scores[k])
    return best


# ── Helpers ───────────────────────────────────────────────────────────────────

def _profile_response(profile: Optional[UserProfile], suggested: str) -> dict:
    pro = PRO_REFERENCES.get(suggested, {})
    return {
        "handicap":        profile.handicap        if profile else None,
        "rounds_per_year": profile.rounds_per_year if profile else None,
        "age":             profile.age             if profile else None,
        "height_in":       profile.height_in       if profile else None,
        "weight_lbs":      profile.weight_lbs      if profile else None,
        "handedness":      profile.handedness      if profile else "right",
        "primary_goal":    profile.primary_goal    if profile else None,
        "suggested_pro": {
            "id":           suggested,
            "name":         pro.get("name", suggested),
            "style":        pro.get("style", ""),
            "match_reason": PRO_META.get(suggested, {}).get("match_reason", ""),
        },
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def get_profile(
    user: User            = Depends(current_user),
    db:   AsyncSession    = Depends(get_db),
):
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )).scalar_one_or_none()

    suggested = profile.suggested_pro if (profile and profile.suggested_pro) else "adam_scott"
    return _profile_response(profile, suggested)


@router.put("")
async def update_profile(
    body: ProfileUpdate,
    user: User            = Depends(current_user),
    db:   AsyncSession    = Depends(get_db),
):
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )).scalar_one_or_none()

    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    # Apply updates
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    # Recompute suggested pro
    suggested = suggest_pro(
        handicap=profile.handicap,
        age=profile.age,
        height_in=profile.height_in,
        weight_lbs=profile.weight_lbs,
        primary_goal=profile.primary_goal,
    )
    profile.suggested_pro = suggested
    profile.updated_at    = datetime.utcnow()

    await db.commit()
    await db.refresh(profile)

    return _profile_response(profile, suggested)
