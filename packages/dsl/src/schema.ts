import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Скаляри                                                            */
/* ------------------------------------------------------------------ */

export const SlugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,62}$/, 'slug: малі літери/цифри/дефіси, 2–63 символів');

export const ApiNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,62}$/, 'очікується ідентифікатор [a-z][a-z0-9_]*');

const Label = z.string().trim().min(1).max(120);
const Expression = z.string().min(1).max(500);

/* ------------------------------------------------------------------ */
/* Поля сутностей                                                     */
/* ------------------------------------------------------------------ */

const FieldBase = {
  name: ApiNameSchema,
  label: Label,
  required: z.boolean().optional().default(false),
  maxLength: z.number().int().min(1).max(10_000).optional(),
};

const TextFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('text'),
  maxLength: z.number().int().min(1).max(10_000).optional(),
  default: z.string().max(10_000).optional(),
});

const LongTextFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('longtext'),
  default: z.string().max(100_000).optional(),
});

const NumberFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  default: z.number().optional(),
});

const BooleanFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('boolean'),
  default: z.boolean().optional(),
});

const DateFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('date'),
  default: z.enum(['today']).optional(),
});

const DatetimeFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('datetime'),
  default: z.enum(['now']).optional(),
});

const SelectFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('select'),
  options: z.array(z.string().min(1).max(120)).min(2).max(50),
  default: z.string().max(120).optional(),
});

const RelationFieldSchema = z.object({
  ...FieldBase,
  type: z.literal('relation'),
  target: ApiNameSchema,
  cardinality: z.enum(['one', 'many']).default('one'),
});

export const FieldDefinitionSchema = z.discriminatedUnion('type', [
  TextFieldSchema,
  LongTextFieldSchema,
  NumberFieldSchema,
  BooleanFieldSchema,
  DateFieldSchema,
  DatetimeFieldSchema,
  SelectFieldSchema,
  RelationFieldSchema,
]);

export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

/* ------------------------------------------------------------------ */
/* Сутності                                                           */
/* ------------------------------------------------------------------ */

export const EntityDefinitionSchema = z.object({
  apiName: ApiNameSchema,
  label: Label,
  fields: z.array(FieldDefinitionSchema).min(1).max(200),
});

export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;

/* ------------------------------------------------------------------ */
/* Сторінки                                                           */
/* ------------------------------------------------------------------ */

const TableViewSchema = z.object({ kind: z.literal('table'), columns: z.array(ApiNameSchema).min(1) });
const DetailViewSchema = z.object({ kind: z.literal('detail'), columns: z.array(ApiNameSchema).min(1) });
const FormViewSchema = z.object({ kind: z.literal('form'), fields: z.array(ApiNameSchema).min(1) });

const ViewSchema = z.discriminatedUnion('kind', [TableViewSchema, DetailViewSchema, FormViewSchema]);

export const PageDefinitionSchema = z.object({
  path: z.string().regex(/^\/[a-z0-9-/]*$/, 'шлях починається з «/» і містить [a-z0-9-/]'),
  label: Label,
  entity: ApiNameSchema,
  view: ViewSchema,
});

export type PageDefinition = z.infer<typeof PageDefinitionSchema>;

/* ------------------------------------------------------------------ */
/* Політики та workflows (структура валідується, вирази НЕ виконуються) */
/* ------------------------------------------------------------------ */

export const PolicyActionSchema = z.enum(['read', 'create', 'update', 'delete']);

export const PolicyDefinitionSchema = z.object({
  resource: ApiNameSchema,
  action: PolicyActionSchema,
  /** Непрозорий рядок виразу; семантику визначає policy engine (пакет policy). */
  allow: Expression,
});

export type PolicyDefinition = z.infer<typeof PolicyDefinitionSchema>;

export const WorkflowStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('assign'),
    field: ApiNameSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    type: z.literal('updateRecord'),
    data: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }),
  z.object({
    type: z.literal('webhook'),
    connection: SlugSchema,
    event: z.string().min(1).max(120),
  }),
]);

export const WorkflowDefinitionSchema = z.object({
  on: z.string().regex(
    /^[a-z][a-z0-9_]*\.(created|updated|deleted)$/,
    'on: очікується "<entity>.(created|updated|deleted)"',
  ),
  if: Expression.optional(),
  steps: z.array(WorkflowStepSchema).min(1).max(20),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

/* ------------------------------------------------------------------ */
/* Корінь                                                             */
/* ------------------------------------------------------------------ */

export const AppDefinitionSchema = z.object({
  app: z.object({
    slug: SlugSchema,
    name: z.string().trim().min(1).max(80),
  }),
  entities: z.array(EntityDefinitionSchema).min(1).max(100),
  pages: z.array(PageDefinitionSchema).min(1).max(200),
  policies: z.array(PolicyDefinitionSchema).max(300).default([]),
  workflows: z.array(WorkflowDefinitionSchema).max(200).default([]),
});

export type AppDefinition = z.infer<typeof AppDefinitionSchema>;
