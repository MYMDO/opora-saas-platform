# ОПОРА Core — Специфікація платформи v0.1

> Джерела: `docs/blueprint/saas-platform-blueprint.md` (архітектура), ADR 0001 (півот),
> рішення власника: повний pivot · гібридний порт даних · повний монорепо.
> Цей документ — контракт для агентних задач. Код без посилання на нього не приймається.

---

## 0. Формула продукту

> Користувач описує дані, процеси, інтерфейс і доступи; платформа генерує застосунок,
> API, автоматизації та інтеграції.

**Перший клас систем:** внутрішні операційні застосунки SMB (CRM-lite, service desk,
inventory, approval portal). Універсальність — з метаданих і плагінів, не з кастомного коду.
Модулі ОПОРИ v1 (Фінанси/Кадри/Енергія) повернуться як конфгуровані застосунки після MVP.

---

## 1. Доменна модель платформи

| Сутність | Призначення | Ключові атрибути | Сховище зараз |
|---|---|---|---|
| Tenant | Організація-замовник | id, slug, plan, created_at | D1 `tenants` |
| User | Людина в тенанті | id, tenant_id, email, display_name | D1 `users` |
| Membership | User↔Tenant + роль | tenant_id, user_id, role | D1 |
| App | Застосунок усередині тенанта | id, tenant_id, slug, active_release_id | D1 `apps` |
| AppRelease | Версовий зріз конфігурації | app_id, version(draft/published/archived), definition JSONB | D1 `app_releases` |
| EntityDefinition | Тип сутності у release | release_id, api_name, fields JSONB | D1 |
| Record | Екземпляр даних | tenant_id, app_id, entity_ref, data JSONB, owner_id, deleted_at | D1 `records` |
| AuditEvent | Невидаляємій слід змін | tenant_id, actor, action, before/after, request_id | D1 `audit_events` |
| Role / Policy | Доступи | роль→дозволи; ABAC-вирази пізніше | DSL policies + D1 |
| WorkflowDef / Run | Автоматизації | DSL workflow; run: status/steps/idempotency_key | Фаза workflows |
| WebhookEndpoint | Інтеграції | url, secret_ref, events[] | Фаза інтеграцій |

Правило: **платформа не знає про домен клієнта** — «контрагент», «заявка», «ліміт ПДВ»
існують лише як записи `EntityDefinition` + `Record`.

---

## 2. Модель даних: гібридний порт (рішення ADR 0001.2)

```ts
// packages/data-runtime/src/port.ts — ЄДИНИЙ спосіб доступу до даних
export interface DataPort {
  list(entity: string, q: QuerySpec): Promise<Page<Record>>;
  get(entity: string, id: string): Promise<Record | null>;
  create(entity: string, data: Json): Promise<Record>;   // + audit + outbox всередині
  update(entity: string, id: string, patch: Json): Promise<Record>;
  softDelete(entity: string, id: string): Promise<void>;
}
```

- **Adapter A (MVP):** D1. SQLite-діалект; JSONB → TEXT з JSON; індекси
  `json_extract(data,'$.field')` під гарячі фільтри; tenancy — обов'язковий
  `tenant_id` + фільтр у кожному запит шару (RLS у SQLite немає).
- **Adapter B (ціль):** PostgreSQL + RLS (`app.tenant_id` у транзакції).
  Перемикання — конфігом DI, без змін споживачів порту.
- **Заборонено:** прямі SQL-запити до БД поза `data-runtime`; доступ до чужого
  `tenant_id`; запис без audit/outbox.

Тест-межа орендаря: на кожен endpoint — тест «тенант А не бачить записів тенанта Б»
(блюпринт §10).

---

## 3. Tenancy та безпека

**Фази автентифікації:**

| Фаза | Механізм | Статус |
|---|---|---|
| A0 (MVP demo) | Заголовок `X-Opora-Tenant`, без паролів | ✅ реалізовано в референсі; переноситься в apps/api |
| A1 | Email + одноразовий код (OTP), сесії HttpOnly cookie | наступний крок |
| A2 | КЕП / BankID / SSO (SAML-ready) | після перших клієнтів |

**Авторизація:** RBAC v1 (ролі: owner / admin / member; у застосунку — ролі з DSL,
наприклад requester/agent). ABAC-вирази з `policies[].allow` виконує майбутній
пакет `policy`: безпечний AST-evaluator (allow-list функцій, без `eval`,
ліміт глибини/часу). До його появи невідомі вирази = deny + warning.

**Секрети:** тільки в env/bindings воркера; ніколи в DSL, логах, аудиті чи браузері.
**Аудит:** кожна мутація через DataPort пише AuditEvent в одній транзакції (outbox §6).
**Rate limiting:** базовий по IP+tenant на edge (Free-Tier сумісно, без KV-записів).

---

## 4. API-контракти v1 (REST, OpenAPI генеруємо зі схем пізніше)

```
POST /v1/auth/otp:request {email}            → {sent:true}
POST /v1/auth/otp:verify  {email, code}      → Set-Cookie сесія
GET  /v1/me                                  → {user, tenants[], role}
GET  /v1/apps                                → список застосунків тенанта
POST /v1/apps                                → створення (slug/name)
POST /v1/apps/:id/releases                   → draft
POST /v1/apps/:id/releases/:ver/publish      → атомарна публікація
GET  /v1/data/:entity?filter&sort&cursor     → Page<Record> (через DataPort)
POST /v1/data/:entity                        → create
GET|PATCH|DELETE /v1/data/:entity/:id
GET  /v1/audit?resource=&since=              → стрічка аудиту (admin)
```

Конвенції: camelCase JSON; помилка = `{error, issues?}`; пагінація cursor;
ідемпотентність POST через заголовок `Idempotency-Key` (зберігаємо 24 год).

---

## 5. DSL: стан і еволюція

- ✅ `packages/dsl@0.1`: entities/fields (8 типів)/pages/policies/workflows;
  `parseAppDefinition` + референційна цілісність; 25 тестів (23 негативні).
- Наступне: `computed` поля та формули — окремий пакет `packages/formula`
  (AST: літерали, оператори порівняння/арифметики, allow-list функцій;
  заборонено: `eval`, доступ до мережі/часу поза інʼєкцією, глибина >20).
- Версіонування DSL: поле `dslVersion` у корені визначення; міграції конфігурацій
  показують diff адміністратору до publish (§10 блюпринта).

---

## 6. Runtime pipeline (з блюпринта §6, адаптація під Cloudflare)

```
request → auth(A-фаза) → tenant ctx → published release (cache by release_id)
        → validate за EntityDefinition → authorize (RBAC; ABAC пізніше)
        → транзакція D1: record + audit_event + outbox_event
        → Cron-worker хвилинно забирає outbox → виконує workflows (idempotent)
```

Free-Tier дисципліна: нема Redis/Queues → outbox-таблиця + Cron Triggers.
Durable execution (retries/DLQ) — Cloudflare Workflows на paid-тарифі, коли
з'являться платні клієнти; інтерфейси runner проєктуємо сумісно.

---

## 7. Граф пакетів (монорепо)

```
dsl ← metadata ← data-runtime ← apps/api
policy(formula) ↗       ↓
                  ui-schema ← ui-renderer ← apps/{builder-web,runtime-web}
workflow ← connector-sdk
design-system (спільне) · test-fixtures (приклади CRM/helpdesk/ОПОРА-lite)
```

Жорсткі межі (§7 блюпринта): renderer без БД; dsl без Next.js/PG;
workflow лише через DataPort-контракти.

---

## 8. Backlog MVP → критерії приймання

| # | Крок | Пакет(и) | Критерій готовності |
|---|---|---|---|
| 1 | Auth A1 + orgs/roles + audit | apps/api, packages/metadata | OTP-вхід; tenant-boundary тести зелені; audit пишеться |
| 2 | Конфігурована модель даних | metadata, data-runtime | draft/publish release; records CRUD через DataPort; JSONB-індекси |
| 3 | Autogen CRUD API+UI | ui-renderer, ui-schema | Service Desk §8 кроки 1–3 без нового коду платформи |
| 4 | Views/permissions записів | ui-renderer, policy | requester бачить свої; agent — усі; field-level — після ABAC |
| 5 | Workflows + webhooks | workflow | outbox→run; retry+idempotency-key; run-log |
| 6 | Дашборди + конектори | connector-sdk | метрики-віджети; webhook out/in |
| 7 | Extension SDK | sdk | sandboxed функції з лімітами часу/мережі |

Definition of done MVP (§13 блюпринта): неінженер за 1 годину створює сутність,
поля, форму, таблицю, ролі, правила й webhook — публікує без deploy.

---

## 9. Нефункціональні вимоги

- p95 CRUD < 500 ms на цільовому обсязі; ліміти планів зафіксовані.
- Publish атомарний; runtime читає лише published.
- Кожен workflow step: timeout + retry policy + idempotency key.
- Tenant-boundary тести — обов'язкові до merge будь-якого endpoint'а.
- Structured logs + request_id; Sentry — при перших зовнішніх користувачах.

## 10. Відкриті питання

1. Custom domain для API (обхід блокування `*.workers.dev` уже вирішено same-origin Functions).
2. Обсяг безкоштовного плану: кількість apps/records/tenant — зафіксувати до білінгу.
3. Чи потрібен PG-adapter у MVP, або відкласти до першого enterprise-запиту.
