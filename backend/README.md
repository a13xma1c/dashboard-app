# Google Analytics Dashboard — Backend

FastAPI service that wraps the GA4 Data API (or serves deterministic mock data).

## Setup

```bash
uv sync                      # installs runtime + dev dependencies into .venv
cp .env.example .env         # then edit
uv run uvicorn app.main:app --reload --port 8000
```

### Mock mode (no Google account needed)

```bash
GA_MOCK_MODE=true uv run uvicorn app.main:app --reload --port 8000
```

In mock mode:

* `GET /auth/login` logs you straight in (no OAuth) and redirects to the frontend.
* Every `/analytics/*` endpoint returns generated data that is deterministic,
  internally consistent (breakdowns add up to the same totals as the time
  series; cities roll up into their countries) and realistic (weekly
  seasonality, trend, noise).
* `SESSION_SECRET` may be omitted — an insecure development secret is used.
* Set `MOCK_TODAY=2025-03-15` to freeze the clock for reproducible data.

### Real mode notes

* After OAuth the user's email is fetched from Google's `userinfo` endpoint and
  shown in the header (best-effort; login still succeeds if it fails).
* Identical report requests by the same user are cached in memory for
  `REPORT_CACHE_TTL` seconds (default 300) to conserve GA Data API quota.
  Cache entries are keyed by a hash of the user's credentials, never shared.
* Set `SESSION_HTTPS_ONLY=true` in production so the session cookie is `Secure`.
* `property_id` path parameters must be numeric; anything else is rejected with 422.

## Endpoints

| Path | Description |
|------|-------------|
| `GET /health` | Liveness + mock-mode flag |
| `GET /auth/login` · `/auth/callback` · `/auth/me` · `POST /auth/logout` | OAuth 2.0 session flow |
| `GET /analytics/metadata` | Dimensions & metrics available to the report builder |
| `GET /analytics/summary/{property_id}` | Headline metrics for the range **and** the equal-length preceding range |
| `GET /analytics/{report}/{property_id}` | Standard reports: `overview`, `traffic-sources`, `source-medium`, `top-pages`, `landing-pages`, `devices`, `browsers`, `operating-systems`, `new-vs-returning`, `geo`, `cities`, `events`, `hourly` |
| `GET /analytics/custom/{property_id}` | Arbitrary report: `?dimensions=a,b&metrics=x,y` (max 5 each) |

All report endpoints accept:

* `start_date` / `end_date` — GA syntax: `YYYY-MM-DD`, `today`, `yesterday`, `NdaysAgo`
* `filter_dimension` + `filter_value` — exact-match dimension filter (used for drill-downs)
* `limit` — 1…10000

Interactive docs: http://localhost:8000/docs

## Tests & type checking

```bash
uv run pytest                                   # ~200 tests, no network access
uv run pytest --cov=app --cov-report=term-missing
uv run mypy                                     # strict mode over app/ *and* tests/
uv run ruff check . && uv run ruff format --check .
```

The suite covers settings parsing, date resolution, the mock data generator
(shape, determinism, consistency, hierarchy, validation), every HTTP endpoint
in mock mode, and the Google provider / OAuth code paths with the Google
client faked out. Tests are fully type-annotated and checked with
`mypy --strict` alongside the application code.

## Layout

```
app/
├── main.py          ASGI entry point (uvicorn app.main:app)
├── factory.py       create_app(settings) — testable application factory
├── config.py        Settings loaded from the environment
├── cache.py         TTL/LRU cache for Google report responses
├── dates.py         GA relative-date parsing, DateRange, previous period
├── mock_data.py     Deterministic mock GA generator (MockAnalyticsProvider)
├── providers.py     ReportProvider protocol, GoogleAnalyticsProvider, DI
├── oauth.py         google-auth-oauthlib flow helper
├── schemas.py       Pydantic response models
└── routers/
    ├── auth.py
    └── analytics.py
tests/
```
