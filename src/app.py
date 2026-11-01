"""Mergington High School extracurricular activities API."""

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

DATA_DIR = Path(__file__).parent
SESSION_COOKIE = "teacher_session"
SESSION_TTL_SECONDS = 8 * 60 * 60
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_urlsafe(32)
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

with (DATA_DIR / "activities.json").open(encoding="utf-8") as activities_file:
    activities = json.load(activities_file)

with (DATA_DIR / "teachers.json").open(encoding="utf-8") as teachers_file:
    teacher_accounts = json.load(teachers_file)["teachers"]

app.mount(
    "/static",
    StaticFiles(directory=DATA_DIR / "static"),
    name="static",
)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


def _session_signature(payload: str) -> str:
    return hmac.new(
        SESSION_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _create_session_token(username: str) -> str:
    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    payload = f"{username}|{expires_at}"
    return f"{payload}|{_session_signature(payload)}"


def _get_session_username(token: str | None) -> str | None:
    if not token:
        return None

    try:
        username, expires_at_text, signature = token.split("|", maxsplit=2)
        expires_at = int(expires_at_text)
    except ValueError:
        return None

    payload = f"{username}|{expires_at_text}"
    if (
        expires_at <= int(time.time())
        or not hmac.compare_digest(signature, _session_signature(payload))
        or not any(account["username"] == username for account in teacher_accounts)
    ):
        return None
    return username


def _verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, digest_hex = encoded_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
        expected_digest = bytes.fromhex(digest_hex)
    except ValueError:
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(actual_digest, expected_digest)


def require_teacher(request: Request) -> str:
    username = _get_session_username(request.cookies.get(SESSION_COOKIE))
    if username is None:
        raise HTTPException(status_code=401, detail="Teacher login required")
    return username


def _validate_email(email: str) -> str:
    normalized_email = email.strip().lower()
    if not EMAIL_PATTERN.fullmatch(normalized_email):
        raise HTTPException(status_code=422, detail="A valid email address is required")
    return normalized_email


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.get("/auth/me")
def get_current_teacher(request: Request):
    return {"username": _get_session_username(request.cookies.get(SESSION_COOKIE))}


@app.post("/auth/login")
def login(credentials: LoginRequest, response: Response):
    account = next(
        (
            teacher
            for teacher in teacher_accounts
            if teacher["username"] == credentials.username
        ),
        None,
    )
    if account is None or not _verify_password(
        credentials.password, account["password_hash"]
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    response.set_cookie(
        key=SESSION_COOKIE,
        value=_create_session_token(account["username"]),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=os.environ.get("COOKIE_SECURE", "").lower() == "true",
        samesite="strict",
        path="/",
    )
    return {"username": account["username"]}


@app.post("/auth/logout")
def logout(response: Response, _username: str = Depends(require_teacher)):
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=os.environ.get("COOKIE_SECURE", "").lower() == "true",
        samesite="strict",
        path="/",
    )
    return {"message": "Logged out"}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    _username: str = Depends(require_teacher),
):
    """Sign up a student for an activity."""
    activity = activities.get(activity_name)
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")

    email = _validate_email(email)
    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")
    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    _username: str = Depends(require_teacher),
):
    """Unregister a student from an activity."""
    activity = activities.get(activity_name)
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")

    email = _validate_email(email)
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity",
        )

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
