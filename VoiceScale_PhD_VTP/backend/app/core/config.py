"""
VoiceCare PHC - Backend Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "LungLens"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # MongoDB (default to local instance; configure Atlas URL in .env)
    MONGODB_URL: str = "mongodb://localhost:27017/voicecare"
    MONGODB_DB_NAME: str = "voicecare"

    # JWT
    JWT_SECRET_KEY: str = "voicecare-phc-super-secret-jwt-key-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Colab GPU API (set this after starting the Colab notebook)
    # Example: VOICE_API_URL=https://abc123.ngrok-free.app
    VOICE_API_URL: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
