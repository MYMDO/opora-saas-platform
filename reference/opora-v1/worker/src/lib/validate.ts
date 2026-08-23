import { z } from 'zod';

const MAX_UAH = 1_000_000_000;

const uahInt = z.coerce.number().int().min(0).max(MAX_UAH);

const clientUuid = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, 'Дозволені літери, цифри, «_», «-» (до 64 символів)');

export const contractorCreateSchema = z.object({
  id: clientUuid.optional(),
  name: z.string().trim().min(1).max(120),
  usedUah: z.coerce.number().int().min(0).max(MAX_UAH).optional(),
  limitUah: z.coerce.number().int().min(1).max(MAX_UAH),
});

export const contractorPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    usedUah: uahInt.optional(),
    limitUah: z.coerce.number().int().min(1).max(MAX_UAH).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Порожній патч' });

export const employeeCreateSchema = z.object({
  id: clientUuid.optional(),
  name: z.string().trim().min(1).max(120),
  monthlySalaryUah: uahInt,
  isMilitaryObliged: z.boolean().optional().default(true),
});

export const employeePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    monthlySalaryUah: uahInt.optional(),
    isMilitaryObliged: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Порожній патч' });

export const enterprisePutSchema = z.object({
  territoryType: z.enum(['regular', 'frontline']),
  hasCriticalStatus: z.boolean(),
  isCriticalIndustry: z.boolean(),
  hasTaxDebt: z.boolean(),
  obligatedCount: uahInt,
  bookedCount: uahInt,
});

export type ContractorCreate = z.infer<typeof contractorCreateSchema>;
export type ContractorPatch = z.infer<typeof contractorPatchSchema>;
export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;
export type EmployeePatch = z.infer<typeof employeePatchSchema>;
export type EnterprisePut = z.infer<typeof enterprisePutSchema>;

export function parseBody<T>(schema: z.ZodType<T>, raw: unknown):
  | { ok: true; value: T }
  | { ok: false; issues: string[] } {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`),
  };
}

export async function readJson(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
