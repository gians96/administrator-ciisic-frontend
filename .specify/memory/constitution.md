# Constitución de administrator-ciisic-frontend

Panel administrativo del congreso CIISIC (UNDC). Consume exclusivamente la API
administrativa de `backend-ciisic`; los contratos viven en
`backend-ciisic/specs/*/contracts` y `backend-ciisic/docs/arquitectura-ecosistema.md`.

## Principios

### I. El JWT nunca llega al navegador (NO NEGOCIABLE)
El servidor Nitro actúa como BFF: guarda el JWT del backend (de administrador o de inscrito)
en la cookie httpOnly `ciisic_admin_session` (`SameSite=Strict`, `Secure` en producción, con la
vida del JWT) y reenvía las llamadas por `/api/backend/**` y `/api/portal/**` agregando
`Authorization: Bearer`. Las mutaciones validan el encabezado `Origin`. El nonce del inicio de
sesión con Google también vive en una cookie httpOnly y es de un solo uso. Ningún secreto
(tokens DNI, tokens de integraciones, API keys) se muestra completo: el backend devuelve solo su
sufijo.

### II. Tailwind oficial, sin el módulo de Nuxt
Tailwind CSS v4 se integra con `@tailwindcss/vite` en `vite.plugins` y
`@import "tailwindcss"` + `@theme` en `app/assets/css/main.css`. **Prohibido
`@nuxtjs/tailwindcss`.** Los colores y tipografías de marca (azul marino + cian, Barlow y
Poppins) se definen como tokens en `@theme`.

### III. Multi-evento
Toda pantalla de operación trabaja sobre el evento seleccionado en la barra superior
(`useEventoStore`). No hay ids ni textos de una edición embebidos.

### IV. Accesibilidad y claridad
Etiquetas asociadas a cada control, foco visible, diálogos con `<dialog>` nativo (Esc y
foco atrapado), textos en español y mensajes de error del backend mostrados al usuario.
Acciones destructivas siempre con confirmación.

### V. Calidad
`bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde antes de
cada commit. Las utilidades puras (formato, errores, filtros, sesión) tienen pruebas Vitest.

### VI. Dos perfiles: administrador e inscrito
El panel atiende a dos perfiles, separados por la audiencia del JWT (`ciisic-admin` y
`ciisic-participante`). El administrador usa las pantallas de operación según su rol
(`soloSuperAdmin` para las de SuperAdmin). El inscrito entra solo con Google y únicamente llega
a las páginas con `perfil: 'participante'` (`/mis-inscripciones`) y a `/api/portal/**`, que el
BFF reenvía a `/api/v1/me/**`. El middleware y el BFF aplican la separación (`/api/backend/**`
rechaza sesiones de inscrito con 403 `FORBIDDEN_PROFILE`); el BFF lee `aud` sin verificar solo
para enrutar y el backend es la autoridad.

## Configuración

La única variable de entorno es `NUXT_BACKEND_BASE_URL`. La sesión dura lo que el JWT
(`expiraEn`); el client ID de Google, la conexión con API_UNDC, la URL del panel y las rutas de
la landing anterior se configuran en el backend desde la página Sistema (SuperAdmin).

## Stack

Nuxt 4 (SPA, `ssr: false`) + Nitro, Vue 3, Pinia, `@nuxt/icon` (heroicons), Chart.js
(`vue-chartjs`), Tailwind CSS v4, TypeScript estricto, ESLint (`@nuxt/eslint`), Vitest.
Gestor de paquetes: bun.

## Estructura

```
app/assets/css/main.css      tema Tailwind v4
app/components/ui/           botones, campos, modales, badges, tablas, toasts…
app/components/{layout,eventos,inscripciones,dashboard,charts,auth}/
app/composables/             useApi (BFF), usePortal (portal del inscrito), useToast, useConfirm
app/stores/                  auth (sesión por perfil), evento seleccionado
app/layouts/                 default (administración), participante (portal), blank (login)
app/pages/                   resumen, inscripciones, asistencia, eventos, tipos,
                             consultas, ponencias, mensajes, participantes, administradores,
                             correo, sistema, mis-inscripciones
server/api/auth/             login / google / session / logout (cookie httpOnly)
server/api/backend/[...path] proxy autenticado a backend-ciisic (administradores)
server/api/portal/[...path]  proxy del portal del inscrito (→ /api/v1/me)
specs/                       SDD (Spec Kit)
```

## Flujo de trabajo

Spec Kit: `specs/NNN-nombre/{spec,plan,tasks}.md`; ramas `feat/*`; commits
convencionales en español.

**Versión**: 1.1.0 | **Ratificada**: 2026-09-29 | **Última enmienda**: 2026-09-29
