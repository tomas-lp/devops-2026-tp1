FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV PORT=3000 REDIS_HOST=redis REDIS_PORT=6379
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
