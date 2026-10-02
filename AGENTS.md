# AGENTS.md — administrator-ciisic-frontend (panel del congreso)

Guía para agentes de IA y desarrolladores que trabajen en este repositorio.

## Qué es

Panel del Congreso CIISIC (UNDC) con **dos perfiles**:
- **Staff**: Owner, Administrador del sistema (ambos con todos los eventos), Tesorero y Comisión
  tecnológica (solo sus eventos). Cada cuenta ve las pantallas y botones que sus **permisos**
  permiten: resumen, inscripciones, asistencia, escáner de asistencia (QR del fotocheck, lector USB
  o DNI), ponencias, mensajes, eventos, tipos de inscripción, consultas DNI, participantes (con
  alta y cortesías), correo, equipo y administradores, y sistema (solo Owner). Tabla de permisos por
  pantalla y por rol en [`docs/overview.md`](docs/overview.md).
- **Portal del inscrito** (entra con Google o con un código a su correo): inscripciones (estado,
  motivo de rechazo, credencial PDF), fotocheck virtual con QR, asistencia, certificados (llegan con
  la spec 015 del backend) y perfil (celular y foto opcional). El staff inscrito con su mismo correo
  pasa a su portal desde el menú de su cuenta.

Todo el dato vive en backend-ciisic; el panel es una SPA con un BFF Nitro. Documentación:
[`docs/`](docs/README.md).

## Entorno y comandos

- Nuxt 4 SPA (`ssr: false`) + servidor Nitro (BFF), **Tailwind v4 vía `@tailwindcss/vite`**
  (nunca `@nuxtjs/tailwindcss`), Pinia, `@nuxt/icon` (heroicons), chart.js, `vue-qrcode-reader`
  (cámara del escáner, con el wasm de ZXing servido por el panel), Vitest. Gestor: **bun**.
- Única variable (runtime, servidor): `NUXT_BACKEND_BASE_URL` (ver [`.env.example`](.env.example)).
  El client ID de Google y la vida de la sesión vienen del backend.
- Comandos:

  | Tarea | Comando |
  |---|---|
  | Desarrollo (puerto 3001) | `bun run dev` |
  | Lint · tipos · pruebas | `bun run lint` · `bun run typecheck` · `bun run test` |
  | Build · vista previa | `bun run build` · `bun run preview` |
  | Copiar el wasm de ZXing del escáner a `public/zxing-wasm/<versión>/` (al actualizar `vue-qrcode-reader`) | `bun run escaner:wasm` |

- Necesitas backend-ciisic en `http://localhost:3010` con un administrador (bootstrap) y, para
  Google, el client ID guardado en Sistema con `http://localhost:3001` autorizado en Google Cloud.
  El código por correo, el fotocheck y el escáner con QR nuevo necesitan el backend con la spec 014
  (rama `feat/portal-fotocheck`) y una credencial de correo predeterminada activa (Correo); con el
  backend 013 el panel debe seguir funcionando (ver «Compatibilidad» abajo).

## Arquitectura

- `server/utils/session.ts`: cookie httpOnly `ciisic_admin_session` (SameSite Strict, Secure en
  producción) con el JWT del backend; su vida = la del JWT (`vida-sesion.ts`).
- `server/utils/proxy.ts`: proxy autenticado reutilizado por:
  - `server/api/backend/[...path].ts` → `/api/v1/*`, solo perfil **ADMIN**;
  - `server/api/portal/[...path].ts` (y `index.ts` para la raíz) → `/api/v1/me/*`, solo perfil
    **PARTICIPANTE**;
  el otro perfil recibe `403 FORBIDDEN_PROFILE`. Valida `Origin` en mutaciones, no reenvía
  `Origin`/`Referer`/cookies del navegador y cierra la sesión si el backend responde 401.
- `server/utils/jwt-publico.ts`: lee la audiencia del JWT **solo para enrutar** (el backend verifica).
- `server/api/auth/*`: `login.post` (contraseña), `google.get` (client ID + nonce en cookie
  httpOnly), `google.post` (canjea el ID token en `/v1/auth/google`), `config.get`
  (`accesoCodigo.disponible`), `codigo/index.post` y `codigo/verificar.post` (código por correo →
  sesión de participante), `portal.post` (el staff pasa a su portal), `session.get`, `logout.post`.
  Lógica pura en `server/utils/acceso-codigo.ts` y `respuestas-auth.ts` (`errorPropagado`: estado,
  `code`, `fields` y `Retry-After`; la ruta inexistente de un backend anterior → 503 con respaldo).
- `server/utils/ip-cliente.ts`: login, Google y código reenvían en `x-forwarded-for` la **última**
  entrada de `X-Forwarded-For` (la de Traefik) o la IP de la conexión, **nunca la primera**; una IPv4
  escrita como IPv6 (`::ffff:a.b.c.d`) va como IPv4. Supone un solo proxy delante (ver
  `docs/configuracion-y-despliegue.md` antes de agregar un CDN o balanceador).
- `server/utils/renovar-sesion.ts`: si al JWT del staff le quedan < 20 min, el BFF lo renueva con
  `POST /v1/auth/refresh` (proxy y `session.get`); el backend corta la sesión a las 12 h. La sesión
  del participante (12 h) no se renueva (`esRenovable`). Si la sesión se cerró o pasó al portal
  mientras una petición renovaba, esa respuesta no devuelve la cookie del staff
  (`descartarRenovacionSiSeCerro`).
- `app/stores/auth.ts` (sesión `{ tipo, usuario | participante }`, `acceso` y `puede(permiso)`),
  `app/middleware/auth.global.ts` + `app/utils/sesion.ts` (redirecciones por perfil y por `permiso`)
  y `app/utils/permisos.ts` (catálogo, menú, `inicioPara` —la cuenta que solo marca asistencia
  empieza en `/escanear`—; único lugar con códigos de rol).
- `app/composables/useApi.ts` (staff: 401 → login con motivo; 403 `FORBIDDEN`/`EVENT_NOT_ASSIGNED`
  → relee el acceso y los eventos) y `usePortal.ts` (inscrito: 401 → login con motivo y `redirect`;
  403 `FORBIDDEN_PROFILE` → relee la sesión y va a donde corresponda);
  `app/utils/errores.ts` traduce los `code` del backend.
- Portal y escáner: `app/utils/portal.ts` (`NAVEGACION_PORTAL`, `esNoDisponible`, tipos del portal),
  `app/utils/codigoAcceso.ts` + `components/auth/AccesoConCodigo.vue` (código por correo),
  `app/utils/lecturaQr.ts` (`interpretarLectura`, `debeProcesar`) y `app/utils/foto.ts` (foto del
  perfil recodificada con canvas).
- Layouts: `default` (menú lateral contraíble con la hamburguesa —preferencia en `localStorage`—,
  selector de evento y menú de usuario `MenuUsuario`, con «Mi portal de participante» si
  `acceso.perfilParticipante`), `escaner` (`/escanear` a pantalla completa: volver, selector de
  evento, actividad y menú de usuario) y `participante` (sin menú lateral: pestañas en escritorio y
  barra inferior en el celular desde `NAVEGACION_PORTAL`, mismo menú de usuario).

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
- Portal: solo las páginas con `definePageMeta({ layout: 'participante', perfil: 'participante' })`
  (las de `NAVEGACION_PORTAL`) y `/api/portal/**` para el perfil PARTICIPANTE. El código por correo
  **siempre** abre el portal, nunca el panel; el staff pasa a su portal en un solo sentido (para
  volver, ingresa de nuevo).
- Escáner: lo leído se limpia y se interpreta con `interpretarLectura` (10 letras o dígitos →
  `{ codigo }` en mayúsculas; solo dígitos → `{ participanteId }`, QR anterior); cualquier otra cosa
  es «QR no válido» y **no** se envía al backend. `alerta: 'QR_LEGADO'` → resultado ámbar «QR antiguo:
  verifica el DNI», que solo se cierra con «Continuar» (`esperaContinuar`). Las marcas van de una en
  una y en orden por `crearColaEnvios` (`app/utils/colaEnvios.ts`): ninguna lectura se pierde sin
  aviso (cola llena → «No procesada» en la lista). Con un error o el aviso del QR anterior a la vista
  la cámara se pausa (`pausaLaCamara`); al cerrar un error el mismo QR se puede volver a escanear
  (`recienteTrasCerrar`). «Fuera de horario» se desmarca al cambiar de actividad. El wasm de ZXing se
  configura una sola vez (`usarZxingDelPanel`) y se sirve con caché inmutable.
- Foto del perfil: recodificada con canvas (recorte cuadrado centrado, JPEG de 600 × 600 px, mínimo
  200 px) y con la casilla de consentimiento obligatoria; el multipart lleva solo `file` y
  `consentimiento=true`.
- Archivos del portal (credencial PDF, certificados): con `PortalBotonDescarga` / `usePortal().descargar`
  (`$fetch` en blob), nunca con un `<a href>` directo al BFF: así un error (`503 PDF_BUSY`, sesión
  vencida, `409 NOT_APPROVED`) se muestra con su mensaje en lugar del JSON del backend.
- **Compatibilidad**: este panel (spec 009) se despliega **antes** que el backend 014; producción
  tiene el 013. Lo nuevo degrada: sin `accesoCodigo.disponible` no se ofrece el código; una sección
  del portal que recibe 404 de ruta o 405 muestra «pronto disponible» (`esNoDisponible`, no los 404
  de negocio); el escáner sigue marcando con el QR anterior (`{ participanteId, metodo: 'QR' }`).
- Secretos (API keys, tokens) son de solo escritura: se muestran enmascarados; el token de acceso
  de un evento se muestra una única vez y no se guarda en el navegador.
- Rechazar exige motivo; aprobar genera la credencial y el correo (si el correo falla, se ofrece
  reenviar).

## Seguridad

- El JWT nunca llega a JavaScript del navegador (cookie httpOnly); no usar localStorage para sesiones.
  El único dato personal que el portal guarda en el dispositivo es la copia sin conexión del último
  fotocheck (`ciisic-portal:fotocheck`, sin el JWT), que se borra al cerrarse la sesión o cambiar de
  persona (`app/plugins/fotocheck-guardado.client.ts`).
- El login con Google exige el `nonce` emitido por este servidor (cookie httpOnly de un solo uso).
- No agregar variables `NUXT_PUBLIC_*` con configuración del backend: se lee del backend.
- Los límites por IP del backend dependen de la IP que reenvía el BFF: en producción
  `NUXT_BACKEND_BASE_URL` es la URL interna de Docker y nunca se reenvía la primera entrada de
  `X-Forwarded-For` (la puede inventar el cliente).

## Ecosistema y comunicación entre sistemas

Contratos: `backend-ciisic/docs/arquitectura-ecosistema.md`. Este panel es el consumidor del
**contrato 4** (API administrativa) y del **contrato 5** (Google, código por correo y portal). **No
expone API** propia: su BFF solo reenvía a backend-ciisic.

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
- Git: ramas `feat/*` (roles y permisos: `feat/roles-permisos`; portal y escáner:
  `feat/portal-escaner`); `git add <rutas explícitas>`;
  commits convencionales en español; sin push, merge ni despliegues sin confirmación humana.
- Al terminar, reporta commits, pruebas y pendientes.

## SDD con Spec Kit

Constitución: [`.specify/memory/constitution.md`](.specify/memory/constitution.md). Specs 001–010
en `specs/` (base, inscripciones, eventos y tipos, consultas DNI, resumen/Semana Sistémica,
correo y tokens de acceso, sistema/Google/portal, roles y permisos, portal del participante y
escáner, «Disponible para» de los tipos). Flujo: spec → plan → tasks; marcar tasks. Contratos: roles y permisos en
`backend-ciisic/specs/013-roles-permisos/contracts/`; código por correo, portal, fotocheck,
asistencia por QR, alta de participantes y cortesías en
`backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/`.

## Antes de dar por terminado

1. `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
2. Probar en el navegador contra el backend local la pantalla afectada, con el perfil que
   corresponda y con una cuenta de cada rol que la use (Owner, Administrador, Tesorero, Comisión).
   Mientras producción no tenga el backend 014, probar también lo nuevo contra el 013.
3. Mensajes para códigos de error nuevos en `app/utils/errores.ts`.
4. Documentación de `docs/` al día.
