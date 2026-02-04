import json

from app.extensions import db
from app.models import Block, Page
from tests.conftest import login


def test_viewer_permissions(client, viewer):
    login(client, "viewer")

    response = client.post("/pages", data={"title": "Blocked"})
    assert response.status_code == 403

    response = client.post("/pages/quick_capture", data={"capture_text": "Test"})
    assert response.status_code == 403

    with client.application.app_context():
        page = Page(title="Viewer Page")
        db.session.add(page)
        db.session.commit()
        page_id = page.id

    response = client.get(f"/pages/{page_id}/edit")
    assert response.status_code == 403

    response = client.post(f"/pages/{page_id}/archive")
    assert response.status_code == 403

    response = client.post(f"/pages/{page_id}/restore")
    assert response.status_code == 403


def test_editor_quick_capture_creates_page_and_block(client, editor):
    login(client, "editor")

    response = client.post("/pages/quick_capture", data={"capture_text": "Quick note"})
    assert response.status_code == 302

    with client.application.app_context():
        page = Page.query.filter_by(title="Untitled").first()
        assert page is not None
        block = Block.query.filter_by(page_id=page.id).first()
        assert block is not None
        assert block.type == "text"
        assert block.content_json["text"] == "Quick note"


def test_invalid_block_type_rejected(client, editor):
    login(client, "editor")

    with client.application.app_context():
        page = Page(title="Editable")
        db.session.add(page)
        db.session.commit()
        page_id = page.id

    payload = [{"id": None, "type": "unknown", "content": {}}]
    response = client.post(
        f"/pages/{page_id}/save",
        data={"title": "Editable", "blocks_payload": json.dumps(payload)},
    )
    assert response.status_code == 400


def test_archive_and_restore_flow(client, editor):
    login(client, "editor")

    with client.application.app_context():
        page = Page(title="Archive Me")
        db.session.add(page)
        db.session.commit()
        page_id = page.id

    response = client.post(f"/pages/{page_id}/archive", follow_redirects=True)
    assert response.status_code == 200
    assert b"Archive Me" not in response.data

    response = client.get("/pages/archived")
    assert b"Archive Me" in response.data

    response = client.post(f"/pages/{page_id}/restore", follow_redirects=True)
    assert response.status_code == 200
    assert b"Archive Me" in response.data
