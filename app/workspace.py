import os
import sqlite3
from pathlib import Path

from flask import current_app
from sqlalchemy import inspect
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db

WORKSPACE_SETTING_KEY = "workspace_database_url"
DEFAULT_WORKSPACE_NAME = "ems_home_workspace.db"
WORKSPACE_TABLES = {"page", "company", "project", "task", "task_page_links", "saved_view"}


def clean_url(value):
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def default_workspace_url(instance_path: str) -> str:
    return f"sqlite:///{Path(instance_path) / DEFAULT_WORKSPACE_NAME}"


def _read_workspace_setting_from_core_sqlite(core_db_url: str) -> str | None:
    try:
        parsed = make_url(core_db_url)
    except Exception:
        return None

    if parsed.drivername != "sqlite" or parsed.database is None:
        return None

    db_path = Path(parsed.database)
    if not db_path.exists():
        return None

    try:
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                "SELECT value FROM app_setting WHERE key = ? LIMIT 1",
                (WORKSPACE_SETTING_KEY,),
            ).fetchone()
    except sqlite3.Error:
        return None

    return clean_url(row[0]) if row else None


def resolve_workspace_url(core_db_url: str, env_workspace_url: str | None) -> str | None:
    explicit = clean_url(env_workspace_url)
    if explicit:
        return explicit
    return _read_workspace_setting_from_core_sqlite(core_db_url)


def workspace_configured(app=None) -> bool:
    app = app or current_app
    binds = app.config.get("SQLALCHEMY_BINDS") or {}
    return bool(clean_url(binds.get("workspace")))


def workspace_ready() -> bool:
    if not workspace_configured():
        return False
    try:
        engine = db.engines.get("workspace")
    except Exception:
        return False
    if engine is None:
        return False

    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    return WORKSPACE_TABLES.issubset(existing)


def validate_workspace_url(workspace_url: str) -> tuple[bool, str | None]:
    candidate = clean_url(workspace_url)
    if not candidate:
        return False, "Workspace database URL is required."

    try:
        parsed = make_url(candidate)
    except SQLAlchemyError:
        return False, "Invalid SQLAlchemy URL."
    except Exception:
        return False, "Invalid SQLAlchemy URL."

    if parsed.drivername.startswith("sqlite"):
        db_path = Path(parsed.database or "")
        if not db_path.is_absolute():
            db_path = Path(current_app.root_path).parent / db_path
        parent = db_path.parent
        try:
            parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            return False, f"Cannot create directory for SQLite database: {parent}"
        if not os.access(parent, os.W_OK):
            return False, f"Directory is not writable: {parent}"

    return True, None
