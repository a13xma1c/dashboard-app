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

## Environment

Copy `.env.example` to `.env` (or `.env.local`) and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |
| `VITE_MOCK_API` | `false` | `true` = no backend at all; every call is answered by the in-browser mock generator in `src/mocks` |

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
