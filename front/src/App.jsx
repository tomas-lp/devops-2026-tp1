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
  obtenerReplicaApi,
} from "./data";
import coffeeIcon from "./assets/coffee.svg";

const columnas = [
  { clave: "recibidos", titulo: "Recibidos", color: "amarillo" },
  { clave: "preparando", titulo: "Preparando", color: "azul" },
  { clave: "listos", titulo: "Listos", color: "verde" },
];

function obtenerReplicaInfo() {
  const raw = typeof window !== "undefined" ? window.REPLICA_ID : null;
  if (!raw || raw === "__SERVER_REPLICA_ID__") {
    return null;
  }
  const hash = raw
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  const numero = (hash % 900) + 100;
  return { raw, numero };
}

function App() {
  const [pedidos, establecerPedidos] = useState(obtenerPedidosIniciales);
  const [pedidoArrastrado, establecerPedidoArrastrado] = useState(null);
  const [error, establecerError] = useState("");
  const [ocupado, establecerOcupado] = useState(true);
  const [mostrarFormulario, establecerMostrarFormulario] = useState(false);
  const [replicaApiInfo, establecerReplicaApiInfo] = useState(null);
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

    obtenerReplicaApi()
      .then((datos) => {
        if (activo) establecerReplicaApiInfo(datos);
      })
      .catch((err) => console.error("Error al obtener réplica de API:", err));

    return () => {
      activo = false;
    };
  }, []);

  function abrirFormulario() {
    if (ocupado || operacionEnCurso.current) return;
    establecerError("");
    establecerMostrarFormulario(true);
  }

  function cerrarFormulario() {
    if (operacionEnCurso.current) return;
    establecerMostrarFormulario(false);
  }

  async function guardarPedido(cliente, productos) {
    if (ocupado || operacionEnCurso.current) return;

    operacionEnCurso.current = true;
    establecerOcupado(true);
    establecerError("");

    try {
      const nuevoPedido = await crearPedido(cliente, productos);
      establecerPedidos((actuales) => ({
        ...actuales,
        recibidos: [...actuales.recibidos, nuevoPedido],
      }));
      establecerMostrarFormulario(false);
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

  const replicaInfo = obtenerReplicaInfo();

  return (
    <DragDropProvider
      onDragStart={iniciarArrastre}
      onDragEnd={terminarArrastre}
    >
      <main className="aplicacion">
        <header className="encabezado">
          <div className="encabezado-titulo">
            <h1>coffee.dev</h1>
          </div>
          <button
            className="boton-nuevo"
            type="button"
            onClick={abrirFormulario}
            disabled={ocupado}
          >
            <span aria-hidden="true">+</span>
            Nuevo pedido
          </button>
        </header>

        {mostrarFormulario && (
          <FormularioPedido
            enCurso={ocupado}
            onCancelar={cerrarFormulario}
            onGuardar={guardarPedido}
          />
        )}

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
        {error && (
          <div className="card-error">
            <p role="alert">{error}</p>
          </div>
        )}
      </main>

      <div className="badge">
        <span
          className="badge-replica"
          title={replicaInfo ? `Host: ${replicaInfo.raw}` : undefined}
        >
          Front: {replicaInfo ? `#${replicaInfo.numero}` : "###"}
        </span>
        <span
          className="badge-replica"
          title={replicaApiInfo ? `Host: ${replicaApiInfo.hostname}` : undefined}
        >
          API: {replicaApiInfo ? `#${replicaApiInfo.numero}` : "###"}
        </span>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {pedidoArrastrado && (
          <TarjetaPedidoVisual esOverlay pedido={pedidoArrastrado.pedido} />
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}

function FormularioPedido({ enCurso, onCancelar, onGuardar }) {
  const [cliente, establecerCliente] = useState("");
  const [productos, establecerProductos] = useState([
    { nombre: "", cantidad: 1 },
  ]);
  const [errorLocal, establecerErrorLocal] = useState("");

  useEffect(() => {
    function manejarTecla(evento) {
      if (evento.key === "Escape") onCancelar();
    }

    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [onCancelar]);

  function actualizarProducto(indice, campo, valor) {
    establecerProductos((actuales) =>
      actuales.map((producto, posicion) =>
        posicion === indice ? { ...producto, [campo]: valor } : producto,
      ),
    );
  }

  function agregarProducto() {
    establecerProductos((actuales) => [
      ...actuales,
      { nombre: "", cantidad: 1 },
    ]);
  }

  function quitarProducto(indice) {
    establecerProductos((actuales) =>
      actuales.length <= 1
        ? actuales
        : actuales.filter((_, posicion) => posicion !== indice),
    );
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    const clienteLimpio = cliente.trim();
    const items = productos
      .map((producto) => ({
        name: producto.nombre.trim(),
        quantity: Number(producto.cantidad),
      }))
      .filter((item) => item.name !== "");

    if (!clienteLimpio) {
      establecerErrorLocal("Ingresá el nombre del cliente.");
      return;
    }

    if (items.length === 0) {
      establecerErrorLocal("Agregá al menos un producto con nombre.");
      return;
    }

    if (
      items.some((item) => !Number.isFinite(item.quantity) || item.quantity < 1)
    ) {
      establecerErrorLocal("La cantidad debe ser un número mayor o igual a 1.");
      return;
    }

    establecerErrorLocal("");
    await onGuardar(clienteLimpio, items);
  }

  return (
    <div className="fondo-popup" onClick={onCancelar}>
      <div
        className="popup"
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo pedido"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="encabezado-popup">
          <div className="titulo-popup">
            <div className="linea" />
            <h2>Nuevo pedido</h2>
            <div className="linea" />
          </div>
        </div>

        <form className="formulario-pedido" onSubmit={manejarEnvio}>
          <label className="campo">
            <span>Cliente</span>
            <input
              autoFocus
              disabled={enCurso}
              name="cliente"
              onChange={(evento) => establecerCliente(evento.target.value)}
              placeholder="Nombre del cliente"
              type="text"
              value={cliente}
            />
          </label>

          <div className="productos-encabezado">
            <span>Productos</span>
            <button
              className="boton-secundario"
              type="button"
              onClick={agregarProducto}
              disabled={enCurso}
            >
              <span aria-hidden="true">+</span>
              Agregar
            </button>
          </div>

          <div className="lista-productos">
            {productos.map((producto, indice) => (
              <div className="fila-producto" key={indice}>
                <label className="campo campo-producto">
                  <span className="solo-lectores">Producto {indice + 1}</span>
                  <input
                    disabled={enCurso}
                    onChange={(evento) =>
                      actualizarProducto(indice, "nombre", evento.target.value)
                    }
                    placeholder={`Producto ${indice + 1}`}
                    type="text"
                    value={producto.nombre}
                  />
                </label>
                <label className="campo campo-cantidad">
                  <span className="solo-lectores">Cantidad</span>
                  <input
                    disabled={enCurso}
                    min="1"
                    onChange={(evento) =>
                      actualizarProducto(
                        indice,
                        "cantidad",
                        evento.target.value,
                      )
                    }
                    step="1"
                    type="number"
                    value={producto.cantidad}
                  />
                </label>
                <button
                  className="boton-quitar"
                  type="button"
                  onClick={() => quitarProducto(indice)}
                  disabled={enCurso || productos.length <= 1}
                  aria-label={`Quitar producto ${indice + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {errorLocal && (
            <p className="error-formulario" role="alert">
              {errorLocal}
            </p>
          )}

          <div className="acciones-popup">
            <button
              className="boton-secundario"
              type="button"
              onClick={onCancelar}
              disabled={enCurso}
            >
              Cancelar
            </button>
            <button className="boton-primario" type="submit" disabled={enCurso}>
              Crear pedido
            </button>
          </div>
        </form>
      </div>
    </div>
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
