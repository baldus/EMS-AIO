import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os

import pytest

from app import create_app
from app.extensions import db
from app.models import User


@pytest.fixture
def app(tmp_path):
    os.environ["FLASK_CONFIG"] = "development"
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'test.db'}"
    os.environ["SECRET_KEY"] = "test-secret"

    app = create_app()
    app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)

    with app.app_context():
        db.drop_all()
        db.create_all()

        admin = User(username="admin", role="Admin", is_active=True)
        admin.set_password("pw")
        editor = User(username="editor", role="Editor", is_active=True)
        editor.set_password("pw")
        viewer = User(username="viewer", role="Viewer", is_active=True)
        viewer.set_password("pw")
        db.session.add_all([admin, editor, viewer])
        db.session.commit()

    yield app


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, username, password="pw"):
    return client.post("/login", data={"username": username, "password": password}, follow_redirects=True)
