# AGENTS.md

## Що це за репозиторій

**Конфігурована B2B SaaS-платформа** (Builder/Runtime, metadata control plane) —
будується за блюпринтом після півота з вертикальної ОПОРИ (ADR 0001).

## Обов'язкові до прочитання

1. `docs/blueprint/saas-platform-blueprint.md` — **головна специфікація**: архітектура,
   DSL, модель метаданих, етапи. Не відступати без ADR.
2. `docs/specs/platform-spec.md` — **контракти платформи v0.1**: доменна модель,
   DataPort, tenancy/auth фази, API v1, backlog з критеріями приймання.
3. `docs/architecture/decision-records/0001-pivot-to-configurable-platform.md` —
   півот: повний перехід на конфігуровану платформу, гібридний порт даних,
   монорепо pnpm+turbo.
4. `docs/architecture/decision-records/0002-bootstrap-wedge-free-models.md` —
   wedge-стратегія, $0 burn, правила free-моделей, stop-loss. Читати перед плануванням фіч.
5. `docs/research/2026-09-competitor-analysis.md` — конкуренти 14+3, матриця X×Y,
   Pareto-backlog. Читати перед вибором фіч.
6. `docs/plans/pareto-roadmap.md` — фази, наступні кроки (B1/B2/B3), stop-loss.
   Живий документ: оновлювати при закритті фази.
7. `docs/research/ПЛАН_ОПОРА...md` — доменні знання колишньої ОПОРИ (КМУ №692/1048,
   тарифи НКРЕКП); стане в нагоді, коли модулі ОПОРИ повернуться як конфгуровані застосунки.
8. `reference/opora-v1/` — **заморожений референс** попередньої реалізації.
   Читати можна; імпортувати чи розширювати — ні.

## Структура (pnpm workspaces + Turborepo)

### Пакети

| Пакет | Роль | Тести |
|---|---|---|
| `packages/dsl` | Zod-схеми DSL + `parseAppDefinition`. Вирази (`allow`, `if`) НЕ виконуються. Умови workflow: == != < <= > >= (числа). Фікстури: service-desk, inventory, hr-desk. | 29 |
| `packages/data-runtime` | DataPort-контракт: Memory + D1 адаптери; валідація записів; audit+outbox у мутаціях. SQL-білдери окремо від БД. Пошук _q (LIKE+escape), агрегації. | 22 |
| `packages/metadata` | Реєстр застосунків і релізів: draft/publish/rollback/getActive/getRelease/updateDraft + `diffAppDefinitions` (зміни і breaking-ризики). DSL-валідація через @opora/dsl. | 28 |
| `packages/workflow` | Матчинг workflow за подією, умови == != < <= > >= (порядок — лише числа; інакше false; неграматика → skipped), executor (webhook/assign; function-values skip). | 17 |

### Застосунки

| Застосунок | Роль | Deploy |
|---|---|---|
| `apps/api` | Hono runtime API: `/v1/apps` → releases/publish/rollback/diff → `/v1/apps/:slug/data/:entity` CRUD за PUBLISHED релізом. Auth: HMAC Bearer tokens. Record-level RBAC. Stats + connections endpoints. | Workers: https://opora-core-api.p4d-b2q.workers.dev (38 тестів) |
| `apps/runtime-web` | Vite React SPA: generated table/form CRUD UI from published schema + Builder mode (entity editor, release manager). | Pages: https://opora-runtime.pages.dev (9 тестів) |

### Заморожено

- `reference/opora-v1/` — стара ОПОРА v1. Читати можна; імпортувати чи розширювати — ні.

## Команди

```bash
# Монорепо (з кореня)
pnpm install                          # перший раз
pnpm lint                             # eslint flat config
pnpm typecheck                        # turbo run typecheck (всі пакети)
pnpm test                             # turbo run test (всі пакети)
pnpm --filter @opora/dsl test         # один пакет

# API deploy (з apps/api/)
npm run db:migrate:remote             # міграції D1 remote
npm run db:migrate:local              # міграції D1 local (Miniflare)
npx wrangler deploy                   # деплой worker

# Runtime-web build+deploy
VITE_API_BASE=https://opora-core-api.p4d-b2q.workers.dev npm run build
npx wrangler pages deploy dist --project-name opora-runtime --branch master
```

CI: `verify` (lint+typecheck+test) → `preflight` → `deploy` на master
(`.github/workflows/ci.yml`). Deploy: D1 міграції remote → worker → Pages.
Потрібні repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Ручний запуск: Actions → CI → Run workflow.

## Правила

### Межі пакетів (§7 блюпринта)

- `ui-renderer` не торкається БД — отримує лише view model/API.
- `dsl` не залежить від Next.js/PostgreSQL.
- `workflow` лише через контракти data-runtime.
- Кожна зміна даних у DataPort — audit event + outbox event в одній транзакції.
- Tenant boundary тестується автоматично для кожного endpoint'а.

### Конвенції коду

- Усі продуктові тексти українською; форматування чисел/дат uk-UA.
- Модуль→колір: AI teal `--ai`, Energy amber `--energy`, Finance green `--finance`.
- Дати — `new Date(x).toLocaleString('uk-UA')` інлайн (хелперів `formatDateUa` нема).
- Без коментарів у коді якщо не запитано.

### Gotchas

- `.env.production` в `apps/runtime-web/` містить публічний API URL — комічити (не секрет).
- `AUTH_SECRET` та `DRAIN_KEY` — Cloudflare secrets (`npx wrangler secret put`).
- Деякі мережі блокують `*.workers.dev`; фронтенд використовує same-origin Functions
  або CORS allow-list. Перевіряти що ALLOWED_ORIGINS включає домен фронтенду.
- CI сам деплоїть прод після push у master (потрібні repo secrets,
  див. Команди вище); вручну — Actions → CI → Run workflow.
- `owner_id` — КОЛОНКА records, не поле data: D1-фільтр іде через `owner_id = ?`,
  memory — через `r.ownerId`. Не шукати в `data`.
- `runs.list(tenantId, limit)` — runs завжди скоупляться тенантом (лік між тенантами був багом).
- Фронт ходить в API лише через `client.*` (абсолютний `API_BASE` + auth-заголовки).
  Відносний `fetch('/v1/...')` повертає HTML SPA — Builder так ламався.
- Візуальний редактор несе `workflows`/`policies` транзитом (`DefinitionDraft`);
  не викидати ці ключі, інакше publish зітре автоматизації.
- Дрейф спеки: `platform-spec.md` малює App всередині тенанта, реально `apps` глобальні
  (ізоляція — на рівні records/audit/runs). users/memberships таблиці є, логін видає owner.
- Неавторизовані читання ізольовані лише `X-Opora-Tenant`-заголовком (демо-трейдоф).
- CORS: кожен заголовок, який шле фронт (сьогодні `Authorization`), мусить бути
  в `Access-Control-Allow-Headers` api-middleware. Інакше браузер ріже запити
  з `NetworkError`, а preflight лишається зеленим — оманливо. Є регресійний тест.
- Webhook-доставка в проді — через `CONNECTIONS` env (JSON slug→URL, краще як
  wrangler secret). Без нього steps skip'аються (`connection_not_configured`);
  статус видно в Builder → Автоматизації (`GET /v1/connections` без URL).
- Пошук `_q`: D1 LIKE згортає регістр лише для ASCII (нема ICU) — кирилиця
  case-sensitive; memory-адаптер — insensitive. Повна уніфікація = ICU/
  нормалізована колонка, відкладено свідомо.
- Референційна цілісність DSL: видалення поля, на яке посилається сторінка
  (columns/fields/groupBy), валить чернетку 400. Поле прибирати разом із
  посиланнями — інакше publish/diff-тести впадуть не там де чекаєш.
- Перед publish дивитись `GET .../releases/:v/diff` (breaking-ризики);
  відкат — `POST .../releases/:v/rollback` (лише на published, історія не треться).
