'use strict';

const { createPriceService } = require('../src/priceService');

const SAMPLE = {
  bitcoin: {
    usd: 67000.5,
    eur: 61000.1,
    ars: 65000000,
    usd_24h_change: 1.75,
    last_updated_at: 1761300000,
  },
};

function okFetch(body = SAMPLE) {
  return jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('priceService', () => {
  test('obtiene y normaliza el precio desde la API', async () => {
    const fetchFn = okFetch();
    const svc = createPriceService({ fetchFn });
    const p = await svc.getPrice();
    expect(p.usd).toBe(67000.5);
    expect(p.eur).toBe(61000.1);
    expect(p.ars).toBe(65000000);
    expect(p.change24h).toBe(1.75);
    expect(p.source).toBe('api');
    expect(p.stale).toBe(false);
    expect(p.lastUpdated).toBe(new Date(1761300000 * 1000).toISOString());
  });

  test('usa la cache dentro del TTL', async () => {
    const fetchFn = okFetch();
    let t = 0;
    const svc = createPriceService({ fetchFn, cacheTtlMs: 30000, now: () => t });
    await svc.getPrice();
    t = 10000;
    const p = await svc.getPrice();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(p.source).toBe('cache');
  });

  test('vuelve a consultar cuando vence el TTL', async () => {
    const fetchFn = okFetch();
    let t = 0;
    const svc = createPriceService({ fetchFn, cacheTtlMs: 30000, now: () => t });
    await svc.getPrice();
    t = 31000;
    await svc.getPrice();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('devuelve el ultimo valor (stale) si la API falla', async () => {
    let t = 0;
    const fetchFn = okFetch();
    const svc = createPriceService({ fetchFn, cacheTtlMs: 1000, now: () => t });
    await svc.getPrice();
    fetchFn.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    t = 5000;
    const p = await svc.getPrice();
    expect(p.stale).toBe(true);
    expect(p.usd).toBe(67000.5);
  });

  test('lanza error si la API falla y no hay cache', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('network down'));
    const onFetch = jest.fn();
    const svc = createPriceService({ fetchFn, onFetch });
    await expect(svc.getPrice()).rejects.toThrow('network down');
    expect(onFetch).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('rechaza respuestas con formato inesperado', async () => {
    const svc = createPriceService({ fetchFn: okFetch({ foo: 1 }) });
    await expect(svc.getPrice()).rejects.toThrow('Respuesta inesperada');
  });

  test('campos opcionales ausentes quedan en null', () => {
    const svc = createPriceService({ fetchFn: okFetch(), now: () => 0 });
    const p = svc._parse({ bitcoin: { usd: 1 } });
    expect(p.eur).toBeNull();
    expect(p.change24h).toBeNull();
    expect(p.lastUpdated).toBe(new Date(0).toISOString());
  });
});
