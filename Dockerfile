# syntax=docker/dockerfile:1
# Color Matcher — CI tests (target: test) and production image (target: production).

# --- Frontend: tests + production build ---
FROM node:22-alpine AS frontend-ci
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY scripts/docker-npm-ci.sh /tmp/docker-npm-ci.sh
RUN --mount=type=cache,target=/root/.npm \
    sed -i 's/\r$//' /tmp/docker-npm-ci.sh \
    && sh /tmp/docker-npm-ci.sh
COPY frontend/ ./
RUN npm test && npm run build

# --- Backend + repo checks (also requires frontend-ci tests/build) ---
FROM python:3.12-slim-bookworm AS test
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=frontend-ci /app/frontend/dist /tmp/frontend-dist-check
RUN test -f /tmp/frontend-dist-check/index.html

COPY backend/requirements.txt backend/requirements-dev.txt ./backend/
COPY scripts/docker-pip-install.sh /tmp/docker-pip-install.sh
RUN sed -i 's/\r$//' /tmp/docker-pip-install.sh \
    && sh /tmp/docker-pip-install.sh backend/requirements-dev.txt

COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY docs/openapi.json ./docs/openapi.json
COPY frontend/src/i18n/locales ./frontend/src/i18n/locales

RUN cd backend && python -m pytest -q
RUN python scripts/check_i18n_keys.py
RUN python scripts/check_openapi_drift.py

# --- Production (lightweight Debian slim; UI baked in) ---
FROM python:3.12-slim-bookworm AS production
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    COLOR_MATCHER_STATIC_DIR=/app/static \
    COLOR_MATCHER_HOST=0.0.0.0 \
    COLOR_MATCHER_PORT=8000

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

COPY backend/requirements.txt .
COPY scripts/docker-pip-install.sh /tmp/docker-pip-install.sh
RUN sed -i 's/\r$//' /tmp/docker-pip-install.sh \
    && sh /tmp/docker-pip-install.sh requirements.txt

COPY backend/app ./app
COPY --from=frontend-ci /app/frontend/dist ./static
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
    && chmod +x /entrypoint.sh \
    && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
