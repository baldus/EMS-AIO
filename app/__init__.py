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
from app.migrations import apply_all_migrations
from app.models import ROLE_CHOICES, User


def create_app():
    load_dotenv()
    app = Flask(__name__, instance_relative_config=True)

    config_name = os.environ.get("FLASK_CONFIG", "development").lower()
    if config_name == "production":
        app.config.from_object("app.config.ProductionConfig")
    else:
        app.config.from_object("app.config.DevelopmentConfig")

    os.makedirs(app.instance_path, exist_ok=True)
    default_db_path = os.path.join(app.instance_path, "ems_home.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", f"sqlite:///{default_db_path}"
    )

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(databases_bp)

    @app.errorhandler(403)
    def forbidden(_error):
        return render_template("errors/403.html"), 403


    @app.cli.command("apply-migrations")
    def apply_migrations_command():
        """Apply SQL migrations."""
        with app.app_context():
            apply_all_migrations(app)
            click.echo("Migrations applied.")

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
        apply_all_migrations(app)
        db.create_all()

    return app
