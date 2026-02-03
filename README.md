# EMS Home
Local-First Operations Workspace

EMS Home is the internal “home base” platform for Engineered & Manufacturing Solutions (EMS).

It is a local-first, opinionated, Notion-lite style system designed to centralize work, context, and operational knowledge without relying on subscriptions, SaaS platforms, or external dependencies.

This repository currently implements **Phase 0: Platform Foundation**.

---

## Phase 0 — Platform Foundation

### Purpose

Establish a boring, stable, and secure foundation that everything else builds on.

Nothing fancy.
Nothing fragile.
No shortcuts.

If Phase 0 is not solid, nothing built on top of it matters.

---

## Phase 0 Goals

- Application runs locally on a dedicated PC
- Secure access using local authentication
- Clear structure that will not fight future development
- Opinionated defaults over premature flexibility
- README serves as the single source of truth

---

## Definition of Done (Phase 0)

Phase 0 is considered complete when:

- The application can be started locally
- Users can log in and log out
- Role-based access is enforced:
  - Admin
  - Editor
  - Viewer
- A Home page loads after login (even if empty)
- All authenticated pages share a global layout:
  - Header
  - Sidebar navigation
  - Main content area
- A basic audit log records key system actions
- This README clearly documents:
  - Architecture
  - Folder structure
  - Permissions model
  - How to run locally
  - How to back up and restore data

---

## Locked Design Decisions

The following decisions are intentionally locked in Phase 0:

- No subscriptions
- No SaaS dependencies
- No external authentication providers
- Local-first data storage
- Runs entirely on EMS-controlled hardware
- Opinionated structure over flexibility

Network access via VPN (WireGuard, Tailscale, OpenVPN) is recommended but handled outside the application.

---

## Architecture Overview

EMS Home is a Flask application using the application factory pattern and modular blueprints.

### Request Flow

Request  
→ Flask App Factory  
→ Blueprint Route  
→ Authentication & Role Check  
→ Business Logic  
→ Database  
→ Audit Log  
→ Template Render (global layout)

### Core Concepts

- Blueprints isolate features and permissions
- Flask-Login manages sessions
- SQLite stores all data locally
- Audit logging is mandatory for system actions
- Role-based access control is enforced at the route level

---

## Folder Structure

ems_home/
├── app/
│ ├── init.py # Application factory
│ ├── config.py # Configuration classes
│ ├── extensions.py # db, login manager, etc.
│ │
│ ├── models/
│ │ ├── user.py # User + role model
│ │ └── audit.py # Audit log model
│ │
│ ├── blueprints/
│ │ ├── auth/ # Login / logout
│ │ ├── main/ # Home page
│ │ └── admin/ # User & role management
│ │
│ ├── templates/
│ │ ├── layout.html # Global layout
│ │ └── partials/ # Header, sidebar, flashes
│ │
│ └── static/
│ └── css/
│ └── app.css
│
├── instance/ # Local data (SQLite DB)
│ └── ems_home.db
│
├── migrations/ # Optional (if used)
├── tests/
├── run.py # Development entrypoint
├── wsgi.py # Production entrypoint
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md


---

## Permissions Model

EMS Home uses role-based access control.

### Roles

- Viewer  
  - Can view pages

- Editor  
  - Can view and modify content (future phases)

- Admin  
  - Full access
  - User and role management

### Enforcement Rules

- All pages require authentication unless explicitly public
- Admin routes require Admin role
- Role checks are enforced via decorators at the route level
- UI elements are hidden when permissions do not allow access

---

## Audit Logging

Phase 0 includes a basic, append-only audit log.

### Logged Events (Minimum)

- User login
- User logout
- User created
- User updated
- User disabled or enabled
- Role changes

Audit logs are stored locally and are not user-editable.

---

## Running Locally

### Clone the Repository

git clone https://github.com/<your-org>/ems-home.git
cd ems-home


### Create Virtual Environment

python3 -m venv .venv
source .venv/bin/activate


### Install Dependencies

pip install -r requirements.txt


### Configure Environment

cp .env.example .env


Set at minimum:
- FLASK_ENV
- SECRET_KEY

### Initialize Database

On first run, the SQLite database is created automatically in:

instance/ems_home.db


### Run the Application

Development:

python run.py


Production-style:

gunicorn wsgi:app


---

## Data Storage

- All data is stored locally
- SQLite database lives in `/instance`
- `/instance` is gitignored
- No external services required

---

## Backup and Restore

### Backup

1. Stop the application
2. Copy the database file:

cp instance/ems_home.db /path/to/backup/ems_home_YYYY-MM-DD.db


3. Restart the application

### Restore

1. Stop the application
2. Replace the database file:

cp ems_home_backup.db instance/ems_home.db


3. Restart the application

---

## Security Notes

- Passwords are hashed (never stored in plain text)
- Sessions managed by Flask-Login
- SECRET_KEY must never be committed
- Intended for trusted local networks or VPN access
- This is an internal operations platform, not a public-facing app

---

## Out of Scope for Phase 0

The following are intentionally excluded:

- Notes or documents
- Projects or tasks
- Metrics or dashboards
- Search or tagging
- File uploads
- Integrations
- Automation

These will be introduced in later phases.

---

## Roadmap (High Level)

- Phase 0 — Platform Foundation
- Phase 1 — Core Content
- Phase 2 — Metrics and Operational Views
- Phase 3 — Automation and Integrations
- Phase 4 — Advanced Analytics

Each phase builds on the previous one without rewriting the foundation.

---

Stability first.
Clarity over cleverness.
Foundations before features.
