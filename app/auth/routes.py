from datetime import datetime

from flask import flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from app.auth import auth_bp
from app.extensions import db
from app.models import AuditLog, User


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.home"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = User.query.filter_by(username=username).first()

        if user and user.is_active and user.check_password(password):
            login_user(user)
            user.last_login_at = datetime.utcnow()
            db.session.add(
                AuditLog(
                    actor_user_id=user.id,
                    action="login",
                    entity_type="User",
                    entity_id=str(user.id),
                    ip_address=request.remote_addr,
                )
            )
            db.session.commit()
            return redirect(url_for("main.home"))

        flash("Invalid credentials or inactive account.", "error")

    return render_template("login.html")


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    db.session.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="logout",
            entity_type="User",
            entity_id=str(current_user.id),
            ip_address=request.remote_addr,
        )
    )
    db.session.commit()
    logout_user()
    return redirect(url_for("auth.login"))
