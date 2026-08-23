import { crudRoutes } from '../lib/crud';
import { contractorCreateSchema, contractorPatchSchema } from '../lib/validate';

export function financeRoutes() {
  return crudRoutes({
    table: 'contractors',
    columns: 'id, name, used_uah, limit_uah',
    mapRow: (r) => ({
      id: String(r.id),
      name: String(r.name),
      usedUah: Number(r.used_uah),
      limitUah: Number(r.limit_uah),
    }),
    createSchema: contractorCreateSchema,
    patchSchema: contractorPatchSchema,
    patchColumns: {
      name: 'name',
      usedUah: 'used_uah',
      limitUah: 'limit_uah',
    },
    createColumns: (v) => [
      { column: 'used_uah', value: v.usedUah ?? 0 },
      { column: 'limit_uah', value: v.limitUah },
    ],
    notFoundLabel: 'Контрагента не знайдено',
  });
}
