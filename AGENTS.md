# AGENTS.md

## Що це за репозиторій

**Конфігурована B2B SaaS-платформа** (Builder/Runtime, metadata control plane) —
будується за блюпринтом після півота з вертикальної ОПОРИ (ADR 0001).

## Обов'язкові до прочитання

1. `docs/blueprint/saas-platform-blueprint.md` — **головна специфікація**: архітектура,
   DSL, модель метаданих, етапи. Не відступати без ADR.
2. `docs/specs/platform-spec.md` — **контракти платформи v0.1**: доменна модель,
   DataPort, tenancy/auth фази, API v1, backlog з критеріями приймання.
3. `docs/architecture/decision-records/` — ухвалені рішення (почитайте 0001 про півот).
4. `docs/research/ПЛАН_ОПОРА...md` — доменні знання колишньої ОПОРИ (КМУ №692/1048,
   тарифи НКРЕКП); стане в нагоді, коли модулі ОПОРИ повернуться як конфгуровані застосунки.
5. `reference/opora-v1/` — **заморожений референс** попередньої реалізації.
   Читати можна; імпортувати чи розширювати — ні.

## Структура (pnpm workspaces + Turborepo)

- `packages/dsl` — Zod-схеми DSL + `parseAppDefinition`. **Єдиний експорт:**
  `parseAppDefinition`, типи `AppDefinition*`, клас `AppDefinitionError`.
  Вирази (`allow`, `if`) тут НЕ виконуються і не парсяться.
- `packages/data-runtime` — DataPort-контракт (ADR 0001.2): Memory-адаптер (тести/
  офлайн) + D1-адаптер; валідація записів за EntityDefinition; audit+outbox у кожній
  мутації. SQL-білдери тестуються окремо від БД.
- `packages/metadata` — реєстр застосунків і релізів (draft/publish/getActive),
  DSL-валідація через @opora/dsl з MetadataError('invalid_definition', issues).
- `apps/api` — Hono runtime API: `/v1/apps` → releases/publish →
  `/v1/apps/:slug/data/:entity` CRUD лише за PUBLISHED релізом.
  Deploy: `cd apps/api && npx wrangler deploy` → https://opora-core-api.p4d-b2q.workers.dev
  (D1 opora-core-db; міграції `npm run db:migrate:remote|--local`).
- У черзі: `policy` (AST-evaluator), `ui-schema`, `ui-renderer`, `workflow`,
  `connector-sdk`, `apps/builder-web`, `apps/runtime-web`.

## Команди

- `pnpm install`
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (turbo пробігає всі пакети)
- точково: `pnpm --filter @opora/dsl test`

## Правила

- Межі пакетів за §7 блюпринта: `ui-renderer` не торкається БД;
  `dsl` не залежить від Next.js/PostgreSQL; `workflow` лише через контракти data-runtime.
- Кожна зміна даних у майбутньому runtime — з audit event; tenant boundary тестується.
- Задачі агентам ставити вузько (приклад — §11 блюпринта), з критеріями готовності:
  код + тести + контракт + оновлений fixture/DSL приклад.
- Усі продуктові тексти — українською; форматування чисел/дат uk-UA.
