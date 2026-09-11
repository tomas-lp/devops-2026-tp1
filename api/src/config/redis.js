import { createClient } from 'redis';

export function createRedisClient(database = process.env.REDIS_DB ?? '0') {
  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
      connectTimeout: 5000,
      reconnectStrategy: (retries) => Math.min(100 * (retries + 1), 3000),
    },
    database: Number(database),
    disableOfflineQueue: true,
  });
  client.on('error', (error) => console.error('Redis:', error.message));
  return client;
}
