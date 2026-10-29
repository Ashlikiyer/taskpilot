from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.errors import error_response

# In-memory, per client IP: fine for a single-instance demo. Behind a proxy, run
# uvicorn with --proxy-headers so the client IP comes from X-Forwarded-For.
limiter = Limiter(key_func=get_remote_address, enabled=get_settings().rate_limit_enabled)


async def rate_limit_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RateLimitExceeded)
    return error_response(429, "RATE_LIMITED", "Too many requests, try again later")
