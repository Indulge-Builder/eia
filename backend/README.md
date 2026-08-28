# Serene Backend (Python)

The Python home of Serene (master-plan Step 2+). Today: a health-checked
FastAPI skeleton on ECS Fargate. Next: the Elaya brain (Step 3, eval-gated),
then the one write path (Step 5), then the Sia pipelines (Step 6).

## Local dev

```bash
cd backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --reload --port 8002
# http://localhost:8002/healthz
```

Secrets go in `backend/.env` (gitignored) — see `app/config.py` for the keys.

## Deploy (AWS Copilot → ECS Fargate, ap-south-1)

One-time setup was done 2026-08-27 (app `serene`, env `prod`, service `api`).
Day-to-day, a deploy is:

```bash
cd backend
copilot deploy        # builds the Docker image, pushes, rolls the service
```

`copilot svc show` prints the URL and status. `copilot svc logs --follow`
tails production logs. The manifest lives in `backend/copilot/api/manifest.yml`
— container size, health check path, env vars, and secrets are configured
there, not in the console.
