# BOTS

A living, AI-native business transformation platform. Product docs live in `memory/`:
`PRD.md` (product and data model), `DESIGN.md` (visual design system), `AUDIT-conducting-ai.md` (competitive teardown and plan).

Backend: FastAPI + MongoDB (`backend/`). Frontend: Vite + React (`frontend/`).

Required environment (backend): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
Optional: `DEMO_USERS_PASSWORD` (creates demo accounts), `ALLOW_DEMO_RESEED=true` (enables POST /api/admin/seed on demo instances), an LLM provider key for AI drafts.
Frontend: `REACT_APP_BACKEND_URL`; optional `REACT_APP_DEMO_PASSWORD` to show demo-account buttons on the login page.
