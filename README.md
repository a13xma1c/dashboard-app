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

---

## Dashboards

| Page | What's on it | Interactions |
|------|--------------|--------------|
| **Overview** | KPI cards with period-over-period deltas, trend chart, channel & device donuts | Click a KPI to plot it · line/area/bar toggle · brush to zoom · click a donut slice to filter the whole page |
| **Audience** | Devices, new vs returning, browsers, operating systems, hour-of-day, users over time | Click any segment/bar — every other widget is cross-filtered to it |
| **Acquisition** | Stacked channels-over-time, channel mix, channels table, source/medium, landing pages | Click a channel (pie, legend or table row) to focus everything on it |
| **Content** | Trend with metric chips, top pages, events, landing pages | Click a page row → its trend and events; search/sort/paginate tables |
| **Geography** | Top-countries bar (rank by sessions/users/new users), trend, countries & cities tables | Click a country → cities *in that country* and its trend |
| **Explore** | Custom report builder over every supported dimension & metric | Pick fields, run, auto-chart (time series or ranked bars), export CSV |

Global controls in the header — **property ID** and **date range** (presets or custom) — apply
to every page and persist across reloads.

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

## Testing

```bash
# Backend — pytest, ~200 typed tests, 100% coverage, no network; mypy --strict over app + tests
cd backend && uv run pytest --cov=app && uv run mypy

# Frontend — Vitest + Testing Library, ~280 tests in frontend/tests (kept out of src/)
cd frontend && npm test            # or: npm run test:coverage
```

Both suites run against the deterministic mock generators, so results are stable and no
Google credentials are ever needed. See `backend/README.md` and `frontend/README.md` for details.

---

## Project structure

```
DashboardApp/
├── backend/
│   ├── app/
│   │   ├── main.py              # ASGI entry point
│   │   ├── factory.py           # create_app(settings)
│   │   ├── config.py            # Settings from env (GA_MOCK_MODE, secrets, origins)
│   │   ├── dates.py             # GA date syntax, DateRange, previous period
│   │   ├── mock_data.py         # Deterministic mock GA generator
│   │   ├── providers.py         # ReportProvider: Google + Mock, dependency injection
│   │   ├── oauth.py             # Google OAuth flow
│   │   ├── schemas.py           # Response models
│   │   └── routers/             # /auth/*, /analytics/*
│   ├── tests/                   # pytest suite
│   └── pyproject.toml
└── frontend/
    ├── src/
    │   ├── api/                 # Axios client + typed API (live or mock)
    │   ├── mocks/               # In-browser mock GA generator + mock API
    │   ├── lib/                 # format / report / dates / csv helpers
    │   ├── context/, hooks/     # Auth, dashboard state, data hooks, drill-down
    │   ├── components/          # ui/, charts/, tables/
    │   ├── layouts/             # Sidebar + header shell
    │   └── pages/               # Overview, Audience, Acquisition, Content, Geography, Explore, Login
    └── tests/                   # Vitest suite (mirrors src/), setup & helpers
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

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8000`) |
| `VITE_MOCK_API` | `true` → answer all API calls in the browser with mock data |
