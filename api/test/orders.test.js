import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createRedisClient } from '../src/config/redis.js';
import { statuses } from '../src/validation.js';

test('API REST con Redis real: CRUD, validación, colas y concurrencia', { timeout: 20000 }, async (t) => {
  const database = process.env.TEST_REDIS_DB;
  assert.match(database || '', /^(?:[1-9]|1[0-5])$/, 'Definir TEST_REDIS_DB (1..15), una base vacía exclusiva de pruebas.');
  const redis = createRedisClient(database);
  const ids = [];
  let ownsDatabase = false;
  let server;
  t.after(async () => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (ownsDatabase && redis.isReady) {
        await redis.del(['orders:next-id', ...statuses.map((s) => `orders:${s}`), ...ids.map((id) => `order:${id}`)]);
      }
    } finally {
      if (redis.isOpen) redis.destroy();
    }
  });
  await redis.connect();
  assert.equal(await redis.dbSize(), 0, 'La base de pruebas debe estar vacía; no se modificaron datos.');
  ownsDatabase = true;
  server = createApp(redis).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/orders`;
  async function request(path = '', method = 'GET', body) {
    const res = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.match(res.headers.get('content-type'), /application\/json/);
    return { status: res.status, body: await res.json() };
  }
  async function create() {
    const response = await request('', 'POST', { customer: ' Maia ', items: [{ name: 'Café', quantity: 1 }, { name: 'Medialuna', quantity: 2 }], id: 999, status: 'delivered' });
    assert.equal(response.status, 201);
    ids.push(response.body.data.id);
    return response.body.data;
  }
  assert.deepEqual((await request()).body, { data: [] });
  const order = await create();
  assert.equal(order.id, 1);
  assert.equal(order.customer, 'Maia');
  assert.equal(order.status, 'received');
  assert.ok(Number.isFinite(Date.parse(order.createdAt)));
  assert.equal(await redis.type(`order:${order.id}`), 'hash');
  assert.equal(await redis.type('orders:received'), 'list');
  assert.deepEqual(JSON.parse(await redis.hGet(`order:${order.id}`, 'items')), order.items);
  assert.deepEqual((await request(`/${order.id}`)).body.data, order);
  assert.equal((await request('', 'POST', { customer: 'Maia', items: [] })).status, 400);
  assert.equal((await request('/bad')).status, 400);
  assert.equal((await request('/999')).status, 404);
  for (const status of ['invented', 'ready', 'received']) {
    assert.equal((await request('/1/status', 'PATCH', { status })).status, 400);
  }
  for (let i = 1; i < statuses.length; i++) {
    const response = await request('/1/status', 'PATCH', { status: statuses[i] });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, statuses[i]);
    assert.deepEqual(await redis.lRange(`orders:${statuses[i - 1]}`, 0, -1), []);
    assert.deepEqual(await redis.lRange(`orders:${statuses[i]}`, 0, -1), ['1']);
  }
  assert.equal((await request('/1/status', 'PATCH', { status: 'preparing' })).status, 400);
  assert.equal((await request()).body.data[0].status, 'delivered');
  // DELETE también limpia referencias duplicadas o ubicadas en una cola incorrecta.
  await redis.rPush('orders:received', ['1', '1']);
  assert.equal((await request('/1', 'DELETE')).status, 200);
  assert.equal(await redis.exists('order:1'), 0);
  for (const status of statuses) assert.deepEqual(await redis.lRange(`orders:${status}`, 0, -1), []);
  assert.equal((await request('/1', 'DELETE')).status, 404);
  assert.equal((await request('/1/status', 'PATCH', { status: 'preparing' })).status, 404);

  const concurrent = await Promise.all(Array.from({ length: 8 }, create));
  assert.equal(new Set(concurrent.map((o) => o.id)).size, 8);
  const id = concurrent[0].id;
  const transitions = await Promise.all(Array.from({ length: 8 }, () => request(`/${id}/status`, 'PATCH', { status: 'preparing' })));
  assert.equal(transitions.filter((r) => r.status === 200).length, 1);
  assert.equal(transitions.filter((r) => r.status === 400).length, 7);
  assert.deepEqual(await redis.lRange('orders:preparing', 0, -1), [String(id)]);
  await Promise.all([request(`/${id}/status`, 'PATCH', { status: 'ready' }), request(`/${id}`, 'DELETE')]);
  assert.equal(await redis.exists(`order:${id}`), 0);
  for (const status of statuses) assert.ok(!(await redis.lRange(`orders:${status}`, 0, -1)).includes(String(id)));

  const malformed = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(malformed.status, 400);
  assert.ok((await malformed.json()).error.message);
  const notFound = await fetch(base.replace('/orders', '/unknown'));
  assert.equal(notFound.status, 404);
  assert.ok((await notFound.json()).error.message);
});
