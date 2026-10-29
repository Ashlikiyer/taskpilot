# TaskPilot — Project Documentation

Oct 29, 2026 · @Kurt

## Overview

TaskPilot is an AI-powered task management system for small teams: tasks are created from plain sentences, overdue work is summarized daily, and emails or spreadsheets turn into tasks automatically.

It is a portfolio project built with a Next.js frontend and a Python FastAPI backend, designed to show full-stack development, AI integration, workflow automation, data import, and disciplined testing of AI-generated code.

**Goals**

1. A complete, usable team task manager (workspaces, projects, Kanban board, comments, roles).
2. AI features that save real time: quick-add from a sentence, subtask breakdown, daily digest, thread summaries.
3. Workflow automation: emails and form submissions become tasks in a triage inbox.
4. Data management: import messy CSV/Excel task lists with AI-assisted column mapping and cleanup.
5. Production-quality engineering: typed API, migrations, automated tests, CI, clean Git history.
6. Runs entirely on free tiers.

**In scope**

- Multiple workspaces, each with members and roles.
- Projects, tasks, subtasks, labels, comments, activity log, notifications (in-app).
- Board (Kanban) and list views, My Tasks view, filters and search.
- AI features, email intake, CSV/Excel import, daily digest.

**Out of scope (for now)**

- Real-time collaboration (live cursors, websockets).
- Native mobile apps (the web app is responsive instead).
- Time tracking, billing, Gantt charts.
- Email sending beyond the daily digest.

| Item | Value |
| --- | --- |
| Owner | Ashley Kier Ferreol |
| Frontend | Next.js + TypeScript |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Supabase) |
| AI provider | Groq (free tier), swappable |
| Budget | ₱0 (free tiers only) |

## Users, roles and permissions

Every user belongs to one or more workspaces, and their role in each workspace decides what they can do there.

| Role | Who | Summary |
| --- | --- | --- |
| Owner | Creator of the workspace (one per workspace) | Full control, including deleting the workspace and transferring ownership |
| Admin | Team leads, managers | Manage members, projects, automations and imports |
| Member | Regular team members | Create and work on tasks in projects they belong to |
| Viewer | Clients or stakeholders | Read-only access, can comment |

**Permission matrix**

| Action | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| View projects and tasks | Yes | Yes | Yes | Yes |
| Comment on tasks | Yes | Yes | Yes | Yes |
| Create, edit, move tasks | Yes | Yes | Yes | No |
| Delete tasks | Yes | Yes | Own tasks only | No |
| Use AI features | Yes | Yes | Yes | No |
| Create, archive projects | Yes | Yes | No | No |
| Invite and remove members, change roles | Yes | Yes (not Owner) | No | No |
| Manage email intake and digest settings | Yes | Yes | No | No |
| Run CSV/Excel import | Yes | Yes | No | No |
| Delete workspace, transfer ownership | Yes | No | No | No |

Permissions are enforced in the FastAPI backend on every request. The frontend only hides buttons for convenience; it is never the security boundary.

## Features with acceptance criteria

Features are grouped by build phase; each one is done only when its acceptance criteria pass in tests or a manual check.

### Phase 1: Core task management

**F1. Accounts and workspaces**

- Register with name, email and password; log in; log out.
- Create a workspace; the creator becomes Owner.
- Invite a member by email: the invite creates a link with a token valid for 7 days (shown to the admin to copy; no email sending required).
- Switch between workspaces from the sidebar.

**F2. Projects**

- Admins create, rename, archive and restore projects.
- Each project has a name, description, color and a member list.
- Archived projects are hidden from the sidebar but searchable.

**F3. Tasks**

- Fields: title (required, max 200 chars), description (markdown), status, priority, assignee, due date, labels, parent task (for subtasks), position (for ordering).
- Statuses: `todo`, `in_progress`, `in_review`, `done`. Priorities: `low`, `medium`, `high`, `urgent`.
- Subtasks are tasks with a `parent_id`; nesting is one level only.
- Completing all subtasks does not auto-complete the parent; the parent shows progress (for example 3/5).
- Every change writes an entry to the activity log (who, what, old value, new value, when).

**F4. Views**

- Board view: columns by status, drag cards to change status and order.
- List view: sortable table with inline edits for status, assignee and due date.
- My Tasks: all tasks assigned to me across projects, grouped by Overdue, Today, This week, Later, No date.
- Filters: assignee, status, priority, label, due date range. Search by title and description.

**F5. Comments and notifications**

- Comments in markdown with `@mention` of workspace members.
- In-app notifications for: assigned to me, mentioned, comment on my task, due tomorrow.
- Unread count in the top bar; mark one or all as read.

### Phase 2: AI features

**F6. Quick-add from a sentence.** The user types "Ask Mark to send the Acme invoice by Friday, high priority". AI returns a draft task (title, assignee, due date, priority, project, labels). The user reviews and confirms before it is saved.

- Relative dates resolve using the Asia/Manila timezone.
- Unknown names become "unassigned" with a warning, never a guess.

**F7. Subtask breakdown.** On any task, "Break down with AI" suggests 3–8 subtasks. The user ticks which ones to create.

**F8. Thread summary.** Tasks with more than 5 comments show "Summarize", returning decisions, open questions and next steps in under 80 words.

**F9. Daily digest.** Each morning (8:00 AM PHT), every member gets an in-app digest of overdue, due-today and at-risk tasks, with a short AI-written summary. Optional email delivery is a later stretch goal.

### Phase 3: Automation and data

**F10. Email and form intake.** Emails sent to a connected Gmail label, or submissions from a public intake form, become task proposals in the project's Inbox. Admins accept, edit or reject them.

**F11. Smart CSV/Excel import.** Upload a task export from another tool. AI suggests a column mapping and value cleanup; the user reviews a dry-run preview, then imports.

### Phase 4: Polish

**F12. Dashboard.** Per workspace: open tasks by status, overdue count, tasks completed per week, workload per member.

**F13. Responsive UI.** Every page usable at 375 px width; Board view becomes a horizontal scroll.

## AI features

AI only proposes; the backend validates every AI output with Pydantic, and a human confirms before anything is saved (except intake proposals, which land in a review inbox).

### Design rules

- All AI calls go through one service, `app/services/ai/`, with a provider interface so Groq can be swapped for Gemini or another model.
- Use JSON mode and validate with Pydantic models. On a validation error, retry once with the error message appended; if it fails again, return a clear error to the user.
- Facts come from the database, words come from the AI. For example, the digest's list of overdue tasks is computed with SQL; AI only writes the summary paragraph.
- Never send passwords, tokens or other workspaces' data to the AI. Send only the fields the feature needs.
- Log every call in `ai_usage` (feature, model, tokens, latency, success).
- Limit: 50 AI calls per user per day (configurable), enforced in the backend.

### F6. Quick-add

Input sent to the model: the user's sentence, today's date and weekday in Asia/Manila, the workspace's member list (id + name), the project list (id + name), and existing labels.

```text
You turn a short request into ONE task for a team task manager.
Return ONLY JSON matching the schema.
Rules:
- Resolve relative dates ("Friday", "tomorrow", "next week") using TODAY.
- assignee_id must be an id from MEMBERS, or null if no clear match.
- project_id must be an id from PROJECTS, or null.
- Use priority "medium" unless the text says otherwise.
- Keep the title short and start with a verb.
- Put anything you were unsure about in "warnings".
```

```python
class QuickAddDraft(BaseModel):
    title: str = Field(max_length=200)
    description: str | None = None
    assignee_id: UUID | None = None
    project_id: UUID | None = None
    due_date: date | None = None
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    labels: list[str] = []
    warnings: list[str] = []
```

After parsing, the backend checks that `assignee_id` and `project_id` really belong to the workspace; anything invalid becomes null with a warning.

### F7. Subtask breakdown

Input: task title, description, project name. Output:

```python
class SubtaskSuggestions(BaseModel):
    subtasks: list[str] = Field(min_length=3, max_length=8)
```

Each subtask title is at most 120 characters and starts with a verb.

### F8. Thread summary

Input: task title and comments (author first name, text, date), oldest first. Output:

```python
class ThreadSummary(BaseModel):
    decisions: list[str]
    open_questions: list[str]
    next_steps: list[str]
```

The whole summary must be under 80 words. Cache it on the task and invalidate when a new comment is added.

### F9. Daily digest

The backend computes three lists per user with SQL:

- **Overdue:** `due_date < today` and status is not `done`.
- **Due today:** `due_date = today` and status is not `done`.
- **At risk:** due within 2 days and still `todo`, or no activity for 5 days while `in_progress`.

The AI receives these lists and returns `{ "summary": str }` (max 60 words, friendly, no new facts). If AI fails, the digest is sent without a summary.

### F10. Intake parsing

Input: email subject, body (first 4,000 characters), sender, received date. Output: a `QuickAddDraft` plus `confidence: float` (0–1). Signatures, quoted replies and disclaimers are stripped before sending.

### F11. Import column mapping

Input: the file's headers and the first 10 rows. Output:

```python
class ImportMapping(BaseModel):
    columns: dict[str, Literal["title", "description", "status",
        "priority", "assignee", "due_date", "labels", "ignore"]]
    status_values: dict[str, Literal["todo", "in_progress", "in_review", "done"]]
    priority_values: dict[str, Literal["low", "medium", "high", "urgent"]]
    date_format: str | None
```

Example: header "Task Name" → `title`; status value "WIP" → `in_progress`; "Closed" → `done`.

## System architecture

TaskPilot has one FastAPI backend that serves three callers (the web app, the email intake script and the daily cron), with the AI module isolated behind validation.

&#91;embedded content: TaskPilot architecture · frontend, backend layers, data, AI, automations\]

The browser only talks to the Vercel domain; Next.js rewrites `/api/v1` calls to Render, and only the backend touches the database and the AI provider.

## Tech stack

Every tool below is free to use; hosted services are on free tiers.

| Layer | Tool | Purpose |
| --- | --- | --- |
| Frontend framework | Next.js (App Router) + TypeScript | Pages, routing, server components |
| UI | Tailwind CSS + shadcn/ui | Components and styling |
| Data fetching | TanStack Query | Caching, optimistic updates |
| Forms | react-hook-form + Zod | Form state and validation |
| Drag and drop | @dnd-kit | Kanban board |
| API types | openapi-typescript | Generate TS types from FastAPI's OpenAPI schema |
| Backend framework | FastAPI | REST API, OpenAPI docs |
| Validation | Pydantic v2 | Request, response and AI output schemas |
| ORM | SQLAlchemy 2.0 (async) + asyncpg | Database access |
| Migrations | Alembic | Schema versioning |
| Auth | PyJWT + pwdlib (Argon2) | Tokens and password hashing |
| AI | Groq Python SDK | LLM calls (free tier) |
| File parsing | pandas + openpyxl | CSV and Excel import |
| Database | Supabase Postgres | Main database (free tier) |
| Package managers | uv (Python), pnpm (Node) | Fast installs, lockfiles |
| Backend tests | pytest + pytest-asyncio + httpx | Unit and API tests |
| Frontend tests | Vitest + Testing Library | Component and util tests |
| End-to-end tests | Playwright | Critical user flows |
| Lint and format | Ruff, mypy, ESLint, Prettier | Code quality |
| CI and scheduling | GitHub Actions | Tests on push, daily digest trigger |
| Email intake | Google Apps Script | Forward Gmail label to webhook |
| Hosting | Vercel (frontend), Render (backend) | Free deploys from GitHub |

Free-tier notes: Render's free backend sleeps after 15 minutes idle and takes about a minute to wake; Supabase free projects can pause after a period of inactivity. Both are fine for a portfolio demo; wake the backend before presenting.

## Database schema

The schema has 17 tables in PostgreSQL, managed only through Alembic migrations; every table uses UUID primary keys and `created_at` / `updated_at` timestamps (timestamptz, UTC).

| Table | Key columns | Notes |
| --- | --- | --- |
| users | id, email (unique), name, password\_hash, avatar\_url, timezone (default Asia/Manila) | Email stored lowercase |
| refresh\_tokens | id, user\_id, token\_hash, expires\_at, revoked\_at | Store hashes only |
| workspaces | id, name, slug (unique), owner\_id |  |
| workspace\_members | workspace\_id, user\_id, role | Unique (workspace\_id, user\_id); role: owner, admin, member, viewer |
| invites | id, workspace\_id, email, role, token\_hash, expires\_at, accepted\_at | Valid 7 days |
| projects | id, workspace\_id, name, description, color, archived\_at |  |
| project\_members | project\_id, user\_id | Unique pair |
| tasks | id, project\_id, parent\_id, title, description, status, priority, assignee\_id, due\_date, position, created\_by, completed\_at, source | source: manual, ai\_quick\_add, intake, import |
| labels | id, workspace\_id, name, color | Unique (workspace\_id, name) |
| task\_labels | task\_id, label\_id | Unique pair |
| comments | id, task\_id, author\_id, body, edited\_at |  |
| activity\_log | id, workspace\_id, task\_id, actor\_id, action, field, old\_value, new\_value | Append-only; actor\_id null for system |
| notifications | id, user\_id, type, task\_id, payload (jsonb), read\_at |  |
| intake\_items | id, project\_id, source, external\_id (unique), raw\_subject, raw\_body, sender, draft (jsonb), confidence, status, task\_id | status: pending, accepted, rejected |
| import\_jobs | id, workspace\_id, project\_id, file\_name, mapping (jsonb), status, total\_rows, imported\_rows, errors (jsonb) | status: uploaded, mapped, previewed, imported, failed |
| ai\_usage | id, user\_id, workspace\_id, feature, model, input\_tokens, output\_tokens, latency\_ms, success | Used for daily limits |
| digests | id, user\_id, date, content (jsonb), summary, read\_at | Unique (user\_id, date) |

**Enums (Postgres enum types or check constraints)**

- `task_status`: todo, in\_progress, in\_review, done
- `task_priority`: low, medium, high, urgent
- `member_role`: owner, admin, member, viewer

**Indexes**

- tasks: (project\_id, status, position), (assignee\_id, due\_date), (parent\_id)
- Full-text search: generated `tsvector` column on tasks (title + description) with a GIN index
- activity\_log: (task\_id, created\_at desc)
- notifications: (user\_id, read\_at)
- ai\_usage: (user\_id, created\_at)

**Rules**

- Deleting a task deletes its subtasks, comments, labels links and notifications (cascade); activity log rows remain.
- `position` uses fractional values (float or string keys) so a card can move between two others without renumbering the column.
- Every query that touches workspace data must filter by `workspace_id` through the project. This is the main defense against data leaks between workspaces.

## API reference

All endpoints live under `/api/v1`, return JSON, and are documented automatically at `/docs` (Swagger) by FastAPI; workspace-scoped routes check membership and role on every call.

### Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | /auth/register | Create account |
| POST | /auth/login | Returns access token; sets refresh token cookie |
| POST | /auth/refresh | New access token from refresh cookie |
| POST | /auth/logout | Revoke refresh token |
| GET | /auth/me | Current user |

### Workspaces and members

| Method | Path | Min role |
| --- | --- | --- |
| GET | /workspaces | any member |
| POST | /workspaces | logged in |
| GET, PATCH, DELETE | /workspaces/{ws\_id} | member / admin / owner |
| GET | /workspaces/{ws\_id}/members | viewer |
| PATCH, DELETE | /workspaces/{ws\_id}/members/{user\_id} | admin |
| POST | /workspaces/{ws\_id}/invites | admin |
| POST | /invites/{token}/accept | logged in |

### Projects

| Method | Path | Min role |
| --- | --- | --- |
| GET, POST | /workspaces/{ws\_id}/projects | viewer / admin |
| GET, PATCH | /projects/{project\_id} | viewer / admin |
| POST | /projects/{project\_id}/archive, /restore | admin |

### Tasks

| Method | Path | Min role |
| --- | --- | --- |
| GET | /projects/{project\_id}/tasks | viewer |
| POST | /projects/{project\_id}/tasks | member |
| GET, PATCH, DELETE | /tasks/{task\_id} | viewer / member / member (own) |
| POST | /tasks/{task\_id}/move | member |
| GET | /tasks/{task\_id}/activity | viewer |
| GET | /workspaces/{ws\_id}/my-tasks | member |
| GET | /workspaces/{ws\_id}/search?q= | viewer |

Task list filters (query params): `status`, `priority`, `assignee_id`, `label`, `due_from`, `due_to`, `parent_id`, `sort`, `page`, `page_size` (max 100).

`POST /tasks/{task_id}/move` body: `{ "status": "in_progress", "before_id": "...", "after_id": "..." }` (the server computes the new position).

### Comments, labels, notifications

| Method | Path | Min role |
| --- | --- | --- |
| GET, POST | /tasks/{task\_id}/comments | viewer |
| PATCH, DELETE | /comments/{comment\_id} | author |
| GET, POST | /workspaces/{ws\_id}/labels | viewer / member |
| GET | /notifications | self |
| POST | /notifications/read-all, /notifications/{id}/read | self |

### AI

| Method | Path | Returns |
| --- | --- | --- |
| POST | /workspaces/{ws\_id}/ai/quick-add | QuickAddDraft (not saved) |
| POST | /tasks/{task\_id}/ai/subtasks | SubtaskSuggestions (not saved) |
| POST | /tasks/{task\_id}/ai/summary | ThreadSummary (cached) |
| GET | /workspaces/{ws\_id}/digest/today | Today's digest for current user |

### Automation and import

| Method | Path | Notes |
| --- | --- | --- |
| POST | /intake/email | Webhook from Apps Script; header `X-Intake-Secret` |
| POST | /intake/form/{project\_slug} | Public form submission, rate limited |
| GET | /projects/{project\_id}/intake | List pending items (admin) |
| POST | /intake/{item\_id}/accept, /reject | Admin; accept accepts optional edits |
| POST | /workspaces/{ws\_id}/imports | Upload file (max 5 MB, .csv/.xlsx) |
| POST | /imports/{job\_id}/mapping | AI suggests mapping |
| PUT | /imports/{job\_id}/mapping | User confirms or edits mapping |
| POST | /imports/{job\_id}/preview | Dry run: rows, errors, warnings |
| POST | /imports/{job\_id}/run | Import into the chosen project |
| POST | /internal/digest/run | Called by GitHub Actions; header `X-Cron-Secret` |

### Error format

```json
{ "error": { "code": "TASK_NOT_FOUND", "message": "Task not found", "details": null } }
```

| HTTP | Common codes |
| --- | --- |
| 400 | VALIDATION\_ERROR |
| 401 | UNAUTHENTICATED, TOKEN\_EXPIRED |
| 403 | FORBIDDEN |
| 404 | NOT\_FOUND (also used for other workspaces' data, never 403) |
| 409 | CONFLICT (duplicate email, label name) |
| 429 | RATE\_LIMITED, AI\_DAILY\_LIMIT |
| 502 | AI\_UNAVAILABLE |

## Frontend pages and components

The Next.js app has 13 routes; all data comes from the FastAPI backend through a typed API client generated from the OpenAPI schema.

| Route | Page | Main components |
| --- | --- | --- |
| /login, /register | Auth | AuthForm |
| /invite/\[token\] | Accept invite | InviteCard |
| /w | Workspace picker / create | WorkspaceList, CreateWorkspaceDialog |
| /w/\[slug\] | Dashboard | StatCards, WorkloadChart, CompletedPerWeekChart |
| /w/\[slug\]/my-tasks | My Tasks | TaskGroup, TaskRow |
| /w/\[slug\]/digest | Today's digest | DigestSummary, TaskGroup |
| /w/\[slug\]/p/\[projectId\] | Project board | BoardColumn, TaskCard, QuickAddBar |
| /w/\[slug\]/p/\[projectId\]/list | Project list | TaskTable, FilterBar |
| /w/\[slug\]/p/\[projectId\]/inbox | Intake inbox | IntakeItemCard, IntakeEditDialog |
| /w/\[slug\]/import | Import wizard | UploadStep, MappingStep, PreviewStep, ResultStep |
| /w/\[slug\]/settings | Workspace settings | GeneralForm, IntakeSettings |
| /w/\[slug\]/settings/members | Members | MemberTable, InviteDialog |
| /intake/\[projectSlug\] | Public intake form | PublicIntakeForm |

**Shared components**

- `TaskDrawer`: opens from any task (URL param `?task=<id>`), shows fields, subtasks, comments, activity, and AI buttons (Break down, Summarize).
- `QuickAddBar`: text input with "Create with AI"; shows the draft in a `QuickAddPreview` for confirmation, including warnings.
- `AppSidebar`: workspace switcher, projects, My Tasks, Digest, Inbox count.
- `NotificationBell`: unread count and dropdown list.
- `CommandMenu`: Ctrl/Cmd+K to search tasks and jump to projects.

**Frontend rules**

- Server state only in TanStack Query; no duplicate copies in other stores.
- Optimistic updates for moving cards and changing status, with rollback on error.
- Every page has loading, empty and error states.
- Accessibility: keyboard-usable board (dnd-kit keyboard sensor), labels on all inputs, focus visible.

## Repository structure

One monorepo with `backend/` and `frontend/`; the backend follows a layered design (routers → services → repositories → models) so business logic is testable without HTTP.

```text
taskpilot/
├── CLAUDE.md                     # Rules for AI coding assistants
├── README.md
├── .github/workflows/
│   ├── ci.yml                    # Lint + tests on every push/PR
│   └── digest.yml                # Daily digest trigger (cron)
├── backend/
│   ├── pyproject.toml            # uv, ruff, mypy, pytest config
│   ├── alembic/                  # Migrations
│   ├── app/
│   │   ├── main.py               # FastAPI app, middleware, routers
│   │   ├── core/
│   │   │   ├── config.py         # Settings from env (pydantic-settings)
│   │   │   ├── security.py       # JWT, password hashing
│   │   │   ├── errors.py         # Error types and handlers
│   │   │   └── deps.py           # get_db, get_current_user, require_role
│   │   ├── db/
│   │   │   ├── session.py        # Async engine and session
│   │   │   └── models/           # SQLAlchemy models, one file per table group
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── repositories/         # Database queries only
│   │   ├── services/             # Business logic
│   │   │   ├── tasks.py
│   │   │   ├── positions.py      # Fractional ordering
│   │   │   ├── digest.py
│   │   │   ├── intake.py
│   │   │   ├── imports.py
│   │   │   └── ai/
│   │   │       ├── provider.py   # Interface + Groq implementation
│   │   │       ├── prompts.py
│   │   │       └── features.py   # quick_add, subtasks, summary, mapping
│   │   └── routers/              # One file per resource
│   └── tests/
│       ├── conftest.py           # Test DB, client, factories
│       ├── unit/
│       └── api/
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── app/                  # Routes (see Frontend pages)
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui
│   │   │   ├── tasks/
│   │   │   ├── board/
│   │   │   ├── ai/
│   │   │   └── import/
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── schema.d.ts   # Generated by openapi-typescript
│   │   │   │   └── client.ts     # Fetch wrapper, auth refresh
│   │   │   └── utils.ts
│   │   ├── hooks/                # TanStack Query hooks per resource
│   │   └── types/
│   ├── tests/                    # Vitest
│   └── e2e/                      # Playwright
└── scripts/
    ├── seed.py                   # Demo workspace with sample data
    └── apps-script/intake.gs     # Gmail → webhook script
```

**Layer rules**

- Routers: parse input, call a service, return a schema. No SQL, no business logic.
- Services: business rules and permission checks. Call repositories and the AI module.
- Repositories: SQLAlchemy queries only. Always take `workspace_id` where relevant.
- Models and schemas are separate: never return a SQLAlchemy model directly from a route.

## Authentication and security

Auth is built in FastAPI with short-lived access tokens and rotating refresh tokens, and the frontend calls the backend through a Next.js rewrite so cookies stay first-party.

### Token flow

1. `POST /auth/login` checks the Argon2 password hash and returns a JWT access token (15 minutes) in the response body.
2. The same response sets a refresh token (random 32 bytes, 14 days) as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, path `/api/v1/auth`. Only its SHA-256 hash is stored.
3. The frontend keeps the access token in memory (not localStorage) and sends it as `Authorization: Bearer`.
4. On a 401 `TOKEN_EXPIRED`, the client calls `/auth/refresh` once, then retries the request.
5. Each refresh rotates the token: the old one is revoked. Reuse of a revoked token revokes all of that user's tokens.

**Same-origin setup.** `next.config.js` rewrites `/api/v1/:path*` to the Render backend URL. The browser only ever talks to the Vercel domain, which avoids cross-site cookie problems.

### Security checklist

- Passwords: Argon2 via pwdlib; minimum 8 characters.
- Rate limits (in-memory per IP is fine for the demo; slowapi): login 5/min, register 3/min, public intake form 10/hour per IP.
- Authorization: `require_role("admin")` dependency on routes; services check that every task, project and comment belongs to the user's workspace.
- Return 404 (not 403) for resources in other workspaces, so IDs can't be probed.
- CORS: allow only the frontend origin.
- Validate all input with Pydantic; set max lengths on every string field.
- Uploads: max 5 MB, only `.csv` and `.xlsx`, parsed in memory, never executed.
- Markdown: render comments and descriptions with sanitization (no raw HTML).
- Webhooks: `/intake/email` and `/internal/digest/run` require a shared secret header compared with `hmac.compare_digest`.
- AI: treat all model output as untrusted data; never execute it or use it in raw SQL. Email content sent to AI may contain instructions; the prompt says to ignore them, and the result is only a draft for human review.
- Secrets only in environment variables; `.env` files are git-ignored.
- Dependencies: enable GitHub Dependabot alerts.

## Automations

Two automations run for free: Google Apps Script forwards labeled Gmail messages to the intake webhook, and a GitHub Actions cron job triggers the daily digest.

### Email intake

1. In Gmail, create a label such as `TaskPilot/Acme-Website` and a filter that applies it (for example, emails to a `+tasks` address).
2. `scripts/apps-script/intake.gs` runs every 5 minutes (time-driven trigger). For each unread message with the label, it POSTs subject, plain-text body, sender, date and label name to `/api/v1/intake/email` with the `X-Intake-Secret` header, then marks the message as read.
3. The backend maps the label to a project (configured in Intake Settings), strips signatures and quoted replies, asks AI for a `QuickAddDraft`, and stores an `intake_items` row with status `pending`.
4. Admins see pending items in the project Inbox, edit if needed, and Accept (creates a task with `source = intake`) or Reject.
5. Duplicate protection: the Gmail message ID is stored; the same ID is never processed twice.

**Public intake form.** `/intake/[projectSlug]` lets clients submit a request (name, email, title, details) without logging in. Submissions follow the same path into the Inbox. It can be turned off per project.

### Daily digest

```yaml
# .github/workflows/digest.yml
on:
  schedule:
    - cron: "0 0 * * *"   # 00:00 UTC = 8:00 AM PHT
  workflow_dispatch: {}
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "$API_URL/api/v1/internal/digest/run" \
            -H "X-Cron-Secret: $CRON_SECRET" --retry 3 --retry-delay 60
        env:
          API_URL: ${{ secrets.API_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

The retries cover Render's cold start. The endpoint builds one digest per active member, stores it in `digests`, and creates a notification. It is idempotent: running it twice on the same day does not create duplicates.

GitHub's scheduled workflows can start a few minutes late and are paused in repos with no activity for 60 days; that is acceptable for a digest.

## Smart CSV/Excel import

The import wizard turns a messy spreadsheet from another tool into clean tasks in four steps, and nothing is written to the tasks table until the user approves a dry-run preview.

1. **Upload.** `.csv` or `.xlsx`, max 5 MB and 2,000 rows. pandas reads it; for Excel, the user picks the sheet. Empty rows and columns are dropped.
2. **Map.** AI suggests which column is title, status, assignee and so on, plus how to translate values ("WIP" → `in_progress`, "P1" → `urgent`) and the date format. The user can change any mapping in dropdowns.
3. **Preview (dry run).** The backend applies the mapping and validates every row without saving. It shows counts (valid, warnings, errors) and a table of the first 50 rows with issues highlighted.
4. **Import.** Valid rows are inserted in one database transaction with `source = import`. Rows with errors are skipped and can be downloaded as a CSV to fix and re-upload.

**Validation rules**

| Check | Result |
| --- | --- |
| Missing title | Error, row skipped |
| Title over 200 characters | Warning, truncated |
| Unknown status or priority value | Warning, set to `todo` / `medium` |
| Assignee name or email not a workspace member | Warning, left unassigned |
| Unparseable date | Warning, date left empty |
| Duplicate title + due date already in project | Warning, imported unless user unticks "allow duplicates" |
| Unknown labels | Created automatically |

**Assignee matching** is done in Python (exact email, then case-insensitive full name, then first name if unique), not by AI.

Include a sample messy file, `scripts/samples/messy_tasks.xlsx`, for demos and tests: mixed date formats, statuses like "WIP" and "Closed", blank rows, and a misspelled member name.

## Local setup and environment variables

Local development needs Python 3.12+, Node.js 20+, uv, pnpm, Docker (for a local Postgres) and a free Groq API key.

**Backend**

```bash
cd backend
uv sync
docker run -d --name taskpilot-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
cp .env.example .env            # fill in values
uv run alembic upgrade head
uv run python ../scripts/seed.py  # demo workspace and tasks
uv run fastapi dev app/main.py   # http://localhost:8000/docs
```

**Frontend**

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm gen:api     # openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/schema.d.ts
pnpm dev         # http://localhost:3000
```

**Backend environment variables**

| Variable | Example | Secret |
| --- | --- | --- |
| DATABASE\_URL | postgresql+asyncpg://postgres:postgres@localhost:5432/taskpilot | Yes |
| JWT\_SECRET | 64 random characters | Yes |
| ACCESS\_TOKEN\_MINUTES | 15 | No |
| REFRESH\_TOKEN\_DAYS | 14 | No |
| FRONTEND\_ORIGIN | http://localhost:3000 | No |
| GROQ\_API\_KEY | gsk\_... | Yes |
| AI\_MODEL | a current Groq model name | No |
| AI\_DAILY\_LIMIT\_PER\_USER | 50 | No |
| INTAKE\_SECRET | random string | Yes |
| CRON\_SECRET | random string | Yes |
| APP\_TIMEZONE | Asia/Manila | No |

**Frontend environment variables**

| Variable | Example | Secret |
| --- | --- | --- |
| BACKEND\_URL | http://localhost:8000 | No (server-side only, used by rewrites) |

Pick the Groq model from Groq's current model list when you start; model names change over time.

## Testing and CI

Every pull request must pass lint, type checks, backend tests, frontend tests and the Playwright smoke test before merging; this is how AI-generated code is verified.

**Backend (pytest)**

- Tests run against a real Postgres (Docker locally, a service container in CI), never SQLite, so migrations and SQL behave the same as production.
- Each test runs in a transaction that is rolled back afterward.
- The AI provider is replaced with a fake that returns fixed responses, so tests are fast, free and deterministic. A separate, manually triggered test suite (`-m live_ai`) calls the real API.
- Target: 80%+ line coverage on `services/` and `core/`.

**Must-have backend tests**

| Area | Test |
| --- | --- |
| Auth | Wrong password fails; expired access token returns 401; refresh rotation; reused refresh token revokes all |
| Permissions | Viewer cannot create tasks; member cannot delete others' tasks; user from workspace A gets 404 on workspace B's task |
| Tasks | Moving a card between two cards puts it in the right order; subtask of a subtask is rejected; activity log entry created on update |
| AI quick-add | Invalid assignee id from AI becomes null with warning; invalid JSON retries once then returns AI\_UNAVAILABLE |
| Digest | Correct overdue/due today/at-risk lists; running twice same day creates one digest |
| Intake | Wrong secret returns 401; same Gmail message ID processed once |
| Import | Messy sample file maps correctly; error rows skipped; import is all-or-nothing on database error |
| Limits | 51st AI call in a day returns AI\_DAILY\_LIMIT |

**Frontend**

- Vitest + Testing Library for components with logic: QuickAddPreview, FilterBar, MappingStep, and the API client's refresh-and-retry.
- Playwright smoke test: register → create workspace → create project → quick-add a task → drag it to Done → see it in My Tasks.

**CI pipeline (`.github/workflows/ci.yml`)**

1. Backend job: `uv sync` → `ruff check` → `ruff format --check` → `mypy app` → `alembic upgrade head` → `pytest --cov`.
2. Frontend job: `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test`.
3. E2E job (after both pass): start backend and frontend, run Playwright.

Protect the `main` branch on GitHub: require pull requests and passing checks.

## Coding standards and AI workflow

The repo includes a `CLAUDE.md` so every AI coding session follows the same rules, and a short AI log in the README shows reviewers how AI was used and checked.

**Git workflow**

- One branch per feature: `feat/quick-add`, `fix/board-order`.
- Small commits using Conventional Commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
- Open a pull request for every feature, even when working alone; write a short description and review the diff yourself before merging.

**Review checklist for AI-generated code**

- Does it match the spec in this document (fields, status names, error codes)?
- Are permissions checked in the service layer, including workspace isolation?
- Are there tests for the happy path and at least one failure case?
- No new dependencies without a reason; no secrets in code.
- No dead code, unused imports or commented-out blocks.

**`CLAUDE.md` (copy into the repo root)**

```markdown
# TaskPilot – rules for AI coding assistants

## Project
AI-powered task manager. Backend: FastAPI (backend/). Frontend: Next.js (frontend/).
The full spec is in docs/TASKPILOT_SPEC.md. Follow it exactly; ask if unclear.

## Commands
- Backend: cd backend && uv run pytest | uv run ruff check . | uv run mypy app
- Migrations: uv run alembic revision --autogenerate -m "msg" && uv run alembic upgrade head
- Frontend: cd frontend && pnpm lint | pnpm typecheck | pnpm test | pnpm gen:api

## Backend rules
- Layers: routers -> services -> repositories -> models. No SQL in routers or services.
- Pydantic schemas for all input/output. Never return SQLAlchemy models.
- Every workspace-scoped query filters by workspace_id. Other workspaces' data -> 404.
- Use the error format and codes from the spec.
- All AI calls go through app/services/ai. Validate AI output with Pydantic.
- Async everywhere. Type hints required; mypy must pass.
- Every schema change needs an Alembic migration.

## Frontend rules
- TypeScript strict. Use generated types from src/lib/api/schema.d.ts; never hand-write API types.
- Server state only in TanStack Query hooks in src/hooks/.
- shadcn/ui + Tailwind only. Every page has loading, empty and error states.

## Workflow
- Before coding: list the files you will create or change.
- Write or update tests with every change. Run tests and lint before saying you are done.
- Do not add dependencies without asking.
- Keep changes focused on the current task; do not refactor unrelated code.
```

**AI log (README section)**

Keep a short table while building: date, task given to the AI, what it got wrong, how you caught it (test, review, manual check). Three to five good examples are enough to talk through in an interview.

## Deployment

The frontend deploys to Vercel, the backend to a Render free web service, and the database to Supabase, all from the same GitHub repo with auto-deploy on merge to `main`.

**Database (Supabase)**

1. Create a free project; copy the connection string (use the pooler URL, port 6543, for the app; the direct URL for migrations).
2. Run `alembic upgrade head` against it from your machine or a CI step.
3. Run `scripts/seed.py` to create the demo workspace.

**Backend (Render)**

1. New Web Service from the repo, root directory `backend`.
2. Build command: `pip install uv && uv sync --frozen`. Start command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Add all backend environment variables; set `FRONTEND_ORIGIN` to the Vercel URL.
4. Health check path: `/api/v1/health` (returns status and database connectivity).

**Frontend (Vercel)**

1. Import the repo, root directory `frontend`.
2. Set `BACKEND_URL` to the Render URL so the rewrite forwards `/api/v1/*`.

**Automations**

- Add `API_URL` and `CRON_SECRET` as GitHub Actions secrets for the digest workflow.
- Set the Apps Script's script properties: webhook URL and `INTAKE_SECRET`.

**Before a demo or interview**

- Open the site 2 minutes early to wake the Render backend.
- Log in with the seeded demo account and check the digest, board and import wizard.
- Keep a 2–3 minute recorded demo video as a backup in case free services are slow.

## Roadmap

TaskPilot takes about 7–9 weeks of part-time work in five phases; each phase ends at a gate that must pass before the next one starts.

&#91;embedded content: TaskPilot roadmap · 5 phases, 4 gates\]

If time is short before an application deadline, ship Phases 0–2 first: a working task manager with AI quick-add and digest is already a strong demo, and Phase 3 can be added after.

**Phase 0 checklist**

- [ ] Create the monorepo with `backend/` and `frontend/`
- [ ] FastAPI app with `/api/v1/health`, settings, error handlers
- [ ] Async SQLAlchemy session and first Alembic migration (users table)
- [ ] Next.js app with Tailwind, shadcn/ui and the `/api/v1` rewrite
- [ ] `pnpm gen:api` script generating types from OpenAPI
- [ ] `CLAUDE.md`, `.env.example` files, README skeleton
- [ ] CI workflow running lint, type checks and tests on push
- [ ] Branch protection on `main`

## Instructions for the AI coding assistant

Paste the block below together with this document (saved in the repo as `docs/TASKPILOT_SPEC.md`) when starting each work session.

```text
You are helping me build TaskPilot. The full specification is in
docs/TASKPILOT_SPEC.md and the coding rules are in CLAUDE.md.
Follow both exactly. If something in the spec is unclear or seems
wrong, ask me before guessing.

Work in small steps:
1. Tell me which roadmap phase and feature we are on.
2. List the files you will create or change and why. Wait for my OK.
3. Implement the change with tests (pytest for backend, Vitest or
   Playwright for frontend).
4. Run lint, type checks and tests. Fix failures before reporting.
5. Summarize what you did, what you tested, and anything I should
   check manually. Suggest a Conventional Commit message.

Rules:
- Stay inside the current phase. Do not start the next phase until
  I confirm the gate is passed.
- Use the exact names from the spec: table and column names, status
  values, endpoint paths, error codes, Pydantic model names.
- Backend layers: routers -> services -> repositories -> models.
- Every workspace-scoped query must filter by workspace_id.
- AI output must be validated with the Pydantic models in the spec,
  and AI never saves data without user confirmation (except intake
  items, which go to the review inbox).
- Ask before adding any dependency not listed in the Tech stack.
- Everything must run on free tiers.

Start with Phase 0: set up the monorepo, backend skeleton with
health endpoint, Alembic, frontend skeleton with the API rewrite,
CLAUDE.md, and the CI workflow. Stop when CI is green.
```

**Suggested session prompts after Phase 0**

- "Phase 1, F1: implement auth endpoints and tests as specified."
- "Phase 1, F3: implement the tasks service and repository, including fractional positions and the activity log."
- "Phase 2, F6: implement AI quick-add backend with the fake provider for tests, then the QuickAddBar and QuickAddPreview."
- "Phase 3, F11: implement the import wizard backend steps with the messy sample file as a test fixture."
