# AGENTS.md

## Repo state

- Product: **ОПОРА** — modular B2B SaaS platform for operational resilience of Ukrainian businesses. Three modules: ШІ-агенти (AI agents), Енергоменеджмент (EMS / BESS / solar tariff arbitrage), Фінанси та податки (VAT invoice limits, risk score, compliance deadlines).
- Stack: **Vite 6 + React 19 + TypeScript (strict)**, recharts, lucide-react, vitest, ESLint 9 (flat config) + react-hooks rules. Backend (Phase 2): **Hono on Cloudflare Workers + D1** in `worker/` (own package.json/tsconfig; Free-Tier guardrails — no DO/Queues/KV-writes; tenant via `X-Opora-Tenant`, app-level tenancy since D1 has no RLS). SPA by design for Phase 1; Next.js migration is off the table while Pages serves the SPA.
- Commands: `npm install` · `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`. CI runs them in that order plus `worker/` typecheck+tests (`.github/workflows/ci.yml`); run lint + typecheck + test after every change.
- Worker commands: from `worker/` — `npm run dev` (local workerd+D1), `npm run db:migrate:local|--remote`, `npm run deploy` → https://opora-api.p4d-b2q.workers.dev

## Files

- `src/` — canonical application code. Module boundaries follow the plan's bounded contexts:
  - `src/app/` — shell (sidebar nav, status strip, hash-routed lazy tabs via `routing.ts`, tested parsers; unknown hashes fall back to overview) + `scenario.tsx` / `scenario-sync.ts` / `api.ts` — React-context scenario store with **offline-first cloud sync**: optimistic local state + fire-and-forget writes to the Workers API, boot-time `reconcile()` adopts remote rows when present and seeds an empty D1 from localStorage otherwise (`apiOnline` flag exposed; no external state libs). Pages read snapshots via `useScenario()` and pass slices into `getFinanceSnapshot(scenario.finance)` / `getEnergySnapshot(...)`. Every lazy tab renders inside an `ErrorBoundary` with a retry action.
  - `src/design-system/` — `tokens.css` (all CSS variables) + shared primitives (`KpiCard`, `ProgressBar`, `AlertRow`, `Eyebrow`, `Dot`, `ChartTooltip`)
  - `src/modules/<name>/` — one folder per module (`overview`, `ai-agents`, `energy`, `finance`); each may expose `domain/` (pure logic), `data/` (fixtures), `ui/` (pages)
- **Cross-module access goes only through a module's `index.ts` facade**, never deep-imports into another module's internals. The finance module demonstrates this.
- `src/modules/finance/domain/` — deterministic tax rules (КМУ №1048 thresholds: 100k ₴/contractor, 1M ₴ total) and the weighted risk-score calculator. This is real business logic covered by vitest tests; change it only together with its tests and `ПЛАН_ОПОРА...md`.
- `src/modules/hr/domain/` — booking compliance rules per КМУ №692 (salary threshold 25 941 ₴ / 21 600 ₴ frontline, quotas 50%/100%, no tax debt) plus bulk roster assessment (`assessBookingRoster`). Same rule applies: logic + tests change together.
- `src/modules/energy/domain/` — BESS tariff-arbitrage model (DoD × round-trip efficiency × day/night spread − degradation cost) and payback calculator; `MARKET_TARIFFS` are the single source for НКРЕКП tariff figures used in UI copy too. Same rule applies: logic + tests change together.
- `src/modules/billing/domain/` — hybrid pricing engine (platform fee + per-resolution outcome with included allowance + EMS fixed/share/capacity modes) per plan §2.4; `PLANS` is the single source for tariff-plan figures shown in UI. Same rule applies: logic + tests change together.
- `src/modules/*/data/fixtures.ts` — hardcoded demo data (there is no backend yet). AI-agent chat replies come from a canned bank cycled by modulo.
- `opora-saas-platform.jsx` — legacy single-file prototype kept as visual reference only; do not extend it. Port anything needed into `src/`.
- `worker/` — Cloudflare Workers API (Phase 2 skeleton): Hono routes mirror the frontend scenario ops (`finance/contractors`, `hr/employees`, `hr/enterprise`) over D1; tests stub D1 via `test/fakeD1.ts`. Money columns are INTEGER ₴; every query filters by `tenant_id` from `resolveTenant()`.
- Filenames contain Cyrillic characters and spaces — always quote paths in shell commands.

## Strategy & architecture

- `ПЛАН_ОПОРА_Дослідження_та_Архітектура.md` — comprehensive research, fact-check, and architecture plan (v1.0). Read it before making product or architecture decisions; it fact-checks all 131 sources from both research docs, justifies the 3-module focus (HR/AI, EMS, Finance) over 6 alternative domains, and defines the 18-month phased roadmap. Structure is reasoning-first then conclusions.
- If you change scope, pricing, or architecture, update that plan — it is the single source of truth for strategic decisions.

## Conventions

- All product copy is **Ukrainian**; use `uk-UA` formatting via helpers in `src/lib/format.ts` (never raw `toLocaleString` scattered around). Keep new UI text in Ukrainian.
- Preserve the module→color mapping from `tokens.css`: AI `--ai` (teal), Energy `--energy` (amber), Finance `--finance` (green), plus `--danger` (red); dark theme `--bg: #14171A`; fonts IBM Plex (Sans / Sans Condensed for display / Mono) loaded in `index.html`.
- Shared control styles live in `tokens.css`: `.btn` variants (`btn-solid`, `btn-finance`, `btn-surface`, `btn-icon`, `btn-ghost`) and `.input-row` (incl. styled `select`). Prefer them over bespoke inline button/input styles; dates render via `formatDateUa`, never raw ISO strings.
- No comments in code unless asked; domain constants carry legal meaning through naming (e.g., `VAT_RULES`) — keep names precise.
