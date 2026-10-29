from typing import Any, cast

from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.health import check_health


class _BrokenSession:
    async def execute(self, *_: Any) -> None:
        raise OperationalError("SELECT 1", None, Exception("connection refused"))


async def test_health_is_degraded_when_database_is_down() -> None:
    result = await check_health(cast(AsyncSession, _BrokenSession()))

    assert result.status == "degraded"
    assert result.database == "unavailable"
