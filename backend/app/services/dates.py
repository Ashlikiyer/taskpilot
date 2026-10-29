import logging
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def user_today(timezone: str, now: datetime | None = None) -> date:
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError, ValueError:
        logger.warning("Unknown timezone %r, using the app default", timezone)
        zone = ZoneInfo(get_settings().app_timezone)
    return (now or datetime.now(UTC)).astimezone(zone).date()
