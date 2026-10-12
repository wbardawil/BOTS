#!/usr/bin/env bash
# Runs the API test suites against the local compose stack (or any BOTS_TEST_BASE_URL).
#   ./scripts/test_local.sh                 # all suites
#   ./scripts/test_local.sh tests/test_flagship.py -k Import
# Reads credentials from .env (never pass them on the command line).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export BOTS_TEST_BASE_URL="${BOTS_TEST_BASE_URL:-http://localhost:8001}"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL in .env}"
: "${ADMIN_PASSWORD:?set ADMIN_PASSWORD in .env}"
: "${DEMO_USERS_PASSWORD:?set DEMO_USERS_PASSWORD in .env (the API tests log in as the demo editor and viewer)}"
cd backend
exec python -m pytest -q "${@:-tests}"
