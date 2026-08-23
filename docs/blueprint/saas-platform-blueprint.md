# Blueprint: конфігурована SaaS-платформа

## 1. Продуктова рамка

**Мета:** дати організаціям змогу збирати внутрішні системи (CRM, service desk, inventory, approval portal, клієнтський кабінет) через конфігурацію даних, екранів, правил і інтеграцій.

**Не є метою MVP:** замінити всі існуючі продукти, дозволити довільний код без обмежень або конкурувати з ERP класу SAP з першої версії.

Платформа має два режими:

- **Builder** — адміністратор описує застосунок.
- **Runtime** — кінцеві користувачі працюють із згенерованим застосунком.

Ключовий принцип: конфігурація є продуктом. Вона версіонується, перевіряється, публікується та може бути відкочена.

## 2. Reference architecture

```text
                    Builder (React / Next.js)
  schemas · pages · workflows · roles · integrations · releases
                              │
                              ▼
                     Metadata Control Plane
               конфігурації, versions, publish, audit
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
    Runtime API          UI Renderer          Automation Engine
 CRUD + policies     pages/forms/views     events/workflows/jobs
         │                    │                    │
         └────────────────────┴──────────┬─────────┘
                                          ▼
                              PostgreSQL + RLS
                           tenant data + metadata
                                          │
                         Queue / Object Storage / Secrets
                                          │
                              Connectors & Webhooks
```

### Обов'язкові сервіси

| Компонент | Відповідальність | Для MVP |
|---|---|---|
| Identity & tenancy | організації, users, SSO-ready auth, tenant isolation | так |
| Metadata registry | схеми, сторінки, policies, versions, publish | так |
| Data runtime | CRUD, query validation, transactions, RLS | так |
| UI renderer | JSON-config -> responsive pages/forms/views | так |
| Policy engine | RBAC + record/field-level доступ | так |
| Workflow engine | trigger, condition, action, retry, idempotency | після CRUD |
| Integration hub | OAuth secrets, webhooks, connector adapters | після workflow |
| Extension sandbox | контрольований custom code / UI | після стабілізації ядра |

## 3. Технічні рішення першої версії

- **Monorepo:** pnpm workspaces + Turborepo.
- **Мова:** TypeScript end-to-end; schema validation через Zod або Valibot.
- **Frontend:** Next.js + React, компонентна бібліотека, React Hook Form.
- **API:** REST спочатку; OpenAPI генерується з metadata. GraphQL — лише за доведеної потреби.
- **БД:** PostgreSQL. Для універсального конструктора — JSONB metadata і дані сутностей у `records`, а не нові фізичні таблиці на кожну сутність у MVP.
- **Доступ до даних:** PostgreSQL Row-Level Security як остання лінія захисту; сервісний policy check як бізнес-рівень.
- **Черги:** BullMQ/Redis або managed queue; усі зовнішні виклики — асинхронні jobs.
- **Файли:** S3-compatible object storage, signed URLs.
- **Спостережуваність:** structured logs, traces, audit trail, Sentry/OTel.

Чому `records.data JSONB` на старті: це різко пришвидшує builder. Часто вживані поля індексуються через expression indexes або materialized search projection. Для enterprise-навантажень можна пізніше додати компіляцію стабільних сутностей у виділені таблиці — не змінюючи DSL.

## 4. Модель метаданих PostgreSQL

```sql
create table tenants (
  id uuid primary key,
  slug text unique not null,
  plan text not null,
  created_at timestamptz not null default now()
);

create table apps (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  active_release_id uuid,
  created_at timestamptz not null default now()
);

create table app_releases (
  id uuid primary key,
  app_id uuid not null references apps(id),
  version integer not null,
  status text not null check (status in ('draft','published','archived')),
  definition jsonb not null,
  published_by uuid,
  published_at timestamptz,
  unique (app_id, version)
);

create table entity_definitions (
  id uuid primary key,
  release_id uuid not null references app_releases(id),
  api_name text not null,
  label text not null,
  definition jsonb not null,
  unique (release_id, api_name)
);

create table records (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  app_id uuid not null references apps(id),
  entity_id uuid not null references entity_definitions(id),
  data jsonb not null default '{}',
  owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table audit_events (
  id uuid primary key,
  tenant_id uuid not null,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before jsonb,
  after jsonb,
  occurred_at timestamptz not null default now()
);
```

Встановлюйте `app.tenant_id` у транзакції для кожного запиту та вмикайте RLS на tenant-owned таблицях. Не покладайтесь на фільтр `WHERE tenant_id = ...` лише в коді API.

## 5. DSL: декларативна конфігурація

Не створюйте власну складну «мову програмування». Почніть з обмеженого JSON DSL, який валідується за JSON Schema/Zod і має чітку семантику.

```json
{
  "app": { "slug": "service-desk", "name": "Service Desk" },
  "entities": [
    {
      "apiName": "ticket",
      "label": "Заявка",
      "fields": [
        { "name": "title", "type": "text", "required": true, "maxLength": 200 },
        { "name": "status", "type": "select", "options": ["new", "in_progress", "done"], "default": "new" },
        { "name": "requester", "type": "relation", "target": "contact", "cardinality": "one" },
        { "name": "dueAt", "type": "datetime" }
      ]
    }
  ],
  "pages": [
    {
      "path": "/tickets",
      "type": "collection",
      "entity": "ticket",
      "view": { "kind": "table", "columns": ["title", "status", "dueAt"] }
    }
  ],
  "policies": [
    { "resource": "ticket", "action": "read", "allow": "role('agent') || record.ownerId == user.id" }
  ],
  "workflows": [
    {
      "on": "ticket.created",
      "if": "record.status == 'new'",
      "steps": [
        { "type": "assign", "field": "ownerId", "value": "firstAvailable('agent')" },
        { "type": "webhook", "connection": "slack", "event": "ticket.created" }
      ]
    }
  ]
}
```

Вирази (`allow`, `if`, formulas) не повинні виконувати JavaScript. Використайте безпечний AST expression language з allow-list функцій, типовою перевіркою, лімітом глибини та timeout.

## 6. Runtime pipeline

```text
HTTP request
  → identity + tenant context
  → load published metadata (cache with release id)
  → validate request against entity definition
  → authorize action + fields + record scope
  → transaction: write record + append audit + outbox event
  → worker consumes outbox → runs workflow idempotently
  → return typed API response
```

Outbox-патерн важливий: подія має записуватися в тій самій транзакції, що й зміна даних. Це не дозволить «загубити» workflow після успішного запису.

## 7. Монорепозиторій

```text
saas-builder/
  apps/
    builder-web/          # конструктор для адміністратора
    runtime-web/          # shell згенерованих застосунків
    api/                  # API / BFF
    worker/               # workflows, webhooks, imports
  packages/
    dsl/                  # Zod schemas, parser, migrations
    metadata/             # registry, release/publish service
    data-runtime/         # CRUD/query compiler
    policy/               # expression evaluator, authorization
    ui-schema/            # page/block contracts
    ui-renderer/          # React renderer
    workflow/             # compiler and executor
    connector-sdk/        # OAuth/webhook connector contracts
    design-system/        # shared UI components
    test-fixtures/        # sample apps: CRM, helpdesk
  infra/
    docker/
    terraform/
  docs/
```

Правило меж: `ui-renderer` ніколи не звертається до бази; він отримує лише view model/API. `dsl` не залежить від Next.js чи PostgreSQL. `workflow` не може напряму викликати приватні таблиці, лише контракти data-runtime.

## 8. Перший вертикальний зріз

Побудуйте один повний приклад — **Service Desk**:

1. Створити сутність `ticket` через Builder.
2. Опублікувати release.
3. Runtime автоматично показує таблицю заявок і форму створення.
4. Роль `requester` бачить лише власні заявки; `agent` — усі.
5. Зміна статусу створює audit event.
6. Створення заявки запускає webhook workflow.

Якщо ці шість кроків не потребують внесення нового платформного коду для нової сутності — фундамент працює.

## 9. Backlog за етапами

### Етап 0 — foundation (1–2 тижні)

- Monorepo, CI, Docker dev environment, migrations.
- Auth, tenant context, users/roles.
- Audit logging, error reporting, базове rate limiting.
- DSL schemas і приклад `service-desk.json`.

### Етап 1 — configurable CRUD (3–5 тижнів)

- Entity/field definitions та release draft/publish.
- Record CRUD, filters, sorting, pagination, JSONB indexes.
- Table + detail + form UI renderer.
- RBAC і owner-based record scope.
- Unit, integration та Playwright E2E для вертикального зрізу.

### Етап 2 — operational apps (3–4 тижні)

- Relations, attachment fields, saved views, kanban/calendar.
- Computed fields і безпечний expression evaluator.
- Import/export CSV.
- Field-level policies, history UI, soft delete.

### Етап 3 — automation (3–5 тижнів)

- Transactional outbox, queue worker, retries, dead-letter queue.
- Event/webhook/cron triggers.
- Actions: update record, create record, email, webhook, approval.
- Run log, replay, idempotency key.

### Етап 4 — extensibility & commercial readiness

- OAuth connector framework, secrets encryption/rotation.
- Custom components and functions in sandbox.
- Usage metering, billing, tenant limits.
- SSO/SAML, data export, retention policies, backup/restore drills.

## 10. Нефункціональні вимоги, які не можна відкласти

- Tenant boundary тестується автоматично для кожного API endpoint.
- Кожна зміна даних має audit event із actor, before/after та request id.
- Publish є атомарним; runtime працює лише з published release.
- Кожен workflow step має timeout, retry policy та idempotency key.
- Secrets ніколи не потрапляють у DSL, логи, audit snapshots або browser.
- Конфігураційні міграції працюють до publish і показують diff/ризики адміністратору.
- Швидкодія: p95 CRUD < 500 мс для базових views на цільовому обсязі; межі обсягу зафіксовані для кожного плану.

## 11. Як організувати агентне кодування

Ведіть `docs/architecture/decision-records` і `docs/contracts`. Агентам не слід давати розмиті задачі на кшталт «зроби low-code SaaS».

Приклад коректної задачі:

> Реалізуй package `dsl`: Zod schema для entity definitions, parser, 15 негативних тестів і JSON fixture Service Desk. Заборонено додавати runtime-виконання виразів. API має експортувати лише `parseAppDefinition`, `AppDefinition` і typed error.

Для кожного pull request/ітерації запускайте чотири ролі:

1. **Implementer** — робить вузьку функцію за контрактом.
2. **Reviewer** — шукає порушення ізоляції tenant, неузгоджені контракти, race conditions.
3. **Security reviewer** — перевіряє authz, secrets, injection у DSL/queries/webhooks.
4. **Test agent** — додає межові та E2E сценарії, не переписуючи production-код без потреби.

Критерій готовності кожної задачі: код, тести, міграція/rollback якщо потрібні, telemetry, API contract і оновлений приклад DSL.

## 12. Перші рішення, які треба зафіксувати

1. Цільовий сегмент першого релізу: внутрішні операційні застосунки для SMB/scale-up.
2. Дані MVP: shared PostgreSQL + RLS, а не окрема база на tenant.
3. Конфігурація: JSON DSL + Builder UI; не генерація вихідного коду застосунку.
4. Розширення: тільки після workflows; sandboxed, permissioned і платні за usage.
5. Перша демо-система: Service Desk, після неї CRM і approval portal — як compatibility suite.

## 13. Definition of done MVP

MVP готовий, коли неінженер може за одну годину створити нову сутність, поля, форму, табличний view, ролі, правила доступу та один webhook workflow — опублікувати це без deploy і без втручання розробника.
