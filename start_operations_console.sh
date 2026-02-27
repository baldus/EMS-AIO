#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -x "$SCRIPT_DIR/.venv/bin/python" ]]; then
  APP_PYTHON="$SCRIPT_DIR/.venv/bin/python"
elif [[ -n "${PYTHON:-}" ]]; then
  APP_PYTHON="$PYTHON"
else
  APP_PYTHON="$(command -v python3 || command -v python)"
fi

if [[ -z "$APP_PYTHON" ]]; then
  echo "Unable to resolve python interpreter"
  exit 1
fi

if [[ "${ENABLE_OPS_MONITOR:-1}" == "1" ]]; then
  if ! "$APP_PYTHON" -m ops_monitor.launcher --python "$APP_PYTHON"; then
    LOG_PATH="${MONITOR_LOG_FILE:-$SCRIPT_DIR/support/hyperion_terminal_monitor.log}"
    echo "WARNING: Ops monitor failed to launch. See log: $LOG_PATH"
    if ! command -v tmux >/dev/null 2>&1; then
      echo "Install tmux: sudo apt-get install -y tmux"
    fi
  fi
fi

exec "$APP_PYTHON" run.py
