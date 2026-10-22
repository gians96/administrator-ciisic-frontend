# ===== Dependencias (bun) =====
# Mismo método que la landing (ciisic-undc-web): el binario de Bun de una versión FIJA copiado a node:22-slim.
# Con la etiqueta móvil `oven/bun:1` la instalación falló en Dokploy ("this CPU is missing SSE4.2 support", código
# 134); la landing, con este binario fijado, se construye sin problema en el mismo servidor. Misma versión que la
# landing: no la cambies sin probar el despliegue en Dokploy.
FROM node:22-slim AS deps
WORKDIR /app
COPY --from=oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

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
