import { createApp } from './app.js';
import { createRedisClient } from './config/redis.js';

const redis = createRedisClient();
let server;

function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 5000);
  timeout.unref();
  if (server) {
    server.close(() => {
      if (redis.isOpen) redis.destroy();
      clearTimeout(timeout);
    });
  } else if (redis.isOpen) redis.destroy();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  await redis.connect();
  server = createApp(redis).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
    console.log(`CoffeeQueue API escuchando en el puerto ${process.env.PORT || 3000}`);
  });
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
    shutdown();
  });
} catch (error) {
  console.error('No se pudo iniciar la API:', error.message);
  process.exitCode = 1;
  shutdown();
}
