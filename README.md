# Google Analytics Dashboard

A full-stack analytics dashboard that connects to Google Analytics 4 via OAuth 2.0 — or runs
entirely on realistic **mock data** so you can develop, demo and test without a Google account.

```
backend/   Python FastAPI — OAuth + GA Data API v1 (+ deterministic mock provider)
frontend/  React + TypeScript + Vite — six interactive dashboard pages (Recharts, TanStack Query)
```

---

## Quick start (mock data, no Google setup)

```bash
# Terminal 1 — API with generated data
cd backend && uv sync && GA_MOCK_MODE=true uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI
cd frontend && npm install && npm run dev
```

Open http://localhost:5173, click **Continue with demo data**, enter any property ID
(e.g. `123456789`) and explore. A **Demo data** badge in the sidebar reminds you the
numbers are generated.

> Want to skip the backend entirely? `VITE_MOCK_API=true npm run dev` serves the same
> mock data from inside the browser.

### …or run everything in containers

```bash
cp .env.example .env          # optional: tweak ports / secrets
docker compose up --build     # Redis cache + API + nginx-served UI
```

Open http://localhost:5173. `GET http://localhost:8000/health` shows the cache backend
(`redis`) and hit/miss counters.

---

## Architecture

```
 browser ──► frontend (nginx, :5173) ──► backend (FastAPI, :8000) ──► Google Analytics Data API
                                              │                           (or the mock provider)
                                              └──► redis (:6379) — report cache, TTL + LRU
```

Every report request is wrapped by a cache keyed on *(user, query)*. With Redis configured
(`REDIS_URL`, set automatically by compose) the cache is shared across backend replicas and
survives restarts; without it an in-process cache is used. Redis outages are fail-soft: the
backend logs and falls through to the data source.

## Dashboards

| Page | What's on it | Interactions |
|------|--------------|--------------|
| **Overview** | KPI cards with period-over-period deltas, trend chart, channel & device donuts | Click a KPI to plot it · line/area/bar toggle · brush to zoom · click a donut slice to filter the whole page |
| **Audience** | Devices, new vs returning, browsers, operating systems, hour-of-day, users over time | Click any segment/bar — every other widget is cross-filtered to it |
| **Acquisition** | Stacked channels-over-time, channel mix, channels table, source/medium, landing pages | Click a channel (pie, legend or table row) to focus everything on it |
| **Content** | Trend with metric chips, top pages, events, landing pages | Click a page row → its trend and events; search/sort/paginate tables |
| **Geography** | Top-countries bar (rank by sessions/users/new users), trend, countries & cities tables | Click a country → cities *in that country* and its trend |
| **Explore** | Custom report builder over every supported dimension & metric | Pick fields, run, auto-chart (time series or ranked bars), export CSV |

Global controls in the header — **property ID**, **date range** (presets or custom) and a
**Refresh** button showing when data was last updated — apply to every page. Property and date
range are mirrored into the URL (`?property=…&start=…&end=…`), so any view is a shareable deep
link, and persisted locally so they survive reloads.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| [uv](https://docs.astral.sh/uv/) | latest |
| Node.js | 18+ |

---

## Connecting to real Google Analytics

1. In [Google Cloud Console](https://console.cloud.google.com/) enable the **Google Analytics Data API**
   and create an **OAuth 2.0 Client ID** (Web application) with redirect URI
   `http://localhost:8000/auth/callback`.
2. Configure the backend:
   ```bash
   cd backend
   cp .env.example .env
   # set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET and GA_MOCK_MODE=false
   uv run python -c "import secrets; print(secrets.token_hex(32))"   # → SESSION_SECRET
   uv run uvicorn app.main:app --reload --port 8000
   ```
3. Start the frontend (`npm run dev`), click **Sign in with Google**, authorise, and enter
   your **GA4 Property ID** (Google Analytics → Admin → Property Settings).

API docs: http://localhost:8000/docs

---

## Development shortcuts

```bash
make install      # uv sync + npm install
make dev          # backend (mock mode) + frontend together
make lint         # ruff · mypy · oxlint · tsc
make test         # lint + backend + frontend + e2e
make up / down    # full stack in Docker (redis + backend + frontend)
make redis        # only the Redis container, for a locally-run backend
```

CI (`.github/workflows/ci.yml`) runs backend, frontend, container build + smoke test, and
Playwright stages on every push / PR.

## Testing

```bash
# Backend — pytest, ~200 typed tests, 100% coverage, no network; mypy --strict over app + tests
cd backend && uv run pytest --cov=app && uv run mypy

# Frontend — Vitest + Testing Library, ~280 tests in frontend/tests (kept out of src/)
cd frontend && npm test            # or: npm run test:coverage

# End-to-end — Playwright drives Chromium against the real backend (mock mode) + Vite
cd frontend && npx playwright install chromium && npm run test:e2e
```

Both suites run against the deterministic mock generators, so results are stable and no
Google credentials are ever needed. See `backend/README.md` and `frontend/README.md` for details.

---

## Project structure

```
DashboardApp/
├── docker-compose.yml           # redis + backend + frontend
├── backend/
│   ├── Dockerfile               # uv-built venv on python:3.12-slim, non-root
│   ├── app/
│   │   ├── main.py              # ASGI entry point
│   │   ├── factory.py           # create_app(settings)
│   │   ├── config.py            # Settings from env (GA_MOCK_MODE, REDIS_URL, secrets, origins)
│   │   ├── cache.py             # ReportCache protocol: RedisCache / MemoryCache
│   │   ├── dates.py             # GA date syntax, DateRange, previous period
│   │   ├── mock_data.py         # Deterministic mock GA generator
│   │   ├── providers.py         # ReportProvider: Google + Mock, dependency injection
│   │   ├── oauth.py             # Google OAuth flow
│   │   ├── schemas.py           # Response models
│   │   └── routers/             # /auth/*, /analytics/*
│   ├── tests/                   # pytest suite
│   └── pyproject.toml
└── frontend/
    ├── Dockerfile               # Vite build → nginx (SPA fallback, asset caching)
    ├── src/
    │   ├── api/                 # Axios client + typed API (live or mock)
    │   ├── mocks/               # In-browser mock GA generator + mock API
    │   ├── lib/                 # format / report / dates / csv helpers
    │   ├── context/, hooks/     # Auth, dashboard state, data hooks, drill-down
    │   ├── components/          # ui/, charts/, tables/
    │   ├── layouts/             # Sidebar + header shell
    │   └── pages/               # Overview, Audience, Acquisition, Content, Geography, Explore, Login
    ├── tests/                   # Vitest suite (mirrors src/), setup & helpers
    ├── e2e/                     # Playwright end-to-end specs
    └── playwright.config.ts     # Starts backend (GA_MOCK_MODE) + Vite for E2E runs
```

---

## Environment variables

### Backend

| Variable | Description |
|----------|-------------|
| `GA_MOCK_MODE` | `true` → serve generated data and skip Google OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client (required unless mock mode) |
| `GOOGLE_REDIRECT_URI` | Must match the Cloud Console redirect URI (default `http://localhost:8000/auth/callback`) |
| `SESSION_SECRET` | Random secret for signing session cookies (required unless mock mode) |
| `FRONTEND_ORIGIN` | CORS origin of the React dev server (default `http://localhost:5173`) |
| `CORS_ORIGINS` | Optional extra comma-separated origins |
| `SESSION_HTTPS_ONLY` | `true` to mark the session cookie `Secure` (use behind HTTPS) |
| `REPORT_CACHE_TTL` | Seconds to cache identical report requests per user (default `300`, `0` disables) |
| `REDIS_URL` | Redis URL for a shared cache (e.g. `redis://localhost:6379/0`); unset → in-memory cache |
| `MOCK_TODAY` | `YYYY-MM-DD` to freeze "today" in mock mode for reproducible demos |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8000`) |
| `VITE_MOCK_API` | `true` → answer all API calls in the browser with mock data |
