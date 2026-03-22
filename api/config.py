"""
config.py — SwingCoach API configuration
Copy .env.example to .env and fill in your values.
"""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Auth
    secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    algorithm: str  = "HS256"
    token_expire_minutes: int = 60 * 24 * 30  # 30 days

    # Anthropic
    anthropic_api_key: str = ""

    # Storage (local for dev, swap for S3/R2 in prod)
    upload_dir: str = "./uploads"

    # Free tier limits
    free_analyses_per_month: int = 5

    # DB
    database_url: str = "sqlite+aiosqlite:///./swingcoach.db"

    class Config:
        env_file = ".env"

settings = Settings()

# Railway sets DATABASE_URL as postgresql:// but SQLAlchemy async needs postgresql+asyncpg://
if settings.database_url.startswith("postgresql://"):
    settings.database_url = settings.database_url.replace(
        "postgresql://", "postgresql+asyncpg://", 1
    )
