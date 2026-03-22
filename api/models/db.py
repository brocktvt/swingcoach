"""
models/db.py — SQLAlchemy database models
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from config import settings

Base = declarative_base()
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


class User(Base):
    __tablename__ = "users"

    id                  = Column(String, primary_key=True)
    email               = Column(String, unique=True, nullable=False, index=True)
    hashed_password     = Column(String, nullable=False)
    subscription        = Column(String, default="free")   # "free" | "pro"
    sub_expires_at      = Column(DateTime, nullable=True)
    analyses_this_month = Column(Integer, default=0)
    month_reset_at      = Column(DateTime, nullable=True)
    total_analyses      = Column(Integer, default=0)
    avg_score           = Column(Float, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)

    analyses = relationship("Analysis", back_populates="user")
    profile  = relationship("UserProfile", back_populates="user", uselist=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id         = Column(String, ForeignKey("users.id"), primary_key=True)
    handicap        = Column(Float,   nullable=True)   # None = "I don't have one"
    rounds_per_year = Column(Integer, nullable=True)
    age             = Column(Integer, nullable=True)
    height_in       = Column(Float,   nullable=True)   # total inches (e.g. 5'10" = 70)
    weight_lbs      = Column(Float,   nullable=True)
    handedness      = Column(String,  default="right") # "right" | "left"
    primary_goal    = Column(String,  nullable=True)   # see GOAL_VALUES in profile.py
    secondary_goal  = Column(String,  nullable=True)   # optional second priority
    suggested_pro   = Column(String,  nullable=True)   # computed on save
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class Analysis(Base):
    __tablename__ = "analyses"

    id            = Column(String, primary_key=True)
    user_id       = Column(String, ForeignKey("users.id"), nullable=False)
    club_type     = Column(String, nullable=False)   # driver | iron | wedge | putter
    pro_reference = Column(String, nullable=False)   # pro ID
    pro_name      = Column(String, nullable=False)
    overall_score = Column(Integer, nullable=True)
    summary       = Column(Text, nullable=True)
    positives_json  = Column(Text, nullable=True)    # JSON array
    issues_json     = Column(Text, nullable=True)    # JSON array
    drills_json     = Column(Text, nullable=True)    # JSON array
    angles_json     = Column(Text, nullable=True)    # JSON array
    coaching_script = Column(Text, nullable=True)    # spoken coaching text
    video_path    = Column(String, nullable=True)
    issue_count   = Column(Integer, default=0)
    drill_count   = Column(Integer, default=0)
    created_at    = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="analyses")
