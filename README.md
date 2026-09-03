# ОПОРА · конфігурована B2B SaaS-платформа

[![CI](https://github.com/MYMDO/opora-saas-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/MYMDO/opora-saas-platform/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Cloudflare Workers](https://img.shields.io/badge/Workers-D1-orange)
![Cloudflare Pages](https://img.shields.io/badge/Pages-React_19-orange)
![pnpm + Turborepo](https://img.shields.io/badge/monorepo-pnpm%2Bturbo-yellow)

Мета-SaaS ядро: **користувач описує дані, процеси, інтерфейс і доступи — платформа генерує застосунок, API, автоматизації та інтеграції.** Універсальність — з метаданих і конфігурацій, а не з кастомного коду: Service Desk і Склад зібрані одним ядром без змін платформеного коду.

## Живе демо

| | |
|---|---|
| Runtime UI | https://opora-runtime.pages.dev |
| API | https://opora-core-api.p4d-b2q.workers.dev |

Спробувати за 1 хвилину:

1. Відкрийте Runtime UI → увійдіть з **будь-яким email** (пароль не потрібен на етапі MVP, токен живе 7 днів).
2. Розділи **Контакт / Заявка** — згенеровані таблиця + форма з опублікованої схеми: створення, пошук, фільтри, сортування кліком по колонці, пагінація.
3. **Builder** — сутності, релізи (draft → publish), автоматизації та їх виконання.
4. **Аудит** — хто, коли і що змінив, з попольним diff.

## Архітектура

```text
Конфігурація (DSL JSON, версіонована релізами)
  ├─ Модель даних (сутності, поля, звʼязки)
  ├─ Логіка (workflow: тригери, умови, дії)
  ├─ Інтерфейс (таблиці, форми, stats)
  └─ Доступи (ролі, власність записів)
                    ↓
            Runtime-платформа
  ├─ Metadata engine (реєстр застосунків і релізів)
  ├─ DataPort (Memory + D1; audit + outbox у кожній мутації)
  ├─ Workflow engine (матчинг, cron-дрен, idempotency, runs-журнал)
  ├─ UI renderer (React SPA генерує CRUD з published-схеми)
  └─ API + Auth (HMAC-токени, tenant isolation)
```

Монорепо `pnpm workspaces + Turborepo`, **125 тестів**, зелений CI з автодеплоєм.

| Пакет | Роль | Тести |
|---|---|---|
| `packages/dsl` | Zod-схеми DSL + `parseAppDefinition`. Умови workflow: `== != < <= > >=` (порядок — лише числа) | 27 |
| `packages/data-runtime` | DataPort-контракт: Memory + D1 адаптери, валідація, пошук `_q` (LIKE + escape), агрегації | 22 |
| `packages/metadata` | Реєстр застосунків і релізів: draft / publish / getActive / delete | 16 |
| `packages/workflow` | Матчинг за подією, executor (webhook / assign) | 17 |

| Застосунок | Роль | Прод |
|---|---|---|
| `apps/api` | Hono API: `/v1/apps` → релізи → `/v1/apps/:slug/data/:entity` CRUD за PUBLISHED релізом; RBAC; audit; stats; connections | Workers + D1 (34 тести) |
| `apps/runtime-web` | Vite + React 19 SPA: runtime CRUD + Builder + аудит + автоматизації | Pages (9 тестів) |

## Швидкий старт

```bash
pnpm install
pnpm test                  # усі пакети (turbo)
pnpm lint                  # eslint (ts + tsx)
pnpm typecheck             # turbo run typecheck
pnpm --filter @opora/dsl test   # один пакет
```

Локальна розробка:

```bash
# API з локальною D1 (з apps/api/)
npm run db:migrate:local
npx wrangler dev           # http://127.0.0.1:8787

# Фронт (з apps/runtime-web/) — /v1 проксюється на прод-API
npm run dev                # http://localhost:5174
```

## Ключові концепції

- **DSL + релізи.** Застосунок = JSON-визначення (сутності, сторінки, політики, workflow). Зміни йдуть чернетками; Runtime і API працюють лише з опублікованою версією. Візуальний редактор Builder несе `workflows`/`policies` транзитом — publish їх не тре.
- **DataPort.** Єдиний контракт доступу до даних. Кожна мутація пише audit event + outbox event. Власник запису — колонка `owner_id` (не поле `data`).
- **Workflow.** Тригер `сутність.подія` (`created`/`deleted`), умова `record.поле OP літерал`, дії webhook / assign. Щохвилинний cron-дрен, ідемпотентність за ключем, журнал виконань зі статусами `ok / skipped / error`.
- **Доступи.** Ролі `owner / admin / member`; записи — за власністю; runs/audit/connections — для привілейованих. Неавторизовані читання ізольовані `X-Opora-Tenant`-заголовком (демо-трейдоф).
- **Таблиці.** Пошук-підрядок (D1 LIKE чутливий до регістру кирилиці — в D1 нема ICU), фільтри з типовою коерсією, сортування, пагінація, stats-агрегації `count group by`.
- **Конектори.** Webhook-доставка через `CONNECTIONS` (JSON slug→URL, краще як wrangler secret). `GET /v1/connections` показує налаштованість без розкриття URL.

Мінімальний приклад визначення:

```json
{
  "app": { "slug": "inventory", "name": "Склад" },
  "entities": [
    { "apiName": "product", "label": "Товар", "fields": [
      { "name": "name", "type": "text", "required": true, "label": "Назва" },
      { "name": "qty", "type": "number", "label": "Кількість" }
    ]}
  ],
  "pages": [
    { "path": "/products", "label": "Товари", "entity": "product",
      "view": { "kind": "table", "columns": ["name", "qty"] } }
  ],
  "policies": [],
  "workflows": [
    { "on": "movement.created", "if": "record.qty >= 10",
      "steps": [{ "type": "webhook", "connection": "ops-hook", "event": "movement.large" }] }
  ]
}
```

Готові приклади: `packages/dsl/fixtures/service-desk.json`, `packages/dsl/fixtures/inventory.json`.

## API (стисло)

| Метод | Шлях | Доступ |
|---|---|---|
| POST | `/v1/auth/token` | відкритий (email → owner-токен, MVP) |
| GET/POST | `/v1/apps` | відкритий |
| DELETE | `/v1/apps/:slug` | admin / owner |
| GET/POST | `/v1/apps/:slug/releases` | відкритий |
| POST | `/v1/apps/:slug/releases/:v/publish` | відкритий |
| GET | `/v1/apps/:slug/schema` | відкритий |
| GET/POST/PATCH/DELETE | `/v1/apps/:slug/data/:entity[/:id]` | читання — всі; чужі записи — 404; `?_q=&_sort=&_limit=&_offset=` |
| GET | `/v1/apps/:slug/data/:entity/stats?groupBy=` | ті ж правила видимості |
| GET | `/v1/audit`, `/v1/workflow-runs`, `/v1/connections` | admin / owner |
| POST | `/v1/automation/drain` | `X-Drain-Key` |

## CI/CD

`verify` (lint + typecheck + test) → `preflight` → `deploy` на кожен push у `master`: міграції D1 remote → Worker → Pages. Ручний запуск: Actions → CI → Run workflow. Потрібні repo secrets: `CLOUDFLARE_API_TOKEN` (Workers + D1 + Pages), `CLOUDFLARE_ACCOUNT_ID`.

## Статус і дорожня карта

Працює: мультитенантність і ролі, конфігурована модель, автогенеровані CRUD UI + API, фільтри/пошук/сорт/stats, workflow з runs-журналом, аудит, автодеплой.

Далі: жива webhook-доставка (налаштувати `CONNECTIONS`), умови за датами, дашборди понад `count group by`, Extension SDK.

## Документація

- `docs/blueprint/saas-platform-blueprint.md` — головна специфікація (не відступати без ADR)
- `docs/specs/platform-spec.md` — контракти платформи v0.1
- `docs/architecture/decision-records/` — ADR (0001: півот на конфігуровану платформу)
- `AGENTS.md` — інструкції для агентів: команди, межі пакетів, gotchas
- `reference/opora-v1/` — заморожений референс попередньої вертикальної реалізації (тільки читання)
