import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app import create_app  # noqa: E402
from app.extensions import db
from app.models import User


@pytest.fixture
def app():
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["FLASK_CONFIG"] = "development"
    app = create_app()
    app.config.update(TESTING=True)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def _create_user(username, role):
    user = User(username=username, role=role, is_active=True)
    user.set_password("password")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def viewer(app):
    with app.app_context():
        return _create_user("viewer", "Viewer")


@pytest.fixture
def editor(app):
    with app.app_context():
        return _create_user("editor", "Editor")


@pytest.fixture
def admin(app):
    with app.app_context():
        return _create_user("admin", "Admin")


def login(client, username, password="password"):
    return client.post(
        "/login",
        data={"username": username, "password": password},
        follow_redirects=True,
    )
