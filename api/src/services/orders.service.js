import { httpError, statuses } from '../validation.js';

function deserialize(hash) {
  return {
    id: Number(hash.id),
    customer: hash.customer,
    items: JSON.parse(hash.items),
    status: hash.status,
    createdAt: hash.createdAt,
  };
}

// Redis ejecuta cada script sin intercalar comandos de otras solicitudes.
// La validación y el movimiento deben ser una única operación.
const changeStatusScript = `
  local current = redis.call('HGET', KEYS[1], 'status')
  if not current then return 0 end
  local nextStatus = {received='preparing', preparing='ready', ready='delivered'}
  if nextStatus[current] ~= ARGV[2] then return -1 end
  redis.call('LREM', 'orders:' .. current, 0, ARGV[1])
  redis.call('RPUSH', 'orders:' .. ARGV[2], ARGV[1])
  redis.call('HSET', KEYS[1], 'status', ARGV[2])
  return redis.call('HGETALL', KEYS[1])
`;

const deleteScript = `
  if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
  redis.call('DEL', KEYS[1])
  for i = 2, #KEYS do redis.call('LREM', KEYS[i], 0, ARGV[1]) end
  return 1
`;

export function createOrdersService(redis) {
  return {
    async list() {
      const queues = await Promise.all(statuses.map((status) => redis.lRange(`orders:${status}`, 0, -1)));
      const ids = [...new Set(queues.flat())];
      const hashes = await Promise.all(ids.map((id) => redis.hGetAll(`order:${id}`)));
      // Un pedido puede haberse eliminado entre la lectura de la cola y el HASH.
      return hashes.filter((hash) => hash.id).map(deserialize);
    },

    async get(id) {
      const hash = await redis.hGetAll(`order:${id}`);
      if (!hash.id) throw httpError(404, 'Pedido inexistente.');
      return deserialize(hash);
    },

    async create({ customer, items }) {
      const id = await redis.incr('orders:next-id');
      const order = { id, customer, items, status: 'received', createdAt: new Date().toISOString() };
      // MULTI/EXEC guarda el HASH y su referencia juntos.
      await redis.multi()
        .hSet(`order:${id}`, { ...order, id: String(id), items: JSON.stringify(items) })
        .rPush('orders:received', String(id))
        .exec();
      return order;
    },

    async changeStatus(id, status) {
      const result = await redis.eval(changeStatusScript, {
        keys: [`order:${id}`], arguments: [String(id), status],
      });
      if (result === 0) throw httpError(404, 'Pedido inexistente.');
      if (result === -1) throw httpError(400, 'Transición inválida. El flujo es received -> preparing -> ready -> delivered.');
      const hash = {};
      for (let i = 0; i < result.length; i += 2) hash[result[i]] = result[i + 1];
      return deserialize(hash);
    },

    async remove(id) {
      const result = await redis.eval(deleteScript, {
        keys: [`order:${id}`, ...statuses.map((status) => `orders:${status}`)],
        arguments: [String(id)],
      });
      if (result === 0) throw httpError(404, 'Pedido inexistente.');
      return { id: Number(id) };
    },
  };
}
