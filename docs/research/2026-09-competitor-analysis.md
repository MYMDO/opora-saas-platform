# Конкурентний аналіз конфігурованої B2B SaaS-платформи (ОПОРА Platform) — вересень 2026

> Статус: факт-чек зріз на 03.09.2026. Ціни і ліміти — з офіційних pricing-сторінок, можуть змінюватись щокварталу.
> Легенда достовірності: ✅ підтверджено ≥2 джерелами · ⚠️ одне джерело / вторинне · ❌ суперечність (вірити першоджерелу).
> Джерела — у §8 і в картках. Мова звіту — українська.

## 1. Executive summary — 5 висновків за Парето

Наш профіль: `Builder → Metadata Control Plane (draft/publish/rollback, audit) → Runtime API + UI Renderer + Automation Engine → DataPort (CRUD, tenant isolation, outbox)`. Ціль — внутрішні операційні застосунки МСБ за 1 годину без коду і без deploy.

Болі з `docs/research/Проблеми українців та бізнесу.md` та `Аналіз проблем для єдиної платформи.md`, за якими оцінювали Pareto-покриття (Y):

- **Кадри (69% компаній — головний бар'єр, −40% працездатних, 96% підняли зарплати):** потрібні ШІ-агенти, автоматизація рекрутингу/онбордингу, CRM.
- **Енергетика (82% страждають від атак на енергосистему, 689,5 МВт BESS у травні 2026, peak shaving):** потрібен EMS/IoT-шар як конфігурований застосунок.
- **Податки/регуляторика (478 людино-днів на облік, блокування ПН, КМУ №692 бронювання / №1048 ПН-ліміти 1 млн / 100 тис. / 90 днів):** потрібні guardrails-автоматизації і моніторинг лімітів.
- **Franken-stack:** 3–4 окремі SaaS = data silos + 3× підписки + lock-in. Рішення — єдина модульна платформа, Tiered Isolation, ISO 27001 один раз.
- **Seat compression 2026:** per-seat вмирає через ШІ-агентів → гібридне ціноутворення (platform fee + outcome/usage), NRR >110% як головна метрика.

**Топ-5 висновків:**

1. **Найближчі архітектурно (X=5): Directus, Creatio, Power Apps.** З них лише Directus доступний МСБ за TCO, але з BSL/MSCL-ліцензією і breaking-змінами. Creatio/Power Apps — еталони Freedom UI / Dataverse + BPM, але вхід $10k/3 роки і $22/user вбивають МСБ.
2. **Найкраще Pareto/TCO для укр. МСБ (Y=4): Odoo Studio, Retool (функціонально), Directus.** Odoo — єдиний з готовими HR/облік-модулями + One App Free. Retool закриває все, але per-seat вибухає на 100+ viewers.
3. **Жоден з 14 не дає з коробки:** draft/publish/rollback + audit+outbox в одній транзакції + record-level RBAC на self-host без Enterprise-податку + укр. податкові guardrails (ПН-ліміти, КМУ 692/1048) + КЕП/Дія.Підпис. Це наша ніша.
4. **Ліцензійний тренд 2025–2026 — втеча від OSI:** NocoDB AGPL→SUL (01.2026), Directus BSL→MSCL (v12, 05.2026), n8n SUL, Baserow open-core (MIT core + proprietary premium/enterprise), Windmill AGPL-ядро + proprietary CE-бінарник. Для нас: чистий MIT/Apache core + прозорий EE-гейт, інакше недовіра спільноти.
5. **Pareto-backlog (що будувати першим, §7):** approval workflows з Wait + Error Workflow→DLQ-таблиця (як у n8n), ПН-монітор (ліміти 1 млн/100 тис., CDC-тригер як у Windmill), HR Desk-шаблон (Service Desk→рекрутинг/онбординг), EMS-конектор-шаблон (REST + time-series фасад), укр. пакет дня 1 (НП/телефонія/Checkbox/Вчасно/Дія.Підпис), гібридна ціна (platform fee + outcome за resolution/лід).

## 2. Методологія і шкали

**Вісь X — архітектурна схожість (1–5):** metadata-driven, draft/publish/rollback + diff, generic records+JSON vs table-per-entity, tenant isolation (shared+RLS vs DB-per-tenant), audit/outbox в транзакції, policy engine без eval, UI-рендерер (table/kanban/calendar/form), connector SDK + secrets поза DSL.

**Вісь Y — Pareto-покриття болей укр. МСБ (1–5):** HR-автоматизація, approval/bureaucracy (бронювання, ПН), фінанси/комплаєнс, EMS/IoT-розширюваність, TCO + укр. локалізація/КЕП.

**Правила факт-чеку:** першоджерела (docs/pricing/GitHub LICENSE/releases) > changelog/status > G2/Capterra > огляди. Маркетингові лендінги не джерело для архітектури. Кожна ціна/ліцензія — з URL і датою. Суперечності позначені ❌ з вказівкою чому вірити.

## 3. Short-list 14 (сортовано за X, потім Y) + long-list

| # | Платформа | Tier | X / Y | Ціна-вхід 2026 | Ліцензія | G2 | Вердикт одним реченням |
|---|---|---|---|---|---|---|---|
| 1 | Directus | S | 5 / 4 | $0 → Team $499/міс | BSL→MSCL, convert GPLv3 за 4р, SDK MIT | 4.9/5 (52) | Еталон метаданих і версіонування — копіювати collections+draft/publish+revisions, уникати breaking-змін і phone-home ключів |
| 2 | Creatio | B | 5 / 3 | $40/$75/user, мін $10k/рік, 3 роки | Proprietary | 4.7/5 (269) | Еталон Freedom UI+BPM+AI Studio — копіювати студійну зв'язку, уникати enterprise-ваги |
| 3 | Power Apps (+Mendix) | B | 5 / 3 | $5/app, $22/user, PAYG $10 | Proprietary | 4.2/5 (250) | Еталон Dataverse+Power Fx+Environments — копіювати, уникати per-user лабіринту і closed-cloud |
| 4 | Budibase | S | 4 / 3 | $0 self-host → Pro $19, Premium $49, Business $299 | GPLv3 + MPL-2.0 client + BSL pro | 4.5/5 (67) | Копіювати partition per app + actions-білінг, уникати audit-тільки-Enterprise |
| 5 | Odoo Studio | B | 4 / 4 | One App $0 → $24.90/$37.40/user | LGPLv3 / EE proprietary | 4.2/4.3, Studio 3.8 (13) | Копіювати Studio поверх живого ERP + One App Free, уникати LGPL/EE-розколу і upgrade-болю |
| 6 | Retool | S | 3 / 4 | $0 (5 users) → Team $10+$5, Business $50+$15 | Proprietary | 4.6/5 (361) | Копіювати Releases+History+Git і nsjail-пісочницю, уникати per-seat на viewers |
| 7 | Appsmith | S | 3 / 3 | $0 (5 users) → Business $15/user | Apache-2.0 | 4.6/5 (67) | Копіювати Git без секретів, уникати клієнтського JS без пісочниці |
| 8 | Supabase | A | 3 / 2 | $0 → Pro від $25 → Team від $599 | Apache-2.0 | 4.6/5 (218) | Копіювати PostgREST+RLS+міграції-як-код, уникати usage-лабіринту і обриву $25→$599 |
| 9 | NocoDB | S | 2 / 3 | Self-host $0 ∞ → Cloud Plus ~$12, Business ~$24, Scale ~$45 | SUL v1.0 Fair-Code (ex-AGPL з 09.01.2026) | мала вибірка | Копіювати BYO-DB+auto-API, уникати зняття audit з OSS і SUL-пастки |
| 10 | Baserow | S | 2 / 3 | $0 (3k rows) → Premium $10, Advanced $18 | MIT core + proprietary premium/enterprise | 4.6/4.7 (мала) | Копіювати row history + CSV audit-імпорт, уникати ховати RBAC/audit за Advanced |
| 11 | Hasura | A | 2 / 1 | Free → DDN $5/$30/active-model | Apache-2.0 engine / DDN commercial | 4.7/5 (n=26) | Копіювати permissions-YAML+allow-lists, уникати GraphQL-only і billing за моделями |
| 12 | Appwrite (+PocketBase MIT) | A | 2(3) / 2 | $0 → Pro від $25/проєкт | BSD-3-Clause / PB MIT | 4.4/5 (n=5) | Копіювати простоту permissions+SDK, уникати document-only без SQL; PB — ідеал DataPort-прототипу |
| 13 | n8n | C | 2 / 4* | Self-host $0 → Cloud €20/€50, Business €667 | SUL (Fair-Code, не OSI) | — | *Y=4 як automation-двигун: копіювати pay-per-run + Error Workflow→DLQ + Wait-approval, уникати polling-пастки |
| 14 | Windmill | C | 2 / 3* | Self-host $0 → EE від ~$120/міс (seat+compute) | AGPLv3 ядро + proprietary CE-бінарник | — | *Y=3: копіювати Postgres-чергу + CDC-тригер + worker tags, не embed-ити без EE-угоди, не давати не-технарям без обгортки |

*Y для automation — як доповнення до ядра, не як заміна платформи.*

**Long-list (оглядово, не deep-dive):** ToolJet, Refine, Superblocks, DronaHQ, UI Bakery, Xata, Strapi, Glide, Softr, Bubble, WeWeb+Xano, OutSystems, Appian, ServiceNow App Engine, Salesforce Lightning, Temporal, Inngest, Trigger.dev. Причина відсіву: нижча X-схожість або дублювання Tier-представника.

## 4. Картки deep-dive (стисло)

### 4.1 Budibase — X4/Y3
Архітектура ✅: Svelte JSON-definition (`github.com/Budibase/budibase`, `docs.budibase.com/docs/budibase-architecture`); BudibaseDB=CouchDB partitioned per app + Redis + MinIO + Koa server+worker; зовнішні PG/MySQL/Mongo/REST/Sheets (`budibase.com/product/data/`). Версіонування ⚠️: backups/restore + publish, draft/publish-релізів як у нас нема. Tenant: partition per app + workspaces (1 Pro / 10 Premium / ∞ Business). Audit: Enterprise 365 днів, нижче — automation logs 7/30 днів (`docs.budibase.com/docs/audit-logs`). Automations: CRUD/email/webhook/Slack/JS/AI.
DSL: декларативний JSON+bindings, table/kanban/calendar/form/grid, AI-скафолд, custom plugins. Доступи: table/view RBAC + row-level, SSO OIDC/Google/Microsoft Premium, enforced SSO+groups Business, AD/SCIM Enterprise; self-host Docker/K8s + Cloud.
Ціни ✅ (`budibase.com/pricing/`): Free Self-host $0 ∞ apps/automations (⚠️ до 20 users), Cloud Free 5 users ~200 runs; Pro $19 annual ($23 monthly, 1 creator + 5k actions + 2k AI), Premium $49 annual ($59, ~10k runs + SSO), Business $299 annual ($359, 250k actions + 3 creators), add-on $50/creator + $5–6/end-user.
Ліцензія ✅: GPLv3 + MPL-2.0 client/components + BSL `packages/pro` (convert GPLv3 за 4 роки) (`github.com/Budibase/budibase/blob/master/LICENSE`).
G2 ✅ 4.5/5 (67–68). Скарги: per-creator ріст рахунку; mobile + крива для non-dev.
Pareto: HR/approval — сильно; фінанси — прості трекери; EMS — лише REST; TCO низький до 20 юзерів.

### 4.2 Retool — X3/Y4
Архітектура ✅: НЕ generic records — зовнішні БД/API + Retool DB (Postgres); таблиці `audit_trail_events, page_saves, resources, users` (`docs.retool.com/self-hosted/.../architecture`). Версії: Releases draft/publish + History rollback + Git sync Enterprise + dev/staging/prod. Tenant: Organizations+Spaces. Audit 1 рік (3 міс UI + CSV) + Datadog/Splunk Enterprise. Workflows на Temporal + nsjail-sandbox (JS/Python).
DSL: JSON app-definition + JS/Python, 80+ компонентів, custom React, AI AppGen. Доступи: granular RBAC + row-level, SSO SAML/OIDC + SCIM Enterprise. Self-host ТІЛЬКИ Enterprise (Free/Team/Business — `Plan not available on Self-host`) (`retool.com/pricing`).
Ціни ✅: Free $0 (5 users, 500 runs, 5GB DB+5GB files, 250 AI); Team $10/builder+$5/internal annual; Business $50+$15 annual; +$75/5k runs, +$100/1k AI; External 50 free далі $8/$6/$4.
Ліцензія ✅ proprietary. G2 ✅ 4.6/5 (361), Capterra 4.5/5 (34). Скарги: per-seat вибух на 100+; гальма великих apps.
Pareto: HR/approval/фінанси — відмінно; EMS — добре але дорого на viewers; TCO — найгірший при масштабі.

### 4.3 Appsmith — X3/Y3
Зовнішні datasources (25+), секрети НЕ в Git; Git branches dev/staging/prod + deploy/publish (`docs.appsmith.com/advanced-concepts/version-control-with-git`); workspaces Free 5 / Business ∞; audit Business + JSON-export; Workflows+packages Business+. Drag-drop + клієнтський JS (без DOM, prepared statements, Iframe sandbox з 1.8.6); views table/form/chart/list (kanban/calendar — ні). RBAC: 3 ролі Free, custom+groups Business, SAML/OIDC Business, SCIM/air-gapped Enterprise.
Ціни ✅ (`appsmith.com/pricing`): Free $0 (5 users, 5 workspaces, 3 repos); Business $15/user/міс до 99; Enterprise від $2.5k/міс за 100. ❌ агрегатори пишуть $40 — вірити офіц. $15.
Ліцензія ✅ Apache-2.0. G2 ✅ 4.6/5 (67). Скарги: JS обов'язковий; mobile + великі датасети.
Pareto: admin-панелі+workflows — добре; проводок/outbox — нема; EMS — viewer; TCO відмінний на self-host.

### 4.4 NocoDB — X2/Y3
UI-шар над своєю MySQL/PG/SQLite, метадані окремо NC_DB (`product-feed.nocodb.com/.../architecture`); table-per-entity + auto REST/GraphQL; webhooks v3 per-table; audit v2 ТІЛЬКИ Scale+/licensed self-host, v1 видалено з OSS в 0.258.10 (`github.com/nocodb/nocodb/issues/10101`); snapshots, draft/publish нема. Spreadsheet views grid/kanban/gallery/calendar/form; формули мілкі; ⚠️ гальма >~100k rows. RLS row-level Scale+, SAML/OIDC Business+, SCIM Enterprise.
Ціни: Self-host Community $0 ∞ (`nocodb.com/pricing`); ❌ free-cloud суперечність (1k records vs 50k rows — звіряти з офіц. перед покупкою); ⚠️ Cloud Plus ~$12 / Business ~$24 / Scale ~$45 (secondary збігаються).
Ліцензія ✅: SUL v1.0 Fair-Code з 09.01.2026 (ex-AGPL), internal free, хостинг як сервіс — commercial (`nocodb.com/docs/self-hosting/license`).
Pareto: довідники/табелі — відмінно; approval — лише +n8n; проводок — ні; EMS — SQL-фасад; TCO найкращий на self-host.

### 4.5 Baserow — X2/Y3
Django+Vue+PG+Redis, table-per-entity; snapshots/trash/row history 14д Free / 90 Premium; Application + Automation Builder (if-this-then-that + JS `Execute code` 2.3) + Dashboard; audit Advanced/Enterprise 360 днів. Формули+JS, Grid/Gallery/Form/Kanban/Calendar/Timeline, AI Premium. RBAC workspace/db/table Advanced+, field-level, SSO SAML/OAuth без SSO-tax. Self-host unlimited rows/API.
Ціни ✅ (`baserow.io/pricing`, `.../pricing-plans`): Free $0 (3k rows/workspace, 2GB); Premium $10 annual ($12 monthly, 50k/20GB); Advanced $18 annual ($22, 250k/100GB + RBAC/audit); Enterprise custom.
Ліцензія ✅ open-core: MIT core + proprietary premium/enterprise. G2 ✅ 4.6/5 (4), Capterra 4.7/5 (69). Скарги: менше інтеграцій за Airtable; гальма великих + paywall.
Pareto: реєстри/інвентар — відмінно; approval — середньо; EMS — GDPR NL + API; TCO найпрогнозованіший.

### 4.6 Directus — X5/Y4 (еталон)
Metadata над існуючим SQL: collections=таблиці + `directus_*` (flows/permissions/revisions), чисте видалення без lock-in; Content Versioning draft/publish + Revisions + Activity (user/IP/UA); Flows webhook/schedule/manual + Run Script Node.js + logs; outbox-транзакції нема (Flows/webhooks). Collections/fields/relations + Insights + extensions, SDK MIT. RBAC найгранулярніший (collection/field/item `$CURRENT_USER`), Policies, 2FA, SCIM enterprise-гейт. SSO SAML/OIDC Team+, self-host на будь-якому тарифі + Cloud add-on.
Ціни ✅ (`directus.com/pricing`, snapshot 02.09.2026): Core $0 (3 seats/25 collections/5 Flows); Team $499 annual ($599 monthly, 10 SSO seats/50 coll/20 Flows); Enterprise custom; Cloud add-on $99/міс; Grant free <$5M + <50 emp. ❌ старі Starter $15 / $99 / $299 — застарілі, вірити v12.
Ліцензія ✅: BSL 1.1 → MSCL з v12 (05.2026), convert GPLv3 за 4 роки, SDK MIT (`directus.com/resources/directus-v12-license-change`).
G2 ✅ 4.9/5 (52) — найвищий. Скарги: breaking між мінорами; self-host DevOps + тонкі docs.
Pareto: approval/фінанси/EMS — найкраще з Tier S; TCO $50–140 self-host vs $499 Team — межа МСБ.

### 4.7 Supabase — X3/Y2
Postgres+PostgREST+Realtime+Auth+Storage+Edge Functions Deno (60с, 2с CPU). Tenancy через RLS (`tenant_id=auth.jwt()`), графи >4 ролей — гальма/німі zero-rows. Audit/outbox — тригерами/pgAudit самотужки. BPM — нема (webhooks/cron/pg_net). DSL/UI — нема (SQL-міграції + Table Editor). RLS row ✅, field — views; Dashboard SSO Team $599, per-tenant SAML — кодом, SCIM — нема.
Ціни (`supabase.com/pricing`): Free $0 (2 проєкти, 50k MAU, 500MB DB, пауза 7д); Pro від $25/орг + $10 compute (100k MAU, 8GB, 250GB egress, $0.09/GB overage); Team від $599 (SOC2/SSO/14д бекапи); Enterprise ~$15k/рік (огляди).
Ліцензія ✅ Apache-2.0 (108k★). Рейтинг ~4.6/5 (218). Скарги: рахунки $25→$100–300 (egress/transforms), RLS-гальма 8с+ на млн, прірва $25→$599, 691 outage/3р.
Pareto: HR/податки/EMS — робити з нуля; TCO старт $25, prod $2.5–4k; КЕП — ні.

### 4.8 Hasura — X2/Y1
Engine/DDN GraphQL→SQL над PG/Mongo/MSSQL/MySQL/ClickHouse. Tenancy — role permissions (x-hasura-role), не boundary. Outbox — Event Triggers CDC-вебхуки. BPM — нема. ✅ Metadata-as-code YAML + Migrations + Allow-lists — найближче до Control Plane. UI — нема. SSO — Enterprise.
Ціни (два прайси!): Legacy v2 Free (3 проєкти, 3M req); Pro pay-as-you-go $1.50/active-hr (PG) / $3.00 (інші) + $0.13/GB; DDN Free unlimited req; Base $5/active-model, Advanced $30/active-model (>1000 хітів/міс); Private ~$1000/AZ/міс. 50 моделей Advanced = $1.5k/міс без трафіку.
Ліцензія: engine Apache-2.0, DDN commercial. G2 4.7/5 (n=26) ⚠️ мала вибірка. Скарги: подвійний прайсинг + model-billing; нема UI/BPM.

### 4.9 Appwrite (+PocketBase) — X2(3)/Y2
Document-БД поверх MariaDB (прямого SQL нема), Auth/Storage/Functions/Messaging/Realtime event-WebSocket. Tenancy Teams+collection permissions, RLS нема. Logs 1г Free/7д Pro, outbox нема, BPM нема. 14 рантаймів (ширше за Deno), 0.5CPU/512MB→4CPU/4GB. Document/collection permissions прості; SSO Pro+. Self-host ~4GB RAM.
Ціни (`appwrite.io/pricing`, зміна 01.09.2025 $15→$25): Free $0 (2 shared проєкти, 5GB bw, 750k exec); Pro від $25/проєкт dedicated (2TB bw +$15/100GB, 150GB +$2.8/100GB, 3.5M exec, 1000 GB-hr +$0.06). PocketBase ✅ MIT, 1 Go-бінар+SQLite, $0 self-host, cloud нема — ідеал DataPort-прототипу, не prod-critical до v1.
Ліцензія ✅ BSD-3-Clause (46k★). Рейтинг 4.4/5 (n=5) ⚠️. Скарги: нема SQL/join; self-host важчий за PB.

### 4.10 Creatio — X5/Y3
No-code Freedom UI + BPM + AI Studio + об'єктний шар; tenancy/audit/BPMN з коробки; visual designers + draft/publish; C#/.NET sandbox; RBAC+record/field, SSO/SAML Enterprise; Cloud/On-prem.
Ціни (`creatio.com/products/pricing`, 08/2026): trial 14д; Growth $40/user, Enterprise $75/user, Unlimited custom; ⚠️ мін $10k/рік, контракт 3 роки; AI Studio обов'язковий з 01.05.2026. 10 юзерів: $4.8k/$9k рік.
Ліцензія ❌ proprietary. G2 ✅ 4.7/5 (269+437+149) — найвищий в LCAP. Скарги: крива + доки для глибокого кастому; ціна/коміт + мало інтеграцій.
Pareto: HR ✅ готовий HCM; податки ⚠️ допил ПН/КМУ; EMS ⚠️ як кейс; TCO ❌; укр. ✅ локалізація+вендор.

### 4.11 Odoo Studio — X4/Y4
Python/PG моноліт-модулі; Studio no-code поверх живого ERP; multi-company Custom; record rules; chatter/audit; queued jobs/webhooks; Automated Actions + Studio automations (простіше за BPMN). Studio-XML + drag-drop; views/kanban/calendar; Python/JS + Server Actions. RBAC/record/field groups; SSO через OAuth/LDAP/IAP. Cloud/On-prem.
Ціни (`odoo.com/pricing`): One App Free $0 unlimited users; Standard ~$24.90/user annual; Custom ~$37.40/user annual (Studio+multi-company+API); 10 юзерів Custom ≈$4.5k/рік; Community $0.
Ліцензія: Community LGPLv3 ✅ / Enterprise proprietary ❌. Odoo 4.2/4.3 (1309/1254), Studio 3.8/5 (13) ⚠️. Скарги: Studio — MVP, складне — кодом; апгрейди; підтримка/перф на кастомі.
Pareto: HR/бухгалтерія ✅ з коробки; податки ⚠️ укр. партнери; EMS ⚠️ IoT/Field Service; TCO ✅ найкращий в LCAP; укр. ⚠️ частково; КЕП ⚠️ модулями.

### 4.12 Power Apps (+Mendix) — X5/Y3
Dataverse (дані+логіка+безпека) + Canvas/Model-driven + Power Automate + 1000+ конекторів; Environments + Business Units; auditing; plug-ins/Service Bus. Solution/Power Fx (Excel-DSL, не відкритий YAML); canvas+model-driven+Pages; PCF/Azure Functions. RBAC+record/field/column + Entra SSO/MFA/DLP. Self-host ❌ (лише Gateway).
Ціни (`microsoft.com/.../power-apps/pricing`, Guide 03/2026): Developer Free non-prod; Premium $22/user annual ($14 при 2000+; ERP $20); Per App $5/user/app; PAYG $10/active/app (Azure); 20 юзерів Premium $440/міс + Dataverse overage. Mendix старт ~€52.50/міс + Enterprise custom — дорожче МСБ.
Ліцензія ❌ proprietary. Power Apps 4.2/5 (250) / 4.6/5 (43); Mendix 4.4/5 (27). Скарги: ліцензійний лабіринт + Dataverse overage; lock-in + delegation-limits + ALM.
Pareto: HR/податки — кастом на Dataverse; IoT-конектор є; TCO ❌; укр. ✅ M365; КЕП ⚠️ Key Vault/партнери.

### 4.13 n8n — automation, Y4*
Queue/worker (`N8N_EXECUTIONS_MODE=queue` + Redis Bull + `n8n worker --concurrency`), concurrency Starter 5 / Pro 20 / Enterprise 200+, EU Frankfurt. Retry per-node + On Error + Error Workflow як DLQ-приймач (нативного DLQ нема → патерн Error→PG `pending/replayed/resolved` + replay-тригер) (`docs.n8n.io/hosting/scaling/queue-mode`, `.../error-handling`). Idempotency — dedupe-таблиця. Run-log retention 7д/2.5k (Starter) / 30д/25k (Pro) / unlimited/50k (Ent). Тригери: schedule/cron, webhook (test vs production пастка), app-events, Manual, Error, Chat/Form, Wait (approval/callback). 400+ нод (500+ каталог + AI Agents/MCP/LangChain, human-in-loop 01.2026) + HTTP + Code JS/Python + cURL-import.
Self-host Community free unlimited (VPS €4–12 + Postgres з дня 1, не SQLite); Cloud Starter/Pro hosted; Business self-hosted з ключем.
Ціни ✅ (`n8n.io/pricing`, annual −17%): Starter €20 (€24 monthly, 2.5k exec); Pro €50 (€60, 10k); Business €667 (€800, ~40k, оверідж €4k/300k); Enterprise custom. 1 execution = 1 run незалежно від степів. Trial 1k Pro без картки.
Ліцензія ⚠️ SUL Fair-Code (не OSI) + LICENSE_EE для `*.ee.*` (заборонено хостити як платний сервіс без угоди).
Скарги: polling-крон 5 хв ≈8.6–8.9k exec/міс з'їдає Starter; подорожчання late-2025; втрата ENCRYPTION_KEY = втрата credentials.
Pareto: брати pay-per-run + Error→DLQ + Wait-approval; для ПН — webhook/cadence з backoff, не кожні 5 хв.

### 4.14 Windmill — automation, Y3*
Rust server stateless + PG як єдина черга (`queue`→`completed_job`, `SELECT ... FOR UPDATE SKIP LOCKED`, 1 job/worker, worker groups/tags GPU/heavy); warm 50–200мс, cold 2–10с, native <50мс. Retry constant/exponential per-step; error handlers/schedule EE; retention CE ≤30д → EE unlimited; observability EE. Idempotency/DLQ — error-handler + своя таблиця. Тригери: багато на один runnable — schedule, webhooks sync/async + HTTP routes + preprocessors, Kafka/NATS/SQS/MQTT/Pub-Sub/Event Grid (частина EE), Postgres CDC (без polling — ідеально для ПН-моніторингу), Email/WebSocket/Native/MCP/CLI/API/auto-UI. Скрипти Python/TS/Go/Bash/SQL/PHP/Rust + Flows DAG (branching/loops/retries/approval) + App builder.
Self-host CE free (Compose/Helm, PG 14+); paid seat+compute: Enterprise від ~$120/міс (dev $20 + operator $10 + compute $50/worker 2GB). SOC2, SSO/SAML/SCIM, audit — EE.
Ліцензія: ядро без enterprise-флага — AGPLv3 ✅, клієнти + OpenFlow — Apache-2.0; ⚠️ CE docker-бінарник містить proprietary EE-gated код (use as-is внутрішньо ок, продавати/serve/wrap без угоди — ні; white-label — commercial).
Скарги: developer-only (кожен степ — код); екосистема ~10–12k★ vs n8n ~200k; EE-gating; app builder слабший за Retool.
Pareto: брати PG-чергу + CDC + tags + preprocessors + MCP; поверх — no-code обгортка; не embed-ити без EE.

## 5. Dead-продукти як уроки

| Проєкт | Дати | Причина | Урок для ОПОРИ |
|---|---|---|---|
| Stacker (London, портали поверх Airtable/Sheets) | Classic живий (`status.stacker.app` Operational); Astra beta spring 2024 → sunset end 2025 → Stacker AI; тригер — Airtable Interface Designer 2022 скопіював цінність (`softr.io/blog/stacker-astra-softr-migration`, `noloco.io/blog/stacker-alternatives`) | Залежність від донора (Airtable як БД+дистрибуція) + роздвоєння Classic vs Astra без міграції (rebuild, no code-export) | Ніколи не будуватись поверх чужої БД як єдиного бекенда без native tables + експорту; гібрид external+native з дня 1 |
| Parse (MBaaS, YC 2011) | 01.06.2011 → куплено FB 2013 $85M → анонс закриття 28.01.2016 → стоп 28–30.01.2017; пік ~500–600k apps (`parseplatform.github.io/migration`, `en.wikipedia.org/wiki/Parse,_Inc.`) | Стратегічна непотрібність власнику, не економіка; врятував open-source Parse Server + migration tool у день анонсу | Хостинг без self-host/exit-шляху (OSS-рантайм + JSON-експорт + мігратор) — оренда довіри; дати exit з дня 1 |
| Google AppMaker (low-code в G Suite) | EAP 2016 → GA 2018 → анонс закриття 27.01.2020 → блок 15.04.2020 → стоп 19.01.2021 (`workspaceupdates.googleblog.com/2020/01/app-maker-update.html`); канібалізація AppSheet (куплена 01.2020); **без міграції взагалі** | Низьке усиновлення (нема в Forrester Wave) + канібалізація; rebuild, лишався лише Cloud SQL | Low-code без чіткого ICP + без forward-migration вмирає навіть у Google; кожен реліз — версіонування + міграція, інакше enterprise не довірить критичне |

## 6. Зведені таблиці: ціни / ліміти / ліцензії / Україна

### 6.1 Ціни і free-tier (з офіц. pricing, 09.2026)

| Платформа | Free | Базовий платний | Модель | Пастка для МСБ |
|---|---|---|---|---|
| Directus | $0: 3 seats/25 coll/5 Flows | Team $499/міс annual | seat + Cloud add-on $99 | Стрибок $0→$499; звіряти Grant <$5M |
| Budibase | Self-host $0 ∞ apps / Cloud 5 users 200 runs | Pro $19 / Premium $49 / Business $299 | creator + actions + end-user $5–6 | Actions + seats ростуть разом |
| Retool | $0: 5 users/500 runs/5GB | Team $10+$5 / Business $50+$15 | per builder + per internal + runs/AI | Viewers платні; self-host лише Enterprise |
| Appsmith | $0: 5 users/5 ws/3 repos | Business $15/user | per user | JS-обов'язковість = потрібен дев |
| NocoDB | Self-host $0 ∞ | ~$12/$24/$45 per seat | per seat | SUL; audit/RLS лише платно; free-cloud капи суперечливі |
| Baserow | $0: 3k rows/2GB | $10 / $18 per user | per user + rows/storage | RBAC/audit за Advanced |
| Supabase | $0: 2 проєкти/500MB, пауза 7д | Pro від $25 → Team від $599 | usage (MAU/egress/storage/compute) | $25→$100–300 рахунки; прірва до $599 |
| Hasura | Free unlimited req (DDN) | $5/$30/active-model; legacy $1.50/hr | per model / per hour | 50 моделей Advanced = $1.5k без трафіку |
| Appwrite | $0: 2 shared/5GB/750k exec | Pro від $25/проєкт | per project + overage | Webhooks 2 Free; logs 1г |
| Creatio | trial 14д, free нема | $40/$75, мін $10k/рік 3 роки | per user + AI Studio | Вхід $10k вбиває МСБ |
| Odoo | One App $0 unlimited users | $24.90/$37.40/user | per user | Studio авто-апсейлить Standard→Custom |
| Power Apps | Developer non-prod | $5/app, $22/user, PAYG $10 | per user/app/active + Dataverse | Dataverse overage; ALM |
| n8n | Self-host $0 ∞ | Cloud €20 (2.5k) / €50 (10k) / €667 (40k) | per execution (run) | Polling 5 хв з'їдає Starter |
| Windmill | Self-host $0 ∞ | EE від ~$120 (seat+compute) | seat + $50/worker | EE-gating observability/audit |

### 6.2 Ліцензії

| OSI-схвалені | Fair-Code / Proprietary з нюансом |
|---|---|
| Appsmith Apache-2.0, Supabase Apache-2.0, Hasura engine Apache-2.0, Appwrite BSD-3-Clause, PocketBase MIT, Baserow core MIT, Budibase GPLv3+MPL-2.0 client, Odoo Community LGPLv3 | NocoDB SUL (01.2026), Directus MSCL (05.2026, convert GPLv3 4р), n8n SUL + EE, Windmill AGPL + proprietary CE-бінарник, Baserow premium/enterprise proprietary, Retool/Creatio/Odoo EE/Power Apps/Mendix proprietary |

Висновок: чистий OSS без гейту audit/RBAC — лише Appsmith/Supabase/Appwrite/PB. Саме тому наш хід — audit+outbox+record-RBAC на self-host без Enterprise-податку — диференціатор.

### 6.3 Україна/ЄС-колонка (що взяти для локалізації)

| Гравець | Ціна | Що взяти |
|---|---|---|
| KeepinCRM (`keepincrm.com/prices`) | Free 1 юзер; розширений 349 грн/дод. юзер; 100GB/платного; −10% річна; trial 14д | Тригери простою мовою, вх./вих. webhooks, API, 40+ інтеграцій (НП/Укрпошта/Meest, Rozetka/Prom, Binotel/Phonet, Приват/Моно/LiqPay, Checkbox, OpenAI). Нема ПН/Медок, кадрів, енергетики |
| NetHunt (`nethunt.com/pricing`) | Basic $24/$30, Plus $34/$42, вище quote; стартапам −75% | Gmail-embed, automation workflows, MCP Server, API. Склад/податки/EMS — ні |
| SalesDrive (`salesdrive.ua/prices`) | 1–2 юзери 791/991 грн; 3–9: 361/452 per user; 1M заявок, 600 зам./юзер/міс | Авторозподіл, ТТН→етапи, склад+синхр, документи+ПРРО Checkbox/Вчасно.Каса, телефонія, API. Кадри частково (тайм-трекер); ПН/EMS — ні |
| Yespo ex-eSputnik | CDP 100k $349 + Email $229 = $578/міс; free 2.5k emails | Omnichannel workflows з бранчингом, сегментація, BigQuery/PG-конектори — як референс тригерів |
| OneBox OS (`1b.app/ua`) | Free 1k сутностей; хмара $1.99/1k записів або ~$29/user | 300+ застосунків + конструктор БП/звітів/документів, Дія.Шерінг/Дія.Підпис, API v2 — чекліст КЕП |
| Uspacy / Perfectum / KeyCRM | від ~337 грн/user; KeyCRM $19 безліміт юзерів | Простий low-code для МСБ без інтегратора; коробка з разовою оплатою |

**Укр. пакет дня 1 для нас:** укр. мова + грн + LiqPay/Моно/Приват + рахунок; НП/Укрпошта/Meest (ТТН→етапи); Binotel/Phonet/UniTalk + TurboSMS + Viber/TG; Checkbox/Вчасно.Каса + КЕП + Дія.Підпис/Шерінг; інтеграції Вчасно/Медок під ПН-моніторинг (цього нема ні в кого); тригери простою мовою як у Keepin/SalesDrive; Free-for-1 + пакети + trial 14д.

## 7. Що це означає для ОПОРИ — Pareto-backlog (Етапи 2–4)

| # | Фіча (20% що дадуть 80%) | Закриває біль | Референс вкрасти | Етап |
|---|---|---|---|---|
| 1 | Approval workflows з Wait + Error Workflow→DLQ-таблиця + replay + idempotency-key | Кадри (заміна рутини), бюрократія (бронювання КМУ 692) | n8n (Wait/Error), Windmill (retry/error-handler) | 3 |
| 2 | ПН-монітор: ліміти 1 млн/100 тис./90 днів + позитивна історія + CDC-тригер без polling + backoff | Податки (блокування ПН, КМУ 1048) | Windmill CDC, n8n schedule-антипатерн (не кожні 5 хв) | 3 |
| 3 | HR Desk-шаблон (Service Desk→рекрутинг/онбординг): воронка, авто-завдання, ШІ-тегування резюме, оффер-approval | Кадри 69% | Odoo HR, Creatio HCM, Retool dashboards | 2 |
| 4 | EMS-конектор-шаблон: REST-фасад над телеметрією + time-series + peak-shaving дашборд + ROI-калькулятор | Енергетика 82%/BESS | Directus як API-шар, Supabase RLS-урок (не гальмувати) | 4 |
| 5 | Укр. пакет дня 1 (§6.3) + Дія.Підпис/КЕП + Вчасно/Медок | Franken-stack, TCO | OneBox (Дія), Keepin/SalesDrive (тригери, НП/телефонія) | 2 |
| 6 | Audit+outbox в одній транзакції + Revisions + CSV-аудит назад у таблицю + row history | Довіра, комплаєнс, ISO 27001 | Directus revisions, Baserow history, Budibase partition | 1–2 |
| 7 | Гібридна ціна: platform fee + outcome ($/resolution, $/лід) + usage (runs/ємність), Free-for-1 як у Keepin + One App Free як у Odoo | Seat compression, NRR>110% | Odoo One App Free, Budibase actions, n8n per-run, Power Apps PAYG-урок (без лабіринту) | 4 |

**Чого не повторювати:** per-seat на viewers (Retool); audit/RLS лише Enterprise (Budibase/NocoDB/Baserow); usage-лабіринт і обрив $25→$599 (Supabase); billing за моделями (Hasura); document-only без SQL (Appwrite); LGPL/EE-розкол + upgrade-біль (Odoo); closed-cloud lock-in (Power Apps); SUL/MSCL-сюрпризи без комунікації (NocoDB/Directus); залежність від чужої БД без експорту (Stacker); хостинг без exit-шляху (Parse); low-code без ICP і міграцій (AppMaker); polling-крон що з'їдає квоту (n8n); embed чужого рантайму без EE-угоди (Windmill CE-бінарник).

## 8. Джерела (перевірено 03.09.2026)

**Офіц. pricing/docs (першоджерела):** `budibase.com/pricing/`, `retool.com/pricing`, `appsmith.com/pricing`, `nocodb.com/pricing`, `baserow.io/pricing`, `baserow.io/user-docs/pricing-plans`, `directus.com/pricing`, `supabase.com/pricing`, `hasura.io/docs/2.0/hasura-cloud/plans/`, `hasura.io/docs/3.0/reference/pricing/`, `hasura.io/blog/for-the-models-that-matter-hasura-ddn-model-based-pricing`, `appwrite.io/pricing`, `creatio.com/products/pricing`, `odoo.com/pricing`, `microsoft.com/.../power-apps/pricing`, `learn.microsoft.com/.../powerapps-flow-licensing-faq`, `n8n.io/pricing`, `windmill.dev/pricing`, `keepincrm.com/prices`, `nethunt.com/pricing`, `salesdrive.ua/prices`, `yespo.io/pricing`, `1b.app/ua`, `docs.budibase.com/docs/budibase-architecture`, `docs.budibase.com/docs/audit-logs`, `docs.retool.com/self-hosted/.../architecture`, `docs.retool.com/org-users/guides/monitoring/audit-logs`, `docs.appsmith.com/advanced-concepts/version-control-with-git`, `docs.appsmith.com/advanced-concepts/audit-logs`, `docs.appsmith.com/product/security`, `nocodb.com/docs/self-hosting/license`, `nocodb.com/docs/product/workspaces/workspace-audit`, `baserow.io/blog/1-14-release-of-baserow`, `directus.com/docs/guides/data-model/collections`, `directus.com/docs/guides/flows`, `directus.com/docs/licensing/overview`, `directus.com/resources/directus-v12-license-change`, `docs.n8n.io/hosting/scaling/queue-mode`, `docs.n8n.io/flow-logic/error-handling`, `docs.n8n.io/privacy-and-security/sustainable-use-license`, `windmill.dev/platform/workers`, `windmill.dev/docs/triggers`, `windmill.dev/docs/core_concepts/scheduling`.

**Ліцензії (GitHub):** `github.com/Budibase/budibase/blob/master/LICENSE`, `github.com/appsmithorg/appsmith/blob/release/LICENSE`, `github.com/nocodb/nocodb/blob/develop/LICENSE.md`, `github.com/baserow/baserow/blob/develop/LICENSE`, `github.com/directus/directus/blob/main/license`, `github.com/supabase/supabase`, `github.com/hasura/graphql-engine/LICENSE`, `github.com/n8n-io/n8n/blob/master/LICENSE.md`, `github.com/windmill-labs/windmill/blob/main/LICENSE`.

**Рейтинги/огляди:** `g2.com/products/budibase/reviews`, `g2.com/products/retool/reviews`, `g2.com/products/appsmith/reviews`, `g2.com/sellers/directus`, `g2.com/products/creatio/reviews`, `toolradar.com/tools/*`, `saascompared.com/product/nocodb`, `getpulsesignal.com/pricing/baserow`, `jetadmin.io/blog/*`, `zite.com/blog/*-pricing`, `uibakery.io/blog/retool-pricing`, `totalum.app/blog/retool-pricing-2026`, `dev.to/beton/appsmith-pricing-teardown-2026-4mpo`, `automatenexus.com/blog/nocodb-review-self-hosted-airtable`, `saasradar.fr/en/nocodb`, `dev.to/nayankyada/directus-pricing-2026-*`, `ossalt.com/guides/supabase-vs-appwrite-2026`, `tryorbye.com`, `costbench.com`, `pocketlantern.dev`, `octurasolutions.com`, `automationatlas.io/answers/windmill-pricing-explained-2026`, `status.stacker.app`, `softr.io/blog/stacker-astra-softr-migration`, `noloco.io/blog/stacker-alternatives`, `parseplatform.github.io/migration`, `workspaceupdates.googleblog.com/2020/01/app-maker-update.html`.

**Укр. контекст (з наявних досліджень):** `docs/research/Проблеми українців та бізнесу.md`, `docs/research/Аналіз проблем для єдиної платформи.md` (ІЕД 69%, EBA 82%, 478 людино-днів CASE, КМУ №692/1048, BESS 689,5 МВт НКРЕКП, 5-7-9/Енергокредит, Дія.City, Brave1).

## Додаток: сирі статуси достовірності

- Budibase actions-цифри Pro/Premium/Business — ⚠️ (офіц. pricing динамічний, звірено з jetadmin/zite, перед релізом звірити повторно).
- Retool self-host лише Enterprise — ✅ (pricing + docs збігаються).
- Appsmith $40/user в агрегаторах — ❌ (вірити офіц. $15 Business).
- NocoDB free-cloud капи — ❌ суперечність secondary (1k vs 50k); ліцензія SUL — ✅ (docs + GitHub + awesome-selfhosted).
- Directus старі $15/$99/$299 — ❌ застарілі; v12 Team $499 — ✅ (pricing snapshot 02.09.2026 + MSCL-ресурс).
- Supabase Team $599 / Enterprise ~$15k — ✅/⚠️ (перше — pricing, друге — огляди).
- Hasura подвійний прайсинг v2 vs DDN — ✅ (два офіц. прайси, це і є пастка).
- Creatio мін $10k/3 роки — ⚠️ (pricing + academy licensing, контрактна деталь — запит демо перед фінальною цифрою в GTM).
- Odoo $24.90/$37.40 — ✅ (pricing + octurasolutions 04/2026).
- Power Apps $22/$5/$10 — ✅ (pricing + Licensing Guide 03/2026).
- n8n Business €667 self-hosted — ✅ (pricing); polling 8.6k exec — ✅ (математика 12/год×24×30 + r/n8n скарги).
- Stacker «помер» — ❌ міф (живий Classic; помер Astra beta → AI); Parse/AppMaker дати — ✅ (migration docs, Google blog).
