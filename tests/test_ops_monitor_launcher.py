from pathlib import Path

from ops_monitor import launcher


def test_headless_detection():
    assert launcher.is_headless_context({"TERM": "xterm"})
    assert launcher.is_headless_context({"DISPLAY": ":0", "TERM": "dumb", "XDG_SESSION_TYPE": "x11"})
    assert not launcher.is_headless_context({"DISPLAY": ":0", "TERM": "xterm", "XDG_SESSION_TYPE": "x11"})


def test_choose_launch_mode_precedence(monkeypatch):
    env = {"OPS_MONITOR_LAUNCH_MODE": "background", "DISPLAY": ":0", "XDG_SESSION_TYPE": "x11", "TERM": "xterm"}
    assert launcher.choose_launch_mode("tmux", env) == "tmux"
    assert launcher.choose_launch_mode(None, env) == "background"


def test_resolve_monitor_log_fallback_to_repo_support(monkeypatch, tmp_path):
    fake_repo = tmp_path / "repo"
    (fake_repo / "support").mkdir(parents=True)

    monkeypatch.setattr(launcher, "repo_root", lambda: fake_repo)

    def fake_writable(path: Path) -> bool:
        return "support" in str(path)

    monkeypatch.setattr(launcher, "_writable_log", fake_writable)

    result = launcher.resolve_monitor_log_file({})
    assert result == (fake_repo / "support" / "hyperion_terminal_monitor.log")
