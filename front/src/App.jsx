import "./App.css";
import { useEffect, useRef, useState } from "react";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import {
  cambiarEstadoPedido,
  crearPedido,
  obtenerPedidosIniciales,
  obtenerPedidos,
} from "./data";
import coffeeIcon from "./assets/coffee.svg";

const columnas = [
  { clave: "recibidos", titulo: "Recibidos", color: "amarillo" },
  { clave: "preparando", titulo: "Preparando", color: "azul" },
  { clave: "listos", titulo: "Listos", color: "verde" },
];

function App() {
  const [pedidos, establecerPedidos] = useState(obtenerPedidosIniciales);
  const [pedidoArrastrado, establecerPedidoArrastrado] = useState(null);
  const [error, establecerError] = useState("");
  const [ocupado, establecerOcupado] = useState(true);
  const operacionEnCurso = useRef(false);

  useEffect(() => {
    let activo = true;

    obtenerPedidos()
      .then((datos) => {
        if (activo) establecerPedidos(datos);
      })
      .catch((errorCarga) => {
        if (activo) establecerError(errorCarga.message);
      })
      .finally(() => {
        if (activo) establecerOcupado(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  async function agregarPedido() {
    if (ocupado || operacionEnCurso.current) return;

    const customer = window.prompt("Nombre del cliente:");
    if (customer === null) return;

    const items = [];
    do {
      const name = window.prompt("Nombre del producto:");
      if (name === null) return;

      const quantity = window.prompt("Cantidad:", "1");
      if (quantity === null) return;

      items.push({ name, quantity: Number(quantity) });
    } while (window.confirm("¿Agregar otro producto al pedido?"));

    operacionEnCurso.current = true;
    establecerOcupado(true);
    establecerError("");

    try {
      const nuevoPedido = await crearPedido(customer, items);
      establecerPedidos((actuales) => ({
        ...actuales,
        recibidos: [...actuales.recibidos, nuevoPedido],
      }));
    } catch (errorCreacion) {
      establecerError(errorCreacion.message);
    } finally {
      operacionEnCurso.current = false;
      establecerOcupado(false);
    }
  }

  function buscarPedido(id) {
    return columnas.reduce((resultado, columna) => {
      const pedido = pedidos[columna.clave].find(
        (pedidoActual) => `pedido-${pedidoActual.id}` === id,
      );

      return pedido ? { pedido, columnaActual: columna.clave } : resultado;
    }, null);
  }

  function iniciarArrastre({ operation }) {
    establecerPedidoArrastrado(buscarPedido(operation.source.id));
  }

  async function terminarArrastre({ operation, canceled }) {
    const destino = operation.target?.id;

    if (
      canceled ||
      ocupado ||
      operacionEnCurso.current ||
      !pedidoArrastrado ||
      !destino ||
      pedidoArrastrado.columnaActual === destino
    ) {
      establecerPedidoArrastrado(null);
      return;
    }

    const { pedido, columnaActual } = pedidoArrastrado;
    establecerPedidoArrastrado(null);
    operacionEnCurso.current = true;
    establecerOcupado(true);
    establecerError("");

    try {
      const actualizado = await cambiarEstadoPedido(pedido, destino);

      establecerPedidos((actuales) => ({
        ...actuales,
        [columnaActual]: actuales[columnaActual].filter(
          (pedidoActual) => pedidoActual.id !== pedido.id,
        ),
        [destino]: [...actuales[destino], actualizado],
      }));
    } catch (errorCambio) {
      establecerError(errorCambio.message);

      // Si el servidor cambió mientras se arrastraba, volvemos a cargar el estado real.
      try {
        establecerPedidos(await obtenerPedidos());
      } catch {
        // Conservamos el tablero actual y el error original.
      }
    } finally {
      operacionEnCurso.current = false;
      establecerOcupado(false);
    }
  }

  return (
    <DragDropProvider
      onDragStart={iniciarArrastre}
      onDragEnd={terminarArrastre}
    >
      <main className="aplicacion">
        <header className="encabezado">
          <div>
            <h1>coffee.dev</h1>
          </div>
          <button
            className="boton-nuevo"
            type="button"
            onClick={agregarPedido}
            disabled={ocupado}
          >
            <span aria-hidden="true">+</span>
            Nuevo pedido
          </button>
        </header>

        {error && <p role="alert">{error}</p>}

        <section className="tablero" aria-label="Cola de pedidos de café">
          {columnas.map((columna) => (
            <Columna
              clave={columna.clave}
              color={columna.color}
              estaEnOrigen={pedidoArrastrado?.columnaActual === columna.clave}
              key={columna.clave}
              pedidos={pedidos[columna.clave]}
              titulo={columna.titulo}
            />
          ))}
        </section>
      </main>

      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {pedidoArrastrado && (
          <TarjetaPedidoVisual esOverlay pedido={pedidoArrastrado.pedido} />
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}

function Columna({ clave, color, estaEnOrigen, pedidos, titulo }) {
  const { isDropTarget, ref } = useDroppable({ id: clave });

  return (
    <section
      className={`columna columna-${color}${estaEnOrigen ? " columna-origen-arrastre" : ""}${isDropTarget ? " columna-destino-arrastre" : ""}`}
      ref={ref}
    >
      <div className="encabezado-columna">
        <div className="titulo-columna">
          <div className="linea" />
          <h2>{titulo}</h2>
          <div className="linea" />
        </div>
      </div>

      <div className="lista-pedidos">
        {pedidos.map((pedido) => (
          <TarjetaPedido
            columnaActual={clave}
            key={pedido.id}
            pedido={pedido}
          />
        ))}

        {pedidos.length === 0 && (
          <p className="lista-vacia">No hay pedidos acá</p>
        )}
      </div>
    </section>
  );
}

function TarjetaPedido({ columnaActual, esOverlay = false, pedido }) {
  const { isDragSource, ref } = useDraggable({
    data: { columnaActual, pedido },
    id: `pedido-${pedido.id}`,
  });

  return (
    <TarjetaPedidoVisual
      esArrastrada={isDragSource}
      esOverlay={esOverlay}
      elementRef={ref}
      pedido={pedido}
    />
  );
}

function TarjetaPedidoVisual({ elementRef, esArrastrada, esOverlay, pedido }) {
  return (
    <article
      aria-label={`Pedido ${pedido.nombre}, número ${pedido.id}`}
      className={`tarjeta-pedido${esOverlay ? " tarjeta-pedido-overlay" : ""}${esArrastrada ? " tarjeta-pedido-origen" : ""}`}
      ref={elementRef}
    >
      <img src={coffeeIcon} className="icono-cafe" aria-hidden="true" />
      <div className="informacion-pedido">
        <h3>{pedido.nombre}</h3>
        <p>Pedido #{pedido.id}</p>
      </div>
      <time>{pedido.hora}</time>
    </article>
  );
}

export default App;
