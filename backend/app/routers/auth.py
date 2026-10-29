from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response, status

from app.core.config import get_settings
from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import auth as auth_service
from app.services.auth import IssuedTokens

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def _token_response(response: Response, tokens: IssuedTokens) -> TokenResponse:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return TokenResponse(
        access_token=tokens.access_token, expires_in=settings.access_token_minutes * 60
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, httponly=True, secure=True, samesite="lax"
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(request: Request, data: RegisterRequest, db: DbSession) -> UserOut:
    user = await auth_service.register(db, data)
    return UserOut.model_validate(user)


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request, data: LoginRequest, db: DbSession, response: Response
) -> TokenResponse:
    tokens = await auth_service.login(db, data.email, data.password)
    return _token_response(response, tokens)


@router.post("/refresh")
async def refresh(
    db: DbSession, response: Response, refresh_token: RefreshCookie = None
) -> TokenResponse:
    tokens = await auth_service.refresh(db, refresh_token)
    return _token_response(response, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(db: DbSession, response: Response, refresh_token: RefreshCookie = None) -> None:
    await auth_service.logout(db, refresh_token)
    _clear_refresh_cookie(response)


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
