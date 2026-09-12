# Etapa 1: Build de los archivos estáticos de React con Vite
FROM node:22-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar el código fuente y compilar
COPY . .
RUN npm run build

# Etapa 2: Servidor web ultraliviano Nginx para servir los archivos
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Limpiar archivos por defecto de Nginx
RUN rm -rf ./*

# Copiar el build compilado desde la etapa anterior
COPY --from=builder /app/dist .

# Puerto HTTP estándar
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
