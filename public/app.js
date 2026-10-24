'use strict';

const REFRESH_MS = 30000;
const LOCALES = { usd: 'en-US', eur: 'it-IT', ars: 'es-AR' };

let currency = 'usd';
let last = null;
const priceHistory = []; // precios USD/EUR/ARS de esta sesion

const $ = (id) => document.getElementById(id);

function format(value, cur) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(LOCALES[cur], {
    style: 'currency',
    currency: cur.toUpperCase(),
    maximumFractionDigits: cur === 'ars' ? 0 : 2,
  }).format(value);
}

function drawSpark() {
  const values = priceHistory.map((h) => h[currency]).filter((v) => typeof v === 'number');
  if (values.length < 2) {
    $('spark-line').setAttribute('points', '');
    return;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = 300 / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(65 - ((v - min) / range) * 60).toFixed(1)}`)
    .join(' ');
  $('spark-line').setAttribute('points', points);
}

function render() {
  if (!last) return;
  $('price').textContent = format(last[currency], currency);

  const ch = last.change24h;
  const el = $('change');
  el.classList.remove('up', 'down');
  if (typeof ch === 'number') {
    el.textContent = `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)} % (24 h)`;
    el.classList.add(ch >= 0 ? 'up' : 'down');
  } else {
    el.textContent = 'Variacion 24 h no disponible';
  }

  $('updated').textContent =
    'Ultima actualizacion: ' + new Date(last.lastUpdated).toLocaleTimeString();
  drawSpark();
}

async function load() {
  const status = $('status');
  try {
    const res = await fetch('/api/price', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    last = await res.json();
    priceHistory.push(last);
    if (priceHistory.length > 60) priceHistory.shift();
    status.className = last.stale ? 'status stale' : 'status';
    status.title = last.stale ? 'Mostrando ultimo valor conocido' : 'En linea';
    render();
  } catch (err) {
    status.className = 'status error';
    status.title = 'Error: ' + err.message;
    if (!last) $('change').textContent = 'No se pudo obtener la cotizacion';
  }
}

document.querySelectorAll('.currencies button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.currencies button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currency = btn.dataset.cur;
    render();
  });
});

load();
setInterval(load, REFRESH_MS);
