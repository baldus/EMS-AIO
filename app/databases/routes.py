from datetime import datetime

from flask import abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from app.databases import databases_bp
from app.extensions import db
from app.models import (
    COMPANY_STATUS_CHOICES,
    DATABASE_KEYS,
    PROJECT_STATUS_CHOICES,
    TASK_STATUS_CHOICES,
    AuditLog,
    Company,
    Page,
    Project,
    SavedView,
    Task,
    TaskPageLink,
)

LIST_ENDPOINTS = {
    "tasks": "databases.tasks_list",
    "projects": "databases.projects_list",
    "companies": "databases.companies_list",
}


def _is_editor_owned(entity):
    return current_user.role == "Admin" or entity.created_by_user_id == current_user.id


def _ensure_can_edit(entity):
    if current_user.role == "Viewer":
        abort(403)
    if current_user.role == "Editor" and not _is_editor_owned(entity):
        abort(403)


def _log_action(action, entity_type, entity_id, metadata=None):
    db.session.add(
        AuditLog(
            actor_user_id=current_user.id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            metadata_json=metadata,
            ip_address=request.remote_addr,
        )
    )


def _parse_query_state():
    direction = request.args.get("dir", request.args.get("direction", "desc")).strip().lower()
    if direction not in {"asc", "desc"}:
        direction = "desc"
    return {
        "q": request.args.get("q", "").strip(),
        "status": request.args.get("status", "").strip(),
        "sort": request.args.get("sort", "updated_at").strip(),
        "dir": direction,
        "include_archived": request.args.get("include_archived", "0").strip(),
        "project_id": request.args.get("project_id", "").strip(),
        "company_id": request.args.get("company_id", "").strip(),
    }


def _apply_view_args(view):
    if not view:
        return redirect(request.path)
    args = dict(view.query_json or {})
    args["view_id"] = view.id
    return redirect(url_for(request.endpoint, **args))


def _save_view(database_key):
    if current_user.role == "Viewer":
        abort(403)
    view_name = request.form.get("view_name", "").strip()
    if not view_name:
        flash("View name is required.", "error")
        return

    if database_key not in DATABASE_KEYS:
        abort(404)

    is_default = request.form.get("is_default") == "on"
    query_json = {
        "q": request.form.get("q", "").strip(),
        "status": request.form.get("status", "").strip(),
        "sort": request.form.get("sort", "updated_at").strip(),
        "dir": request.form.get("dir", "desc").strip(),
        "include_archived": request.form.get("include_archived", "0").strip(),
        "project_id": request.form.get("project_id", "").strip(),
        "company_id": request.form.get("company_id", "").strip(),
    }

    if is_default:
        SavedView.query.filter_by(
            user_id=current_user.id,
            database_key=database_key,
            is_default=True,
        ).update({"is_default": False})

    saved_view = SavedView.query.filter_by(
        user_id=current_user.id,
        database_key=database_key,
        name=view_name,
    ).first()
    if saved_view:
        saved_view.query_json = query_json
        saved_view.is_default = is_default
    else:
        saved_view = SavedView(
            user_id=current_user.id,
            database_key=database_key,
            name=view_name,
            query_json=query_json,
            is_default=is_default,
        )
        db.session.add(saved_view)

    db.session.commit()
    flash("Saved view updated.", "success")


def _prepare_list_context(database_key):
    if database_key not in LIST_ENDPOINTS:
        abort(404)

    if request.args.get("use_default") == "1":
        default_view = SavedView.query.filter_by(
            user_id=current_user.id,
            database_key=database_key,
            is_default=True,
        ).first()
        if default_view:
            return _apply_view_args(default_view)

    view_id = request.args.get("view_id", type=int)
    saved_views = SavedView.query.filter_by(
        user_id=current_user.id,
        database_key=database_key,
    ).order_by(SavedView.name.asc())
    selected_view = SavedView.query.get(view_id) if view_id else None

    if selected_view and selected_view.user_id != current_user.id:
        abort(403)

    if selected_view and request.args.get("use_view") == "1":
        return _apply_view_args(selected_view)

    return {
        "query": _parse_query_state(),
        "saved_views": saved_views,
        "selected_view": selected_view,
    }


def _set_default_view(view):
    SavedView.query.filter_by(
        user_id=current_user.id,
        database_key=view.database_key,
        is_default=True,
    ).update({"is_default": False})
    view.is_default = True
    db.session.commit()


@databases_bp.route("/<string:db_key>/views/save", methods=["POST"])
@login_required
def save_view(db_key):
    if db_key not in LIST_ENDPOINTS:
        abort(404)
    _save_view(db_key)
    return redirect(url_for(LIST_ENDPOINTS[db_key], **request.args))


@databases_bp.route("/<string:db_key>/views/<int:view_id>/delete", methods=["POST"])
@login_required
def delete_view(db_key, view_id):
    if db_key not in LIST_ENDPOINTS or current_user.role == "Viewer":
        abort(403)
    view = SavedView.query.get_or_404(view_id)
    if view.user_id != current_user.id or view.database_key != db_key:
        abort(403)
    db.session.delete(view)
    db.session.commit()
    flash("Saved view deleted.", "success")
    return redirect(url_for(LIST_ENDPOINTS[db_key], **request.args))


@databases_bp.route("/<string:db_key>/views/<int:view_id>/default", methods=["POST"])
@login_required
def set_default_view(db_key, view_id):
    if db_key not in LIST_ENDPOINTS or current_user.role == "Viewer":
        abort(403)
    view = SavedView.query.get_or_404(view_id)
    if view.user_id != current_user.id or view.database_key != db_key:
        abort(403)
    _set_default_view(view)
    flash("Default view set.", "success")
    return redirect(url_for(LIST_ENDPOINTS[db_key], **request.args))


@databases_bp.route("/tasks", methods=["GET"])
@login_required
def tasks_list():
    context = _prepare_list_context("tasks")
    if not isinstance(context, dict):
        return context

    query_state = context["query"]
    query = Task.query.outerjoin(Project)

    if query_state["q"]:
        q = f"%{query_state['q']}%"
        query = query.filter(or_(Task.title.ilike(q), Project.name.ilike(q)))
    if query_state["status"]:
        query = query.filter(Task.status == query_state["status"])
    if query_state["project_id"]:
        query = query.filter(Task.project_id == int(query_state["project_id"]))
    if query_state["include_archived"] != "1":
        query = query.filter(Task.status != "archived")

    sort_field = {
        "title": Task.title,
        "status": Task.status,
        "updated_at": Task.updated_at,
        "due_date": Task.due_date,
    }.get(query_state["sort"], Task.updated_at)
    if query_state["dir"] == "asc":
        query = query.order_by(sort_field.asc())
    else:
        query = query.order_by(sort_field.desc())

    tasks = query.all()
    projects = Project.query.order_by(Project.name.asc()).all()
    return render_template(
        "databases/tasks_list.html",
        tasks=tasks,
        projects=projects,
        statuses=TASK_STATUS_CHOICES,
        database_key="tasks",
        **context,
    )


@databases_bp.route("/projects", methods=["GET"])
@login_required
def projects_list():
    context = _prepare_list_context("projects")
    if not isinstance(context, dict):
        return context

    query_state = context["query"]
    query = Project.query.outerjoin(Company)

    if query_state["q"]:
        q = f"%{query_state['q']}%"
        query = query.filter(or_(Project.name.ilike(q), Company.name.ilike(q)))
    if query_state["status"]:
        query = query.filter(Project.status == query_state["status"])
    if query_state["company_id"]:
        query = query.filter(Project.company_id == int(query_state["company_id"]))
    if query_state["include_archived"] != "1":
        query = query.filter(Project.status != "archived")

    sort_field = {
        "name": Project.name,
        "status": Project.status,
        "updated_at": Project.updated_at,
    }.get(query_state["sort"], Project.updated_at)
    query = query.order_by(sort_field.asc() if query_state["dir"] == "asc" else sort_field.desc())

    projects = query.all()
    companies = Company.query.order_by(Company.name.asc()).all()
    return render_template(
        "databases/projects_list.html",
        projects=projects,
        companies=companies,
        statuses=PROJECT_STATUS_CHOICES,
        database_key="projects",
        **context,
    )


@databases_bp.route("/companies", methods=["GET"])
@login_required
def companies_list():
    context = _prepare_list_context("companies")
    if not isinstance(context, dict):
        return context

    query_state = context["query"]
    query = Company.query

    if query_state["q"]:
        query = query.filter(Company.name.ilike(f"%{query_state['q']}%"))
    if query_state["status"]:
        query = query.filter(Company.status == query_state["status"])
    if query_state["include_archived"] != "1":
        query = query.filter(Company.status != "archived")

    sort_field = {
        "name": Company.name,
        "status": Company.status,
        "updated_at": Company.updated_at,
    }.get(query_state["sort"], Company.updated_at)
    query = query.order_by(sort_field.asc() if query_state["dir"] == "asc" else sort_field.desc())

    companies = query.all()
    return render_template(
        "databases/companies_list.html",
        companies=companies,
        statuses=COMPANY_STATUS_CHOICES,
        database_key="companies",
        **context,
    )


@databases_bp.route("/tasks/<int:task_id>")
@login_required
def task_detail(task_id):
    task = Task.query.get_or_404(task_id)
    pages = Page.query.order_by(Page.title.asc()).all()
    linked_page_ids = {link.page_id for link in task.task_page_links}
    return render_template("databases/task_detail.html", task=task, pages=pages, linked_page_ids=linked_page_ids)


@databases_bp.route("/projects/<int:project_id>")
@login_required
def project_detail(project_id):
    project = Project.query.get_or_404(project_id)
    return render_template("databases/project_detail.html", project=project, task_statuses=TASK_STATUS_CHOICES)


@databases_bp.route("/companies/<int:company_id>")
@login_required
def company_detail(company_id):
    company = Company.query.get_or_404(company_id)
    return render_template("databases/company_detail.html", company=company)


@databases_bp.route("/tasks/new", methods=["GET", "POST"])
@login_required
def task_create():
    if current_user.role == "Viewer":
        abort(403)
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        status = request.form.get("status", "backlog")
        due_date_raw = request.form.get("due_date", "").strip()
        project_id = request.form.get("project_id", type=int)

        if not title:
            flash("Task title is required.", "error")
        elif status not in TASK_STATUS_CHOICES:
            flash("Invalid task status.", "error")
        else:
            due_date = None
            if due_date_raw:
                due_date = datetime.strptime(due_date_raw, "%Y-%m-%d").date()
            task = Task(
                title=title,
                status=status,
                due_date=due_date,
                project_id=project_id,
                created_by_user_id=current_user.id,
            )
            db.session.add(task)
            db.session.flush()
            _log_action("task_created", "Task", task.id)
            db.session.commit()
            flash("Task created.", "success")
            return redirect(url_for("databases.task_detail", task_id=task.id))

    return render_template("databases/task_form.html", task=None, projects=Project.query.order_by(Project.name.asc()))


@databases_bp.route("/tasks/<int:task_id>/edit", methods=["GET", "POST"])
@login_required
def task_edit(task_id):
    task = Task.query.get_or_404(task_id)
    _ensure_can_edit(task)

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        status = request.form.get("status", task.status)
        due_date_raw = request.form.get("due_date", "").strip()
        project_id = request.form.get("project_id", type=int)

        if not title:
            flash("Task title is required.", "error")
        elif status not in TASK_STATUS_CHOICES:
            flash("Invalid task status.", "error")
        else:
            task.title = title
            task.status = status
            task.project_id = project_id
            task.due_date = datetime.strptime(due_date_raw, "%Y-%m-%d").date() if due_date_raw else None
            _log_action("task_updated", "Task", task.id)
            db.session.commit()
            flash("Task updated.", "success")
            return redirect(url_for("databases.task_detail", task_id=task.id))

    return render_template("databases/task_form.html", task=task, projects=Project.query.order_by(Project.name.asc()))


@databases_bp.route("/tasks/<int:task_id>/delete", methods=["POST"])
@login_required
def task_delete(task_id):
    task = Task.query.get_or_404(task_id)
    _ensure_can_edit(task)
    db.session.delete(task)
    _log_action("task_deleted", "Task", task_id)
    db.session.commit()
    flash("Task deleted.", "success")
    return redirect(url_for("databases.tasks_list"))


@databases_bp.route("/tasks/<int:task_id>/pages", methods=["POST"])
@login_required
def task_link_page(task_id):
    task = Task.query.get_or_404(task_id)
    _ensure_can_edit(task)
    page_id = request.form.get("page_id", type=int)
    action = request.form.get("action")
    page = Page.query.get_or_404(page_id)

    existing = TaskPageLink.query.filter_by(task_id=task.id, page_id=page.id).first()
    if action == "link" and not existing:
        db.session.add(TaskPageLink(task_id=task.id, page_id=page.id))
        _log_action("task_page_linked", "Task", task.id, {"page_id": page.id})
        db.session.commit()
    elif action == "unlink" and existing:
        db.session.delete(existing)
        _log_action("task_page_unlinked", "Task", task.id, {"page_id": page.id})
        db.session.commit()

    return redirect(url_for("databases.task_detail", task_id=task.id))


@databases_bp.route("/projects/new", methods=["GET", "POST"])
@login_required
def project_create():
    if current_user.role == "Viewer":
        abort(403)
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        status = request.form.get("status", "idea")
        company_id = request.form.get("company_id", type=int)

        if not name:
            flash("Project name is required.", "error")
        elif status not in PROJECT_STATUS_CHOICES:
            flash("Invalid project status.", "error")
        else:
            project = Project(
                name=name,
                status=status,
                company_id=company_id,
                created_by_user_id=current_user.id,
            )
            db.session.add(project)
            db.session.flush()
            _log_action("project_created", "Project", project.id)
            db.session.commit()
            flash("Project created.", "success")
            return redirect(url_for("databases.project_detail", project_id=project.id))

    return render_template(
        "databases/project_form.html",
        project=None,
        companies=Company.query.order_by(Company.name.asc()),
        statuses=PROJECT_STATUS_CHOICES,
    )


@databases_bp.route("/projects/<int:project_id>/edit", methods=["GET", "POST"])
@login_required
def project_edit(project_id):
    project = Project.query.get_or_404(project_id)
    _ensure_can_edit(project)

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        status = request.form.get("status", project.status)
        company_id = request.form.get("company_id", type=int)

        if not name:
            flash("Project name is required.", "error")
        elif status not in PROJECT_STATUS_CHOICES:
            flash("Invalid project status.", "error")
        else:
            project.name = name
            project.status = status
            project.company_id = company_id
            _log_action("project_updated", "Project", project.id)
            db.session.commit()
            flash("Project updated.", "success")
            return redirect(url_for("databases.project_detail", project_id=project.id))

    return render_template(
        "databases/project_form.html",
        project=project,
        companies=Company.query.order_by(Company.name.asc()),
        statuses=PROJECT_STATUS_CHOICES,
    )


@databases_bp.route("/projects/<int:project_id>/delete", methods=["POST"])
@login_required
def project_delete(project_id):
    project = Project.query.get_or_404(project_id)
    _ensure_can_edit(project)

    for task in Task.query.filter_by(project_id=project.id).all():
        task.project_id = None
    db.session.delete(project)
    _log_action("project_deleted", "Project", project_id)
    db.session.commit()
    flash("Project deleted.", "success")
    return redirect(url_for("databases.projects_list"))


@databases_bp.route("/projects/<int:project_id>/quick-add-task", methods=["POST"])
@login_required
def project_quick_add_task(project_id):
    project = Project.query.get_or_404(project_id)
    _ensure_can_edit(project)

    if current_user.role == "Viewer":
        abort(403)

    title = request.form.get("title", "").strip()
    status = request.form.get("status", "backlog")
    if not title or status not in TASK_STATUS_CHOICES:
        flash("Task title and valid status are required.", "error")
    else:
        task = Task(
            title=title,
            status=status,
            project_id=project.id,
            created_by_user_id=current_user.id,
        )
        db.session.add(task)
        db.session.flush()
        _log_action("task_created", "Task", task.id, {"source": "project_quick_add"})
        db.session.commit()
        flash("Task added.", "success")

    return redirect(url_for("databases.project_detail", project_id=project.id))


@databases_bp.route("/companies/new", methods=["GET", "POST"])
@login_required
def company_create():
    if current_user.role == "Viewer":
        abort(403)
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        status = request.form.get("status", "active")

        if not name:
            flash("Company name is required.", "error")
        elif status not in COMPANY_STATUS_CHOICES:
            flash("Invalid company status.", "error")
        else:
            company = Company(name=name, status=status, created_by_user_id=current_user.id)
            db.session.add(company)
            db.session.flush()
            _log_action("company_created", "Company", company.id)
            db.session.commit()
            flash("Company created.", "success")
            return redirect(url_for("databases.company_detail", company_id=company.id))

    return render_template("databases/company_form.html", company=None, statuses=COMPANY_STATUS_CHOICES)


@databases_bp.route("/companies/<int:company_id>/edit", methods=["GET", "POST"])
@login_required
def company_edit(company_id):
    company = Company.query.get_or_404(company_id)
    _ensure_can_edit(company)

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        status = request.form.get("status", company.status)

        if not name:
            flash("Company name is required.", "error")
        elif status not in COMPANY_STATUS_CHOICES:
            flash("Invalid company status.", "error")
        else:
            company.name = name
            company.status = status
            _log_action("company_updated", "Company", company.id)
            db.session.commit()
            flash("Company updated.", "success")
            return redirect(url_for("databases.company_detail", company_id=company.id))

    return render_template("databases/company_form.html", company=company, statuses=COMPANY_STATUS_CHOICES)


@databases_bp.route("/companies/<int:company_id>/delete", methods=["POST"])
@login_required
def company_delete(company_id):
    company = Company.query.get_or_404(company_id)
    _ensure_can_edit(company)

    for project in Project.query.filter_by(company_id=company.id).all():
        project.company_id = None
    db.session.delete(company)
    _log_action("company_deleted", "Company", company_id)
    db.session.commit()
    flash("Company deleted.", "success")
    return redirect(url_for("databases.companies_list"))


@databases_bp.route("/companies/<int:company_id>/quick-add-project", methods=["POST"])
@login_required
def company_quick_add_project(company_id):
    company = Company.query.get_or_404(company_id)
    _ensure_can_edit(company)

    name = request.form.get("name", "").strip()
    if not name:
        flash("Project name is required.", "error")
    else:
        project = Project(
            name=name,
            status="idea",
            company_id=company.id,
            created_by_user_id=current_user.id,
        )
        db.session.add(project)
        db.session.flush()
        _log_action("project_created", "Project", project.id, {"source": "company_quick_add"})
        db.session.commit()
        flash("Project added.", "success")

    return redirect(url_for("databases.company_detail", company_id=company.id))
