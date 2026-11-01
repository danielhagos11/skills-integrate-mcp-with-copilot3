# Mergington High School Activities

A FastAPI application for browsing extracurricular activities and managing
student registrations.

## Features

- Browse activities and participants without signing in.
- Search by activity name, description, schedule, or category; filter by
  category and sort by name or start time.
- Teachers can sign in to register and unregister students.
- Activity definitions live in `activities.json`; participant changes are kept
  in memory and reset when the server restarts.
- Teacher passwords are stored as PBKDF2 hashes in `teachers.json`.

## Getting Started

From the repository root, install the dependencies and create at least one
teacher account:

```sh
pip install -r requirements.txt
python -m src.create_teacher
```

The account setup prompts for a username and password without echoing the
password. Passwords must be at least 12 characters. Start the server:

```sh
uvicorn src.app:app --reload
```

Then open http://localhost:8000. API documentation is available at
http://localhost:8000/docs.

For deployments, configure `SESSION_SECRET` to a long, random value shared by
all API workers. Set `COOKIE_SECURE=true` when serving the site over HTTPS.
Teacher account changes are loaded at process startup; restart the API after
adding or updating an account.

## API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/activities` | Get activities, schedules, capacity, and current participants |
| GET | `/auth/me` | Get the current teacher login, if any |
| POST | `/auth/login` | Sign in with a teacher username and password |
| POST | `/auth/logout` | Sign out the current teacher |
| POST | `/activities/{activity_name}/signup?email=student@mergington.edu` | Register a student (teacher login required) |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Unregister a student (teacher login required) |

The login endpoint accepts a JSON body such as
`{"username":"teacher","password":"..."}`. A successful login sets a
short-lived, HTTP-only, same-site cookie.
