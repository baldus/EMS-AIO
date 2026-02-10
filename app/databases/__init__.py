from flask import Blueprint


databases_bp = Blueprint("databases", __name__, url_prefix="/db", template_folder="../templates")

from app.databases import routes  # noqa: E402,F401
