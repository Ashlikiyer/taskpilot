import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        (
            "postgresql://u:p@pooler.supabase.com:5432/postgres",
            "postgresql+asyncpg://u:p@pooler.supabase.com:5432/postgres",
        ),
        ("postgres://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("postgresql+asyncpg://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
    ],
)
def test_database_url_always_uses_asyncpg(given: str, expected: str) -> None:
    settings = Settings(database_url=given, jwt_secret="x" * 32)

    assert settings.database_url == expected
