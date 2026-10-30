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
uv run python ../scripts/seed.py  # optional: the "Acme Studio" demo workspace
uv run fastapi dev app/main.py    # http://localhost:8000/docs
```

The seed script creates a demo workspace with five people, four projects, eight weeks of
completed work and a few Inbox requests. Log in as `demo@taskpilot.dev` / `taskpilot-demo`.
Running it again replaces the demo workspace.

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

## Email and form intake

Emails and public form submissions become task proposals in a project's **Inbox**, where an
admin accepts (creating a task) or rejects them. The AI drafts each one, and an admin reviews it.

**Email (Gmail)**

1. In TaskPilot, open **Workspace settings** and give the project a Gmail label, such as
   `TaskPilot/Acme-Website`.
2. In Gmail, create that label and a filter that applies it (for example to emails sent to
   `you+acme@gmail.com`).
3. Go to [script.google.com](https://script.google.com), create a project and paste in
   [`scripts/apps-script/intake.gs`](scripts/apps-script/intake.gs).
4. Under **Project Settings > Script properties**, add `WEBHOOK_URL`
   (`https://<your-frontend>/api/v1/intake/email`) and `INTAKE_SECRET` (the same value as the
   backend's `INTAKE_SECRET`).
5. Run `installTrigger` once and approve the Gmail permissions. New emails under the label are
   sent every 5 minutes and marked read once TaskPilot has them. The same email is never
   processed twice.

**Public form**

Turn on the request form for a project in **Workspace settings** and share the link
(`/intake/<random-code>`). Anyone can submit without logging in; submissions are limited to 10
per hour per IP address.

## Smart import

Admins can import tasks from a `.csv` or `.xlsx` export of another tool (up to 5 MB, 2,000 rows
and 50 columns) under **Import** in the sidebar:

1. **Upload** the file and pick the sheet.
2. **Map** columns to task fields. The AI suggests a mapping from the headers and the first 10
   rows only; well-known values (`WIP`, `Closed`, `P1`…) always get their standard meaning, and
   the date format is inferred from the column if the AI gives none. Everything can be changed.
3. **Preview** every row with its warnings (unknown status, assignee not in the project, bad
   date…) and errors (missing title, duplicate when duplicates are not allowed).
4. **Run**: all valid rows are added in one transaction, so either everything is imported or
   nothing is. Skipped rows can be downloaded as a CSV to fix and upload again.

Assignees are matched in code (email, then full name, then a unique first name), never by the
AI. A messy sample file is in [`scripts/samples/messy_tasks.xlsx`](scripts/samples/messy_tasks.xlsx).

## Checks

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest --cov
cd frontend && npm run lint && npm run typecheck && npm test
```

AI tests use a fake provider, so they are free and repeatable. To check the prompts against the
real model (uses your Groq quota), set `GROQ_API_KEY` in `backend/.env` and run:

```bash
cd backend && uv run pytest -m live_ai -rP
```

The Playwright smoke test (register → workspace → project → quick-add → drag to Done → My
Tasks) runs in a real browser against the real backend. Locally it reuses the servers you
already have running; CI starts both with `AI_PROVIDER=echo`, an offline stand-in that turns
the quick-add sentence into the draft title, so the test needs no Groq key.

```bash
cd frontend && npx playwright install chromium   # once
npm run e2e
```

CI runs the same checks on every pull request ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Deployment

```
Browser ──► Vercel (Next.js) ──/api/v1/*──► Render (FastAPI, Docker) ──► Supabase (Postgres)
```

All free tiers. The browser only talks to Vercel, which forwards `/api/v1/*` to Render, so
the refresh-token cookie stays first-party.

**Database (Supabase).** Create a project and copy the **session pooler** connection string
(Connect → Session pooler, port 5432). It works over IPv4 and keeps asyncpg's prepared
statements working; the transaction pooler on port 6543 does not. A `postgresql://` URL is
fine: the app switches it to asyncpg itself. Load the demo data once from your machine:

```bash
cd backend
DATABASE_URL="<session pooler url>" uv run alembic upgrade head
DATABASE_URL="<session pooler url>" uv run python ../scripts/seed.py
```

**Backend (Render).** New → Blueprint → this repo. [`render.yaml`](render.yaml) builds
[`backend/Dockerfile`](backend/Dockerfile) (Python 3.14, dependencies from `uv.lock`), runs
migrations on start, and checks `/api/v1/health`. Render generates `JWT_SECRET`,
`CRON_SECRET` and `INTAKE_SECRET`; you enter `DATABASE_URL`, `GROQ_API_KEY` and
`FRONTEND_ORIGIN` (the Vercel URL). The free instance sleeps after 15 minutes idle and takes
about a minute to wake.

**Frontend (Vercel).** Import the repo with root directory `frontend` and set `BACKEND_URL`
to the Render URL.

**Automations.** In GitHub → Settings → Secrets → Actions, add `API_URL` (the Render URL)
and `CRON_SECRET` (copied from Render) for the [daily digest](.github/workflows/digest.yml).
For Gmail intake, set the Apps Script's `WEBHOOK_URL` to
`https://<vercel-url>/api/v1/intake/email` and `INTAKE_SECRET` to Render's value.

**Before a demo.** Open the site two minutes early to wake the backend, then log in with the
demo account.

## Roadmap

- [x] Phase 0: monorepo, FastAPI skeleton with health check, Alembic, Next.js with API rewrite, CI
- [x] Phase 1: core task management
  - [x] F1: accounts, workspaces, members and invite links
  - [x] F2: projects (colors, member lists, archive and restore)
  - [x] F3: tasks, subtasks, labels, fractional ordering and activity log
  - [x] F4: Kanban board (drag and drop, keyboard accessible), list view with filters, My Tasks, Ctrl/Cmd+K search
  - [x] F5: markdown comments with @mentions, in-app notifications and unread bell
- [x] Phase 2: AI features
  - [x] AI module (Groq behind a provider interface, validated JSON, usage log, daily limit) and F6 quick-add
  - [x] F7 subtask breakdown, F8 thread summary (cached until the comments change)
  - [x] F9 daily digest (8:00 AM PHT via GitHub Actions; due-tomorrow notifications)
- [x] Phase 3: automation and data
  - [x] F10 email (Gmail label + Apps Script) and public form intake into a project Inbox
  - [x] F11 smart CSV/Excel import (AI column mapping, preview with row warnings, all-or-nothing run)
- [ ] Phase 4: polish and deployment
  - [x] UI redesign from the Claude Design screens: warm neutral surfaces, green actions and a violet layer for everything the AI proposes; global "Create with AI" (Ctrl/Cmd+J)
  - [x] F12 dashboard: open by status, overdue (vs last week), completed per week, workload, share created by AI, per-project filter
  - [x] F13 responsive at 375 px: menu sheet, bottom tab bar, horizontal board, bottom-sheet quick-add
  - [x] Demo seed script and Playwright smoke test in CI
  - [ ] Deployment (Supabase, Render, Vercel)

## AI log

How AI coding assistants were used on this project, and how their mistakes were caught.

| Date | Task given to the AI | What it got wrong | How it was caught |
| --- | --- | --- | --- |
| 2026-10-29 | Alembic migration for the `member_role` enum tables | Autogenerated `downgrade()` dropped the tables but left the Postgres enum type behind | Ran an upgrade → downgrade → upgrade round trip and checked `pg_type` |
| 2026-10-29 | Auth guard for logged-in pages | Redirected to /login on *any* error, so a backend outage looked like being logged out | Review against the spec's "every page has an error state" rule |
| 2026-10-29 | Next.js 16 workspace and invite pages | Read URL params outside a `<Suspense>` boundary, which Cache Components rejects | `next build` failed; fixed per the local Next.js docs |
| 2026-10-29 | Local dev database | Started Postgres on port 5432, already used by a native Postgres install | Password auth failed; moved the container to 5433 |
| 2026-10-29 | Project member checkboxes | Linked labels with `htmlFor`, but Base UI's checkbox doesn't put the `id` on the `role="checkbox"` element, so screen readers announced them with no name | A Testing Library query by accessible name failed; fixed with `aria-labelledby` |
| 2026-10-29 | Typed API calls for creating tasks | Generated types marked fields with server defaults (`status`, `priority`) as required in request bodies, so valid calls failed to type-check | `tsc` errors; regenerated with `openapi-typescript --default-non-nullable false` |
| 2026-10-29 | My Tasks grouped by the user's timezone | Used `zoneinfo` without `tzdata`, which works on Linux but has no timezone data on Windows, so "Asia/Manila" failed to load | Checked `ZoneInfo("Asia/Manila")` on the dev machine before relying on it; added `tzdata` |
| 2026-10-29 | Comments and notifications | Relied on Postgres `now()` for `created_at`, which is the *transaction* start time, so rows written in one request (a comment and its notifications) tied and came back in random order | A notification-order test failed intermittently; timestamps are now set in Python, with the DB default as a fallback |
| 2026-10-29 | Digest summary word limit | Enforced the 60-word limit in Pydantic's `model_post_init`, where errors are raised as plain `ValueError` instead of `ValidationError`, so a too-long AI reply would crash instead of being retried | Code review before running; moved to a `model_validator` and tested with an 80-word reply |
| 2026-10-29 | Public request form and auth pages | Used shadcn's `CardTitle` as the page title, but it renders a `<div>`, so those pages had no heading for screen readers | A Testing Library query for the heading failed; titles are now real `<h1>` elements |
| 2026-10-30 | Import parsing | Dropped blank rows before numbering, so warnings pointed at the wrong spreadsheet row | A test with blank rows in the sample file checked the reported row numbers; the original row numbers are now stored with the rows |
| 2026-10-30 | AI column mapping for imports | The live model mapped `P2` to Medium and `P3` to High, and gave no date format for `11/05/2026` | The live AI test against the sample file; well-known values now override the AI and the date format is inferred in code |
| 2026-10-30 | Skipped-rows CSV download | Prettier turned the `"\uFEFF"` escape into an invisible literal BOM in the source | Noticed in the diff; the BOM is now built with `String.fromCharCode(0xfeff)` |
| 2026-10-30 | Local end-to-end test | An orphaned `fastapi dev` worker kept serving old code on port 8000, so a fix looked like it didn't work | Two listeners showed in `netstat`; stopped the orphan and re-ran |
| 2026-10-30 | Theme tokens for the redesign | The generated theme mapped `--font-sans` to itself, so the app had silently been using the browser's default font instead of Geist | Screenshots against the design didn't match; the token now points at the Geist variable |
| 2026-10-30 | Wider task drawer | Set `sm:max-w-[600px]`, but shadcn's sheet sets its width with a `data-[side=right]:` variant that class merging doesn't override, so the drawer stayed 384 px (and overflowed on phones) | Playwright screenshots at 1280 and 375 px; fixed with the same variant |
| 2026-10-30 | Task links (`?task=<id>`) | An empty `?task=` opened the drawer and showed "Loading" forever | Found through a screenshot script that dropped the id; an empty value now means no task, with a test |
| 2026-10-30 | Playwright smoke test | Passed locally but failed in CI: it pressed drag keys faster than dnd-kit reacted on a fast machine, and Next 16 keeps the previous page mounted (hidden), so a task title matched twice | Ran the test 10 times against a production build; it now waits for each drag announcement and matches elements more precisely |
