import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AnyMember, DbSession, ProjectAccess, TaskAccess, require_role
from app.db.models import MemberRole, TaskPriority, TaskStatus
from app.repositories.tasks import TaskFilters
from app.schemas.task import (
    ActivityOut,
    LabelCreate,
    LabelOut,
    MyTasks,
    SearchResults,
    TaskCreate,
    TaskMove,
    TaskOut,
    TaskPage,
    TaskUpdate,
)
from app.services import labels as labels_service
from app.services import search as search_service
from app.services import tasks as tasks_service
from app.services.workspaces import WorkspaceContext

router = APIRouter(tags=["tasks"])

Member = Annotated[WorkspaceContext, Depends(require_role(MemberRole.member))]
SearchText = Annotated[str, Query(min_length=1, max_length=100)]


@router.get("/projects/{project_id}/tasks")
async def list_tasks(
    db: DbSession,
    ctx: ProjectAccess,
    task_status: Annotated[list[TaskStatus], Query(alias="status")] = [],  # noqa: B006
    priority: Annotated[list[TaskPriority], Query()] = [],  # noqa: B006
    assignee_id: uuid.UUID | None = None,
    label: Annotated[uuid.UUID | None, Query(description="Label id")] = None,
    due_from: date | None = None,
    due_to: date | None = None,
    parent_id: Annotated[
        uuid.UUID | None, Query(description="List this task's subtasks instead of top-level tasks")
    ] = None,
    q: Annotated[str | None, Query(max_length=100, description="Search title and description")] = (
        None
    ),
    sort: Annotated[str, Query(max_length=20, description="Field, prefix with - for desc")] = (
        "position"
    ),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> TaskPage:
    filters = TaskFilters(
        statuses=task_status,
        priorities=priority,
        assignee_id=assignee_id,
        label_id=label,
        due_from=due_from,
        due_to=due_to,
        parent_id=parent_id,
        q=q or None,
    )
    return await tasks_service.list_tasks(
        db, ctx, filters, sort=sort, page=page, page_size=page_size
    )


@router.post("/projects/{project_id}/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskCreate, db: DbSession, ctx: ProjectAccess) -> TaskOut:
    return await tasks_service.create(db, ctx, data)


@router.get("/tasks/{task_id}")
async def get_task(db: DbSession, ctx: TaskAccess) -> TaskOut:
    return await tasks_service.get(db, ctx)


@router.patch("/tasks/{task_id}")
async def update_task(data: TaskUpdate, db: DbSession, ctx: TaskAccess) -> TaskOut:
    return await tasks_service.update(db, ctx, data)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(db: DbSession, ctx: TaskAccess) -> None:
    await tasks_service.delete(db, ctx)


@router.post("/tasks/{task_id}/move")
async def move_task(data: TaskMove, db: DbSession, ctx: TaskAccess) -> TaskOut:
    return await tasks_service.move(db, ctx, data)


@router.get("/tasks/{task_id}/activity")
async def task_activity(db: DbSession, ctx: TaskAccess) -> list[ActivityOut]:
    return await tasks_service.activity(db, ctx)


@router.get("/workspaces/{ws_id}/labels")
async def list_labels(db: DbSession, ctx: AnyMember) -> list[LabelOut]:
    return await labels_service.list_labels(db, ctx)


@router.post("/workspaces/{ws_id}/labels", status_code=status.HTTP_201_CREATED)
async def create_label(data: LabelCreate, db: DbSession, ctx: AnyMember) -> LabelOut:
    return await labels_service.create(db, ctx, data)


@router.get("/workspaces/{ws_id}/search")
async def search(q: SearchText, db: DbSession, ctx: AnyMember) -> SearchResults:
    return await search_service.search(db, ctx, q)


@router.get("/workspaces/{ws_id}/my-tasks")
async def my_tasks(db: DbSession, ctx: Member) -> MyTasks:
    return await search_service.my_tasks(db, ctx)
