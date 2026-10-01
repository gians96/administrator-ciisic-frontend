# Implementation Plan: Portal del participante y escáner de asistencia

## Contrato (backend-ciisic, spec 014)

Fuente de verdad: `backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/`
([acceso con código](../../../backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/api-acceso-codigo.md),
[portal v2](../../../backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/api-portal.md),
[asistencia, credencial y staff](../../../backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/api-asistencia.md))
y su [spec](../../../backend-ciisic/specs/014-portal-fotocheck-asistencia/spec.md). La spec 014 está en
la rama `feat/portal-fotocheck` del backend y **aún no está desplegada**: producción corre la 013. Aquí
solo va lo que usa el panel. Errores con la forma `{ success: false, code, message, fields? }`;
`fields` lleva texto.

| Método y ruta del backend | Guarda | Ruta del BFF | Lo que usa el panel |
|---|---|---|---|
| `GET /auth/config` | pública (caché 60 s) | `GET /api/auth/config` | `accesoCodigo.disponible` (falta en el 013 → `false`) |
| `POST /auth/participant/code` | pública, 60 por IP cada 15 min | `POST /api/auth/codigo` | `{ correo }` → siempre `202 { expiraEnSegundos, reintentarEnSegundos }`; 429 `CODE_COOLDOWN` / `RATE_LIMITED` (`Retry-After`, `fields.reintentarEnSegundos`), 503 `CODE_LOGIN_UNAVAILABLE` / `CODE_LOGIN_PAUSED` |
| `POST /auth/participant/code/verify` | pública, 120 por IP cada 15 min | `POST /api/auth/codigo/verificar` | `{ correo, codigo }` → `{ jwt, tipo: 'PARTICIPANTE', participante, expiraEn }` (12 h); 401 `INVALID_CODE` (`fields.restantes`), 401 `CODE_EXPIRED`, 429 `CODE_LOCKED`, 503 `CODE_LOGIN_PAUSED` |
| `POST /auth/participant/switch` | Bearer de staff, 20 cada 15 min | `POST /api/auth/portal` | Misma sesión que `verify`; 409 `CODE_REQUIRED` (sesión con contraseña), 404 `PARTICIPANT_NOT_FOUND`, 403 `GOOGLE_ACCOUNT_MISMATCH`, 409 `GOOGLE_ACCOUNT_IN_USE` |
| `GET /me` · `PATCH /me/profile` | participante | `GET /api/portal` · `PATCH /api/portal/profile` | Perfil con `celular`, `foto { tiene, actualizadaEn }`, `google { vinculado }` (faltan en el 013); `PATCH` solo `{ celular }` (`/^\+?\d{9,15}$/`) |
| `PUT, GET, DELETE /me/photo` | participante, 10 cambios por hora | `/api/portal/photo` | Multipart con **solo** `file` y `consentimiento=true`; JPEG/PNG ≤ 2 MB y ≤ 4096 px; 422 `CONSENT_REQUIRED`, `INVALID_FILE_TYPE`, `INVALID_FILE_CONTENT`, `IMAGE_TOO_LARGE`, `FILE_REQUIRED`; 413 `UPLOAD_LIMIT_EXCEEDED`; 400 `UPLOAD_INVALID`; 409 `PHOTO_CONFLICT`; 404 `PHOTO_NOT_FOUND` |
| `GET /me/inscriptions` | participante | `GET /api/portal/inscriptions` | Lista de la spec 011 + `fotocheck { disponible }` |
| `GET /me/inscriptions/:id/badge` | participante | `GET /api/portal/inscriptions/:id/badge` | `{ inscripcionId, codigo, qr (data URL), evento, participante (documento enmascarado), tipoInscripcion, foto { tiene } }`; 404 `INSCRIPTION_NOT_FOUND`, 409 `NOT_APPROVED` |
| `GET /me/inscriptions/:id/credential` | participante, 10/min | `GET /api/portal/inscriptions/:id/credential` | PDF con el QR nuevo y la foto; 503 `PDF_BUSY` |
| `GET /me/attendances` | participante | `GET /api/portal/attendances` | Por evento aprobado: `totalActividades`, `asistidas`, `actividades[{ fecha, horaInicio, horaFin, asistio, registradoEn }]` (horas de Lima) |
| `GET /me/certificates` | spec 015 | `GET /api/portal/certificates` | Hoy 404 → estado vacío |
| `POST /activities/:id/attendances` | `asistencia.marcar` (120/min por cuenta por evento) | `/api/backend/…` | Exactamente uno de `{ codigo }`, `{ numeroDocumento, tipoDocumento? }` o `{ participanteId }`, más `fueraDeHorario?` y `metodo?`; `201` con `alerta` (`'QR_LEGADO'` o `null`), `participante { …, foto { tiene } }` e `inscripcion { id, tipoInscripcion }` |
| `GET /inscriptions/:id/photo` | `asistencia.marcar` o `inscripciones.ver`, por evento | `/api/backend/…` | Foto para el escáner; 404 `PHOTO_NOT_FOUND` |
| `POST /participants` | `participantes.gestionar` | `/api/backend/…` | `{ tipoDocumento, numeroDocumento, nombres?, apellidos?, correo, celular? }` → 201; 409 `PARTICIPANT_EXISTS` (`fields.id`), 409 `EMAIL_IN_USE`, 422 `NAMES_REQUIRED` |
| `PUT /participants/:id` | `participantes.gestionar` | `/api/backend/…` | Sin cambios; acepta `celular: ""` |
| `POST /events/:eventId/courtesy-inscriptions` | `inscripciones.cortesia` | `/api/backend/…` | `{ participanteId, tipoInscripcionId?, enviarCredencial? }` → 201 con el detalle y `credencialEnviada`; 409 `ALREADY_REGISTERED`, `DUPLICATE_RECORD`; 422 `REGISTRATION_TYPE_INVALID` |

Errores de la marca de asistencia: 404 `CODE_NOT_FOUND`, 409 `CODE_OTHER_EVENT` (sin datos de la
persona), 422 `LEGACY_QR_NOT_ALLOWED` (el mensaje trae la fecha), 403 `NOT_APPROVED`, 409 `OUTSIDE_WINDOW`
(«desde HH:MM hasta HH:MM»; ventana de 30 min antes de `horaInicio` a `horaFin`), 409
`ATTENDANCE_ALREADY_REGISTERED` (con la hora), 409 `AMBIGUOUS_DOCUMENT`, 403 `OUT_OF_HOURS_NOT_ALLOWED`,
403 `MANUAL_NOT_ALLOWED`, 404 `PARTICIPANT_NOT_FOUND`, 429 `RATE_LIMITED`.

### Lectura del QR

| Lo leído (sin espacios ni saltos) | Cuerpo | Método que guarda el backend 014 | Con el backend 013 |
|---|---|---|---|
| `/^[0-9A-Za-z]{10}$/` | `{ codigo: MAYÚSCULAS }` | `QR` | No ocurre (el 013 no emite ese QR); si llega, 422 `VALIDATION_ERROR` |
| `/^\d+$/` (QR anterior) | `{ participanteId, metodo: 'QR' }` | `QR_LEGADO`, con `alerta: 'QR_LEGADO'` hasta `fechaFin` | Marca como hasta hoy (sin `alerta` ni foto) |
| Otra cosa | — (no se llama al backend) | — | — |

## Orden de despliegue y compatibilidad

**El panel 009 se despliega antes que el backend 014** (o a la vez), nunca después: las credenciales que
emite el 014 llevan el QR nuevo, que el escáner del panel actual no entiende (solo acepta dígitos).

1. Antes: `NUXT_BACKEND_BASE_URL` del panel con la **URL interna de Docker** del backend (no la pública
   de Traefik). Si no, el backend ve la IP del panel en todas las peticiones y los topes por IP del
   login, Google y el código (200 solicitudes y 50 códigos incorrectos por hora) bloquean a todos.
2. Desplegar el panel 009 contra el backend 013 de producción y verificar que todo degrada bien (tabla).
3. Desplegar el backend 014 (respaldo, migración `20261001120000_portal_fotocheck` al arrancar,
   verificación y `credenciales:pregenerar`; ver `backend-ciisic/docs/operacion.md`).
4. Verificar con el 014: código por correo (con una credencial de correo predeterminada activa en
   Correo), fotocheck, escáner con QR nuevo y anterior, paso al portal.

| Con el backend 013 (producción hoy) | Comportamiento del panel 009 |
|---|---|
| `GET /auth/config` sin `accesoCodigo` | Login sin la opción del código (igual que hoy); `POST /api/auth/codigo*` → 503 `CODE_LOGIN_UNAVAILABLE` |
| `POST /auth/participant/switch` no existe (404/405) | «Mi portal de participante» se ve (el 013 ya envía `perfilParticipante`) y al pulsarla avisa que aún no está disponible (503 `PORTAL_SWITCH_UNAVAILABLE`), sin cerrar la sesión |
| `/me/inscriptions/:id/badge`, `/me/attendances`, `/me/profile`, `/me/photo`, `/me/certificates` no existen | «Esta sección estará disponible pronto.» (`esNoDisponible`: 404 `NOT_FOUND` o 405) |
| `GET /me` sin `celular`, `foto`, `google` | El perfil muestra lo que llega; celular y foto, «pronto disponible» |
| `GET /me/inscriptions` sin `fotocheck` | Una inscripción aprobada ofrece «Ver fotocheck» y esa página dice «pronto disponible» |
| `POST /activities/:id/attendances` solo con `participanteId` / `numeroDocumento` | El QR anterior y el DNI marcan como hoy; la respuesta no trae `alerta` ni foto |
| `GET /inscriptions/:id/photo` no existe | Marcador sin foto, sin error |
| `POST /participants`, cortesías no existen | «Pronto disponible» al intentarlo |

Vuelta atrás: si se revierte el backend a la 013, el panel 009 sigue funcionando (vuelve a la tabla de
arriba) y el backend corre `prisma/preflight/marcar-qr-legado-014.sql`. No se revierte el panel 009 con el
backend 014 en producción. Después del 31-oct-2026 el backend retira la aceptación de `participanteId`;
entonces se quita la rama del QR anterior del escáner y los respaldos del 013.

## Arquitectura

```
Login ─ GET /api/auth/config ─► accesoCodigo.disponible ─► AccesoConCodigo
          POST /api/auth/codigo ─► /v1/auth/participant/code          (202 siempre; Retry-After reenviado)
          POST /api/auth/codigo/verificar ─► …/code/verify ─► cookie con el JWT del participante (12 h)
MenuUsuario (staff, perfilParticipante) ─ POST /api/auth/portal ─► /v1/auth/participant/switch
          409 CODE_REQUIRED | 403 GOOGLE_ACCOUNT_MISMATCH ─► diálogo con AccesoConCodigo (correo de la cuenta)
Portal (layout participante, NAVEGACION_PORTAL) ─ usePortal ─► /api/portal/** ─► /v1/me/**
          401 ─► /login?motivo=…&redirect=…   ·   404 de ruta | 405 ─► «pronto disponible»
Escáner /escanear (asistencia.marcar) ─ interpretarLectura ─► debeProcesar ─► POST /api/backend/activities/:id/attendances
          201 ─► verde | ámbar (alerta QR_LEGADO) ─► <img src="/api/backend/inscriptions/:id/photo">
          error ─► rojo con el mensaje del backend
BFF:      login, Google y código ─► x-forwarded-for = última entrada de X-Forwarded-For (ipCliente)
          renovarSiHaceFalta ─► solo si esRenovable (staff)
```

### Acceso con código y paso al portal (base, ya hecha)
- `server/utils/acceso-codigo.ts`: validación del correo (≤ 191) y del código (6 dígitos, sin espacios ni
  guiones), lectura de las respuestas (`codigoSolicitadoDe`, `sesionParticipanteDe`,
  `accesoCodigoDisponible`), respaldos `RESPALDO_CODIGO` y `RESPALDO_PORTAL`, y `lanzarError` (pone
  `Retry-After`). `server/utils/respuestas-auth.ts`: `errorPropagado` conserva estado, `code`, `fields` y
  la espera; un 404 `NOT_FOUND` o 405 del backend se vuelve 503 con el respaldo.
- La sesión de participante se guarda con `vidaSesionSegundos(expiraEn)` (12 h). `POST /api/auth/portal`
  olvida el JWT del staff (`olvidarSesion`) para que una petición en curso no lo renueve sobre la cookie
  nueva.
- `app/utils/codigoAcceso.ts`: normalización, cuenta regresiva (`segundosParaReintentar` lee
  `fields.reintentarEnSegundos` o `Retry-After`), `pasarAlCodigoTrasError` (`CODE_COOLDOWN` lleva al paso
  del código) y `mensajeErrorCodigo`.

### Portal
- `NAVEGACION_PORTAL`: Inscripciones (`/mis-inscripciones`), Fotocheck (`/mi-fotocheck`), Asistencia
  (`/mi-asistencia`), Certificados (`/mis-certificados`), Perfil (`/mi-perfil`). Pestañas en escritorio y
  barra inferior fija en el celular (5 etiquetas completas a 375 px).
- Cada página: `definePageMeta({ layout: 'participante', perfil: 'participante' })`; el middleware ya
  impide que el staff las abra y que el inscrito abra otras.
- Fotocheck: `/mi-fotocheck` muestra una de las inscripciones con fotocheck (`fotocheck.disponible`;
  sin la clave, las aprobadas): la de `?inscripcion=<id>` si viene de «Ver fotocheck» o, si no, la del
  evento en curso, luego la próxima y al final la más reciente; con varias se elige. QR del backend
  (`qr`, data URL de 480 px) a tamaño grande, sin regenerarlo en el navegador; foto con
  `GET /api/portal/photo` solo si `foto.tiene`; reloj «en vivo» en hora de Lima (una captura no lo
  imita); `navigator.wakeLock` donde exista; enlace a `…/credential`.
- Perfil: la foto se recodifica con canvas (`createImageBitmap` con `imageOrientation: 'from-image'`,
  `recorteCuadrado`: cuadrado centrado de 600 × 600 px, mínimo 200 px, `toBlob('image/jpeg', 0.85)`), se revisa con `errorFotoLista` y se
  envía con `formularioFoto`; la casilla usa `TEXTO_CONSENTIMIENTO_FOTO`.

### Escáner
- `/escanear` con `definePageMeta({ permiso: 'asistencia.marcar', layout: 'escaner' })` y el ítem
  «Escanear asistencia» del `MENU` (sección Operación, `RUTA_ESCANER`) con el mismo permiso. El layout
  `escaner` ocupa la pantalla en cualquier tamaño (sin menú lateral): «volver» (a `/asistencia` o al
  inicio de la cuenta), el selector de evento (`useEventoStore`), la actividad (`SelectorActividad`; por
  defecto la que está en su ventana o la próxima de hoy, `actividadParaEscaner`) y el menú de la cuenta.
  Layout y página comparten el estado con `useState(ESTADO_ESCANER)`. «Abrir escáner» en `/asistencia`
  lleva `?evento=&actividad=`.
- `inicioPara`: la cuenta que solo marca asistencia (`soloMarcaAsistencia`: `asistencia.marcar` y, como
  mucho, `asistencia.ver` y `asistencia.fuera_horario`) empieza en `/escanear`; la cuenta por evento que
  marca y hace algo más sigue empezando en `/asistencia`.
- Cámara: `vue-qrcode-reader` (cámara trasera, solo `qr_code`) con el wasm de ZXing **servido por el
  propio panel** (`setZXingModuleOverrides`), no desde un CDN. Lector USB: campo con foco que procesa al
  recibir Enter. DNI: el flujo de `/asistencia` (`cuerpoMarca`, `AMBIGUOUS_DOCUMENT`).
- `interpretarLectura` → `debeProcesar(lectura, reciente)` (3 s; quien llama guarda `{ clave, instante }`
  cada vez que procesa) → cuerpo (`cuerpoLectura`). Resultado a pantalla completa (`PantallaResultado`)
  con `navigator.vibrate` y un pitido (Web Audio, se puede silenciar), y las últimas 10 lecturas
  (`LecturasRecientes`). `ATTENDANCE_ALREADY_REGISTERED` en ámbar; errores de red o 5xx con «Reintentar»;
  un `{ codigo }` rechazado con 422 `VALIDATION_ERROR` (backend 013) → «QR no reconocido». El modo
  (cámara, lector USB o DNI) y el sonido se recuerdan en `localStorage` (preferencias del dispositivo,
  sin datos personales).
- `/asistencia`: su modo QR pasa a `interpretarLectura` (`inputmode="text"`) con el mismo aviso ámbar.
- La foto se pide como `<img>` a `/api/backend/inscriptions/:id/photo` (misma cookie; el proxy transmite
  la imagen); `@error` → marcador.

### Staff
- `app/pages/participantes.vue`: «Nuevo participante» (`auth.puede('participantes.gestionar')`), con los
  nombres opcionales salvo tras `NAMES_REQUIRED`; `PARTICIPANT_EXISTS` abre el registro de `fields.id`.
- «Inscripción de cortesía» con `auth.puede('inscripciones.cortesia')` (Owner y Administrador): tipo del
  evento seleccionado (incluidos los inactivos) y «Enviar credencial».

## Archivos

| Archivo | Rol | Estado |
|---|---|---|
| `server/utils/ip-cliente.ts` | `ultimaIpReenviada`, `ipValida`, `ipCliente` | Hecho |
| `server/utils/acceso-codigo.ts`, `server/utils/respuestas-auth.ts` | Validación, lectura de respuestas, respaldos, `errorPropagado`, `segundosDeEspera`, `lanzarError` | Hecho |
| `server/api/auth/config.get.ts`, `codigo/index.post.ts`, `codigo/verificar.post.ts`, `portal.post.ts` | Rutas del BFF | Hecho |
| `server/api/auth/login.post.ts`, `google.post.ts` | `x-forwarded-for` con `ipCliente` | Hecho |
| `server/utils/renovar-sesion.ts` | `esRenovable` (solo staff) | Hecho |
| `app/utils/codigoAcceso.ts`, `lecturaQr.ts`, `portal.ts`, `foto.ts` | Utilidades puras | Hecho |
| `app/utils/errores.ts` | Códigos de la spec 014 (fijos y de respaldo) y `PORTAL_SWITCH_UNAVAILABLE` | Hecho |
| `app/utils/sesion.ts`, `app/stores/auth.ts`, `app/composables/usePortal.ts` | `destinoTrasLogin` del inscrito, `solicitarCodigo`, `verificarCodigo`, `irAlPortal`, 401 del portal | Hecho |
| `app/components/auth/AccesoConCodigo.vue`, `app/pages/login.vue` | Acceso con código | Hecho |
| `app/components/layout/MenuUsuario.vue` | «Mi portal de participante» y diálogo del código | Hecho |
| `app/layouts/participante.vue`, `app/utils/misInscripciones.ts` | Navegación del portal; `fotocheck?` | Hecho |
| Páginas `mi-fotocheck`, `app/components/portal/*`, `app/utils/fotocheck.ts`, `app/plugins/fotocheck-guardado.client.ts` | Fotocheck y su copia sin conexión | En curso |
| `app/pages/mis-inscripciones.vue` | «Ver fotocheck» | En curso |
| Páginas `mi-asistencia`, `mi-perfil`, `mis-certificados`; `app/utils/miAsistencia.ts`, `miPerfil.ts`, `misCertificados.ts`; `server/api/portal/index.ts` (raíz `/api/portal` → `/api/v1/me`) | Portal | En curso |
| Página `escanear`, layout `escaner`, `app/components/asistencia/*` (`LectorCamara` con `vue-qrcode-reader` y el wasm en `public/zxing-wasm/<versión>/`, copiado con `bun run escaner:wasm`; `SelectorActividad`, `PantallaResultado`, `LecturasRecientes`), `app/utils/permisos.ts` (`MENU`, `RUTA_ESCANER`, `soloMarcaAsistencia`, `inicioPara`) | Escáner | En curso |
| `app/pages/asistencia.vue`, `app/utils/asistencia.ts` | Modo QR con `interpretarLectura` y aviso ámbar | En curso |
| `app/pages/participantes.vue`, `app/components/participantes/*`, `app/utils/participantes.ts` | Nuevo participante y cortesía | En curso |
| `tests/ipCliente.test.ts`, `accesoCodigoBff.test.ts`, `bffCodigo.test.ts`, `codigoAcceso.test.ts`, `lecturaQr.test.ts`, `portal.test.ts`, `foto.test.ts`, `erroresPortal.test.ts`, `sesion.test.ts`, `renovarSesion.test.ts` | Pruebas Vitest de la base | Hecho |
| `tests/fotocheck.test.ts`, `participantes.test.ts`, `portalPaginas.test.ts`, `asistencia.test.ts`, `permisos.test.ts` | Pruebas Vitest de las pantallas | En curso |

## Decisiones

- **El código siempre abre el portal.** Aunque el correo sea de una cuenta de staff, el código no da
  acceso al panel (lo garantiza el backend; el panel no lo ofrece). Del portal al panel solo se llega
  ingresando de nuevo.
- **Acceso con código plegado** tras «Entrar con un código a mi correo»: no hay dos campos de correo a la
  vista y Google sigue siendo la primera opción. Se muestra solo con `accesoCodigo.disponible === true`.
- **La espera para reenviar** se aplica solo al correo que la causó; cambiar de correo la reinicia.
- **`GOOGLE_ACCOUNT_MISMATCH` también ofrece el código**, igual que `CODE_REQUIRED`: el código prueba el
  correo igual y el backend lo sugiere en su mensaje.
- **«Mi portal de participante» visible con el 013**: el 013 ya envía `perfilParticipante`; como el panel
  se despliega justo antes que el backend, la opción avisa en lugar de ocultarse.
- **Mensajes**: los códigos cuyo mensaje del servidor trae datos (hora, fecha, intentos) o cambia según la
  pantalla quedan solo como respaldo en `errores.ts`, para conservar el texto del servidor.
- **Rutas inexistentes del 013**: el BFF vuelve 503 un 404 `NOT_FOUND` o 405 en sus rutas nuevas; en el
  portal, `esNoDisponible` no cuenta los 404 de negocio.
- **IP real**: el BFF toma la última entrada de `X-Forwarded-For` (la que agrega Traefik); la primera la
  escribe el cliente y permitiría esquivar los topes por IP. El backend (`trust proxy` 1) toma a su vez la
  última, que es la que envía el BFF, siempre que se llame por la URL interna.
- **Sesión del participante sin renovación** (`esRenovable`): 12 h y se vuelve a entrar; una sesión con
  las dos audiencias tampoco se renueva.
- **QR del fotocheck tal como lo envía el backend** (data URL): el navegador no genera QR ni conoce otra
  regla de formato.
- **Escáner como página propia** (`/escanear`, layout `escaner`) y no solo un modo de `/asistencia`: en
  la puerta se usa el celular a pantalla completa. Lleva `asistencia.marcar` (marcar implica ver). La
  cuenta que solo marca asistencia empieza en el escáner (`inicioPara` con `soloMarcaAsistencia`); la
  Comisión con más permisos sigue empezando en `/asistencia`, que enlaza al escáner.
- **wasm de ZXing local**: funciona en la red del evento y no envía lecturas a terceros.
- **Foto recodificada en el navegador**: el backend quita los metadatos (y con ellos la orientación EXIF);
  recodificar con canvas corrige la orientación, reduce el peso y deja solo JPEG.
- **Copia sin conexión del fotocheck**: el último fotocheck visto (datos y foto como data URL, nunca el
  JWT) en `localStorage` (`ciisic-portal:fotocheck`), marcado con el participante. Un plugin de cliente
  la borra cuando la sesión se cierra (salir, vencida, invalidada) o cambia de persona, y la conserva
  mientras la sesión no se pudo verificar por falta de red, que es cuando sirve en la puerta. Si el
  navegador no deja guardar (modo privado), simplemente no hay copia.

## Constitution Check

- I. El JWT sigue en la cookie httpOnly: el código y el paso al portal guardan la sesión en el BFF y el
  navegador solo recibe `{ tipo, participante }`. La foto del escáner y del portal pasa por el proxy con
  la cookie. La IP del cliente se calcula en el servidor. La copia sin conexión del fotocheck no lleva
  el JWT y se borra al cerrarse la sesión.
- II. Solo Tailwind v4 y tokens de marca (resultado verde, ámbar y rojo con los colores del tema).
- III. El escáner trabaja sobre el evento de la barra superior y una actividad de ese evento; el portal
  del inscrito no depende del evento seleccionado (muestra los suyos).
- IV. Textos en español, mensajes por código, `inputmode` y `autocomplete` del código, `aria-live` en el
  resultado del escáner, confirmación al quitar la foto.
- V. Lógica en utilidades puras con pruebas (`ip-cliente`, `acceso-codigo`, `codigoAcceso`, `lecturaQr`,
  `portal`, `foto`, `errores`, `sesion`, `renovar-sesion`); lint, typecheck, test y build en verde.
- VI (enmienda 1.3.0). El inscrito entra con Google o con un código por correo y solo abre las páginas
  con `perfil: 'participante'` (`NAVEGACION_PORTAL`) y `/api/portal/**`; el staff pasa a su portal en un
  solo sentido; el escáner y las acciones de staff se deciden por permiso (`asistencia.marcar`,
  `participantes.gestionar`, `inscripciones.cortesia`), nunca por rol.
