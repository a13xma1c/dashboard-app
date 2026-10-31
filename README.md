# Google Analytics Dashboard

A full-stack dashboard app that connects to Google Analytics 4 via OAuth 2.0 and renders interactive charts.

```
backend/   Python FastAPI — OAuth + GA Data API v1
frontend/  React + TypeScript + Vite — charts with Recharts
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| [uv](https://docs.astral.sh/uv/) | latest |
| Node.js | 18+ |

---

## 1 — Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Library** and enable the **Google Analytics Data API**.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:8000/auth/callback`
3. Copy the **Client ID** and **Client Secret** — you'll need them below.

---

## 2 — Backend setup

```bash
cd backend

# Install dependencies (creates .venv automatically)
uv sync

# Configure environment
cp .env.example .env
# Edit .env and fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
```

Generate a session secret:
```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Start the backend:
```bash
uv run uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

---

## 3 — Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App runs at http://localhost:5173

---

## 4 — Usage

1. Open http://localhost:5173 and click **Sign in with Google**.
2. Authorize access to your Google Analytics account.
3. After redirect, enter your **GA4 Property ID** (found in Google Analytics → Admin → Property Settings → Property ID).
4. Dashboards load automatically:
   - **Sessions / Users / Pageviews** — daily line chart (last 30 days)
   - **Traffic Sources** — pie chart by channel group
   - **Devices** — pie chart by device category
   - **Top Pages** — table of top 20 pages by pageviews
   - **Sessions by Country** — table of top 20 countries

---

## Project structure

```
DashboardApp/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, session middleware
│   │   ├── oauth.py             # Google OAuth 2.0 flow helpers
│   │   └── routers/
│   │       ├── auth.py          # /auth/login, /auth/callback, /auth/me, /auth/logout
│   │       └── analytics.py     # /analytics/* GA Data API endpoints
│   ├── pyproject.toml           # uv project + dependencies
│   ├── uv.lock                  # locked dependency graph
│   └── .env.example
└── frontend/
    └── src/
        ├── api/
        │   ├── client.ts        # Axios instance
        │   └── analytics.ts     # API call functions + types
        ├── context/
        │   └── AuthContext.tsx  # Auth state provider
        ├── pages/
        │   ├── LoginPage.tsx
        │   └── DashboardPage.tsx
        └── components/
            ├── OverviewChart.tsx   # Line chart (sessions/users/pageviews)
            ├── PieWidget.tsx       # Pie chart (traffic sources, devices)
            ├── TopPagesTable.tsx   # Top pages table
            └── GeoTable.tsx        # Geo breakdown table
```

---

## Environment variables reference

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | Must match redirect URI registered in Google Cloud (default: `http://localhost:8000/auth/callback`) |
| `SESSION_SECRET` | Random secret used to sign session cookies |
| `FRONTEND_ORIGIN` | CORS allowed origin for the React dev server (default: `http://localhost:5173`) |
