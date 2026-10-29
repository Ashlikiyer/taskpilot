from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (and backend/.env locally)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/taskpilot"
    jwt_secret: SecretStr = Field(min_length=32)
    frontend_origin: str = "http://localhost:3000"
    app_timezone: str = "Asia/Manila"
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    invite_days: int = 7
    ai_daily_limit_per_user: int = 50
    # Without a key the app still runs; AI endpoints answer 502 AI_UNAVAILABLE.
    groq_api_key: SecretStr | None = None
    ai_model: str = "openai/gpt-oss-20b"
    ai_timeout_seconds: float = 20.0
    # Shared secret for POST /internal/digest/run (GitHub Actions). Unset = endpoint disabled.
    cron_secret: SecretStr | None = None
    rate_limit_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
