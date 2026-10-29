import json
from dataclasses import dataclass
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, User
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace
from tests.fakes import FakeProvider

SUMMARY = {
    "decisions": ["Invoice goes out Friday"],
    "open_questions": ["Is the PO number final?"],
    "next_steps": ["Mark emails Acme"],
}


@dataclass
class World:
    owner: User
    mark: User
    vic: User
    task: dict[str, Any]


async def _world(db: AsyncSession, client: AsyncClient, comments: int = 6) -> World:
    owner = await create_user(db, email="owner@example.com", name="Olive Reyes")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    vic = await add_member(db, workspace, "vic@example.com", MemberRole.viewer)
    project = await create_project(db, workspace, [owner, mark])
    task = (
        await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            json={"title": "Send the Acme invoice"},
            headers=auth_headers(owner),
        )
    ).json()
    for index in range(comments):
        author = owner if index % 2 == 0 else mark
        await _comment(client, task, author, f"Comment {index + 1}")
    return World(owner, mark, vic, task)


async def _comment(client: AsyncClient, task: dict[str, Any], user: User, body: str) -> Any:
    response = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": body}, headers=auth_headers(user)
    )
    assert response.status_code == 201
    return response.json()


async def _summarize(client: AsyncClient, w: World, user: User | None = None) -> Any:
    return await client.post(
        f"/api/v1/tasks/{w.task['id']}/ai/summary", headers=auth_headers(user or w.mark)
    )


async def test_summarizes_the_thread_oldest_first_with_first_names(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client, comments=5)
    await _comment(client, w.task, w.mark, f"Thanks @[Olive Reyes]({w.owner.id}), on it")
    fake_ai.reply(SUMMARY)

    response = await _summarize(client, w)

    body = response.json()
    assert response.status_code == 200
    assert {k: body[k] for k in SUMMARY} == SUMMARY
    assert body["cached"] is False
    context = json.loads(fake_ai.calls[0].messages[0].content)
    assert context["TASK"] == "Send the Acme invoice"
    assert [c["author"] for c in context["COMMENTS"]] == ["Olive", "Mark"] * 3
    assert context["COMMENTS"][0]["text"] == "Comment 1"
    assert context["COMMENTS"][-1]["text"] == "Thanks @Olive Reyes, on it"  # no ids
    assert "@example.com" not in fake_ai.calls[0].messages[0].content


async def test_needs_more_than_five_comments(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client, comments=5)

    response = await _summarize(client, w)

    assert response.status_code == 400
    assert fake_ai.calls == []


async def test_second_request_uses_the_cache(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply(SUMMARY)

    first = await _summarize(client, w)
    second = await _summarize(client, w, user=w.owner)

    assert first.json()["cached"] is False
    assert second.json()["cached"] is True
    assert second.json()["generated_at"] == first.json()["generated_at"]
    assert len(fake_ai.calls) == 1


async def test_any_comment_change_clears_the_cache(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply(SUMMARY, SUMMARY, SUMMARY, SUMMARY)

    await _summarize(client, w)
    new = await _comment(client, w.task, w.mark, "One more thing")
    after_new = await _summarize(client, w)
    await client.patch(
        f"/api/v1/comments/{new['id']}", json={"body": "Edited"}, headers=auth_headers(w.mark)
    )
    after_edit = await _summarize(client, w)
    await client.delete(f"/api/v1/comments/{new['id']}", headers=auth_headers(w.mark))
    after_delete = await _summarize(client, w)

    assert [r.json()["cached"] for r in (after_new, after_edit, after_delete)] == [False] * 3
    assert len(fake_ai.calls) == 4


async def test_summaries_of_80_words_or_more_are_retried(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    # 80 short words spread over two points: each point is valid, the total is not.
    half = " ".join(["ok"] * 40)
    wordy = {"decisions": [half], "open_questions": [half], "next_steps": []}
    fake_ai.reply(wordy, SUMMARY)

    response = await _summarize(client, w)

    assert response.status_code == 200
    assert "under 80" in fake_ai.calls[1].messages[2].content


async def test_viewers_cannot_summarize(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)

    response = await _summarize(client, w, user=w.vic)

    assert response.status_code == 403
    assert fake_ai.calls == []
