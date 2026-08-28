"""Eval harness config.

Reads the repo's .env.local (Supabase URL + keys) plus eval-specific settings
from environment variables or evals/.env.eval (gitignored). Never prints secrets.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

EVALS_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = EVALS_DIR.parent


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        out[key.strip()] = value
    return out


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    base_url: str          # the Next.js app under test
    eval_email: str
    eval_password: str
    upstash_url: str       # for fixture cache invalidation ("" = skip)
    upstash_token: str

    @property
    def project_ref(self) -> str:
        # https://<ref>.supabase.co -> <ref>
        host = self.supabase_url.split("//", 1)[-1]
        return host.split(".", 1)[0]


def load_config() -> Config:
    env: dict[str, str] = {}
    env.update(_parse_env_file(REPO_ROOT / ".env.local"))
    env.update(_parse_env_file(EVALS_DIR / ".env.eval"))
    env.update(os.environ)  # real env wins

    missing = [
        k
        for k in (
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "EVAL_USER_EMAIL",
            "EVAL_USER_PASSWORD",
        )
        if not env.get(k)
    ]
    if missing:
        raise SystemExit(
            "Missing config: "
            + ", ".join(missing)
            + "\nSet them in evals/.env.eval (see evals/README.md)."
        )

    return Config(
        supabase_url=env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"),
        supabase_anon_key=env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        supabase_service_key=env["SUPABASE_SERVICE_ROLE_KEY"],
        base_url=env.get("EVAL_BASE_URL", "http://localhost:3000").rstrip("/"),
        eval_email=env["EVAL_USER_EMAIL"],
        eval_password=env["EVAL_USER_PASSWORD"],
        upstash_url=env.get("UPSTASH_REDIS_REST_URL", "").rstrip("/"),
        upstash_token=env.get("UPSTASH_REDIS_REST_TOKEN", ""),
    )
