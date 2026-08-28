# The Sia watcher — Baileys ear on Fargate (Sia W1). READ-ONLY: never sends.
# Runtime state: WhatsApp auth keys live on the mounted EFS volume (WAG_AUTH_DIR);
# media goes straight to S3 (WAG_MEDIA_BUCKET) — the container itself is disposable.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# tsx runs the TypeScript directly — same entry as local (`npm start`).
CMD ["npx", "tsx", "src/index.ts"]
