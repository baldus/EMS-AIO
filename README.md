# EMS Home
Local-First Operations Workspace

EMS Home is a local-first, Notion-lite workspace for Engineered & Manufacturing Solutions (EMS). It runs entirely on a dedicated PC with no SaaS dependencies or subscriptions. Phase 0 focuses on secure local authentication, foundational navigation, and audit logging.

---

## Phase 0 — Platform Foundation

### Purpose
Build a stable, boring foundation that future phases can trust. This phase avoids unnecessary complexity and keeps all data on local hardware.

### Definition of Done
Phase 0 is complete when:

- The app runs locally on a dedicated PC.
- Users can log in/out with local username/password.
- Roles exist and are enforced: **Admin**, **Editor**, **Viewer**.
- All authenticated pages share a global layout (header + sidebar + main).
- A basic local audit log records key actions.
- This README documents architecture, permissions, run steps, and backup/restore.

---

## Architecture Overview

### App Factory + Blueprints
EMS Home uses a Flask application factory to keep configuration, extensions, and blueprints cleanly isolated.

- **Factory**: `create_app()` in `app/__init__.py`
- **Blueprints**:
  - `auth`: login/logout
  - `main`: home page
  - `admin`: user management
- **Extensions**: SQLAlchemy + Flask-Login in `app/extensions.py`
- **Models**: `User`, `AuditLog` in `app/models.py`

### Data + Session Flow (Phase 0)
1. Flask app factory initializes configuration and extensions.
2. Blueprints register routes.
3. Flask-Login enforces login and session handling.
4. SQLAlchemy stores users and audit logs in local SQLite.
5. Templates render within the authenticated layout shell.

---

## Folder Structure

```
EMS-AIO/
├── app/
│   ├── __init__.py        # App factory, CLI commands, setup
│   ├── config.py          # Development/Production config
│   ├── extensions.py      # SQLAlchemy + LoginManager
│   ├── decorators.py      # RBAC helpers
│   ├── models.py          # User + AuditLog models
│   ├── auth/
│   │   ├── __init__.py
│   │   └── routes.py       # /login, /logout
│   ├── main/
│   │   ├── __init__.py
│   │   └── routes.py       # / (home)
│   ├── admin/
│   │   ├── __init__.py
│   │   └── routes.py       # /admin/users
│   └── templates/
│       ├── layout.html     # Global header + sidebar
│       ├── login.html
│       ├── home.html
│       ├── admin/
│       │   ├── users.html
│       │   └── user_form.html
│       └── errors/403.html
├── instance/               # Local SQLite DB (gitignored)
├── .env.example            # Environment variables template
├── .gitignore
├── requirements.txt
├── run.py                  # Local dev entrypoint
├── wsgi.py                 # Production entrypoint
└── README.md
```

---

## Permissions Model (RBAC)

### Roles
- **Viewer**: Can view pages.
- **Editor**: Future ability to edit content.
- **Admin**: Full access, including user management.

### Enforcement
- All routes (except `/login` and static assets) are protected by `@login_required`.
- Admin routes under `/admin/*` require `@roles_required("Admin")`.
- Admin-only UI links are hidden for non-admins.

---

## Audit Logging

Phase 0 stores an append-only audit log locally:

- Login and logout events.
- User created/updated/disabled actions.
- Role changes and password resets.

Audit logs are stored in the local SQLite DB and are not editable by users.

---

## Running Locally

### 1) Clone and set up a virtual environment

```bash
git clone <your-repo-url>
cd EMS-AIO
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `SECRET_KEY` (required; do not commit)
- `FLASK_CONFIG` (`development` or `production`)

### 4) Initialize the database

The SQLite database is created automatically on first run at:

```
instance/ems_home.db
```

### 5) Create your first Admin user

```bash
flask --app run.py create-admin <username>
```

You will be prompted for a password.

### 6) Run the application

**Development**
```bash
python run.py
```

**Production-style (example)**
```bash
gunicorn wsgi:app
```

### Typical startup procedure (daily use)

```bash
cd EMS-AIO
source .venv/bin/activate
export FLASK_CONFIG=development
export SECRET_KEY=change-me
python run.py
```

If you manage environment variables in a `.env` file, load them before starting the app:

```bash
set -a
source .env
set +a
python run.py
```

---

## Backup & Restore

### Where data lives
- SQLite database: `instance/ems_home.db`

### Backup procedure
1. Stop the app.
2. Copy the database file:

```bash
cp instance/ems_home.db /path/to/backup/ems_home_$(date +%F).db
```

3. Restart the app.

### Restore procedure
1. Stop the app.
2. Replace the database file:

```bash
cp /path/to/backup/ems_home_YYYY-MM-DD.db instance/ems_home.db
```

3. Restart the app.

---

## Security Notes

- Passwords are hashed using Werkzeug (`generate_password_hash` / `check_password_hash`).
- Sessions are managed by Flask-Login.
- `SECRET_KEY` must be unique and never committed.
- Run behind VPN (WireGuard/Tailscale/OpenVPN) when remote access is required.
- The app is intended for trusted internal networks only.

---

## Out of Scope (Phase 0)

The following are intentionally excluded until later phases:

- Notes, documents, or attachments
- Projects, tasks, or metrics dashboards
- Search or tagging
- External integrations
- Automation

---

Stability first. Clarity over cleverness. Foundations before features.
