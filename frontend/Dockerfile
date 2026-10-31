# syntax=docker/dockerfile:1.7
# ── Build stage: compile the Vite app ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Where the browser should reach the API. Baked in at build time (Vite env).
ARG VITE_API_URL=http://localhost:8000
ARG VITE_MOCK_API=false
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MOCK_API=$VITE_MOCK_API

COPY index.html vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
RUN npx vite build

# ── Runtime stage: static files behind nginx with SPA fallback ────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
