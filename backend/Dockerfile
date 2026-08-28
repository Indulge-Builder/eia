# Serene backend — single-stage, small, boring on purpose.
FROM python:3.13-slim

WORKDIR /srv

# Layer-cache the deps.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV ENV=production
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
