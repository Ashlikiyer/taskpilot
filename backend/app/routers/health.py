from fastapi import APIRouter, Response, status

from app.core.deps import DbSession
from app.schemas.health import HealthResponse
from app.services.health import check_health

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: DbSession, response: Response) -> HealthResponse:
    result = await check_health(db)
    if result.status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
