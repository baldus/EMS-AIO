from datetime import datetime

from flask import flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.admin import admin_bp
from app.decorators import roles_required
from app.extensions import db
from app.models import AuditLog, ROLE_CHOICES, User


def _log_admin_action(action, entity_type, entity_id, metadata=None):
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


@admin_bp.route("/users")
@login_required
@roles_required("Admin")
def users_list():
    users = User.query.order_by(User.username.asc()).all()
    return render_template("admin/users.html", users=users, roles=ROLE_CHOICES)


@admin_bp.route("/users/new", methods=["GET", "POST"])
@login_required
@roles_required("Admin")
def user_create():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        role = request.form.get("role", "Viewer")
        is_active = request.form.get("is_active") == "on"

        if not username or not password:
            flash("Username and password are required.", "error")
        elif role not in ROLE_CHOICES:
            flash("Invalid role selected.", "error")
        elif User.query.filter_by(username=username).first():
            flash("Username already exists.", "error")
        else:
            user = User(
                username=username,
                role=role,
                is_active=is_active,
                created_at=datetime.utcnow(),
            )
            user.set_password(password)
            db.session.add(user)
            db.session.flush()
            _log_admin_action("user_created", "User", user.id, {"role": role})
            db.session.commit()
            flash("User created.", "success")
            return redirect(url_for("admin.users_list"))

    return render_template("admin/user_form.html", roles=ROLE_CHOICES, user=None)


@admin_bp.route("/users/<int:user_id>/edit", methods=["GET", "POST"])
@login_required
@roles_required("Admin")
def user_edit(user_id):
    user = User.query.get_or_404(user_id)

    if request.method == "POST":
        role = request.form.get("role", user.role)
        is_active = request.form.get("is_active") == "on"
        password = request.form.get("password", "")
        changes = {}

        if role not in ROLE_CHOICES:
            flash("Invalid role selected.", "error")
        else:
            if role != user.role:
                changes["role"] = {"from": user.role, "to": role}
                user.role = role
            if is_active != user.is_active:
                changes["is_active"] = {"from": user.is_active, "to": is_active}
                user.is_active = is_active
            if password:
                user.set_password(password)
                changes["password_reset"] = True

            if changes:
                _log_admin_action("user_updated", "User", user.id, changes)
                db.session.commit()
                flash("User updated.", "success")
            else:
                flash("No changes to save.", "info")
            return redirect(url_for("admin.users_list"))

    return render_template("admin/user_form.html", roles=ROLE_CHOICES, user=user)
