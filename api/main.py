"""
main.py — SwingCoach FastAPI application entry point

Run locally:
    uvicorn main:app --reload --port 8000

Production:
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""
import traceback
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.db import create_tables
from routers.auth    import router as auth_router
from routers.analyze import router as analyze_router

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="SwingCoach API",
    description="Golf swing analysis — pose estimation + AI feedback",
    version="1.0.0",
)

# CORS — allow the mobile app and any future web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analyze_router)


@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    log.error(f"Unhandled exception on {request.url}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "trace": tb},
    )


@app.on_event("startup")
async def startup():
    await create_tables()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SwingCoach API"}


@app.get("/debug/db")
async def debug_db():
    from config import settings
    from sqlalchemy import text
    from models.db import AsyncSessionLocal
    url = settings.database_url
    scheme = url.split("://")[0] if "://" in url else "unknown"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"scheme": scheme, "connection": "ok"}
    except Exception as e:
        return {"scheme": scheme, "connection": "failed", "error": str(e)}
