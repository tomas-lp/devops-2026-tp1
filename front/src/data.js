const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const estados = { recibidos: 'received', preparando: 'preparing', listos: 'ready', entregados: 'delivered' };

async function solicitar(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new Error('No se pudo conectar con la API.');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('La API no devolvió JSON. Revisá la configuración del servidor.');
  }
  if (!response.ok) throw new Error(body.error?.message || 'No se pudo completar la operación.');
  return body.data;
}

function adaptarPedido(order) {
  return {
    id: order.id,
    customer: order.customer,
    nombre: order.items.map((item) => `${item.quantity} × ${item.name}`).join(', '),
    hora: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    estado: Object.keys(estados).find((key) => estados[key] === order.status),
  };
}

export function obtenerPedidosIniciales() {
  return {
    recibidos: [],
    preparando: [],
    listos: [],
  };
}

export async function obtenerPedidos() {
  const orders = await solicitar('/orders');
  const pedidos = obtenerPedidosIniciales();
  orders.map(adaptarPedido).forEach((pedido) => {
    if (pedidos[pedido.estado]) pedidos[pedido.estado].push(pedido);
  });
  return pedidos;
}

export async function crearPedido(customer, items) {
  return adaptarPedido(await solicitar('/orders', {
    method: 'POST', body: JSON.stringify({ customer, items }),
  }));
}

export async function cambiarEstadoPedido(pedido, nuevoEstado) {
  return adaptarPedido(await solicitar(`/orders/${pedido.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: estados[nuevoEstado] }),
  }));
}
