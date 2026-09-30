FROM dailyco/pipecat-base:0.1.20

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app
COPY voice-agent/pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --no-dev
COPY voice-agent/ .

CMD ["uv", "run", "--no-sync", "bot.py", "-t", "daily", "--host", "0.0.0.0", "--port", "8080"]
