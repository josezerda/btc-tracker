'use strict';

const client = require('prom-client');

/**
 * Metricas expuestas en /metrics para Prometheus.
 * Se usa un Registry propio para que los tests no compartan estado global.
 */
function createMetrics() {
  const register = new client.Registry();
  register.setDefaultLabels({ app: 'btc-tracker' });
  client.collectDefaultMetrics({ register });

  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total de requests HTTP atendidos',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
  });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Latencia de los requests HTTP',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  });

  const btcPrice = new client.Gauge({
    name: 'btc_price',
    help: 'Ultima cotizacion conocida de BTC',
    labelNames: ['currency'],
    registers: [register],
  });

  const btcChange24h = new client.Gauge({
    name: 'btc_change_24h_percent',
    help: 'Variacion porcentual de BTC en las ultimas 24 h (USD)',
    registers: [register],
  });

  const upstreamRequests = new client.Counter({
    name: 'btc_upstream_requests_total',
    help: 'Llamadas a la API externa de precios',
    labelNames: ['result'],
    registers: [register],
  });

  const upstreamDuration = new client.Histogram({
    name: 'btc_upstream_request_duration_seconds',
    help: 'Latencia de la API externa de precios',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  });

  function onFetch({ ok, durationMs, data }) {
    upstreamRequests.inc({ result: ok ? 'success' : 'error' });
    upstreamDuration.observe(durationMs / 1000);
    if (ok && data) {
      btcPrice.set({ currency: 'usd' }, data.usd);
      if (data.eur !== null) btcPrice.set({ currency: 'eur' }, data.eur);
      if (data.ars !== null) btcPrice.set({ currency: 'ars' }, data.ars);
      if (data.change24h !== null) btcChange24h.set(data.change24h);
    }
  }

  function httpMiddleware(req, res, next) {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      // Se usa la ruta "plantilla" (no la URL real) para no disparar la cardinalidad
      const route = req.route ? req.route.path : 'static_or_404';
      const labels = { method: req.method, route, status: String(res.statusCode) };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  }

  return { register, onFetch, httpMiddleware };
}

module.exports = { createMetrics };
