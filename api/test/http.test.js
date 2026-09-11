import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

test('errores HTTP consistentes incluso si Redis falla', async (t) => {
  // Sólo simula una caída para verificar el middleware; CRUD se prueba con Redis real.
  const server = createApp({ hGetAll: async () => { throw new Error('Detalle privado'); } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    ['/api/orders/1', {}, 500, 'Error interno del servidor.'],
    ['/api/orders/abc', {}, 400, 'El ID debe ser un entero positivo.'],
    ['/no-existe', {}, 404, 'Ruta inexistente.'],
    ['/api/orders', { method: 'POST', body: '{bad' }, 400, 'JSON inválido.'],
    ['/api/orders', { method: 'POST', body: JSON.stringify({ customer: 'a'.repeat(110000) }) }, 400, 'El cuerpo excede 100 KB.'],
    ['/api/orders', { method: 'POST', body: '{}' }, 400, 'customer debe ser un texto no vacío.'],
  ];
  for (const [path, options, status, message] of cases) {
    const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: { message } });
  }
});
