import express from 'express';
import os from 'node:os';
import { ordersRoutes } from './routes/orders.routes.js';
import { createOrdersService } from './services/orders.service.js';

const apiReplicaNumero = Math.floor(100 + Math.random() * 900);

export function createApp(redis) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/replica', (req, res) => {
    res.json({
      data: {
        numero: apiReplicaNumero,
        hostname: os.hostname(),
      },
    });
  });
  app.use('/api/orders', ordersRoutes(createOrdersService(redis)));
  app.use((req, res) => res.status(404).json({ error: { message: 'Ruta inexistente.' } }));
  // Express 5 deriva automáticamente los rechazos de handlers async a este middleware.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const invalidJson = error.type === 'entity.parse.failed';
    const oversized = error.type === 'entity.too.large';
    const status = invalidJson || oversized ? 400 : [400, 404].includes(error.status) ? error.status : 500;
    if (status === 500) console.error(error);
    const message = invalidJson ? 'JSON inválido.' : oversized ? 'El cuerpo excede 100 KB.'
      : status === 500 ? 'Error interno del servidor.' : error.message;
    res.status(status).json({ error: { message } });
  });
  return app;
}
