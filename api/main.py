"""
main.py — SwingCoach FastAPI application entry point

Run locally:
    uvicorn main:app --reload --port 8000

Production:
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.db import create_tables
from routers.auth    import router as auth_router
from routers.analyze import router as analyze_router

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


@app.on_event("startup")
async def startup():
    await create_tables()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SwingCoach API"}
