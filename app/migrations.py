from pathlib import Path

from sqlalchemy import text

from app.extensions import db


def apply_sql_migration(migration_id: str, script_path: Path):
    db.session.execute(
        text(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "migration_id TEXT PRIMARY KEY, "
            "applied_at TEXT NOT NULL)"
        )
    )
    exists = db.session.execute(
        text("SELECT migration_id FROM schema_migrations WHERE migration_id = :migration_id"),
        {"migration_id": migration_id},
    ).scalar()
    if exists:
        db.session.commit()
        return False

    sql = script_path.read_text(encoding="utf-8")
    conn = db.session.connection()
    for statement in [part.strip() for part in sql.split(";") if part.strip()]:
        conn.exec_driver_sql(statement)

    db.session.execute(
        text("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (:migration_id, datetime('now'))"),
        {"migration_id": migration_id},
    )
    db.session.commit()
    return True


def apply_all_migrations(app):
    migration_root = Path(app.root_path) / "migrations"
    migration = migration_root / "phase2_structured_data.sql"
    if migration.exists():
        apply_sql_migration("phase2_structured_data", migration)
