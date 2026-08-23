import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('lists contractors with tenant header and same-origin path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ contractors: [{ id: 'c1', name: 'ТОВ «А»', usedUah: 1, limitUah: 2 }] }));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await api.listContractors();

    expect(rows).toEqual([{ id: 'c1', name: 'ТОВ «А»', usedUah: 1, limitUah: 2 }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/v1/finance/contractors');
    expect(init.method ?? 'GET').toBe('GET');
    expect((init.headers as Record<string, string>)['X-Opora-Tenant']).toBe('demo');
  });

  it('throws a descriptive error on non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 500)));
    await expect(api.listContractors()).rejects.toThrow('API /v1/finance/contractors → 500');
  });

  it('sends client-generated id when creating a contractor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ contractor: {} }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await api.createContractor({ id: 'abc', name: 'ТОВ «Б»', usedUah: 0, limitUah: 100_000 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      id: 'abc',
      name: 'ТОВ «Б»',
      usedUah: 0,
      limitUah: 100_000,
    });
  });

  it('maps enterprise context into backend field shapes on PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await api.putEnterprise({
      territoryType: 'frontline',
      hasCriticalEnterpriseStatus: true,
      isCriticalIndustry: false,
      hasTaxDebt: true,
      militaryObligatedCount: 12,
      alreadyBookedCount: 3,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      territoryType: 'frontline',
      hasCriticalStatus: true,
      isCriticalIndustry: false,
      hasTaxDebt: true,
      obligatedCount: 12,
      bookedCount: 3,
    });
  });

  it('deletes via DELETE without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.deleteContractor('c9');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/v1/finance/contractors/c9');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });
});
