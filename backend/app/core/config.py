from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (and backend/.env locally)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/taskpilot"
    frontend_origin: str = "http://localhost:3000"
    app_timezone: str = "Asia/Manila"
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    ai_daily_limit_per_user: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()
