# BOTS

A living, AI-native business transformation platform. Product docs live in `memory/`:
`PRD.md` (product and data model), `DESIGN.md` (visual design system), `AUDIT-conducting-ai.md` (competitive teardown and plan).

Backend: FastAPI + MongoDB (`backend/`). Frontend: Vite + React (`frontend/`).

## Run it locally (Docker)

```
cp .env.example .env        # set ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET at least
docker compose up --build   # MongoDB + API on :8001 + app on :3000
./scripts/test_local.sh     # API test suites against the local stack (reads .env)
```

The frontend container serves the built bundle through nginx and proxies `/api` to the backend, so no
backend URL is baked into the bundle. Data persists in the `mongo-data` volume; `docker compose down -v` wipes it.
Attachments still use the hosted object-storage integration and do not work offline (provider swap pending).

## Environment

Required environment (backend): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
Optional: `DEMO_USERS_PASSWORD` (creates demo accounts), `ALLOW_DEMO_RESEED=true` (enables POST /api/admin/seed on demo instances).
AI provider: `BOTS_LLM_PROVIDER` (`anthropic` | `fake` | `none`; defaults to `anthropic` when `ANTHROPIC_API_KEY` is set),
`ANTHROPIC_API_KEY`, `BOTS_LLM_MODEL` (default `claude-opus-5-5`), `BOTS_LLM_CONCURRENCY` (default 3).
`fake` is a deterministic stand-in for tests and demos; it never calls a network.
Frontend: `REACT_APP_BACKEND_URL` (empty = same origin, as in Docker); optional `REACT_APP_DEMO_PASSWORD` to show demo-account buttons on the login page.

Cron: `WEBHOOK_CRON_SECRET` (bearer token for `POST /api/cron/checkpoint-nudges`).

API tests (`backend/tests`) run against a live server: `BOTS_TEST_BASE_URL` (default `http://localhost:8001`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_USERS_PASSWORD`, `WEBHOOK_CRON_SECRET`. Modules skip when these are unset. Never put credential values in the repo or in test reports.
