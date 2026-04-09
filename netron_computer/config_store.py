from __future__ import annotations

import secrets
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

DEFAULT_CONFIG = {
    "HOST": "0.0.0.0",
    "PORT": "3001",
    "FPS": "30",
    "JPEG_QUALITY": "45",
    "MAX_FRAME_WIDTH": "1024",
    "MONITOR_INDEX": "1",
    "LANGUAGE": "en",
    "AUTH_USERNAME": "admin",
    "AUTH_PASSWORD": "admin",
    "SESSION_COOKIE_NAME": "netron_computer_session",
    "SESSION_SECRET": "change-this-netron-computer-secret",
    "ENABLE_AUDIO": "1",
    "AUDIO_SOURCE": "",
    "AUDIO_SAMPLE_RATE": "48000",
    "AUDIO_CHUNK_MS": "20",
}


def load_env_lines(path: Path = ENV_PATH) -> list[str]:
    if path.exists():
        return path.read_text(encoding="utf-8").splitlines()
    return []


def parse_env(path: Path = ENV_PATH) -> dict[str, str]:
    values = dict(DEFAULT_CONFIG)
    for line in load_env_lines(path):
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value
    return values


def set_key(lines: list[str], key: str, value: str) -> list[str]:
    prefix = key + "="
    updated = []
    replaced = False

    for line in lines:
        if line.startswith(prefix):
            updated.append(prefix + value)
            replaced = True
        else:
            updated.append(line)

    if not replaced:
        updated.append(prefix + value)

    return updated


def save_env(updates: dict[str, str], path: Path = ENV_PATH) -> None:
    lines = load_env_lines(path)
    for key, value in updates.items():
        lines = set_key(lines, key, str(value))
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def rotate_session_secret(path: Path = ENV_PATH) -> str:
    secret = secrets.token_urlsafe(32)
    save_env({"SESSION_SECRET": secret}, path=path)
    return secret
