# ===== Dependencias (npm) =====
# Se instalan con npm y no con Bun: el servidor de Dokploy tiene una CPU sin SSE4.2 y Bun no arranca ahí
# (`this CPU is missing SSE4.2 support`). package-lock.json se genera desde bun.lock sin cambiar ninguna
# versión (`bun run lock:npm`), así que la imagen instala lo mismo que se desarrolla con bun.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ===== Build (Node) =====
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx nuxi prepare && npx nuxi build

# ===== Producción =====
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nuxt -u 1001
COPY --from=build --chown=nuxt:nodejs /app/.output ./.output
USER nuxt
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/login', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
