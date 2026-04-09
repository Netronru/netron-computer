from __future__ import annotations

import argparse
from netron_computer.config_store import ENV_PATH, rotate_session_secret, save_env


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

def main() -> None:
    args = parse_args()
    save_env(
        {
            "AUTH_USERNAME": args.username,
            "AUTH_PASSWORD": args.password,
        }
    )

    if args.rotate_session_secret:
        rotate_session_secret()

    print("Updated credentials in", ENV_PATH)
    print("AUTH_USERNAME =", args.username)
    print("AUTH_PASSWORD = <hidden>")
    if args.rotate_session_secret:
        print("SESSION_SECRET = rotated")
    print("Restart netron-computer to apply changes.")
