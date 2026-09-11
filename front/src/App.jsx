import "./App.css";
import { useEffect, useRef, useState } from "react";
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
      .then((datos) => { if (activo) establecerPedidos(datos); })
      .catch((error) => { if (activo) establecerError(error.message); })
      .finally(() => { if (activo) establecerOcupado(false); });
    return () => { activo = false; };
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
      establecerPedidos((actuales) => ({ ...actuales, recibidos: [...actuales.recibidos, nuevoPedido] }));
    } catch (error) {
      establecerError(error.message);
    } finally {
      operacionEnCurso.current = false;
      establecerOcupado(false);
    }
  }

  function iniciarArrastre(evento, pedido, columnaActual) {
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("text/plain", pedido.id.toString());
    establecerPedidoArrastrado({ pedido, columnaActual });
  }

  function permitirSoltar(evento) {
    evento.preventDefault();
    evento.dataTransfer.dropEffect = "move";
  }

  async function soltarPedido(evento, nuevaColumna) {
    evento.preventDefault();

    if (ocupado || !pedidoArrastrado || pedidoArrastrado.columnaActual === nuevaColumna) {
      establecerPedidoArrastrado(null);
      return;
    }

    const { pedido, columnaActual } = pedidoArrastrado;
    establecerPedidoArrastrado(null);
    await moverPedido(pedido, columnaActual, nuevaColumna);
  }

  async function moverPedido(pedido, columnaActual, nuevaColumna) {
    if (ocupado || operacionEnCurso.current) return;
    operacionEnCurso.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      const actualizado = await cambiarEstadoPedido(pedido, nuevaColumna);
      establecerPedidos((actuales) => {
        const siguientes = { ...actuales, [columnaActual]: actuales[columnaActual].filter((p) => p.id !== pedido.id) };
        if (siguientes[nuevaColumna]) siguientes[nuevaColumna] = [...siguientes[nuevaColumna], actualizado];
        return siguientes;
      });
    } catch (error) {
      establecerError(error.message);
      // Si otro cliente lo movió o eliminó, recuperar el estado del servidor.
      try { establecerPedidos(await obtenerPedidos()); } catch { /* Conservar el tablero y el error original. */ }
    } finally {
      operacionEnCurso.current = false;
      establecerOcupado(false);
    }
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
        <button className="boton-nuevo" type="button" onClick={agregarPedido} disabled={ocupado}>
          <span aria-hidden="true">+</span>
          Nuevo pedido
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {ocupado && <p role="status">Cargando…</p>}

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
                  draggable={!ocupado}
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
                    <p>{pedido.customer}</p>
                    {columna.clave === "listos" && (
                      <button type="button" disabled={ocupado} onClick={() => moverPedido(pedido, "listos", "entregados")}>
                        Entregar
                      </button>
                    )}
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
