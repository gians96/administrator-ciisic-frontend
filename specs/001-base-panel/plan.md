# Implementation Plan: Base del panel

## Arquitectura

```
Navegador (SPA Vue) ──$fetch──► Nitro (mismo origen)
   /api/auth/login|session|logout  → backend /api/v1/auth/*   (setea/borra cookie httpOnly)
   /api/backend/<ruta>             → backend /api/v1/<ruta>   (proxyRequest + Bearer)
```

- `server/utils/session.ts`: cookie, URL del backend y verificación de `Origin`.
- `server/api/backend/[...path].ts`: `proxyRequest` (transmite multipart y archivos: voucher,
  credencial PDF, CSV) sin cargarlos en memoria.
- `app/middleware/auth.global.ts`: carga la sesión una vez y protege todas las páginas;
  `definePageMeta({ soloSuperAdmin: true })` para páginas de SuperAdmin.
- `app/composables/useApi.ts`: cliente del BFF; ante 401 redirige al login con `redirect`.
- `app/stores/{auth,evento}.ts`: sesión y evento seleccionado.

## Tema

`app/assets/css/main.css`: `@import "tailwindcss"`, `@theme` con `--color-navy-*`,
`--color-brand-*` (cian #00d9e8), fuentes Barlow/Poppins; clases `card`, `field-control`,
`field-label`, `kicker`, `table-base`.

## Decisiones

- **SPA** (`ssr: false`): no hay datos públicos que indexar y simplifica la sesión.
- **Componentes sin librería UI**: menos dependencias; `<dialog>` nativo aporta accesibilidad.
- **vue-router** lo aporta Nuxt (v5); no se fija versión propia.
