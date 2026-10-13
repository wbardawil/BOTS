"""Unit tests for the pure layers: no server, no MongoDB.

db.py opens a Motor client from MONGO_URL / DB_NAME at import and auth.py reads JWT_SECRET, so dummies go
into the environment before any backend module is imported. Motor connects lazily, so port 1 is never
dialled. backend/ goes on sys.path so `import fields` works whichever directory pytest runs from.
"""
import os
import sys

os.environ.setdefault("MONGO_URL", "mongodb://localhost:1")
os.environ.setdefault("DB_NAME", "bots_unit")
os.environ.setdefault("JWT_SECRET", "unit-tests-only-not-a-secret")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
