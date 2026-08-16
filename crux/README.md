# Crux — DSA Ascent Log

A self-hosted tracker for interview-prep DSA practice, styled around a mountaineering
theme: topics are **routes**, questions are **pitches**, difficulty is the **grade**,
and the suggested approach for each problem is its **beta** (climbing slang for
insider tips on how to complete a move).

Runs as two Docker containers — a Flask app and a Postgres database — so your
progress is stored in a real database, not the browser.

## Run it

You need Docker and Docker Compose installed.

```bash
cd crux
docker compose up --build
```

Then open **http://localhost:5000**.

First run seeds two starter routes (Arrays, Strings) with the same 40 questions
you had before — each with a difficulty grade and a beta (suggested technique +
one-line approach hint). Add your own routes and pitches as you go.

## Stop / restart

```bash
docker compose down       # stop containers, keep your data
docker compose up         # start again — data is still there
docker compose down -v    # stop AND wipe the database (fresh start)
```

Your data lives in a named Docker volume (`crux_pgdata`), not in the container
itself, so `docker compose down` (without `-v`) is always safe.

## Project layout

```
crux/
├── docker-compose.yml       # wires the app + Postgres together
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── app.py               # Flask app + REST API
    ├── models.py             # Topic / Question tables
    ├── seed_data.py          # starter routes & pitches
    ├── templates/index.html
    └── static/
        ├── css/style.css
        └── js/app.js
```

## API

| Method | Path                              | Does |
|--------|------------------------------------|------|
| GET    | `/api/state`                       | All routes with their pitches |
| POST   | `/api/topics`                      | Create a route `{ name }` |
| POST   | `/api/topics/<id>/questions`       | Add a pitch `{ name, number, difficulty, link }` |
| PATCH  | `/api/questions/<id>`              | Update `{ done, notes }` |
| DELETE | `/api/questions/<id>`              | Remove a pitch |

## Deploying it publicly

This is built to run via Docker Compose on your own machine or any VPS/host that
supports Docker (Render, Railway, a DigitalOcean droplet, etc.). It won't work on
GitHub Pages — that only serves static files and can't run a Flask app or a
database. If you want a public URL, a small always-on host (Railway and Render
both have free/low-cost tiers that support Docker Compose-style deployments) is
the simplest path.
