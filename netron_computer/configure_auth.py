from __future__ import annotations

import argparse
import secrets
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update AUTH_USERNAME and AUTH_PASSWORD in the project .env file.",
    )
    parser.add_argument("--username", required=True, help="New login username.")
    parser.add_argument("--password", required=True, help="New login password.")
    parser.add_argument(
        "--rotate-session-secret",
        action="store_true",
        help="Generate a new SESSION_SECRET as well.",
    )
    return parser.parse_args()


def load_env_lines() -> list[str]:
    if ENV_PATH.exists():
        return ENV_PATH.read_text(encoding="utf-8").splitlines()
    return []


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


def main() -> None:
    args = parse_args()
    lines = load_env_lines()

    lines = set_key(lines, "AUTH_USERNAME", args.username)
    lines = set_key(lines, "AUTH_PASSWORD", args.password)

    if args.rotate_session_secret:
        lines = set_key(lines, "SESSION_SECRET", secrets.token_urlsafe(32))

    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    print("Updated credentials in", ENV_PATH)
    print("AUTH_USERNAME =", args.username)
    print("AUTH_PASSWORD = <hidden>")
    if args.rotate_session_secret:
        print("SESSION_SECRET = rotated")
    print("Restart netron-computer to apply changes.")
