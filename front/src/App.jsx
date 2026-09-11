import "./App.css";
import { useState } from "react";
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

  function iniciarArrastre(evento, pedido, columnaActual) {
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("texto/plain", pedido.id.toString());
    establecerPedidoArrastrado({ pedido, columnaActual });
  }

  function permitirSoltar(evento) {
    evento.preventDefault();
    evento.dataTransfer.dropEffect = "move";
  }

  function soltarPedido(evento, nuevaColumna) {
    evento.preventDefault();

    if (!pedidoArrastrado || pedidoArrastrado.columnaActual === nuevaColumna) {
      establecerPedidoArrastrado(null);
      return;
    }

    const pedidoActualizado = cambiarEstadoPedido(
      pedidoArrastrado.pedido,
      nuevaColumna,
    );

    establecerPedidos((pedidosActuales) => ({
      ...pedidosActuales,
      [pedidoArrastrado.columnaActual]: pedidosActuales[
        pedidoArrastrado.columnaActual
      ].filter((pedido) => pedido.id !== pedidoArrastrado.pedido.id),
      [nuevaColumna]: [...pedidosActuales[nuevaColumna], pedidoActualizado],
    }));
    establecerPedidoArrastrado(null);
  }

  function terminarArrastre() {
    establecerPedidoArrastrado(null);
  }

  return (
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
          <section
            className={`columna columna-${columna.color}`}
            key={columna.clave}
            onDragOver={permitirSoltar}
            onDrop={(evento) => soltarPedido(evento, columna.clave)}
          >
            <div className="encabezado-columna">
              <div className="titulo-columna">
                <div className="linea" />
                <h2>{columna.titulo}</h2>
                <div className="linea" />
              </div>
              {/* <span className="contador">{pedidos[columna.clave].length}</span> */}
            </div>

            <div className="lista-pedidos">
              {pedidos[columna.clave].map((pedido) => (
                <article
                  className="tarjeta-pedido"
                  draggable
                  key={pedido.id}
                  onDragStart={(evento) =>
                    iniciarArrastre(evento, pedido, columna.clave)
                  }
                  onDragEnd={terminarArrastre}
                >
                  <img
                    src={coffeeIcon}
                    className="icono-cafe"
                    aria-hidden="true"
                  />
                  <div className="informacion-pedido">
                    <h3>{pedido.nombre}</h3>
                    <p>Pedido #{pedido.id}</p>
                  </div>
                  <time>{pedido.hora}</time>
                </article>
              ))}

              {pedidos[columna.clave].length === 0 && (
                <p className="lista-vacia">No hay pedidos acá</p>
              )}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}

export default App;
