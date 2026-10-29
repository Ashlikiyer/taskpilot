# TaskPilot

AI-powered task management for small teams: create tasks from plain sentences, get a daily
digest of overdue work, and turn emails and spreadsheets into tasks automatically.

Portfolio project showing full-stack development (Next.js + FastAPI), AI integration,
workflow automation, data import, and disciplined testing of AI-generated code.
The full specification is in [docs/TASKPILOT_SPEC.md](docs/TASKPILOT_SPEC.md).

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2 (async) + asyncpg, Alembic |
| Database | PostgreSQL (Supabase in production) |
| AI | Groq (free tier), behind a swappable provider interface |
| Testing | pytest, Vitest + Testing Library, Playwright |
| CI / hosting | GitHub Actions, Vercel (frontend), Render (backend) |

## Repository layout

```text
backend/    FastAPI app (routers -> services -> repositories -> models), Alembic, pytest
frontend/   Next.js app, shadcn/ui components, TanStack Query hooks, Vitest
docs/       Project specification
```

## Local setup

Requirements: Python 3.14 with [uv](https://docs.astral.sh/uv/), Node.js 24+, Docker.

**Database** (port 5433, so it doesn't clash with a locally installed Postgres)

```bash
docker run -d --name taskpilot-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=taskpilot -p 5433:5432 postgres:16
docker exec taskpilot-db psql -U postgres -c "CREATE DATABASE taskpilot_test"
```

**Backend**

```bash
cd backend
uv sync
cp .env.example .env              # fill in values
uv run alembic upgrade head
uv run fastapi dev app/main.py    # http://localhost:8000/docs
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run gen:api                   # regenerate API types (backend must be running)
npm run dev                       # http://localhost:3000
```

The browser only talks to the Next.js app; `/api/v1/*` is rewritten to the FastAPI backend
(`BACKEND_URL`), so auth cookies stay first-party.

## Checks

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest --cov
cd frontend && npm run lint && npm run typecheck && npm test
```

CI runs the same checks on every pull request ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Roadmap

- [x] Phase 0: monorepo, FastAPI skeleton with health check, Alembic, Next.js with API rewrite, CI
- [ ] Phase 1: accounts, workspaces, projects, tasks, board/list views, comments, notifications
- [ ] Phase 2: AI quick-add, subtask breakdown, thread summary, daily digest
- [ ] Phase 3: email/form intake, smart CSV/Excel import
- [ ] Phase 4: dashboard, responsive polish, deployment

## AI log

How AI coding assistants were used on this project, and how their mistakes were caught.

| Date | Task given to the AI | What it got wrong | How it was caught |
| --- | --- | --- | --- |
| | | | |
