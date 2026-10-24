'use strict';

/**
 * Servicio que obtiene la cotizacion de BTC desde la API publica de CoinGecko.
 * - Cachea la respuesta durante CACHE_TTL_MS para no exceder el rate limit.
 * - Si la API falla y hay un valor en cache, devuelve el ultimo valor conocido (stale).
 * - La funcion fetch es inyectable para poder testear sin red.
 */

const DEFAULT_URL =
  'https://api.coingecko.com/api/v3/simple/price' +
  '?ids=bitcoin&vs_currencies=usd,eur,ars' +
  '&include_24hr_change=true&include_last_updated_at=true';

function createPriceService({
  fetchFn = globalThis.fetch,
  url = process.env.PRICE_API_URL || DEFAULT_URL,
  cacheTtlMs = Number(process.env.CACHE_TTL_MS || 30000),
  timeoutMs = 5000,
  now = () => Date.now(),
  onFetch = () => {},
} = {}) {
  let cache = null; // { data, fetchedAt }

  function parse(body) {
    const btc = body && body.bitcoin;
    if (!btc || typeof btc.usd !== 'number') {
      throw new Error('Respuesta inesperada de la API de precios');
    }
    return {
      usd: btc.usd,
      eur: btc.eur ?? null,
      ars: btc.ars ?? null,
      change24h: btc.usd_24h_change ?? null,
      lastUpdated: btc.last_updated_at
        ? new Date(btc.last_updated_at * 1000).toISOString()
        : new Date(now()).toISOString(),
    };
  }

  async function getPrice() {
    if (cache && now() - cache.fetchedAt < cacheTtlMs) {
      return { ...cache.data, source: 'cache', stale: false };
    }

    const started = now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res;
      try {
        res = await fetchFn(url, {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        throw new Error(`La API respondio HTTP ${res.status}`);
      }
      const data = parse(await res.json());
      cache = { data, fetchedAt: now() };
      onFetch({ ok: true, durationMs: now() - started, data });
      return { ...data, source: 'api', stale: false };
    } catch (err) {
      onFetch({ ok: false, durationMs: now() - started, error: err });
      if (cache) {
        return { ...cache.data, source: 'cache', stale: true };
      }
      throw err;
    }
  }

  return { getPrice, _parse: parse };
}

module.exports = { createPriceService, DEFAULT_URL };
