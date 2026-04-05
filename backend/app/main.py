from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.core.config import settings
from app.routers.health import router as health_router
from app.routers.analyze import router as analyze_router
from app.routers.weather_forecast import router as weather_router
from app.routers.recommendations import router as recommendations_router
from app.routers.upload import router as upload_router

app = FastAPI(
    title="Amazing Wardrobe Planner API",
    description="Backend API for the Amazing Wardrobe Planner MVP.",
    version="0.8.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory for uploads
upload_dir = Path(__file__).resolve().parents[1] / "uploads"
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(upload_router, prefix="", tags=["upload"])
app.include_router(analyze_router, prefix="", tags=["clothes"])
app.include_router(weather_router, prefix="/weather", tags=["weather"])
app.include_router(recommendations_router, prefix="/recommendations", tags=["recommendations"])


@app.get("/")
def root():
    return {"message": "Amazing Wardrobe Planner backend is running."}
