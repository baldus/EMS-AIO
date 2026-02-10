from tests.conftest import login
from app.extensions import db
from app.models import Page, Project, SavedView, Task, User


def test_rbac_viewer_cannot_create_task(client):
    login(client, "viewer")
    response = client.post("/db/tasks/new", data={"title": "Nope", "status": "backlog"})
    assert response.status_code == 403


def test_rbac_editor_only_edits_owned_project(client, app):
    with app.app_context():
        admin = User.query.filter_by(username="admin").first()
        editor = User.query.filter_by(username="editor").first()
        project = Project(name="Admin Project", status="active", created_by_user_id=admin.id)
        own_project = Project(name="Own Project", status="active", created_by_user_id=editor.id)
        db.session.add_all([project, own_project])
        db.session.commit()
        forbidden_id = project.id
        allowed_id = own_project.id

    login(client, "editor")
    forbidden = client.post(f"/db/projects/{forbidden_id}/edit", data={"name": "Change", "status": "active"})
    allowed = client.post(f"/db/projects/{allowed_id}/edit", data={"name": "Changed", "status": "active"})
    assert forbidden.status_code == 403
    assert allowed.status_code == 302


def test_saved_view_create_set_default_load_and_delete(client, app):
    login(client, "editor")
    save_response = client.post(
        "/db/tasks/views/save?status=doing&sort=title&dir=asc",
        data={"view_name": "Doing by title", "status": "doing", "sort": "title", "dir": "asc", "is_default": "on"},
        follow_redirects=True,
    )
    assert save_response.status_code == 200

    with app.app_context():
        editor = User.query.filter_by(username="editor").first()
        saved = SavedView.query.filter_by(user_id=editor.id, database_key="tasks", name="Doing by title").first()
        assert saved is not None
        assert saved.query_json["status"] == "doing"
        assert saved.is_default is True
        view_id = saved.id

    set_default_response = client.post(
        f"/db/tasks/views/{view_id}/default",
        follow_redirects=False,
    )
    assert set_default_response.status_code == 302

    load_response = client.get(f"/db/tasks?view_id={view_id}&use_view=1", follow_redirects=False)
    assert load_response.status_code == 302
    assert "status=doing" in load_response.location

    delete_response = client.post(f"/db/tasks/views/{view_id}/delete", follow_redirects=False)
    assert delete_response.status_code == 302
    with app.app_context():
        assert SavedView.query.get(view_id) is None


def test_task_page_linking(client, app):
    with app.app_context():
        editor = User.query.filter_by(username="editor").first()
        page = Page(title="Ops Note")
        task = Task(title="Wire form", status="backlog", created_by_user_id=editor.id)
        db.session.add_all([page, task])
        db.session.commit()
        task_id = task.id
        page_id = page.id

    login(client, "editor")
    response = client.post(
        f"/db/tasks/{task_id}/pages",
        data={"page_id": page_id, "action": "link"},
        follow_redirects=False,
    )
    assert response.status_code == 302

    with app.app_context():
        task = Task.query.get(task_id)
        assert len(task.task_page_links) == 1
        assert task.task_page_links[0].page_id == page_id
