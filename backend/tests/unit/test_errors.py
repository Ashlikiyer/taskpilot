from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import NotFoundError, register_error_handlers


def _make_client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/tasks/{task_id}")
    async def get_task(task_id: int) -> dict[str, int]:
        raise NotFoundError("Task not found", code="TASK_NOT_FOUND")

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret internal detail")

    return TestClient(app, raise_server_exceptions=False)


def test_app_error_uses_spec_format() -> None:
    response = _make_client().get("/tasks/1")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "TASK_NOT_FOUND", "message": "Task not found", "details": None}
    }


def test_validation_error_returns_400() -> None:
    response = _make_client().get("/tasks/not-a-number")

    assert response.status_code == 400
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert body["details"][0]["loc"] == ["path", "task_id"]


def test_unknown_route_returns_not_found_code() -> None:
    response = _make_client().get("/nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_unhandled_error_hides_internal_details() -> None:
    response = _make_client().get("/boom")

    assert response.status_code == 500
    assert response.json()["error"] == {
        "code": "INTERNAL_ERROR",
        "message": "Something went wrong",
        "details": None,
    }
