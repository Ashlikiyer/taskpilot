# TaskPilot – rules for AI coding assistants

## Project
AI-powered task manager. Backend: FastAPI (backend/). Frontend: Next.js (frontend/).
The full spec is in docs/TASKPILOT_SPEC.md. Follow it exactly; ask if unclear.
The frontend uses Next.js 16: read frontend/AGENTS.md and the docs in
frontend/node_modules/next/dist/docs/ before writing Next.js code.

## Commands
- Backend: cd backend && uv run pytest | uv run ruff check . | uv run ruff format . | uv run mypy app
- Migrations: uv run alembic revision --autogenerate -m "msg" && uv run alembic upgrade head
- Frontend: cd frontend && npm run lint | npm run typecheck | npm test | npm run gen:api
- Local Postgres runs in Docker on port 5433 (container taskpilot-db); tests use the taskpilot_test database.

## Backend rules
- Layers: routers -> services -> repositories -> models. No SQL in routers or services.
- Pydantic schemas for all input/output. Never return SQLAlchemy models.
- Every workspace-scoped query filters by workspace_id. Other workspaces' data -> 404.
- Use the error format and codes from the spec (raise AppError subclasses from app/core/errors.py).
- All AI calls go through app/services/ai. Validate AI output with Pydantic.
- Async everywhere. Type hints required; mypy must pass.
- Every schema change needs an Alembic migration.

## Frontend rules
- TypeScript strict. Use generated types from src/lib/api/schema.d.ts; never hand-write API types.
- Server state only in TanStack Query hooks in src/hooks/.
- shadcn/ui + Tailwind only. Every page has loading, empty and error states.
- npm is the package manager (not pnpm).

## Workflow
- Before coding: list the files you will create or change.
- Write or update tests with every change. Run tests and lint before saying you are done.
- Do not add dependencies without asking.
- Keep changes focused on the current task; do not refactor unrelated code.
