# Constitución de administrator-ciisic-frontend

Panel administrativo del congreso CIISIC (UNDC). Consume exclusivamente la API
administrativa de `backend-ciisic`; los contratos viven en
`backend-ciisic/specs/*/contracts` y `backend-ciisic/docs/arquitectura-ecosistema.md`.

## Principios

### I. El JWT nunca llega al navegador (NO NEGOCIABLE)
El servidor Nitro actúa como BFF: guarda el JWT del backend en la cookie httpOnly
`ciisic_admin_session` (`SameSite=Strict`, `Secure` en producción) y reenvía las llamadas
por `/api/backend/**` agregando `Authorization: Bearer`. Las mutaciones validan el
encabezado `Origin`. Ningún secreto (tokens DNI, tokens de integraciones) se muestra
completo: el backend devuelve solo su sufijo.

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
cada commit. Las utilidades puras (formato, errores, filtros) tienen pruebas Vitest.

## Stack

Nuxt 4 (SPA, `ssr: false`) + Nitro, Vue 3, Pinia, `@nuxt/icon` (heroicons), Chart.js
(`vue-chartjs`), Tailwind CSS v4, TypeScript estricto, ESLint (`@nuxt/eslint`), Vitest.
Gestor de paquetes: bun.

## Estructura

```
app/assets/css/main.css      tema Tailwind v4
app/components/ui/           botones, campos, modales, badges, tablas, toasts…
app/components/{layout,eventos,inscripciones,dashboard,charts}/
app/composables/             useApi (BFF), useToast, useConfirm
app/stores/                  auth, evento seleccionado
app/pages/                   resumen, inscripciones, asistencia, eventos, tipos,
                             consultas, ponencias, mensajes, participantes, administradores
server/api/auth/             login / session / logout (cookie httpOnly)
server/api/backend/[...path] proxy autenticado a backend-ciisic
specs/                       SDD (Spec Kit)
```

## Flujo de trabajo

Spec Kit: `specs/NNN-nombre/{spec,plan,tasks}.md`; ramas `feat/*`; commits
convencionales en español.

**Versión**: 1.0.0 | **Ratificada**: 2026-09-29 | **Última enmienda**: 2026-09-29
