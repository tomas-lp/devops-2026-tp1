import "./App.css";
import { useState } from "react";
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

  function agregarPedido() {
    const nuevoPedido = crearPedido();

    establecerPedidos((pedidosActuales) => ({
      ...pedidosActuales,
      recibidos: [...pedidosActuales.recibidos, nuevoPedido],
    }));
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

  function terminarArrastre({ operation, canceled }) {
    if (
      canceled ||
      !pedidoArrastrado ||
      !operation.target ||
      pedidoArrastrado.columnaActual === operation.target.id
    ) {
      establecerPedidoArrastrado(null);
      return;
    }

    const pedidoActualizado = cambiarEstadoPedido(
      pedidoArrastrado.pedido,
      operation.target.id,
    );

    establecerPedidos((pedidosActuales) => ({
      ...pedidosActuales,
      [pedidoArrastrado.columnaActual]: pedidosActuales[
        pedidoArrastrado.columnaActual
      ].filter((pedido) => pedido.id !== pedidoArrastrado.pedido.id),
      [operation.target.id]: [
        ...pedidosActuales[operation.target.id],
        pedidoActualizado,
      ],
    }));
    establecerPedidoArrastrado(null);
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
          <button className="boton-nuevo" type="button" onClick={agregarPedido}>
            <span aria-hidden="true">+</span>
            Nuevo pedido
          </button>
        </header>

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
