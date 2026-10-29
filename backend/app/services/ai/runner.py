"""Shared plumbing for every AI feature: daily limit, JSON validation with one
retry, and an `ai_usage` row for each call.

AI only proposes. Output is validated here with Pydantic and treated as untrusted
data afterwards (features check every id against the database).
"""

import logging
import time
import uuid
from datetime import UTC, datetime
from datetime import time as day_start
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import AIUsage, User
from app.repositories import ai_usage as ai_usage_repo
from app.services.ai.provider import AIProvider, Message, ProviderError
from app.services.dates import user_today

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2  # the first try plus one retry with the validation error


def ai_unavailable() -> AppError:
    return AppError(
        502, "AI_UNAVAILABLE", "The AI assistant isn't available right now. Please try again."
    )


async def _check_daily_limit(db: AsyncSession, user: User) -> None:
    settings = get_settings()
    zone = settings.app_timezone
    midnight = datetime.combine(user_today(zone), day_start(0), tzinfo=ZoneInfo(zone))
    used = await ai_usage_repo.count_since(db, user.id, midnight.astimezone(UTC))
    if used >= settings.ai_daily_limit_per_user:
        raise AppError(
            429,
            "AI_DAILY_LIMIT",
            f"You've used all {settings.ai_daily_limit_per_user} AI requests for today. "
            "The limit resets at midnight (Manila time).",
        )


async def _log(
    db: AsyncSession,
    *,
    user: User,
    workspace_id: uuid.UUID | None,
    feature: str,
    model: str,
    started: float,
    success: bool,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> None:
    await ai_usage_repo.add(
        db,
        AIUsage(
            user_id=user.id,
            workspace_id=workspace_id,
            feature=feature,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=round((time.monotonic() - started) * 1000),
            success=success,
        ),
    )
    # Committed right away so failed attempts still count toward the limit.
    await db.commit()


async def run_json[T: BaseModel](
    db: AsyncSession,
    provider: AIProvider,
    *,
    user: User,
    workspace_id: uuid.UUID | None,
    feature: str,
    system: str,
    prompt: str,
    schema: type[T],
) -> T:
    """Ask the provider for JSON matching `schema`; retry once with the error appended."""
    await _check_daily_limit(db, user)
    messages = [Message("user", prompt)]

    for attempt in range(1, MAX_ATTEMPTS + 1):
        started = time.monotonic()
        try:
            completion = await provider.complete_json(system, messages)
        except ProviderError:
            await _log(
                db,
                user=user,
                workspace_id=workspace_id,
                feature=feature,
                model=provider.model,
                started=started,
                success=False,
            )
            raise ai_unavailable() from None

        try:
            result = schema.model_validate_json(completion.text)
        except ValidationError as exc:
            logger.info("%s: invalid AI output on attempt %d", feature, attempt)
            success, result = False, None
            messages += [
                Message("assistant", completion.text),
                Message(
                    "user",
                    "That reply did not match the schema. Errors: "
                    f"{exc.errors(include_url=False, include_input=False)}. "
                    "Return ONLY the corrected JSON object.",
                ),
            ]
        else:
            success = True

        await _log(
            db,
            user=user,
            workspace_id=workspace_id,
            feature=feature,
            model=completion.model,
            started=started,
            success=success,
            input_tokens=completion.input_tokens,
            output_tokens=completion.output_tokens,
        )
        if result is not None:
            return result

    raise ai_unavailable()
