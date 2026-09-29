# Panel administrativo CIISIC

Panel del Congreso Internacional de Ingeniería de Sistemas e Investigación Científica
(UNDC) para gestionar **eventos**, **inscripciones** (revisión de vouchers, aprobación y
credenciales), **tipos de inscripción**, **asistencia**, **consultas DNI** (pool de tokens
Decolecta/apiperu), **ponencias**, **mensajes**, **participantes**, **administradores** y la
**integración con deportes-fi** (resumen de la Semana Sistémica).

- **Stack**: Nuxt 4 (SPA + Nitro como BFF) · Vue 3 · Pinia · Tailwind CSS v4 con
  `@tailwindcss/vite` (sin `@nuxtjs/tailwindcss`) · Chart.js · TypeScript · bun
- **API**: [`backend-ciisic`](https://github.com/gians96/backend-ciisic) — contratos en
  `specs/*/contracts` y `docs/arquitectura-ecosistema.md` de ese repositorio.
- **SDD**: constitución en [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
  y especificaciones en [`specs/`](specs).

## Desarrollo

```bash
cp .env.example .env     # NUXT_BACKEND_BASE_URL=http://localhost:3010
bun install
bun run dev              # http://localhost:3001
```

Calidad: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`.

## Seguridad

- El JWT del backend se guarda en la cookie httpOnly `ciisic_admin_session`
  (`SameSite=Strict`); el navegador nunca lo ve.
- Todas las llamadas pasan por `/api/backend/**` (proxy Nitro) que agrega el Bearer y
  valida el `Origin` en mutaciones.
- Los tokens de proveedores e integraciones se envían una sola vez y el backend los guarda
  cifrados; el panel solo muestra `••••` + últimos 4 caracteres.

## Despliegue

Imagen Docker (`Dockerfile`): Node 22 Alpine sirviendo `.output/server/index.mjs` en el
puerto 3000. Variables: `NUXT_BACKEND_BASE_URL` (URL interna del backend),
`NUXT_SESSION_MAX_AGE` (3600) y `NUXT_PUBLIC_LANDING_URL`. Servir detrás de HTTPS
(la cookie es `Secure`).
