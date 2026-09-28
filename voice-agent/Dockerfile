FROM dailyco/pipecat-base:0.1.20

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --no-dev
COPY . .

CMD ["uv", "run", "bot.py"]
