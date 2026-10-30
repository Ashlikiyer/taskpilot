# Production image for the API (Render). Python is pinned here rather than relying
# on the host, and dependencies come from uv.lock exactly.
FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.12 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

# Dependencies first, so code changes don't reinstall them.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home app
USER app

# Apply migrations, then serve. --proxy-headers takes the client IP from
# X-Forwarded-For (Vercel → Render), which the rate limits key on.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
