from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db

ROLE_CHOICES = ("Admin", "Editor", "Viewer")
PAGE_BLOCK_TYPES = ("text", "heading", "bulleted_list", "checkbox_list", "divider", "callout")


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


class Page(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, default="Untitled")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    last_viewed_at = db.Column(db.DateTime)
    last_edited_at = db.Column(db.DateTime)
    archived_at = db.Column(db.DateTime)
    archived_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    created_by = db.relationship("User", foreign_keys=[created_by_user_id])
    archived_by = db.relationship("User", foreign_keys=[archived_by_user_id])
    blocks = db.relationship(
        "Block",
        backref="page",
        order_by="Block.position.asc()",
        cascade="all, delete-orphan",
    )


class Block(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    page_id = db.Column(db.Integer, db.ForeignKey("page.id"), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    content_json = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    updated_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    created_by = db.relationship("User", foreign_keys=[created_by_user_id])
    updated_by = db.relationship("User", foreign_keys=[updated_by_user_id])

    __table_args__ = (db.UniqueConstraint("page_id", "position", name="uq_block_page_position"),)
