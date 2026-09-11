const nombresDeCafe = [
  "Espresso",
  "Cappuccino",
  "Latte",
  "Americano",
  "Mocaccino",
];

let siguienteId = 1;

export function obtenerPedidosIniciales() {
  return {
    recibidos: [],
    preparando: [],
    listos: [],
  };
}

export function crearPedido() {
  const nombre = nombresDeCafe[(siguienteId - 1) % nombresDeCafe.length];
  const hora = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const pedido = {
    id: siguienteId,
    nombre,
    hora,
    estado: "recibidos",
  };

  siguienteId += 1;
  return pedido;
}

export function cambiarEstadoPedido(pedido, nuevoEstado) {
  return {
    ...pedido,
    estado: nuevoEstado,
  };
}
