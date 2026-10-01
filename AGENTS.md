# AGENTS.md — administrator-ciisic-frontend (panel del congreso)

Guía para agentes de IA y desarrolladores que trabajen en este repositorio.

## Qué es

Panel del Congreso CIISIC (UNDC) con **dos perfiles**:
- **Staff**: Owner, Administrador del sistema (ambos con todos los eventos), Tesorero y Comisión
  tecnológica (solo sus eventos). Cada cuenta ve las pantallas y botones que sus **permisos**
  permiten: resumen, inscripciones, asistencia, ponencias, mensajes, eventos, tipos de inscripción,
  consultas DNI, participantes, correo, equipo y administradores, y sistema (solo Owner). Tabla
  de permisos por pantalla y por rol en [`docs/overview.md`](docs/overview.md).
- **Portal del inscrito**: "Mis inscripciones" (estado, motivo de rechazo, credencial PDF).

Todo el dato vive en backend-ciisic; el panel es una SPA con un BFF Nitro. Documentación:
[`docs/`](docs/README.md).

## Entorno y comandos

- Nuxt 4 SPA (`ssr: false`) + servidor Nitro (BFF), **Tailwind v4 vía `@tailwindcss/vite`**
  (nunca `@nuxtjs/tailwindcss`), Pinia, `@nuxt/icon` (heroicons), chart.js, Vitest. Gestor: **bun**.
- Única variable (runtime, servidor): `NUXT_BACKEND_BASE_URL` (ver [`.env.example`](.env.example)).
  El client ID de Google y la vida de la sesión vienen del backend.
- Comandos:

  | Tarea | Comando |
  |---|---|
  | Desarrollo (puerto 3001) | `bun run dev` |
  | Lint · tipos · pruebas | `bun run lint` · `bun run typecheck` · `bun run test` |
  | Build · vista previa | `bun run build` · `bun run preview` |

- Necesitas backend-ciisic en `http://localhost:3010` con un administrador (bootstrap) y, para
  Google, el client ID guardado en Sistema con `http://localhost:3001` autorizado en Google Cloud.

## Arquitectura

- `server/utils/session.ts`: cookie httpOnly `ciisic_admin_session` (SameSite Strict, Secure en
  producción) con el JWT del backend; su vida = la del JWT (`vida-sesion.ts`).
- `server/utils/proxy.ts`: proxy autenticado reutilizado por:
  - `server/api/backend/[...path].ts` → `/api/v1/*`, solo perfil **ADMIN**;
  - `server/api/portal/[...path].ts` → `/api/v1/me/*`, solo perfil **PARTICIPANTE**;
  el otro perfil recibe `403 FORBIDDEN_PROFILE`. Valida `Origin` en mutaciones, no reenvía
  `Origin`/`Referer`/cookies del navegador y cierra la sesión si el backend responde 401.
- `server/utils/jwt-publico.ts`: lee la audiencia del JWT **solo para enrutar** (el backend verifica).
- `server/api/auth/*`: `login.post` (contraseña), `google.get` (client ID + nonce en cookie
  httpOnly), `google.post` (canjea el ID token en `/v1/auth/google`), `session.get`, `logout.post`.
- `server/utils/renovar-sesion.ts`: si al JWT del staff le quedan < 20 min, el BFF lo renueva con
  `POST /v1/auth/refresh` (proxy y `session.get`); el backend corta la sesión a las 12 h.
- `app/stores/auth.ts` (sesión `{ tipo, usuario | participante }`, `acceso` y `puede(permiso)`),
  `app/middleware/auth.global.ts` + `app/utils/sesion.ts` (redirecciones por perfil y por `permiso`)
  y `app/utils/permisos.ts` (catálogo, menú, `inicioPara`; único lugar con códigos de rol).
- `app/composables/useApi.ts` (staff: 401 → login con motivo; 403 `FORBIDDEN`/`EVENT_NOT_ASSIGNED`
  → relee el acceso y los eventos) y `usePortal.ts` (inscrito); `app/utils/errores.ts` traduce los
  `code` del backend.
- Layouts: `default` (menú lateral contraíble con la hamburguesa —preferencia en `localStorage`—,
  selector de evento y menú de usuario `MenuUsuario`) y `participante` (sin menú lateral, mismo
  menú de usuario).

## Convenciones de código

- TypeScript; lógica en funciones puras de `app/utils` y `server/utils` con pruebas Vitest.
- Componentes base propios en `app/components/ui` (Button, Input, Select, Modal, Drawer, Table,
  Badge, Tabs, Toast, Confirm); marca navy/cyan, Barlow/Poppins; accesibilidad (labels, foco, aria).
- Copias de datos reactivos con `clonarLista` (`app/utils/clonar.ts`), nunca `structuredClone`
  sobre proxies de Vue.
- Fechas con `app/utils/formato.ts` y `whitespace-nowrap` en tablas.
- Textos en español; errores por código.

## Reglas de negocio clave (no romper)

- Páginas de administración: sesión de staff y el permiso de la página
  (`definePageMeta({ permiso: '…' })`, mismo permiso que su ítem en `MENU` de `app/utils/permisos.ts`).
  Menús y botones se deciden con `auth.puede(permiso)`, **nunca** con el código del rol (Owner =
  `SUPERADMIN`, Administrador del sistema = `ADMIN`, Tesorero y Comisión con alcance por evento).
  Sin `pagos.ver` los montos llegan en `null` (`soles()` muestra «—»).
- Portal: solo `/mis-inscripciones` y `/api/portal/**` para el perfil PARTICIPANTE.
- Secretos (API keys, tokens) son de solo escritura: se muestran enmascarados; el token de acceso
  de un evento se muestra una única vez y no se guarda en el navegador.
- Rechazar exige motivo; aprobar genera la credencial y el correo (si el correo falla, se ofrece
  reenviar).

## Seguridad

- El JWT nunca llega a JavaScript del navegador (cookie httpOnly); no usar localStorage para sesiones.
- El login con Google exige el `nonce` emitido por este servidor (cookie httpOnly de un solo uso).
- No agregar variables `NUXT_PUBLIC_*` con configuración del backend: se lee del backend.

## Ecosistema y comunicación entre sistemas

Contratos: `backend-ciisic/docs/arquitectura-ecosistema.md`. Este panel es el consumidor del
**contrato 4** (API administrativa) y del **contrato 5** (Google y portal). **No expone API**
propia: su BFF solo reenvía a backend-ciisic.

| Sistema | Repositorio | Relación |
|---|---|---|
| API del congreso | `gians96/backend-ciisic` | Proveedor único (vía BFF) |
| Landing del evento | `gians96/ciisic-undc-web` | Usa el token de acceso que se genera aquí (Eventos → Acceso); su `/login` y "Mis inscripciones" llegan aquí |
| API_UNDC / SIGENET | otros repos | La API key de API_UNDC se crea en SIGENET y se registra aquí (Sistema) |
| deportes-fi | otros repos | El token por evento se genera en deportes-fi y se registra aquí (Eventos → Integraciones) |

Puertos locales: landing 3000 · panel 3001 · backend-ciisic 3010 · API_UNDC 3020 · deportes-fi 3030.

**Protocolo de cambio de contrato**: el cambio empieza en backend-ciisic (spec + `contracts/` +
`docs/arquitectura-ecosistema.md`); el panel se adapta en su rama; prueba integrada local.

**Trabajo con agentes (varias sesiones en paralelo)**:
- Un agente por repositorio a la vez. Al empezar: `git status` y `git log --oneline -10`; si hay
  cambios sin comitear que no son tuyos, detente y coordina (ya ocurrió: dos sesiones editando
  este repo a la vez).
- No modifiques el backend ni la landing desde aquí.
- Git: ramas `feat/*` (roles y permisos: `feat/roles-permisos`); `git add <rutas explícitas>`;
  commits convencionales en español; sin push, merge ni despliegues sin confirmación humana.
- Al terminar, reporta commits, pruebas y pendientes.

## SDD con Spec Kit

Constitución: [`.specify/memory/constitution.md`](.specify/memory/constitution.md). Specs 001–008
en `specs/` (base, inscripciones, eventos y tipos, consultas DNI, resumen/Semana Sistémica,
correo y tokens de acceso, sistema/Google/portal, roles y permisos). Flujo: spec → plan → tasks;
marcar tasks. Contrato de roles y permisos: `backend-ciisic/specs/013-roles-permisos/contracts/`.

## Antes de dar por terminado

1. `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
2. Probar en el navegador contra el backend local la pantalla afectada, con el perfil que
   corresponda y con una cuenta de cada rol que la use (Owner, Administrador, Tesorero, Comisión).
3. Mensajes para códigos de error nuevos en `app/utils/errores.ts`.
4. Documentación de `docs/` al día.
