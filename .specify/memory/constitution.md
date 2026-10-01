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

### VI. Dos perfiles por audiencia; dentro del staff, roles y permisos por página
El panel atiende a dos perfiles, separados por la audiencia del JWT (`ciisic-admin` y
`ciisic-participante`). El inscrito entra solo con Google y únicamente llega a las páginas con
`perfil: 'participante'` (`/mis-inscripciones`) y a `/api/portal/**`, que el BFF reenvía a
`/api/v1/me/**`. El middleware y el BFF aplican la separación (`/api/backend/**` rechaza sesiones
de inscrito con 403 `FORBIDDEN_PROFILE`); el BFF lee `aud` sin verificar solo para enrutar.

Dentro del staff hay roles (Owner, Administrador del sistema, Tesorero, Comisión tecnológica) y
el panel decide **por permisos**, nunca por el código del rol: cada página de staff declara el
suyo con `definePageMeta({ permiso })` (el mismo que su ítem del menú) y los menús y botones usan
`auth.puede(permiso)` con el `acceso` (permisos y eventos) que el backend envía en la sesión. Los
códigos de rol solo aparecen en `app/utils/permisos.ts` (nombres visibles y tono). El BFF renueva
el JWT del staff antes de que caduque. **El backend es la autoridad**: lee la cuenta en cada
petición y responde 403 a lo que no corresponde; el panel solo evita ofrecerlo.

## Configuración

La única variable de entorno es `NUXT_BACKEND_BASE_URL`. La cookie dura lo que el JWT
(`expiraEn`); el del staff se renueva y el backend corta la sesión a las 12 h. El client ID de Google, la conexión con API_UNDC, la URL del panel y las rutas de
la landing anterior se configuran en el backend desde la página Sistema (Owner,
`sistema.configurar`).

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
app/stores/                  auth (sesión por perfil, acceso y permisos), evento seleccionado
app/layouts/                 default (administración), participante (portal), blank (login)
app/pages/                   resumen, inscripciones, asistencia, eventos, tipos,
                             consultas, ponencias, mensajes, participantes, administradores,
                             correo, sistema, sin-acceso, mis-inscripciones
app/utils/permisos.ts        catálogo de permisos, menú, inicio por cuenta, etiquetas de rol
server/api/auth/             login / google / session / logout (cookie httpOnly)
server/api/backend/[...path] proxy autenticado a backend-ciisic (staff; renueva el JWT)
server/api/portal/[...path]  proxy del portal del inscrito (→ /api/v1/me)
specs/                       SDD (Spec Kit)
```

## Flujo de trabajo

Spec Kit: `specs/NNN-nombre/{spec,plan,tasks}.md`; ramas `feat/*`; commits
convencionales en español.

## Gobernanza

Esta constitución prevalece sobre prácticas ad-hoc. Enmiendas: se documentan en este archivo con
fecha y motivo, y se revisan en el PR correspondiente.

**Versión**: 1.2.0 | **Ratificada**: 2026-09-29 | **Última enmienda**: 2026-10-01

- 1.2.0 (2026-10-01): principio VI, dos perfiles por audiencia y, dentro del staff, roles y
  permisos declarados por página con la meta `permiso` (reemplaza `soloSuperAdmin`); menús y
  botones con `puede(permiso)`; renovación del JWT del staff en el BFF; el backend es la autoridad.
  Motivo: roles Owner, Administrador del sistema, Tesorero y Comisión tecnológica con alcance por
  evento (backend-ciisic spec 013, panel spec 008).
- 1.1.0 (2026-09-29): dos perfiles (administrador e inscrito) separados por la audiencia del JWT;
  la única variable de entorno es `NUXT_BACKEND_BASE_URL` (spec 007).
