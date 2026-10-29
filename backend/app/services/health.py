import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import health as health_repo
from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)


async def check_health(db: AsyncSession) -> HealthResponse:
    try:
        await health_repo.ping(db)
    except SQLAlchemyError, OSError:
        logger.warning("Database health check failed", exc_info=True)
        return HealthResponse(status="degraded", database="unavailable")
    return HealthResponse(status="ok", database="ok")
