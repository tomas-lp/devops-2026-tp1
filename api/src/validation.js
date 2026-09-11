export const statuses = ['received', 'preparing', 'ready', 'delivered'];

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw httpError(400, 'El ID debe ser un entero positivo.');
  }
  return value;
}

export function validateOrder(body) {
  if (typeof body?.customer !== 'string' || !body.customer.trim()) {
    throw httpError(400, 'customer debe ser un texto no vacío.');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw httpError(400, 'items debe ser un array no vacío.');
  }
  const items = body.items.map((item) => {
    if (typeof item?.name !== 'string' || !item.name.trim()) {
      throw httpError(400, 'Cada ítem debe tener un name no vacío.');
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw httpError(400, 'quantity debe ser un entero positivo.');
    }
    return { name: item.name.trim(), quantity: item.quantity };
  });
  return { customer: body.customer.trim(), items };
}

export function validateStatus(body) {
  if (!statuses.includes(body?.status)) {
    throw httpError(400, `status debe ser uno de: ${statuses.join(', ')}.`);
  }
  return body.status;
}
