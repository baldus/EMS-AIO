# EMS Home
Local-First Operations Workspace

EMS Home is a local-first, Notion-lite workspace for Engineered & Manufacturing Solutions (EMS). It runs entirely on a dedicated PC with no SaaS dependencies or subscriptions.

---

## Phase 0 — Platform Foundation

Phase 0 established authentication, RBAC, a global layout shell, and append-only audit logging with local SQLite storage.

## Phase 2 — Structured Data (Databases)

### Goal
Phase 2 introduces first-class relational databases for Tasks, Projects, and Companies with server-rendered table/detail views, saved views, and relationship workflows.

### Scope delivered
- Structured SQLAlchemy models for `Company`, `Project`, `Task`, `SavedView`, and task-to-page linking (`task_page_links`).
- New `/db/*` blueprint with list/detail/create/edit/delete routes.
- Query-parameter filtering, sorting, and search for each table view.
- Per-user saved views with optional per-database default.
- Relationship UX:
  - Task ↔ Project + Task ↔ Page links
  - Project ↔ Company + quick-add Task
  - Company ↔ Projects + quick-add Project
- Audit log entries on all create/update/delete actions for tasks/projects/companies.
- Lightweight SQLite-compatible SQL migration script and apply command.

---

## Architecture Overview

### App Factory + Blueprints
- **Factory**: `create_app()` in `app/__init__.py`
- **Blueprints**:
  - `auth`: login/logout
  - `main`: home page
  - `admin`: user management
  - `databases`: structured data UI under `/db/*`
- **Extensions**: SQLAlchemy + Flask-Login in `app/extensions.py`
- **Models**: in `app/models.py`

### Migration approach
EMS Home uses a lightweight SQL migration script approach (no external migration service):
- SQL scripts live under `app/migrations/`
- Applied via `flask apply-migrations`
- Applied automatically in `create_app()` for idempotent startup safety

---

## Folder Structure

```
EMS-AIO/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   ├── decorators.py
│   ├── models.py
│   ├── migrations.py
│   ├── migrations/
│   │   └── phase2_structured_data.sql
│   ├── auth/
│   ├── main/
│   ├── admin/
│   ├── databases/
│   │   ├── __init__.py
│   │   └── routes.py
│   └── templates/
│       ├── layout.html
│       ├── databases/
│       │   ├── tasks_list.html
│       │   ├── projects_list.html
│       │   ├── companies_list.html
│       │   ├── task_detail.html
│       │   ├── project_detail.html
│       │   ├── company_detail.html
│       │   ├── task_form.html
│       │   ├── project_form.html
│       │   ├── company_form.html
│       │   └── _saved_view.html
├── tests/
│   ├── conftest.py
│   └── test_phase2_databases.py
└── README.md
```

---

## Schema Definitions (Phase 2)

### Company
- `id` (PK)
- `name` (required)
- `status` (`active` / `inactive`)
- `created_by_user_id` (FK → `user.id`)
- `created_at`, `updated_at`

### Project
- `id` (PK)
- `name` (required)
- `status` (`idea` / `active` / `blocked` / `done` / `archived`)
- `company_id` (nullable FK → `company.id`, `ON DELETE SET NULL`)
- `created_by_user_id` (FK → `user.id`)
- `created_at`, `updated_at`

### Task
- `id` (PK)
- `title` (required)
- `status` (`backlog` / `next` / `doing` / `blocked` / `done` / `archived`)
- `due_date` (nullable)
- `project_id` (nullable FK → `project.id`, `ON DELETE SET NULL`)
- `created_by_user_id` (FK → `user.id`)
- `created_at`, `updated_at`

### Task ↔ Page links
- Table: `task_page_links`
- Fields: `task_id` (FK → `task.id`), `page_id` (FK → `page.id`)
- Composite PK enforces uniqueness of (`task_id`, `page_id`)
- Cascade delete when a linked task is deleted

### SavedView
- `id` (PK)
- `user_id` (FK → `user.id`)
- `database_key` (`tasks` | `projects` | `companies`)
- `name`
- `query_json` (filters/sort/search payload)
- `is_default` (boolean)
- `created_at`, `updated_at`

---

## Data Integrity Rules

- Deleting a **Company** sets `project.company_id = NULL`.
- Deleting a **Project** sets `task.project_id = NULL`.
- Deleting a **Task** removes its `task_page_links`.
- Archived items are hidden by default; pass `include_archived=1` to show them.

---

## Route Reference (Phase 2)

All routes require login.

| Route | Methods | Purpose |
|---|---|---|
| `/db/tasks` | GET | List tasks (filter/sort/search) |
| `/db/projects` | GET | List projects (filter/sort/search) |
| `/db/companies` | GET | List companies (filter/sort/search) |
| `/db/tasks/new` | GET, POST | Create task |
| `/db/projects/new` | GET, POST | Create project |
| `/db/companies/new` | GET, POST | Create company |
| `/db/tasks/<id>` | GET | Task detail |
| `/db/projects/<id>` | GET | Project detail |
| `/db/companies/<id>` | GET | Company detail |
| `/db/tasks/<id>/edit` | GET, POST | Edit task |
| `/db/projects/<id>/edit` | GET, POST | Edit project |
| `/db/companies/<id>/edit` | GET, POST | Edit company |
| `/db/tasks/<id>/delete` | POST | Delete task |
| `/db/projects/<id>/delete` | POST | Delete project |
| `/db/companies/<id>/delete` | POST | Delete company |
| `/db/tasks/<id>/pages` | POST | Link/unlink task-page relationship |
| `/db/<db_key>/views/save` | POST | Save current query state as named view |
| `/db/<db_key>/views/<view_id>/default` | POST | Mark view as default for user/database |
| `/db/<db_key>/views/<view_id>/delete` | POST | Delete saved view |
| `/db/projects/<id>/quick-add-task` | POST | Quick-add task under project |
| `/db/companies/<id>/quick-add-project` | POST | Quick-add project under company |

---

## Permissions Matrix (RBAC)

| Capability | Viewer | Editor | Admin |
|---|---:|---:|---:|
| View Tasks/Projects/Companies | ✅ | ✅ | ✅ |
| Create Tasks/Projects/Companies | ❌ | ✅ | ✅ |
| Edit own Tasks/Projects/Companies | ❌ | ✅ | ✅ |
| Edit others' Tasks/Projects/Companies | ❌ | ❌ | ✅ |
| Delete own Tasks/Projects/Companies | ❌ | ✅ | ✅ |
| Delete others' Tasks/Projects/Companies | ❌ | ❌ | ✅ |
| Save/load views | load only | ✅ | ✅ |

---

## Querystring Contract

List routes accept:
- `q=` free-text search over the primary name/title and related parent where relevant
- `status=` exact match
- `project_id=` (tasks list)
- `company_id=` (projects list)
- `sort=` `title|name|status|updated_at|due_date` (due_date valid for tasks)
- `dir=` `asc|desc`
- `include_archived=1` to include archived rows


## Saved Views Behavior

- Saved views are scoped by `(user_id, database_key, name)`.
- Saving updates existing view if the same name already exists for that user/database.
- A single default view can be set per user/database (existing default is unset when a new default is chosen).
- Stored state includes: search query, filters, sort field, sort direction, related-entity filters, and `include_archived`.

---

## Audit Logging

AuditLog records create/update/delete for structured entities:
- `task_created`, `task_updated`, `task_deleted`
- `project_created`, `project_updated`, `project_deleted`
- `company_created`, `company_updated`, `company_deleted`

Entity type and entity ID are persisted for each action.

---

## Running Locally

### 1) Setup
```bash
git clone <your-repo-url>
cd EMS-AIO
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2) Apply migrations
```bash
flask apply-migrations
```

### 3) Start app
```bash
./start_ems_home.sh
```

---

## Verify Phase 2 Locally

1. Login as Admin or Editor.
2. Open `/db/companies`, create a company.
3. Open company detail, quick-add a project.
4. Open project detail, quick-add a task.
5. Open task detail, link/unlink a page.
6. On each list page, apply filters/sort/search and save current view.
7. Confirm archived records are hidden by default and shown with `include_archived=1`.
8. Confirm Viewer cannot create/edit/delete records.

---

## Backup & Restore

Data remains local in SQLite (`instance/ems_home.db` by default). Backup/restore remains file-copy based.

---

Stability first. Clarity over cleverness. Foundations before features.
