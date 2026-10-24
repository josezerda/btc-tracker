'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 3000);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`btc-tracker escuchando en http://0.0.0.0:${PORT}`);
});

// Apagado ordenado cuando Docker envia SIGTERM
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} recibido, cerrando servidor...`);
    server.close(() => process.exit(0));
  });
}
