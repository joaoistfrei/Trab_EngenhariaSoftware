# syntax=docker/dockerfile:1

# =========================================================
# Stage 1 — compila o scraper Go
# =========================================================
FROM golang:1.26-bookworm AS scraper-build
WORKDIR /src

COPY src/scraper/go.mod src/scraper/go.sum ./
RUN go mod download

COPY src/scraper/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/scraper .

# =========================================================
# Stage 2 — runtime Python + Chromium (resolve o WAF do Booking)
# =========================================================
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-liberation \
        tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements ./requirements
RUN pip install --no-cache-dir -r requirements

COPY src/backend /app/backend
COPY --from=scraper-build /out/scraper /usr/local/bin/scraper

ENV CHROMIUM_PATH=/usr/bin/chromium \
    SCRAPER_BIN=/usr/local/bin/scraper \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# tini reaping evita zumbis quando chromedp deixa subprocessos pendurados.
ENTRYPOINT ["tini", "--"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
