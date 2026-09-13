# CoffeeQueue

[![CI/CD Pipeline](https://github.com/tomas-lp/devops-2026-tp1/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/tomas-lp/devops-2026-tp1/actions/workflows/ci-cd.yml)
[![CodeQL SAST Security Analysis](https://github.com/tomas-lp/devops-2026-tp1/actions/workflows/codeql.yml/badge.svg)](https://github.com/tomas-lp/devops-2026-tp1/actions/workflows/codeql.yml)

Gestión simple de pedidos de cafetería: **Frontend React → API REST Express → Redis**.
No incluye usuarios, login, pagos, stock ni administración de productos.

## Despliegue en la Nube

- **Aplicación (Nginx Gateway / Reverse Proxy)**: [https://coffeequeue-nginx-latest.onrender.com](https://coffeequeue-nginx-latest.onrender.com)
- **Frontend**: [https://coffeequeue-front-latest.onrender.com](https://coffeequeue-front-latest.onrender.com)
- **API REST**: [https://coffeequeue-api-latest.onrender.com](https://coffeequeue-api-latest.onrender.com)


## Organización

```text
.github/workflows/
  ci-cd.yml              CI/CD: tests, build/push a GHCR y deploy automático
  codeql.yml             SAST: análisis estático de seguridad con CodeQL
docker-compose.yml       Stack completo local: nginx, front, api, redis
nginx/
  nginx.conf             Reverse proxy local (Docker Compose)
  nginx.cloud.conf       Reverse proxy en la nube (Render)
  Dockerfile             Imagen para el servicio Nginx en la nube
front/                    React 19 + Vite; tablero existente
  src/App.jsx             Interacción, carga y mensajes de error
  src/data.js             fetch y adaptación de pedidos para las tarjetas
  nginx.conf             Servidor Nginx para archivos estáticos de React
  Dockerfile              Multi-stage: build Vite + nginx estático
api/
  src/config/redis.js      Conexión mediante variables de entorno
  src/routes/             Endpoints
  src/controllers/        Entrada HTTP y respuestas
  src/services/           Operaciones sobre Redis
  src/validation.js       Validación de entradas
  src/app.js              Express y manejo de errores
  src/server.js           Inicio y cierre del servidor
  test/                   Pruebas con node:test
  Dockerfile
  .env.example
```

El frontend original sólo tenía datos en memoria (`id`, `nombre`, `hora`, `estado`) y
tres columnas. Ahora `data.js` adapta el contrato REST a esas mismas tarjetas:
`items` → `nombre`, `createdAt` → `hora` y estados en inglés → columnas en español.
No contiene cliente Redis ni credenciales de Redis.

## Ejecutar en desarrollo

Requisitos: Node.js 22.13 o posterior, npm y un servidor Redis accesible.
Los comandos siguientes usan PowerShell, desde la raíz del repositorio.

```powershell
cd api
npm ci
Copy-Item .env.example .env
# Si Redis corre en tu máquina, editar .env: REDIS_HOST=127.0.0.1
npm run dev
```

La API escucha en `0.0.0.0:3000` después de conectarse a Redis.
Configuración de `api/.env`:

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `REDIS_HOST` | `redis` | Nombre del servicio en Docker o dirección real de Redis |
| `REDIS_PORT` | `6379` | Puerto de Redis |
| `REDIS_DB` | `0` | Base lógica de la aplicación |
| `PORT` | `3000` | Puerto HTTP de la API |

En otra terminal:

```powershell
cd front
npm ci
Copy-Item .env.example .env
npm run dev
```

Abrir la URL que indica Vite. El navegador usa `/api`; el proxy de Vite reenvía a
`API_PROXY_TARGET` (por defecto `http://127.0.0.1:3000`). Si Vite corre dentro de
Docker, configurar esa variable con el nombre del servicio API, por ejemplo
`http://api:3000`. No usar `redis` como destino HTTP.

`VITE_API_BASE_URL=/api` se incorpora al compilar el frontend. La configuración
prevista utiliza el mismo origen, por lo que no requiere CORS. En producción,
Nginx reverse proxy (`nginx/nginx.conf`) enruta `/` al frontend y `/api/` a la API.

## Contrato REST

Respuestas correctas: `{ "data": ... }`. Errores:
`{ "error": { "message": "Descripción" } }`.

| Método y ruta | Respuesta correcta |
| --- | --- |
| `GET /api/orders` | `200`, `data` es un array con todos los estados, incluidos entregados |
| `GET /api/orders/:id` | `200`, `data` es un pedido |
| `POST /api/orders` | `201`, `data` es el pedido creado; cabecera `Location` |
| `PATCH /api/orders/:id/status` | `200`, `data` es el pedido actualizado |
| `DELETE /api/orders/:id` | `200`, `data` es `{ "id": 15 }` |

Se devuelve `400` para datos, JSON, ID o transición inválidos; `404` para pedidos
o rutas inexistentes; `500` para fallos internos (sin exponer detalles al cliente).
El cuerpo JSON admite hasta 100 KB. `customer` y `name` deben ser textos no vacíos;
`items`, un array no vacío; `quantity`, un entero positivo. Se recortan espacios
en nombres. El servidor genera `id`, `status` y `createdAt`, aunque el cliente los envíe.
Las fechas usan ISO 8601 en UTC; el frontend muestra la hora local.

Ejemplo de creación y avance (con la API ejecutándose):

```powershell
$body = @{ customer = 'Maia'; items = @(@{ name = 'Café'; quantity = 1 }, @{ name = 'Medialuna'; quantity = 2 }) } | ConvertTo-Json -Depth 4
$result = Invoke-RestMethod http://localhost:3000/api/orders -Method Post -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
$orderId = $result.data.id
Invoke-RestMethod "http://localhost:3000/api/orders/$orderId/status" -Method Patch -ContentType 'application/json' -Body '{"status":"preparing"}'
Invoke-RestMethod http://localhost:3000/api/orders
Invoke-RestMethod "http://localhost:3000/api/orders/$orderId" -Method Delete
```

## Redis y flujo de estados

- `INCR orders:next-id` genera IDs. Puede haber saltos si una creación falla después del incremento.
- Cada pedido se guarda en el HASH `order:<id>` con `id`, `customer`, `items`, `status`, `createdAt`.
- Sólo `items` se serializa como JSON dentro del HASH.
- Las listas son `orders:received`, `orders:preparing`, `orders:ready`, `orders:delivered`.
- Crear usa `MULTI/EXEC` para `HSET` y `RPUSH` juntos.
- Cambiar de estado valida y ejecuta `LREM`, `RPUSH`, `HSET` en un script Lua corto.
  Esto evita que dos solicitudes simultáneas validen el mismo estado anterior.
- Eliminar usa otro script para comprobar existencia, borrar el HASH y quitar todas
  sus referencias de las cuatro listas.
- El listado lee las listas y sus HASH, sin `KEYS *` ni un JSON global; conserva el
  orden de cada cola. No es una instantánea transaccional frente a cambios simultáneos.

Únicas transiciones: **received → preparing → ready → delivered**.
Repetir un estado, retroceder o saltear etapas devuelve `400`.
Los scripts están pensados para un único servidor Redis, como requiere este proyecto.
La persistencia de Redis en disco y sus volúmenes corresponden a la infraestructura.

## Uso del tablero

“Nuevo pedido” solicita cliente, producto y cantidad con diálogos nativos, y permite
agregar más ítems. Cancelar no crea nada. Arrastrar permite avanzar entre las tres
columnas; la API rechaza movimientos inválidos y se muestra el error.
“Entregar” en Listos avanza a `delivered` y quita la tarjeta del tablero activo.
El pedido sigue disponible mediante GET. La interfaz carga al abrir y actualiza
tras sus propias operaciones; para ver cambios de otra pantalla, recargar.
GET individual y DELETE están disponibles en la API; no se agregaron pantallas nuevas.

## Docker de la API

Desde la raíz:

```powershell
docker build -t coffeequeue-api ./api
# Con una red ya creada y un servidor Redis llamado redis en esa red:
docker run --rm --name coffeequeue-api --network <red-existente> -p 3000:3000 -e REDIS_HOST=redis coffeequeue-api
```

La imagen instala sólo dependencias de producción y corre con el usuario `node`.
El contenedor recibe variables por `-e` o `--env-file`; no copia archivos `.env`.

## Docker Compose (stack completo)

Levantar el stack completo con reverse proxy y réplicas:

```bash
docker compose up --build --scale front=3 --scale api=3
```

Verificar réplicas:

```bash
docker compose ps
```

Detener y limpiar:

```bash
docker compose down
```

La arquitectura queda:

```
              NGINX (:80)
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Front (×3)         API (×3)
   :80                :3000
                         │
                    Redis (:6379)
```

- Solo Nginx expone el puerto 80 al host
- Front, API y Redis son internos a la red Docker
- Redis no es accesible desde fuera

## Demo: Tolerancia a fallos

```bash
# Ver 3 réplicas corriendo
docker compose ps

# Matar una réplica de la API
docker stop devops-api-1

# Verificar que el sistema sigue funcionando
curl http://localhost/api/orders

# Revivir la réplica
docker start devops-api-1

# Verificar que volvieron a ser 3
docker compose ps
```

## Verificación

```powershell
cd api
npm test
# Redis real, base lógica VACÍA y EXCLUSIVA de pruebas (no usar la de la aplicación):
$env:REDIS_HOST = '127.0.0.1'
$env:TEST_REDIS_DB = '15'
npm run test:integration
cd ../front
npm run lint
npm run build
```

Las pruebas de integración comprueban CRUD, HASH/listas, JSON inválido, errores,
transiciones, IDs simultáneos y carreras entre cambios de estado y eliminación.
Se niegan a usar una base con datos y limpian sus claves al terminar; no ejecutan FLUSHDB.

Referencias técnicas: [transacciones con node-redis](https://redis.io/docs/latest/develop/clients/nodejs/transpipe/)
y [manejo de errores de Express 5](https://expressjs.com/en/guide/error-handling/).

