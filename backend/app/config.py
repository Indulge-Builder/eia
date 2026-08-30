"""Settings — environment-driven, never hardcoded.

Secrets arrive as environment variables (locally from backend/.env, on AWS
from Copilot secrets / SSM). The Supabase values are unused by the skeleton
but declared now so the Step 3 port drops in without config surgery.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"

    # Step 3 wiring (optional until the brain lands):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    anthropic_api_key: str = ""
    # Shared bearer between our own servers (Next.js, evals) and the brain
    # endpoints. Empty = brain endpoints refuse everything (fail closed).
    brain_api_secret: str = ""
    # The Next.js app — the write bridge lives there (/api/elaya/bridge).
    # Local dev/evals default; the Fargate manifest carries the prod URL.
    web_app_url: str = "http://localhost:3000"


settings = Settings()
