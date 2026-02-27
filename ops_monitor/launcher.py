from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Mapping

VALID_MODES = {"window", "background", "headless", "tmux"}
TMUX_SESSION = "hyperion-monitor"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _writable_log(path: Path) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write("")
        return True
    except OSError:
        return False


def resolve_monitor_log_file(env: Mapping[str, str] | None = None) -> Path:
    env = env or os.environ
    candidates = []
    if env.get("MONITOR_LOG_FILE"):
        candidates.append(Path(env["MONITOR_LOG_FILE"]).expanduser())
    candidates.extend(
        [
            Path("/var/log/hyperion/terminal_monitor.log"),
            repo_root() / "support" / "hyperion_terminal_monitor.log",
            Path("/tmp/hyperion_terminal_monitor.log"),
        ]
    )

    for candidate in candidates:
        if _writable_log(candidate):
            return candidate.resolve()

    # Last resort path in current working dir.
    fallback = Path("hyperion_terminal_monitor.log").resolve()
    fallback.parent.mkdir(parents=True, exist_ok=True)
    fallback.touch(exist_ok=True)
    return fallback


def append_log(path: Path, message: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(message.rstrip() + "\n")


def is_headless_context(env: Mapping[str, str] | None = None) -> bool:
    env = env or os.environ
    return (not env.get("DISPLAY")) or (not env.get("XDG_SESSION_TYPE")) or env.get("TERM") == "dumb"


def _terminal_candidates(env: Mapping[str, str]) -> list[str]:
    if env.get("OPS_MONITOR_TERMINAL"):
        return [env["OPS_MONITOR_TERMINAL"]]
    return ["gnome-terminal", "xterm", "konsole", "xfce4-terminal"]


def choose_launch_mode(cli_mode: str | None, env: Mapping[str, str] | None = None) -> str:
    env = env or os.environ
    if cli_mode:
        return cli_mode

    env_mode = env.get("OPS_MONITOR_LAUNCH_MODE")
    if env_mode:
        return env_mode

    if is_headless_context(env):
        return "tmux" if shutil.which("tmux") else "headless"
    return "window"


def _monitor_cmd(python_exe: str, log_file: Path) -> list[str]:
    return [python_exe, "-m", "ops_monitor.monitor", "--log-file", str(log_file)]


def launch_tmux(python_exe: str, log_file: Path) -> tuple[bool, str]:
    if not shutil.which("tmux"):
        append_log(log_file, "tmux missing; falling back to headless")
        return False, "tmux missing"

    cmd = " ".join(subprocess.list2cmdline(_monitor_cmd(python_exe, log_file)).split())
    has_session = subprocess.run(["tmux", "has-session", "-t", TMUX_SESSION], capture_output=True)
    if has_session.returncode == 0:
        append_log(log_file, f"tmux session {TMUX_SESSION} already exists; keeping existing session")
        return True, f"tmux session {TMUX_SESSION} already exists"

    run = subprocess.run(
        ["tmux", "new-session", "-d", "-s", TMUX_SESSION, cmd],
        capture_output=True,
        text=True,
    )
    if run.returncode != 0:
        append_log(log_file, f"tmux launch failed: {run.stderr or run.stdout}")
        return False, run.stderr.strip() or run.stdout.strip() or "tmux launch failed"
    return True, f"tmux session {TMUX_SESSION} created"


def launch_headless(python_exe: str, log_file: Path) -> tuple[bool, str]:
    try:
        with log_file.open("a", encoding="utf-8") as lf:
            subprocess.Popen(_monitor_cmd(python_exe, log_file), stdout=lf, stderr=lf, start_new_session=True)
        return True, "headless monitor started"
    except Exception as exc:  # noqa: BLE001
        append_log(log_file, f"headless launch failed: {exc}")
        return False, str(exc)


def launch_window(python_exe: str, log_file: Path, env: Mapping[str, str] | None = None) -> tuple[bool, str]:
    env = env or os.environ
    for terminal in _terminal_candidates(env):
        if not shutil.which(terminal):
            continue
        base_cmd = _monitor_cmd(python_exe, log_file)
        if terminal == "gnome-terminal":
            cmd = [terminal, "--"] + base_cmd
        elif terminal == "xterm":
            cmd = [terminal, "-e"] + base_cmd
        else:
            cmd = [terminal, "-e"] + base_cmd

        run = subprocess.run(cmd, capture_output=True, text=True)
        if run.returncode == 0:
            return True, f"window monitor started with {terminal}"

        append_log(log_file, f"window launch failed with {terminal}: {run.stderr or run.stdout}")

    return False, "no terminal app available"


def launch_monitor(cli_mode: str | None = None, python_exe: str | None = None, env: Mapping[str, str] | None = None) -> tuple[bool, Path, str]:
    env = env or os.environ
    python_exe = python_exe or env.get("PYTHON") or sys.executable
    log_file = resolve_monitor_log_file(env)
    append_log(log_file, "Launching terminal monitor")

    mode = choose_launch_mode(cli_mode, env)
    if mode not in VALID_MODES:
        append_log(log_file, f"Invalid launch mode '{mode}', defaulting to headless")
        mode = "headless"

    if mode == "window":
        ok, msg = launch_window(python_exe, log_file, env)
        if ok:
            return True, log_file, msg

        append_log(log_file, f"window mode unavailable, falling back: {msg}")
        if shutil.which("tmux"):
            ok, tmsg = launch_tmux(python_exe, log_file)
            return ok, log_file, tmsg

        append_log(log_file, "tmux missing after window fallback; using headless")
        ok, hmsg = launch_headless(python_exe, log_file)
        return ok, log_file, f"tmux missing; {hmsg}"

    if mode == "tmux":
        ok, msg = launch_tmux(python_exe, log_file)
        if ok:
            return True, log_file, msg
        ok, hmsg = launch_headless(python_exe, log_file)
        prefix = "tmux missing; " if msg == "tmux missing" else ""
        return ok, log_file, f"{prefix}{hmsg}"

    if mode in {"background", "headless"}:
        ok, msg = launch_headless(python_exe, log_file)
        return ok, log_file, msg

    return False, log_file, "unsupported mode"


def main() -> int:
    parser = argparse.ArgumentParser(description="Launch Hyperion Ops monitor")
    parser.add_argument("--launch-mode", choices=sorted(VALID_MODES), default=None)
    parser.add_argument("--python", default=None)
    args = parser.parse_args()

    ok, log_path, message = launch_monitor(args.launch_mode, args.python)

    if ok:
        print(f"Ops Monitor: {message}. Log: {log_path}")
        return 0

    print(f"Terminal monitor failed to launch. See log: {log_path}")
    if "tmux missing" in message.lower():
        print("Install tmux: sudo apt-get install -y tmux")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
