'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { createMetrics } = require('./metrics');
const { createPriceService } = require('./priceService');
const pkg = require('../package.json');

function createApp({ priceService, metrics } = {}) {
  const m = metrics || createMetrics();
  const prices = priceService || createPriceService({ onFetch: m.onFetch });

  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          // Se sirve por HTTP plano dentro de la VM: no forzar HTTPS en los recursos
          'upgrade-insecure-requests': null,
        },
      },
    })
  );
  app.use(m.httpMiddleware);

  app.get('/api/price', async (req, res) => {
    try {
      const data = await prices.getPrice();
      res.set('Cache-Control', 'no-store');
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: 'No se pudo obtener la cotizacion', detail: err.message });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: pkg.version, uptime: process.uptime() });
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', m.register.contentType);
    res.send(await m.register.metrics());
  });

  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}

module.exports = { createApp };
