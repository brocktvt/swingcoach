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
    first_name:      Optional[str]    = Field(None, max_length=50, description="Golfer's first name — used to personalise the coaching script")
    handicap:        Optional[float]  = Field(None, ge=0,  le=54,  description="Handicap index. Null = 'I don't have one'")
    rounds_per_year: Optional[int]    = Field(None, ge=0,  le=500)
    age:             Optional[int]    = Field(None, ge=5,  le=100)
    height_in:       Optional[float]  = Field(None, ge=36, le=96,  description="Height in total inches (e.g. 5'10\" = 70)")
    weight_lbs:      Optional[float]  = Field(None, ge=60, le=500)
    handedness:      Optional[str]    = Field("right", pattern="^(right|left)$")
    primary_goal:    Optional[str]    = Field(None, pattern="^(hit_further|iron_accuracy|chipping|fix_shape|consistency|scoring|putting)$")
    secondary_goal:  Optional[str]    = Field(None, pattern="^(hit_further|iron_accuracy|chipping|fix_shape|consistency|scoring|putting)$")


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
    "scottie_scheffler": {
        "match_reason": "Ultra-consistent and methodical. The world #1's repeatable fundamentals are a great model for any player focused on ball-striking reliability.",
    },
    "collin_morikawa": {
        "match_reason": "Elite iron accuracy and face control. Ideal for players who want to shape their irons and improve ball-striking precision.",
    },
    "dustin_johnson": {
        "match_reason": "Exceptional length with a powerful athletic build. Great match for tall, strong players looking to maximise distance.",
    },
    "xander_schauffele": {
        "match_reason": "Smooth, all-around swing with great tempo and dependable fade. A great all-round model for consistent ball-striking.",
    },
    "lydia_ko": {
        "match_reason": "Technically refined and highly consistent. An ideal model for accuracy-first players and anyone working on iron control.",
    },
}


def suggest_pro(
    handicap:        Optional[float],
    age:             Optional[int],
    height_in:       Optional[float],
    weight_lbs:      Optional[float],
    primary_goal:    Optional[str],
    secondary_goal:  Optional[str] = None,
) -> str:
    """
    Score each pro based on how well they match the golfer's characteristics.
    Returns the pro ID with the highest score.
    """
    scores = {pro: 0 for pro in PRO_REFERENCES}

    # ── Skill level (handicap) ────────────────────────────────────────────────
    if handicap is None or handicap > 20:          # beginner / no handicap
        scores["adam_scott"]        += 4
        scores["nelly_korda"]       += 3
        scores["lydia_ko"]          += 2
    elif handicap > 10:                             # mid-high
        scores["adam_scott"]        += 3
        scores["scottie_scheffler"] += 2
        scores["nelly_korda"]       += 2
        scores["tiger_woods"]       += 1
    elif handicap > 5:                              # mid
        scores["tiger_woods"]       += 2
        scores["scottie_scheffler"] += 2
        scores["adam_scott"]        += 1
        scores["jon_rahm"]          += 1
    else:                                           # low / scratch
        scores["rory_mcilroy"]      += 3
        scores["tiger_woods"]       += 2
        scores["scottie_scheffler"] += 2
        scores["jon_rahm"]          += 1

    # ── Height ────────────────────────────────────────────────────────────────
    if height_in:
        if height_in >= 74:          # 6'2"+
            scores["rory_mcilroy"]      += 2
            scores["dustin_johnson"]    += 3
            scores["tiger_woods"]       += 1
        elif height_in >= 71:        # 5'11"–6'2"
            scores["rory_mcilroy"]      += 1
            scores["xander_schauffele"] += 1
            scores["adam_scott"]        += 1
        elif height_in >= 68:        # 5'8"–5'11"
            scores["tiger_woods"]       += 1
            scores["scottie_scheffler"] += 1
        else:                        # under 5'8"
            scores["jon_rahm"]          += 2
            scores["nelly_korda"]       += 1
            scores["lydia_ko"]          += 1

    # ── Weight / build ────────────────────────────────────────────────────────
    if weight_lbs:
        if weight_lbs >= 220:        # heavier / more powerful build
            scores["dustin_johnson"] += 2
            scores["jon_rahm"]       += 1
        elif weight_lbs >= 185:
            scores["tiger_woods"]    += 1
            scores["jon_rahm"]       += 1
        elif weight_lbs <= 160:      # lighter / lean
            scores["rory_mcilroy"]      += 1
            scores["collin_morikawa"]   += 1
            scores["nelly_korda"]       += 1

    # ── Primary goal ──────────────────────────────────────────────────────────
    if primary_goal == "hit_further":
        scores["rory_mcilroy"]   += 3
        scores["dustin_johnson"] += 3
        scores["jon_rahm"]       += 2
        scores["tiger_woods"]    += 1
    elif primary_goal == "iron_accuracy":
        scores["collin_morikawa"]   += 4
        scores["lydia_ko"]          += 2
        scores["adam_scott"]        += 2
    elif primary_goal == "consistency":
        scores["scottie_scheffler"] += 4
        scores["nelly_korda"]       += 3
        scores["adam_scott"]        += 2
    elif primary_goal == "chipping":
        scores["tiger_woods"]    += 3
        scores["adam_scott"]     += 1
    elif primary_goal == "putting":
        scores["tiger_woods"]    += 3
        scores["lydia_ko"]       += 1
    elif primary_goal == "scoring":
        scores["tiger_woods"]       += 3
        scores["scottie_scheffler"] += 2
    elif primary_goal == "fix_shape":
        scores["collin_morikawa"]   += 3
        scores["xander_schauffele"] += 2
        scores["tiger_woods"]       += 2

    # ── Age ───────────────────────────────────────────────────────────────────
    if age:
        if age >= 55:
            scores["nelly_korda"]  += 3
            scores["lydia_ko"]     += 2
            scores["adam_scott"]   += 2
        elif age >= 40:
            scores["adam_scott"]        += 2
            scores["xander_schauffele"] += 1
            scores["nelly_korda"]       += 1
        elif age <= 28:
            scores["rory_mcilroy"]      += 1
            scores["dustin_johnson"]    += 1
            scores["jon_rahm"]          += 1

    # ── Secondary goal (half weight) ──────────────────────────────────────────
    if secondary_goal and secondary_goal != primary_goal:
        if secondary_goal == "hit_further":
            scores["rory_mcilroy"]   += 1
            scores["dustin_johnson"] += 1
            scores["jon_rahm"]       += 1
        elif secondary_goal in ("consistency", "iron_accuracy"):
            scores["scottie_scheffler"] += 1
            scores["collin_morikawa"]   += 1
            scores["adam_scott"]        += 1
            scores["nelly_korda"]       += 1
        elif secondary_goal in ("chipping", "putting"):
            scores["tiger_woods"]  += 1
        elif secondary_goal == "fix_shape":
            scores["collin_morikawa"]   += 1
            scores["xander_schauffele"] += 1

    best = max(scores, key=lambda k: scores[k])
    return best


# ── Helpers ───────────────────────────────────────────────────────────────────

def _profile_response(profile: Optional[UserProfile], suggested: str) -> dict:
    pro = PRO_REFERENCES.get(suggested, {})
    return {
        "first_name":      profile.first_name      if profile else None,
        "handicap":        profile.handicap        if profile else None,
        "rounds_per_year": profile.rounds_per_year if profile else None,
        "age":             profile.age             if profile else None,
        "height_in":       profile.height_in       if profile else None,
        "weight_lbs":      profile.weight_lbs      if profile else None,
        "handedness":      profile.handedness       if profile else "right",
        "primary_goal":    profile.primary_goal     if profile else None,
        "secondary_goal":  profile.secondary_goal   if profile else None,
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
        secondary_goal=profile.secondary_goal,
    )
    profile.suggested_pro = suggested
    profile.updated_at    = datetime.utcnow()

    await db.commit()
    await db.refresh(profile)

    return _profile_response(profile, suggested)
