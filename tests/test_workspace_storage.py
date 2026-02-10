from tests.conftest import login
from app.models import get_setting


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
