from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db

ROLE_CHOICES = ("Admin", "Editor", "Viewer")
COMPANY_STATUS_CHOICES = ("active", "inactive")
PROJECT_STATUS_CHOICES = ("idea", "active", "blocked", "done", "archived")
TASK_STATUS_CHOICES = ("backlog", "next", "doing", "blocked", "done", "archived")
DATABASE_KEYS = ("tasks", "projects", "companies")


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="Viewer")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = db.Column(db.DateTime)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    actor_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    action = db.Column(db.String(120), nullable=False)
    entity_type = db.Column(db.String(120), nullable=False)
    entity_id = db.Column(db.String(120))
    metadata_json = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    actor = db.relationship("User", backref="audit_logs", foreign_keys=[actor_user_id])


class AppSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), unique=True, nullable=False)
    value = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_setting(key: str, default=None):
    setting = AppSetting.query.filter_by(key=key).first()
    if not setting or setting.value is None:
        return default
    return setting.value


def set_setting(key: str, value) -> AppSetting:
    setting = AppSetting.query.filter_by(key=key).first()
    stored_value = None if value is None else str(value)
    if setting is None:
        setting = AppSetting(key=key, value=stored_value)
        db.session.add(setting)
    else:
        setting.value = stored_value
    db.session.flush()
    return setting


class Page(db.Model):
    __bind_key__ = "workspace"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class Company(db.Model):
    __bind_key__ = "workspace"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="active")
    created_by_user_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    projects = db.relationship("Project", back_populates="company", passive_deletes=True)


class Project(db.Model):
    __bind_key__ = "workspace"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="idea")
    company_id = db.Column(db.Integer, db.ForeignKey("company.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = db.relationship("Company", back_populates="projects")
    tasks = db.relationship("Task", back_populates="project", passive_deletes=True)


class TaskPageLink(db.Model):
    __bind_key__ = "workspace"
    __tablename__ = "task_page_links"

    task_id = db.Column(db.Integer, db.ForeignKey("task.id", ondelete="CASCADE"), primary_key=True)
    page_id = db.Column(db.Integer, db.ForeignKey("page.id", ondelete="CASCADE"), primary_key=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    task = db.relationship("Task", back_populates="task_page_links")
    page = db.relationship("Page", backref="task_page_links")


class Task(db.Model):
    __bind_key__ = "workspace"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="backlog")
    due_date = db.Column(db.Date, nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project", back_populates="tasks")
    task_page_links = db.relationship(
        "TaskPageLink", back_populates="task", cascade="all, delete-orphan", passive_deletes=True
    )


class SavedView(db.Model):
    __bind_key__ = "workspace"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    database_key = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    query_json = db.Column(db.JSON, nullable=False)
    is_default = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "database_key", "name", name="uq_saved_view_user_db_name"),
    )
