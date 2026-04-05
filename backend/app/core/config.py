from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI Wardrobe Planner"
    backend_cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]
    database_url: str = "postgresql://user:password@localhost:5432/ai_wardrobe"
    secret_key: str = "change-this-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    openai_api_key: str = ""
    weather_api_key: str = ""
    resend_api_key: str = ""
    email_from: str = "onboarding@resend.dev"
    public_backend_url: str = "http://localhost:8000"
    openai_rate_limit_window_seconds: int = 300
    openai_upload_rate_limit: int = 8
    openai_recommendation_rate_limit: int = 12
    enable_recaptcha: bool = False
    recaptcha_secret_key: str = ""
    recaptcha_min_score: float = 0.5

    class Config:
        env_file = Path(__file__).resolve().parents[2] / ".env"
        env_file_encoding = "utf-8"


settings = Settings()
