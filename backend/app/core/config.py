from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
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
    # "echo" answers quick-add offline (the request becomes the title). Only for the
    # end-to-end test in CI; never set it in production.
    ai_provider: Literal["groq", "echo"] = "groq"
    ai_timeout_seconds: float = 20.0
    # Shared secret for POST /internal/digest/run (GitHub Actions). Unset = endpoint disabled.
    cron_secret: SecretStr | None = None
    # Shared secret for POST /intake/email (the Gmail Apps Script). Unset = disabled.
    intake_secret: SecretStr | None = None
    rate_limit_enabled: bool = True

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg(cls, url: str) -> str:
        """Hosts like Supabase hand out `postgresql://` URLs; the app needs asyncpg."""
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url.removeprefix(prefix)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
