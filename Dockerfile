# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Copy the source and build a plain Node server bundle
COPY . .

# VITE_* values are inlined into the browser bundle at build time,
# so they must be passed as build args:
#   docker build --build-arg VITE_SUPABASE_URL=... ...
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    ACEMAIL_TARGET=node-server

RUN bun run build

# ── Stage 2: runtime ────────────────────────────────────────
# The nitro node-server output is self-contained (dependencies are
# bundled into .output), so no node_modules install is needed here.
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000

# Runtime env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL,
# QUEUE_HOOK_SECRET, APP_USER_CONNECTION_KEY_SECRET, ...) is supplied
# via `docker run --env-file .env` or docker-compose.
CMD ["node", ".output/server/index.mjs"]
