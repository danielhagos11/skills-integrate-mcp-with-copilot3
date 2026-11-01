"""Add or update a teacher account without storing a plaintext password."""

import getpass
import json
import re
from pathlib import Path

from src.auth import hash_password

TEACHERS_FILE = Path(__file__).with_name("teachers.json")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def main():
    username = input("Teacher username: ").strip()
    if not USERNAME_PATTERN.fullmatch(username):
        raise SystemExit("Use 1-64 letters, numbers, dots, underscores, or hyphens.")

    password = getpass.getpass("Teacher password (at least 12 characters): ")
    if not 12 <= len(password) <= 256:
        raise SystemExit("Teacher passwords must be 12-256 characters.")

    with TEACHERS_FILE.open(encoding="utf-8") as teachers_file:
        data = json.load(teachers_file)

    account = {
        "username": username,
        "password_hash": hash_password(password),
    }
    data["teachers"] = [
        teacher
        for teacher in data["teachers"]
        if teacher["username"] != username
    ]
    data["teachers"].append(account)
    with TEACHERS_FILE.open("w", encoding="utf-8") as teachers_file:
        json.dump(data, teachers_file, indent=2)
        teachers_file.write("\n")

    print(f"Teacher account {username!r} is ready. Restart the API to load it.")


if __name__ == "__main__":
    main()
