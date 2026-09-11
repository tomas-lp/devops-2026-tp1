import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder, validateId, validateStatus } from '../src/validation.js';

test('normaliza cliente e ítems e ignora campos controlados por el servidor', () => {
  assert.deepEqual(validateOrder({
    customer: ' Maia ', items: [{ name: ' Café ', quantity: 2 }], id: 999, status: 'delivered',
  }), { customer: 'Maia', items: [{ name: 'Café', quantity: 2 }] });
});

test('rechaza cuerpos y pedidos inválidos', () => {
  for (const body of [undefined, null, [], {}, { customer: 1 }, { customer: ' ' },
    { customer: 'Maia', items: [] }, { customer: 'Maia', items: {} },
    ...[null, {}, { name: ' ' }, { name: 42 },
      ...[0, -1, 1.5, '2', null, true, Number.MAX_SAFE_INTEGER + 1].map((quantity) => ({ name: 'Café', quantity })),
    ].map((item) => ({ customer: 'Maia', items: [item] })),
  ]) {
    assert.throws(() => validateOrder(body), { status: 400 });
  }
});

test('valida IDs y estados', () => {
  assert.equal(validateId('15'), '15');
  for (const id of ['0', '-1', '01', '1.2', '1abc', '9007199254740992']) {
    assert.throws(() => validateId(id), { status: 400 });
  }
  for (const status of ['received', 'preparing', 'ready', 'delivered']) {
    assert.equal(validateStatus({ status }), status);
  }
  for (const body of [undefined, {}, { status: 'listos' }, { status: 'unknown' }]) {
    assert.throws(() => validateStatus(body), { status: 400 });
  }
});
