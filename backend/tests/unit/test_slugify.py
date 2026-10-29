import pytest

from app.services.workspaces import slugify


@pytest.mark.parametrize(
    ("name", "slug"),
    [
        ("Acme Website", "acme-website"),
        ("  Hello,   World!! ", "hello-world"),
        ("Café Ñoño", "cafe-nono"),
        ("!!!", "workspace"),
        ("a" * 80, "a" * 50),
    ],
)
def test_slugify(name: str, slug: str) -> None:
    assert slugify(name) == slug
