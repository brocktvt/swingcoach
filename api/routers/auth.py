"""
routers/auth.py — Registration, login, JWT token issuance
"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from jose import jwt
from passlib.context import CryptContext

from models.db import get_db, User
from config import settings

router  = APIRouter(prefix="/auth", tags=["auth"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    email:    EmailStr
    password: str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user:  dict


def _hash(password: str) -> str:
    return pwd_ctx.hash(password)

def _verify(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def _create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )

def _user_dict(user: User) -> dict:
    return {
        "id":                  user.id,
        "email":               user.email,
        "subscription":        user.subscription,
        "analyses_remaining":  max(0, settings.free_analyses_per_month - user.analyses_this_month)
                               if user.subscription == "free" else None,
        "total_analyses":      user.total_analyses,
        "avg_score":           round(user.avg_score, 1) if user.avg_score else None,
        "created_at":          user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email not already taken
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="An account with that email already exists.")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=_hash(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(token=_create_token(user.id), user=_user_dict(user))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not _verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return AuthResponse(token=_create_token(user.id), user=_user_dict(user))
