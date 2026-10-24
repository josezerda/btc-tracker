'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { createMetrics } = require('../src/metrics');

function appWith(getPrice) {
  const metrics = createMetrics();
  return { app: createApp({ priceService: { getPrice }, metrics }), metrics };
}

describe('API HTTP', () => {
  test('GET /health responde ok', async () => {
    const { app } = appWith(jest.fn());
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/price devuelve la cotizacion', async () => {
    const price = { usd: 67000, eur: 61000, ars: 6.5e7, change24h: -0.5, source: 'api' };
    const { app } = appWith(jest.fn().mockResolvedValue(price));
    const res = await request(app).get('/api/price');
    expect(res.status).toBe(200);
    expect(res.body.usd).toBe(67000);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('GET /api/price devuelve 502 si falla el proveedor', async () => {
    const { app } = appWith(jest.fn().mockRejectedValue(new Error('timeout')));
    const res = await request(app).get('/api/price');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/cotizacion/);
  });

  test('GET / sirve la pagina web con cabeceras de seguridad', async () => {
    const { app } = appWith(jest.fn());
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('BTC Tracker');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('GET /metrics expone metricas Prometheus', async () => {
    const { app, metrics } = appWith(jest.fn());
    metrics.onFetch({ ok: true, durationMs: 120, data: { usd: 1, eur: 2, ars: 3, change24h: 4 } });
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('btc_price{currency="usd",app="btc-tracker"} 1');
    expect(res.text).toContain('btc_change_24h_percent');
    expect(res.text).toContain('http_requests_total{method="GET",route="/health",status="200"');
  });

  test('rutas inexistentes devuelven 404', async () => {
    const { app } = appWith(jest.fn());
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
  });
});
