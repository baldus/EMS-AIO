from flask import Blueprint

pages_bp = Blueprint("pages", __name__, url_prefix="/pages")

from app.pages import routes  # noqa: E402,F401
