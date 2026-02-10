import os
from datetime import datetime

import click
from dotenv import load_dotenv
from flask import Flask, render_template

from app.admin import admin_bp
from app.auth import auth_bp
from app.databases import databases_bp
from app.extensions import db, login_manager
from app.main import main_bp
from app.models import User
from app.workspace import clean_url, resolve_core_url, resolve_workspace_url, workspace_configured


def _ensure_instance_dir(instance_path: str) -> str:
    absolute_instance = os.path.abspath(instance_path)
    os.makedirs(absolute_instance, exist_ok=True)
    if not os.access(absolute_instance, os.W_OK):
        raise RuntimeError(
            f"Instance directory is not writable: {absolute_instance}. "
            "Fix permissions for instance/ and try again."
        )
    return absolute_instance


def create_app():
    load_dotenv()
    app = Flask(__name__, instance_relative_config=True)

    config_name = os.environ.get("FLASK_CONFIG", "development").lower()
    if config_name == "production":
        app.config.from_object("app.config.ProductionConfig")
    else:
        app.config.from_object("app.config.DevelopmentConfig")

    instance_dir = _ensure_instance_dir(app.instance_path)

    core_url = resolve_core_url(
        instance_path=instance_dir,
        configured_url=clean_url(os.environ.get("CORE_DATABASE_URL")),
        legacy_database_url=clean_url(os.environ.get("DATABASE_URL")),
    )
    workspace_url = resolve_workspace_url(core_url, clean_url(os.environ.get("WORKSPACE_DATABASE_URL")))

    app.config["SQLALCHEMY_DATABASE_URI"] = core_url
    if workspace_url:
        app.config["SQLALCHEMY_BINDS"] = {"workspace": workspace_url}
    else:
        app.config.pop("SQLALCHEMY_BINDS", None)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @app.context_processor
    def inject_workspace_state():
        return {
            "workspace_is_configured": workspace_configured(),
        }

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(databases_bp)

    @app.errorhandler(403)
    def forbidden(_error):
        return render_template("errors/403.html"), 403

    @app.cli.command("create-admin")
    @click.argument("username")
    @click.password_option()
    def create_admin(username, password):
        """Create an admin user."""
        with app.app_context():
            if User.query.filter_by(username=username).first():
                raise click.ClickException("User already exists.")
            user = User(username=username, role="Admin", is_active=True, created_at=datetime.utcnow())
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            click.echo("Admin user created.")

    with app.app_context():
        db.create_all(bind_key=None)
        if workspace_configured(app):
            db.create_all(bind_key="workspace")

    return app
