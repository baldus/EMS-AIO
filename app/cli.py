import argparse
import sys
from datetime import datetime
from getpass import getpass

from app import create_app
from app.extensions import db
from app.models import AuditLog, User


PLACEHOLDER_USERNAMES = {"admin", "root"}


def _prompt_non_empty(prompt):
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("Value cannot be empty.")


def _prompt_password():
    while True:
        password = getpass("Password: ")
        confirm = getpass("Confirm password: ")
        if not password:
            print("Password cannot be empty.")
            continue
        if password != confirm:
            print("Passwords do not match. Try again.")
            continue
        return password


def bootstrap_admin():
    if not sys.stdin.isatty():
        raise SystemExit("Interactive TTY required for bootstrap-admin.")

    app = create_app()
    with app.app_context():
        db.create_all(bind_key=None)
        existing_admin = (
            User.query.filter_by(role="Admin", is_active=True).order_by(User.id.asc()).first()
        )
        if existing_admin:
            print("Admin present; bootstrap skipped.")
            return

        username = _prompt_non_empty("Admin username: ")
        if username.lower() in PLACEHOLDER_USERNAMES:
            raise SystemExit("Refusing to create admin with a placeholder username.")
        password = _prompt_password()

        user = User(
            username=username,
            role="Admin",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        db.session.add(
            AuditLog(
                actor_user_id=user.id,
                action="bootstrap_admin_created",
                entity_type="User",
                entity_id=str(user.id),
                metadata_json={"username": username},
            )
        )
        db.session.commit()
        print("Admin user created successfully.")


def main():
    parser = argparse.ArgumentParser(description="EMS Home CLI")
    subparsers = parser.add_subparsers(dest="command")
    subparsers.add_parser("bootstrap-admin", help="Create the first admin user if none exist")

    args = parser.parse_args()

    if args.command == "bootstrap-admin":
        bootstrap_admin()
    else:
        parser.print_help()
        raise SystemExit(1)


if __name__ == "__main__":
    main()
