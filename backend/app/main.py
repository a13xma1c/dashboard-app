"""
ASGI entry point: ``uvicorn app.main:app --reload --port 8000``.

Configuration is read from the environment / ``.env`` at import time; see
``app.factory.create_app`` for the testable factory.
"""

from app.factory import create_app

app = create_app()
