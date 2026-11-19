"""Tests for the env-variable helpers in config/settings.py."""

import os
import subprocess
import sys
from pathlib import Path

from config.settings import env_bool, env_list, load_env_file

BACKEND = Path(__file__).resolve().parents[2]


def test_env_bool_is_false_when_missing(monkeypatch):
    monkeypatch.delenv("SOME_FLAG", raising=False)
    assert env_bool("SOME_FLAG") is False


def test_env_bool_only_accepts_clear_yes_words(monkeypatch):
    for word in ["1", "true", "TRUE", "yes"]:
        monkeypatch.setenv("SOME_FLAG", word)
        assert env_bool("SOME_FLAG") is True
    for word in ["0", "false", "no", "", "maybe"]:
        monkeypatch.setenv("SOME_FLAG", word)
        assert env_bool("SOME_FLAG") is False


def test_env_list_drops_spaces_and_empty_parts(monkeypatch):
    monkeypatch.setenv("SOME_LIST", " a.com , ,b.com,")
    assert env_list("SOME_LIST") == ["a.com", "b.com"]


def test_env_file_never_overrides_the_real_environment(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("# a comment\nFROM_FILE=file\nALREADY_SET=file\n", encoding="utf-8")
    monkeypatch.delenv("FROM_FILE", raising=False)
    monkeypatch.setenv("ALREADY_SET", "real")
    load_env_file(env_file)
    assert os.environ["FROM_FILE"] == "file"
    assert os.environ["ALREADY_SET"] == "real"


def import_settings_with(env):
    """Import the settings in a fresh Python that sees only these variables
    (and never the local .env file), and report what it printed."""
    code = "import config.settings as s; print(s.DEBUG, s.ALLOWED_HOSTS)"
    clean = {"SYSTEMROOT": os.environ.get("SYSTEMROOT", ""), "DJANGO_ENV_FILE_SKIP": "1", **env}
    return subprocess.run(
        [sys.executable, "-c", code], cwd=BACKEND, env=clean, capture_output=True, text=True
    )


def test_settings_refuse_to_start_without_a_secret_key():
    result = import_settings_with({})
    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY" in result.stderr


def test_debug_is_off_and_hosts_are_not_wildcard_by_default():
    result = import_settings_with({"DJANGO_SECRET_KEY": "x"})
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "False ['localhost', '127.0.0.1']"
