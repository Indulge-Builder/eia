"""Serene backend — the Python service (master-plan Step 2 skeleton).

This is the future home of the Elaya brain (Step 3), the one write path
(Step 5), and the Sia pipelines (Step 6). Today it is deliberately tiny:
boot, config, health. The port lands piece by piece behind eval gates —
never all at once (the strangler rule).
"""

from __future__ import annotations

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.config import settings

app = FastAPI(
    title="Serene Backend",
    version="0.1.0",
    # No public docs on an internal service.
    docs_url="/docs" if settings.env != "production" else None,
    redoc_url=None,
)


app.include_router(chat_router)


@app.get("/healthz")
def healthz() -> dict:
    """Liveness — the load balancer and ECS health checks hit this."""
    return {"ok": True, "service": "serene-backend", "env": settings.env}


@app.get("/")
def root() -> dict:
    return {
        "service": "serene-backend",
        "version": app.version,
        "env": settings.env,
        "note": "The Python home of Serene. The brain arrives at Step 3.",
    }
