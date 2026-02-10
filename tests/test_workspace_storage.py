from pathlib import Path

from app import create_app
from app.extensions import db
from app.models import User, get_setting
from tests.conftest import login


def test_non_admin_gets_friendly_workspace_message_when_not_configured(client, app):
    with app.app_context():
        app.config["SQLALCHEMY_BINDS"] = {}

    login(client, "viewer")
    response = client.get("/db/tasks", follow_redirects=True)
    assert response.status_code == 200
    assert b"Workspace setup required" in response.data


def test_admin_storage_save_default_and_prompt_restart(client):
    login(client, "admin")
    response = client.post(
        "/admin/storage",
        data={"mode": "default"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Restart required" in response.data
    with client.application.app_context():
        assert get_setting("workspace_database_url") is not None


def test_blank_core_and_workspace_env_boots_with_absolute_core_db(monkeypatch, tmp_path):
    monkeypatch.setenv("FLASK_CONFIG", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.setenv("CORE_DATABASE_URL", "   ")
    monkeypatch.setenv("WORKSPACE_DATABASE_URL", "   ")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    app = create_app()
    app.config.update(TESTING=True)

    with app.app_context():
        db.create_all(bind_key=None)
        user = User(username="core_only_admin", role="Admin", is_active=True)
        user.set_password("pw")
        db.session.add(user)
        db.session.commit()

        core_uri = app.config["SQLALCHEMY_DATABASE_URI"]
        assert core_uri.startswith("sqlite:///")
        core_path = Path(core_uri.removeprefix("sqlite:///"))
        assert core_path.is_absolute()
        assert core_path.name == "ems_home_core.db"
        assert core_path.exists()
        assert "workspace" not in app.config.get("SQLALCHEMY_BINDS", {})
