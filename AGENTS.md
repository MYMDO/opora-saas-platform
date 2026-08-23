# AGENTS.md

## Що це за репозиторій

**Конфігурована B2B SaaS-платформа** (Builder/Runtime, metadata control plane) —
будується за блюпринтом після півота з вертикальної ОПОРИ (ADR 0001).

## Обов'язкові до прочитання

1. `docs/blueprint/saas-platform-blueprint.md` — **головна специфікація**: архітектура,
   DSL, модель метаданих, етапи. Не відступати без ADR.
2. `docs/architecture/decision-records/` — ухвалені рішення (почитайте 0001 про півот).
3. `docs/research/ПЛАН_ОПОРА...md` — доменні знання колишньої ОПОРИ (КМУ №692/1048,
   тарифи НКРЕКП); стане в нагоді, коли модулі ОПОРИ повернуться як конфгуровані застосунки.
4. `reference/opora-v1/` — **заморожений референс** попередньої реалізації.
   Читати можна; імпортувати чи розширювати — ні.

## Структура (pnpm workspaces + Turborepo)

- `packages/dsl` — Zod-схеми DSL + `parseAppDefinition`. **Єдиний експорт:**
  `parseAppDefinition`, типи `AppDefinition*`, клас `AppDefinitionError`.
  Вирази (`allow`, `if`) тут НЕ виконуються і не парсяться.
- Наступні пакети (у черзі): `metadata`, `data-runtime`, `policy`, `ui-renderer`,
  `workflow`, `apps/api`, `apps/builder-web`, `apps/runtime-web`.

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
