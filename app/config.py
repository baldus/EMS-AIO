import os


def _clean_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    CORE_DATABASE_URL = _clean_env_value("CORE_DATABASE_URL") or "sqlite:///instance/ems_home_core.db"
    WORKSPACE_DATABASE_URL = _clean_env_value("WORKSPACE_DATABASE_URL")

    SQLALCHEMY_DATABASE_URI = CORE_DATABASE_URL
    if WORKSPACE_DATABASE_URL:
        SQLALCHEMY_BINDS = {"workspace": WORKSPACE_DATABASE_URL}


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
