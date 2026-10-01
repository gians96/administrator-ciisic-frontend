# Arquitectura

```
Navegador (SPA) ──cookie httpOnly──► Nitro (BFF) ──Authorization: Bearer <JWT>──► backend-ciisic
                                     /api/auth/*      (login, Google, código por correo, portal, sesión, salir)
                                     /api/backend/**  → /api/v1/**     (solo staff: tipo ADMIN)
                                     /api/portal/**   → /api/v1/me/**  (solo sesión PARTICIPANTE)
```

## Sesión

- El backend emite un JWT con audiencia `ciisic-admin` (staff, 1 h con renovación) o
  `ciisic-participante` (inscrito, 12 h con Google o con código; **no se renueva**: al vencer se
  vuelve a entrar). El BFF lo guarda en la cookie httpOnly `ciisic_admin_session` (SameSite Strict,
  Secure en producción) con la misma vida que el token; el navegador nunca lo ve.
- `server/utils/jwt-publico.ts` lee la audiencia y `exp` solo para enrutar y decidir la renovación;
  la verificación real la hace el backend.
- **Renovación** (`server/utils/renovar-sesion.ts`): cuando al JWT del staff le quedan menos de
  20 min, el proxy y `/api/auth/session` piden `POST /api/v1/auth/refresh` con el Bearer actual y
  guardan el JWT nuevo en la cookie antes de reenviar la petición. Las peticiones que llegan a la
  vez con el mismo JWT comparten una sola renovación (60 s), porque el backend permite 30 cada
  15 min por cuenta (y varias estaciones pueden compartir una cuenta). El backend conserva el inicio
  de la sesión y la corta a las 12 h (401 `SESSION_EXPIRED`); si la cuenta cambió de correo,
  contraseña o Google, o se desactivó, responde 401 `SESSION_INVALIDATED`. Si la renovación falla,
  la petición sigue con el JWT actual: tras un 401 o 403 ese JWT no se vuelve a intentar renovar
  hasta que caduca; tras un 429 o un backend caído, se reintenta a los 60 s.
- Al cerrar sesión (`/api/auth/logout`) el BFF recuerda el JWT (su hash) hasta que caduca: una
  petición aún en curso con él no lo renueva ni vuelve a guardar la cookie.
- Si el backend responde 401, el BFF borra la cookie y la SPA vuelve a `/login?motivo=…`, que
  explica el motivo. `/api/auth/session` solo borra la cookie ante un 401: si el backend no
  responde, devuelve 503 `SESSION_UNAVAILABLE` y la sesión se conserva; al abrir el panel, el login
  lo avisa con «Reintentar» y `/api/auth/login` responde 503 `LOGIN_UNAVAILABLE` (no «contraseña
  incorrecta»).

## Permisos del staff

- La sesión del staff trae `usuario.acceso = { alcance: 'GLOBAL' | 'EVENTO', permisos, eventoIds,
  perfilParticipante }` (en `/api/auth/login`, `/api/auth/google` y `/api/auth/session`). El backend
  la lee de la BD en cada petición y es la autoridad (403 `FORBIDDEN` o `EVENT_NOT_ASSIGNED`).
- `app/utils/permisos.ts`: catálogo de permisos y dependencias (copiado de
  `backend-ciisic/src/core/permisos.ts`), `tienePermiso`, `accesoDeSesion`, el `MENU` con el permiso
  de cada ítem, `menuPara` e `inicioPara`. Es el único archivo con códigos de rol (nombre visible y
  tono): Owner = `SUPERADMIN`, Administrador del sistema = `ADMIN`, Tesorero, Comisión.
- Páginas: `definePageMeta({ permiso: '…' })` (o una lista: basta uno), el mismo que su ítem del
  menú. Menús y botones: `auth.puede(permiso)`. Nunca se decide con el código del rol; el
  `tipo: 'ADMIN'` de la sesión es el perfil (staff), no el rol.
- Las cuentas por evento reciben de `GET /events` solo sus eventos (vista reducida, sin la
  configuración de correo: tipo `EventoResumido`; el evento completo es `Evento`); `useEventoStore`
  recuerda el evento elegido por cuenta y se vacía al cambiar de cuenta o cerrar sesión. Una cuenta
  por evento sin eventos asignados va a `/sin-acceso` aunque tenga permisos.

## Proxies

`server/utils/proxy.ts` (usado por `/api/backend/**` y `/api/portal/**`; la raíz `/api/portal`, el
perfil del inscrito, la atiende `server/api/portal/index.ts` → `/api/v1/me`):
- valida la ruta (sin `..`) y el `Origin` en mutaciones (`assertSameOrigin`);
- rechaza el perfil equivocado con `403 FORBIDDEN_PROFILE`;
- no reenvía `Origin`, `Referer` ni cookies del navegador (llamada servidor a servidor);
- transmite multipart y archivos (vouchers, credenciales, CSV, fotos) sin cargarlos en memoria;
- los demás encabezados pasan tal como llegan (`proxyRequest` de h3), incluido `X-Forwarded-For`:
  en producción su última entrada es la que agrega Traefik, que es la que toma el backend. Los
  límites de estas rutas son sobre todo por cuenta o por participante (marcar asistencia, foto).
  Las rutas de `server/api/auth/*` no usan el proxy y calculan la IP con `ipCliente` (ver abajo).

## Acceso con Google

1. `GET /api/auth/google` pide al backend `GET /api/v1/auth/config` y devuelve el client ID y un
   `nonce` aleatorio, guardado en la cookie httpOnly `ciisic_google_nonce` (15 min, un solo uso).
2. El botón de Google Identity Services (popup) incluye ese nonce en el ID token.
3. `POST /api/auth/google` consume la cookie del nonce, envía `{ idToken, nonce }` a
   `POST /api/v1/auth/google` y guarda la sesión que devuelve el backend (ADMIN o PARTICIPANTE).
4. Tras un intento fallido se pide un nonce nuevo. Los errores llegan con su `code`
   (`GOOGLE_ACCOUNT_NOT_REGISTERED`, `GOOGLE_ACCOUNT_MISMATCH`, …) y se traducen en `app/utils/errores.ts`.

## Acceso con código por correo y paso del staff al portal (backend spec 014)

- `GET /api/auth/config` → `{ accesoCodigo: { disponible } }` (de `GET /api/v1/auth/config`). El login
  ofrece «Entrar con un código a mi correo» (`AccesoConCodigo`) solo si es `true`: un backend anterior
  a la 014 no envía la clave y el acceso queda oculto.
- `POST /api/auth/codigo` `{ correo }` → `POST /api/v1/auth/participant/code` (siempre 202, exista o
  no el correo). `POST /api/auth/codigo/verificar` `{ correo, codigo }` → `…/code/verify` y guarda la
  sesión de participante (12 h). El código **siempre** abre el portal, nunca el panel.
- `POST /api/auth/portal` → `POST /api/v1/auth/participant/switch` con el Bearer del staff
  (`acceso.perfilParticipante`, opción «Mi portal de participante» del menú de la cuenta). Si entró
  con contraseña (409 `CODE_REQUIRED`) o su inscripción tiene otra cuenta de Google, el menú pide un
  código al correo de la cuenta. Para volver al panel se ingresa de nuevo.
- Los errores del backend se propagan con su estado, `code`, `fields` y `Retry-After`
  (`errorPropagado` en `server/utils/respuestas-auth.ts`); sin backend o sin la ruta (404/405 de un
  backend anterior) responden 503 `CODE_LOGIN_UNAVAILABLE` / `PORTAL_SWITCH_UNAVAILABLE`.
- **IP real del cliente** (`server/utils/ip-cliente.ts`): login, Google y código reenvían en
  `x-forwarded-for` la **última** entrada de `X-Forwarded-For` (la que agrega Traefik) o, sin
  proxy, la IP de la conexión; nunca la primera, que la puede inventar el cliente. El backend
  (`trust proxy` 1) toma a su vez la última entrada, que es la que envía el BFF **si se le llama por
  la URL interna de Docker**; por la URL pública, Traefik agregaría la IP del panel y todos los
  visitantes compartirían los topes por IP (ver
  [configuracion-y-despliegue.md](configuracion-y-despliegue.md)).
- La sesión de participante dura 12 h y `renovarSiHaceFalta` no la toca (`esRenovable`: solo staff).

## Portal del inscrito (spec 009)

- Secciones en `NAVEGACION_PORTAL` (`app/utils/portal.ts`): Inscripciones, Fotocheck, Asistencia,
  Certificados y Perfil. El layout `participante` las muestra como pestañas en escritorio y como barra
  inferior fija en el celular; cada página declara
  `definePageMeta({ layout: 'participante', perfil: 'participante' })`.
- `usePortal` llama a `/api/portal/**` (→ `/api/v1/me/**`): un 401 limpia la sesión y lleva a
  `/login?motivo=…&redirect=…`. Una sección que el backend aún no tiene (404 `NOT_FOUND` de ruta o 405:
  el backend 013, o los certificados antes de la 015) muestra «Esta sección estará disponible pronto.»
  (`esNoDisponible`); los 404 de negocio (`INSCRIPTION_NOT_FOUND`, `PHOTO_NOT_FOUND`…) se muestran con
  su mensaje. Un 403 `FORBIDDEN_PROFILE` (la cookie ya no es del participante) relee la sesión y lleva
  a donde corresponda.
- Archivos (credencial PDF, certificados): `PortalBotonDescarga` los baja con `usePortal().descargar`
  (`$fetch.raw` en blob, nombre de `Content-Disposition`), nunca con un enlace directo: los errores se
  muestran con su mensaje (`leerCuerpoDeError` lee el JSON que llega como Blob) y `503 PDF_BUSY` se
  reintenta una vez a los 3 s.
- Fotocheck: `GET /api/portal/inscriptions/:id/badge` trae el QR ya dibujado (data URL; solo el código
  de 10 caracteres, sin URL ni datos personales); la foto, `GET /api/portal/photo`. El último
  fotocheck visto (con la foto, nunca el JWT) se guarda en `localStorage` (`ciisic-portal:fotocheck`)
  para mostrarlo sin conexión; `app/plugins/fotocheck-guardado.client.ts` lo borra cuando la sesión se
  cierra o cambia de persona y lo conserva mientras la sesión no se puede verificar por falta de red.
- Foto del perfil: el navegador la recodifica con canvas (recorte cuadrado centrado, JPEG de
  600 × 600 px, orientación corregida) y la sube con `PUT /api/portal/photo` en multipart con **solo** `file` y `consentimiento=true`
  (`formularioFoto` en `app/utils/foto.ts`); el backend vuelve a validar el tipo real y quita los
  metadatos.

## Escáner de asistencia (spec 009)

- `/escanear` (`permiso: 'asistencia.marcar'`, ítem «Escanear asistencia» del `MENU`) usa el layout
  `escaner`: pantalla completa sin menú lateral, con «volver», el selector de evento, la actividad
  (por defecto la que está en su ventana o la próxima de hoy) y el menú de la cuenta; layout y página
  comparten el estado con `useState`. Lee con la cámara (`LectorCamara`: `vue-qrcode-reader`, wasm de
  ZXing servido por el propio panel desde `public/zxing-wasm/<versión>/`), con un lector USB (escribe
  y pulsa Enter) o por documento. El modo y el sonido se recuerdan en `localStorage` (preferencias del
  dispositivo). El modo QR de `/asistencia` usa la misma lectura y «Abrir escáner» lleva el evento y
  la actividad elegidos.
- `app/utils/lecturaQr.ts`: `interpretarLectura` quita espacios y saltos de línea; 10 letras o dígitos
  → `{ codigo }` en mayúsculas; solo dígitos → `{ participanteId }` (QR anterior, enviado con
  `metodo: 'QR'`, que el backend 013 también entiende); otra cosa → «QR no válido» sin llamar al
  backend. `debeProcesar` ignora la misma lectura durante 3 s (con aviso); al cerrar un error
  (`recienteTrasCerrar`) o al marcar «Fuera de horario» la misma lectura se vuelve a procesar.
- Cola y cámara: las marcas se registran de una en una y en orden (`crearColaEnvios`, hasta 10 en
  espera; si no caben, «No procesada» en rojo en la lista). La cámara emite cada QR nuevo
  (`lecturasNuevas`; con varios a la vista, todos y el aviso «muestra uno a la vez») y se pausa
  mientras se ve un resultado que no se cierra solo (`pausaLaCamara`); el aviso del QR anterior solo
  se cierra con «Continuar» y, mientras tanto, lo que lea el lector USB espera en la cola. «Fuera de
  horario» se desmarca al cambiar de actividad. `usarZxingDelPanel` configura el wasm una sola vez y
  `/zxing-wasm/**` se sirve con `cache-control: immutable` (la ruta lleva la versión).
- `POST /api/backend/activities/:id/attendances` → `201` con `alerta` (`'QR_LEGADO'` → resultado ámbar
  «QR antiguo: verifica el DNI»), `participante.foto.tiene` e `inscripcion.id`. La foto se pide como
  imagen a `/api/backend/inscriptions/:id/photo` (misma cookie; si no hay foto o la ruta no existe, un
  marcador). Los errores (`CODE_NOT_FOUND`, `CODE_OTHER_EVENT`, `LEGACY_QR_NOT_ALLOWED`,
  `NOT_APPROVED`, `OUTSIDE_WINDOW`, `AMBIGUOUS_DOCUMENT`, `OUT_OF_HOURS_NOT_ALLOWED`) se muestran en
  rojo con el mensaje del backend, que trae la fecha o el horario; `ATTENDANCE_ALREADY_REGISTERED`, en
  ámbar con la hora. Sin red, con un 429 o con un 5xx se ofrece «Reintentar». Un `{ codigo }` rechazado con 422
  `VALIDATION_ERROR` es el backend 013: «QR no reconocido», registrar con el documento.

## Alta de participantes y cortesías (spec 009)

- Participantes: «Nuevo participante» (`participantes.gestionar`, `POST /api/backend/participants`).
  Con DNI el backend toma los nombres de la consulta DNI; si falla, 422 `NAMES_REQUIRED` y se piden.
  409 `PARTICIPANT_EXISTS` trae `fields.id` para abrir el registro existente.
- «Inscripción de cortesía» (`inscripciones.cortesia`,
  `POST /api/backend/events/:eventId/courtesy-inscriptions`): aprobada, sin monto, con el tipo del
  evento seleccionado y la credencial opcional (`credencialEnviada: false` → ofrecer reenviarla).

## Enrutamiento por perfil y permiso

`app/middleware/auth.global.ts` con `app/utils/sesion.ts`:
- sin sesión → `/login?redirect=…` (solo `/login` es pública);
- PARTICIPANTE → solo páginas con `definePageMeta({ perfil: 'participante' })` (las de
  `NAVEGACION_PORTAL`; tras el login, `redirect` si es una de ellas, si no `/mis-inscripciones`);
- staff (ADMIN) en una página de inscrito o sin el `permiso` de la página → su página de inicio
  (`inicioPara`: la primera del menú que puede abrir; la cuenta que solo marca asistencia,
  `/escanear`; la cuenta por evento que marca y hace algo más, `/asistencia`; sin ninguna,
  `/sin-acceso`). Tras el login, `redirect` solo si la cuenta puede abrirla.
- sesión sin verificar (backend caído) → `/login?motivo=SESSION_UNAVAILABLE&redirect=…`; la siguiente
  navegación (o «Reintentar») vuelve a leerla.
- 401 de la API → `/login?motivo=SESSION_EXPIRED|SESSION_INVALIDATED&redirect=…` (si ya se está en el
  login, se conservan su `redirect` y su motivo); 403 `FORBIDDEN` o `EVENT_NOT_ASSIGNED` → se relee el
  acceso (como máximo cada 15 s) y los eventos, y se sale de la página si ya no está permitida. Los 403
  de un permiso concreto (`STATUS_NOT_ALLOWED`, `OUT_OF_HOURS_NOT_ALLOWED`) releen el acceso al
  momento (`releerAcceso`) para ocultar la acción.
