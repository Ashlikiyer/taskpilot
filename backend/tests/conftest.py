import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

# Configure the app for tests before any app module reads settings or creates an engine.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/taskpilot_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET"] = "test-jwt-secret-that-is-at-least-32-characters"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["CRON_SECRET"] = "test-cron-secret"
os.environ["INTAKE_SECRET"] = "test-intake-secret"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.deps import get_ai_provider, get_db  # noqa: E402
from app.main import app  # noqa: E402
from tests.fakes import FakeProvider  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    """Run every Alembic migration against the test database once per session."""
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """A session inside a transaction that is rolled back after the test."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    # https so the Secure refresh cookie is stored and sent like in a browser.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def fake_ai() -> Iterator[FakeProvider]:
    """Replace the real AI provider for one test; queue replies with `fake_ai.reply(...)`."""
    provider = FakeProvider()
    app.dependency_overrides[get_ai_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_ai_provider, None)
