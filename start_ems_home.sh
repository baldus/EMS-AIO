#!/usr/bin/env bash
set -euo pipefail

log() {
  printf "[ems-home] %s\n" "$1"
}

fail() {
  printf "[ems-home][error] %s\n" "$1" >&2
  exit 1
}

if [[ "${EUID}" -eq 0 ]]; then
  fail "Do not run as root. Run as an allowed local user."
fi

OS_NAME="$(uname -s)"
log "Detected OS: ${OS_NAME}"
case "${OS_NAME}" in
  Linux) ;; 
  Darwin) log "Warning: macOS detected. Support is best-effort." ;;
  *) fail "Unsupported OS: ${OS_NAME}. Use Linux or macOS." ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
  fail "python3 is required but not found. Install Python 3.11+ and try again."
fi

PY_VERSION_OK=$(python3 - <<'PY'
import sys
print("ok" if sys.version_info >= (3, 11) else "no")
PY
)
if [[ "${PY_VERSION_OK}" != "ok" ]]; then
  fail "Python 3.11+ is required."
fi

if [[ ! -f "requirements.txt" || ! -d "app" ]]; then
  fail "Run this script from the repo root (requirements.txt and app/ must exist)."
fi

if [[ ! -f ".env" ]]; then
  fail "Missing .env. Copy .env.example to .env and set required values."
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

ALLOWED_START_USERS_DEFAULT="ems,josh"
ALLOWED_START_USERS="${ALLOWED_START_USERS:-$ALLOWED_START_USERS_DEFAULT}"
CURRENT_USER="$(id -un)"
IFS=',' read -r -a ALLOWED_USERS <<< "${ALLOWED_START_USERS}"
USER_ALLOWED="no"
for allowed in "${ALLOWED_USERS[@]}"; do
  if [[ "${CURRENT_USER}" == "${allowed}" ]]; then
    USER_ALLOWED="yes"
    break
  fi
done
if [[ "${USER_ALLOWED}" != "yes" ]]; then
  fail "User ${CURRENT_USER} is not allowed. Allowed users: ${ALLOWED_START_USERS}."
fi

if [[ ! -d ".venv" ]]; then
  log "Creating virtual environment (.venv)."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

log "Upgrading pip tooling."
python -m pip install --upgrade pip setuptools wheel

log "Installing dependencies."
python -m pip install -r requirements.txt
log "Dependencies installed successfully."

if [[ -z "${SECRET_KEY:-}" ]]; then
  fail "SECRET_KEY is required. Set it in .env."
fi
case "${SECRET_KEY}" in
  changeme|change-me|dev-insecure-change-me)
    fail "SECRET_KEY is set to a placeholder. Set a strong value in .env." ;;
esac

if [[ -z "${FLASK_ENV:-}" ]]; then
  log "FLASK_ENV not set. Defaulting to production."
  export FLASK_ENV="production"
fi

FLASK_CONFIG_VALUE="${FLASK_CONFIG:-production}"
if [[ "${FLASK_ENV}" == "production" && "${FLASK_CONFIG_VALUE}" == "development" ]]; then
  fail "Unsafe configuration: FLASK_ENV=production with FLASK_CONFIG=development."
fi

mkdir -p instance
if [[ ! -w "instance" ]]; then
  fail "instance/ is not writable. Fix permissions and try again."
fi

log "Running bootstrap check for Admin user."
python -m app.cli bootstrap-admin

DB_PATH="${DATABASE_URL:-sqlite:///$(pwd)/instance/ems_home.db}"
RUN_MODE="${EMS_RUN_MODE:-}"
if [[ -z "${RUN_MODE}" ]]; then
  if grep -q "^gunicorn" requirements.txt; then
    RUN_MODE="prod"
  else
    RUN_MODE="dev"
  fi
fi

log "Starting EMS Home (mode=${RUN_MODE}, db=${DB_PATH}, user=${CURRENT_USER})."
if [[ "${RUN_MODE}" == "dev" ]]; then
  exec python run.py
elif [[ "${RUN_MODE}" == "prod" ]]; then
  exec gunicorn -w "${GUNICORN_WORKERS:-2}" -b "${BIND_ADDR:-0.0.0.0}:${PORT:-8000}" wsgi:app
else
  fail "Unknown EMS_RUN_MODE: ${RUN_MODE}. Use 'dev' or 'prod'."
fi
