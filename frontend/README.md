# GA Dashboard — Frontend

React 19 + TypeScript + Vite. Charts with Recharts, data fetching with TanStack Query, routing with React Router.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server on http://localhost:5173 |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run oxlint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run the suite with a V8 coverage report (`coverage/`) |
| `npm run test:e2e` | Run the Playwright end-to-end suite (starts backend + frontend automatically) |
| `npm run test:e2e:ui` | Playwright's interactive UI mode |
| `npm run test:e2e:headed` | Run E2E tests in a visible browser |

## Environment

Copy `.env.example` to `.env` (or `.env.local`) and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |
| `VITE_MOCK_API` | `false` | `true` = no backend at all; every call is answered by the in-browser mock generator in `src/mocks` |

## Behaviour worth knowing

* **Shareable URLs** — property and date range live in the query string
  (`?property=…&start=…&end=…`) and are restored on load; sidebar links carry them along.
* **Session expiry** — a `401` from any report endpoint signs the user out and returns
  to the login page instead of leaving every widget in an error state.
* **Refresh** — the header button invalidates every report query and shows when data was
  last updated; widgets keep showing previous data (marked busy) while new data loads.
* **Resilience** — each page is wrapped in an error boundary (reset on navigation) and is
  code-split with `React.lazy`; vendor libraries ship as separate long-cacheable chunks.

## Structure

```
src/
├── api/            Axios client, typed API functions, wire types
├── mocks/          Deterministic mock GA data generator + mock API implementation
├── lib/            Pure helpers: formatting, report parsing, dates, CSV
├── context/        Auth + dashboard (property / date range) providers
├── hooks/          useReport / useSummary / useCustomReport / useMetadata, useDrilldown
├── components/
│   ├── ui/         WidgetCard, KpiCard, DateRangePicker, PropertySelector, controls
│   ├── charts/     TimeSeriesChart, BreakdownPie, BreakdownBar
│   └── tables/     DataTable (sort / search / paginate / select), ReportTable
├── layouts/        DashboardLayout (sidebar + header) and nav config
└── pages/          Overview, Audience, Acquisition, Content, Geography, Explore, Login

e2e/                Playwright end-to-end suite (real browser, real backend in mock mode)
├── helpers.ts      signIn / selectProperty / waitForWidgets, `dashboard` fixture
└── *.spec.ts       auth, navigation, date-range, overview, drilldowns, explore, api

tests/              Vitest suite — kept entirely outside src/
├── setup.ts        jsdom polyfills, jest-dom matchers, Recharts ResponsiveContainer stub
├── helpers/
│   ├── render.tsx          renderWithProviders(), test QueryClient, makeReport()
│   └── mockAnalytics.ts    vi.fn-wrapped mock API used in place of src/api/analytics
└── <mirrors src/>  api/, components/, context/, hooks/, layouts/, lib/, mocks/, pages/, App.test.tsx
```

## Testing

Tests live in `tests/`, mirroring the `src/` tree, and import application code
through the `@/` alias (`@tests/` for helpers). Component and page tests render
against the deterministic mock API via

```ts
vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));
```

so they never touch the network and every number is stable. Type-checking of
the tests is wired into `tsc -b` through `tsconfig.test.json`, while
`tsconfig.app.json` (used for the production build) only sees `src/`.

## End-to-end tests (Playwright)

`npm run test:e2e` launches the FastAPI backend in `GA_MOCK_MODE` (from
`../backend`, via `uv`) and the Vite dev server, then drives Chromium through
the real application: signing in, entering a property, navigating every
dashboard, cross-filtering charts, drilling into tables, building custom
reports, downloading CSVs, and checking that numbers agree across pages
(e.g. the filtered Sessions KPI equals the channel table's row; a country's
cities add up to the country total). `e2e/api.spec.ts` additionally checks the
backend contract directly with Playwright's `request` fixture.

Already-running servers on ports 8000 / 5173 are reused locally; set
`E2E_FRONTEND_PORT` / `E2E_BACKEND_PORT` to change them. Traces and
screenshots are kept for failed tests under `test-results/`.

Prerequisite: `npx playwright install chromium` (once).
