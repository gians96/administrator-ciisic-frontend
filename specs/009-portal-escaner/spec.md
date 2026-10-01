# Feature Specification: Portal del participante (fotocheck, asistencia, perfil) y escáner de asistencia

**Feature Branch**: `feat/portal-escaner` · **Created**: 2026-10-01 · **Status**: En implementación (base lista)
**Contrato**: backend-ciisic spec 014, **aún no desplegada** (producción tiene la 013); resumen, orden de
despliegue y compatibilidad en [plan.md](plan.md)
**Input**: "los participantes también podrían ingresar para ver su inscripción ... su certificado
otorgado, perfil, su asistencia, su fotocheck virtual" y "los administradores pueden designar a cierto
equipo de la comisión tecnológica ... para que puedan por ejemplo marcar asistencia de los inscritos"

Decisiones:
- El inscrito entra al portal con Google **o con un código de 6 dígitos que llega a su correo** (también
  si su cuenta está vinculada a Google). El código siempre abre una sesión de **participante** (12 h, no
  se renueva), nunca del panel.
- El perfil permite editar el celular y subir una **foto opcional**, con consentimiento, que sale en el
  fotocheck, en la credencial PDF y en el escáner.
- El QR del fotocheck y de la credencial nueva lleva un código aleatorio de 10 caracteres. El QR anterior
  (el id del participante) se acepta hasta el fin del evento, con aviso ámbar.
- El staff inscrito con su mismo correo pasa a su portal desde el menú de su cuenta; nada lleva del
  portal al panel.
- Los certificados del portal son de la spec 015 del backend: hasta entonces, estado vacío.
- **El panel 009 se despliega antes que el backend 014** y todo lo nuevo degrada bien con el 013.

## User Scenarios & Testing

### User Story 1 - Entrar al portal con un código por correo (Priority: P1)
Como inscrito sin Google (o sin recordar qué cuenta usé) quiero entrar a mi portal con un código que
llega a mi correo.

**Acceptance Scenarios**:
1. **Given** que el backend ofrece el código (`accesoCodigo.disponible`), **Then** el login muestra
   «Entrar con un código a mi correo» plegado bajo Google, que sigue visible.
2. **When** pido el código, **Then** paso a escribirlo con el aviso «Si <correo> está registrado, te
   llegará un código de 6 dígitos … Vence en 10 minutos»; el mensaje es el mismo exista o no el correo.
3. **When** pido otro antes de tiempo (429 `CODE_COOLDOWN`), **Then** paso al paso del código con una
   cuenta regresiva para reenviar; la espera solo se aplica al correo que la causó.
4. **When** escribo un código incorrecto, **Then** veo «Te quedan N intentos» (401 `INVALID_CODE`);
   vencido o usado (401 `CODE_EXPIRED`), se me pide uno nuevo; con 429 `CODE_LOCKED` o `RATE_LIMITED`,
   cuánto esperar; con 503 `CODE_LOGIN_PAUSED` o `CODE_LOGIN_UNAVAILABLE`, que entre con Google.
5. **When** el código es correcto, **Then** entro a mi portal (a `redirect` si es una página del portal;
   si no, a `/mis-inscripciones`) por 12 h; al vencer, el login explica el motivo y me devuelve a la
   página.
6. El campo acepta `123 456` o `123-456`, usa `inputmode="numeric"` y `autocomplete="one-time-code"`.
7. **Given** el backend 013 (sin `accesoCodigo`), **Then** la opción no aparece y
   `POST /api/auth/codigo` responde 503 `CODE_LOGIN_UNAVAILABLE`.

### User Story 2 - Mi fotocheck virtual (Priority: P1)
Como inscrito aprobado quiero mostrar en mi celular un fotocheck con QR para registrar mi asistencia.

**Acceptance Scenarios**:
1. **Given** una inscripción aprobada (`fotocheck.disponible`), **Then** «Mis inscripciones» ofrece «Ver
   fotocheck».
2. **When** abro «Fotocheck», **Then** veo el QR grande, el código en texto, el evento, mi nombre, mi
   documento enmascarado (`****1234`), el tipo de inscripción y mi foto si la subí; con varias
   inscripciones aprobadas elijo el evento (primero el que está en curso, luego los próximos y al
   final los pasados); «Ver fotocheck» abre la suya (`/mi-fotocheck?inscripcion=<id>`).
3. La pantalla no se apaga mientras el fotocheck está abierto (Wake Lock donde exista) y hay enlace a la
   credencial PDF.
4. Una inscripción no aprobada → 409 `NOT_APPROVED`; ajena o inexistente → 404 `INSCRIPTION_NOT_FOUND`:
   ambos con su mensaje, no una pantalla rota.
5. **Given** el backend 013, **Then** la sección muestra «Esta sección estará disponible pronto.».
6. El último fotocheck que vi queda guardado en el dispositivo para mostrarlo sin conexión en la
   puerta; se borra cuando la sesión se cierra (salir, vencida o invalidada) o entra otra persona, y
   se conserva mientras la sesión no se puede verificar por falta de red.

### User Story 3 - La Comisión marca asistencia con el QR del fotocheck (Priority: P1)
Como cuenta con `asistencia.marcar` (Comisión tecnológica, Administrador, Owner) quiero escanear el QR en
la puerta con el celular, un lector USB o el DNI.

**Acceptance Scenarios**:
1. **Given** `asistencia.marcar`, **Then** el menú muestra «Escanear asistencia» (`/escanear`), a
   pantalla completa y sin menú lateral, que trabaja sobre el evento de la barra superior y una de sus
   actividades (por defecto, la que está en curso o la próxima de hoy); «Abrir escáner» en
   `/asistencia` lo abre con el evento y la actividad elegidos.
   Una cuenta que solo marca asistencia (sin otros permisos que `asistencia.ver` y
   `asistencia.fuera_horario`) empieza en el escáner; la que además hace otras cosas, en Asistencia.
2. **When** se lee el QR (cámara trasera, lector USB que escribe y pulsa Enter, o el campo de texto),
   **Then** lo leído se limpia de espacios y saltos de línea y:
   - 10 letras o dígitos → `{ codigo }` en mayúsculas;
   - solo dígitos (QR anterior) → `{ participanteId }`;
   - otra cosa → «QR no válido», sin llamar al backend.
3. La misma lectura repetida dentro de 3 s se ignora (la cámara lee el mismo QR muchas veces).
4. **When** la marca entra (201), **Then** veo el resultado en verde a pantalla completa con nombre,
   documento, tipo de inscripción y la foto (`GET /api/backend/inscriptions/:id/photo`; sin foto, un
   marcador), con vibración y sonido.
5. **When** la respuesta trae `alerta: 'QR_LEGADO'`, **Then** el resultado es ámbar: «QR antiguo:
   verifica el DNI», con el documento completo y la foto.
6. **When** el backend rechaza, **Then** el resultado es rojo con el mensaje: `CODE_NOT_FOUND`,
   `CODE_OTHER_EVENT`, `LEGACY_QR_NOT_ALLOWED` (con la fecha), `NOT_APPROVED`, `OUTSIDE_WINDOW` (con el
   horario), `OUT_OF_HOURS_NOT_ALLOWED`; en modo DNI, `AMBIGUOUS_DOCUMENT` pide el tipo de documento y
   reintenta. `ATTENDANCE_ALREADY_REGISTERED` sale en ámbar («Ya estaba registrada», con la hora). Sin
   conexión o con un error del servidor se ofrece «Reintentar».
7. La casilla «Fuera de horario» solo aparece con `asistencia.fuera_horario`.
8. Sin cámara (permiso denegado, sin HTTPS o un navegador integrado) se explica el motivo y siguen el
   lector USB y el DNI.
9. Se ven las últimas 10 lecturas con su resultado.
10. **Given** el backend 013, **Then** el QR anterior sigue marcando (`{ participanteId, metodo: 'QR' }`):
    resultado verde con el nombre, sin alerta y sin foto.
11. El modo QR de `/asistencia` usa la misma lectura (acepta el código de 10 caracteres, no solo
    dígitos) y el mismo aviso ámbar.

### User Story 4 - El staff pasa a su portal (Priority: P2)
Como cuenta de staff que también está inscrita quiero ver mi fotocheck sin cerrar sesión a mano.

**Acceptance Scenarios**:
1. **Given** `acceso.perfilParticipante`, **Then** el menú de la cuenta ofrece «Mi portal de
   participante».
2. **Given** que entré con Google, **When** lo elijo, **Then** entro al portal sin otro paso.
3. **Given** que entré con contraseña (409 `CODE_REQUIRED`) o que mi inscripción está vinculada a otra
   cuenta de Google (403 `GOOGLE_ACCOUNT_MISMATCH`), **Then** un diálogo me envía un código al correo de
   mi cuenta (fijo, no editable) y con él entro al portal.
4. Sin inscripción con mi correo (404 `PARTICIPANT_NOT_FOUND`) veo el aviso y sigo en el panel.
5. Para volver al panel ingreso de nuevo: el portal no tiene camino al panel.
6. **Given** el backend 013, **Then** veo «aún no está disponible» y la sesión del panel sigue abierta.

### User Story 5 - Mi perfil y mi foto (Priority: P2)
Como inscrito quiero corregir mi celular y poner mi foto en el fotocheck.

**Acceptance Scenarios**:
1. Veo nombres, documento y correo (no se editan aquí) y puedo cambiar el celular (`+` opcional y de 9
   a 15 dígitos).
2. **When** elijo una foto, **Then** el panel la recodifica con canvas (recorte cuadrado centrado, JPEG de 600 × 600 px, con
   la orientación corregida y sin metadatos), revisa que pese hasta 2 MB y exige marcar el
   consentimiento antes de subirla.
3. Los rechazos se explican: `CONSENT_REQUIRED`, `INVALID_FILE_TYPE`, `INVALID_FILE_CONTENT`,
   `IMAGE_TOO_LARGE`, 413 `UPLOAD_LIMIT_EXCEEDED`, `PHOTO_CONFLICT` y 429 `RATE_LIMITED` (10 cambios por
   hora); una imagen que el navegador no abre (p. ej. HEIC) → «No se pudo abrir la imagen».
4. Veo mi foto y puedo quitarla, con confirmación.
5. **Given** el backend 013, **Then** el perfil muestra lo que llega y el celular y la foto dicen «pronto
   disponible».

### User Story 6 - Mi asistencia (Priority: P2)
**Acceptance Scenarios**:
1. Por cada evento en el que estoy aprobado veo sus actividades (fecha y hora de Lima), en cuáles asistí
   y el total «asistidas / actividades»; las marcas anuladas no cuentan.
2. Sin eventos aprobados, un estado vacío; con el backend 013, «pronto disponible».

### User Story 7 - Mis certificados (Priority: P3)
**Acceptance Scenarios**:
1. Hasta la spec 015 del backend, `GET /api/portal/certificates` responde 404 y la sección muestra un
   estado vacío «pronto disponible», no un error.

### User Story 8 - Alta de participantes y cortesías (Priority: P2)
Como Owner o Administrador quiero registrar a ponentes, organizadores o inscritos en persona y darles una
inscripción sin pago.

**Acceptance Scenarios**:
1. **Given** `participantes.gestionar`, **When** pulso «Nuevo participante» en Participantes, **Then**
   registro tipo y número de documento, correo (obligatorio) y celular opcional; con DNI los nombres
   salen de RENIEC y, si la consulta falla (422 `NAMES_REQUIRED`), se me piden.
2. Documento ya registrado (409 `PARTICIPANT_EXISTS`) → aviso con «Abrir registro» (`fields.id`);
   correo de otra persona (409 `EMAIL_IN_USE`) → error junto al campo.
3. Al editar un participante puedo dejar el celular vacío.
4. **Given** `inscripciones.cortesia`, **When** pulso «Inscripción de cortesía» en un participante,
   **Then** elijo el tipo del evento seleccionado (también los inactivos, como «Ponente») y si se le envía
   la credencial; se crea aprobada, sin monto. `ALREADY_REGISTERED` y `REGISTRATION_TYPE_INVALID` con su
   mensaje; `credencialEnviada: false` ofrece reenviarla.
5. **Given** el backend 013, **Then** ambas acciones responden «pronto disponible» (404/405).

### Edge Cases
- **Backend 013 en producción**: sin `accesoCodigo` el login es el de siempre; las rutas nuevas del BFF
  convierten un 404 `NOT_FOUND` o un 405 del backend en 503 con mensaje de respaldo
  (`CODE_LOGIN_UNAVAILABLE`, `PORTAL_SWITCH_UNAVAILABLE`); las páginas del portal distinguen el 404 de
  una ruta inexistente de los 404 de negocio (`INSCRIPTION_NOT_FOUND`, `PHOTO_NOT_FOUND`,
  `PARTICIPANT_NOT_FOUND`) con `esNoDisponible`.
- `GET /me` del 013 no trae `celular`, `foto` ni `google`: los tipos los marcan opcionales.
- `GET /me/inscriptions` del 013 no trae `fotocheck`: una inscripción aprobada se toma como con
  fotocheck y la página del fotocheck dice «pronto disponible».
- `fields.restantes` y `fields.reintentarEnSegundos` llegan como texto; la espera también en
  `Retry-After`, que el BFF reenvía.
- `accesoCodigo.disponible` se cachea 60 s en el backend: puede tardar un minuto en cambiar.
- Un correo que solo es de staff no recibe código: la verificación responde `CODE_EXPIRED` (igual que
  un correo inexistente).
- Una sesión con las dos audiencias o de participante nunca se renueva (`esRenovable`).
- El QR anterior es un id secuencial y se puede falsificar hasta `fechaFin`: por eso el ámbar, el DNI
  completo y la foto. Pasado `fechaFin` → 422 `LEGACY_QR_NOT_ALLOWED`.
- Un código de 10 caracteres contra el backend 013 → 422 `VALIDATION_ERROR` (no ocurre en la práctica:
  el 013 no emite esos QR); el escáner lo muestra como «QR no reconocido» y pide registrar con el
  documento.
- Dos lecturas distintas seguidas se procesan las dos; la misma dentro de 3 s, una sola vez.
- La foto de la persona escaneada se pide con la cookie de staff; si no hay foto o la ruta no existe
  (013), se muestra el marcador sin error.
- Un `X-Forwarded-For` inventado por el cliente no cambia la IP que ve el backend (el BFF toma la
  última entrada, la de Traefik).

## Requirements
- **FR-001**: BFF del código por correo: `GET /api/auth/config` (`{ accesoCodigo: { disponible } }`, sin
  caché), `POST /api/auth/codigo` y `POST /api/auth/codigo/verificar` (valida `Origin`, correo de hasta
  191 caracteres y código de 6 dígitos; guarda la sesión de participante con la vida de `expiraEn`).
  Errores propagados con estado, `code`, `fields` y `Retry-After`; sin backend o sin la ruta, 503
  `CODE_LOGIN_UNAVAILABLE`.
- **FR-002**: BFF del paso al portal: `POST /api/auth/portal` con el Bearer del staff; reemplaza la cookie
  por la sesión de participante; propaga 409/404/403; un 401 cierra la sesión; sin la ruta, 503
  `PORTAL_SWITCH_UNAVAILABLE`.
- **FR-003**: IP real del cliente (`server/utils/ip-cliente.ts`): login, Google y código reenvían en
  `x-forwarded-for` la **última** entrada de `X-Forwarded-For` (o la IP de la conexión), nunca la primera.
- **FR-004**: Solo se renueva la sesión del staff (`esRenovable`); la del participante dura 12 h.
- **FR-005**: Store `auth`: `solicitarCodigo`, `verificarCodigo` e `irAlPortal`
  (`'PORTAL' | 'CODIGO_REQUERIDO'`); `destinoTrasLogin` devuelve al inscrito a `redirect` si es una página
  del portal.
- **FR-006**: Login con `AccesoConCodigo` (dos pasos, cuenta regresiva, intentos restantes) solo si
  `accesoCodigo.disponible`.
- **FR-007**: Navegación del portal en `NAVEGACION_PORTAL` (`app/utils/portal.ts`): pestañas en escritorio
  y barra inferior en el celular (layout `participante`). Cada página declara
  `definePageMeta({ layout: 'participante', perfil: 'participante' })`. `usePortal`: 401 → login con
  motivo y `redirect`; 404 de ruta o 405 → `MENSAJE_PRONTO_DISPONIBLE`.
- **FR-008**: `/mi-fotocheck` con el fotocheck de `GET /api/portal/inscriptions/:id/badge`, la foto de
  `GET /api/portal/photo`, Wake Lock y enlace al PDF; «Ver fotocheck» en «Mis inscripciones». Copia
  del último fotocheck (con la foto, nunca el JWT) en `localStorage` (`ciisic-portal:fotocheck`), del
  participante que la vio.
- **FR-009**: `/mi-asistencia` con `GET /api/portal/attendances`.
- **FR-010**: `/mi-perfil` con `GET /api/portal` (raíz del proxy, `server/api/portal/index.ts` →
  `/api/v1/me`), `PATCH /api/portal/profile` (celular) y
  `PUT|GET|DELETE /api/portal/photo` (foto recodificada con canvas y `formularioFoto`: solo `file` y
  `consentimiento=true`).
- **FR-011**: `/mis-certificados` con estado vacío mientras `GET /api/portal/certificates` responda 404.
- **FR-012**: Escáner `/escanear` (`definePageMeta({ permiso: 'asistencia.marcar', layout: 'escaner' })`,
  ítem «Escanear asistencia» del `MENU` con el mismo permiso; `inicioPara` lleva ahí a la cuenta que
  solo marca asistencia, `soloMarcaAsistencia`): cámara, lector USB y DNI; `interpretarLectura` y
  `debeProcesar` de `app/utils/lecturaQr.ts`; cuerpo `{ codigo }` o `{ participanteId, metodo: 'QR' }`
  (más `fueraDeHorario` con `asistencia.fuera_horario`); resultado verde, ámbar (`alerta: 'QR_LEGADO'`) o
  rojo, con foto. El modo QR de `/asistencia` usa la misma lectura.
- **FR-013**: Participantes: «Nuevo participante» (`participantes.gestionar`, `POST /participants`) y
  «Inscripción de cortesía» (`inscripciones.cortesia`,
  `POST /events/:eventId/courtesy-inscriptions`); celular vacío permitido al editar.
- **FR-014**: Mensajes por código en `app/utils/errores.ts`. Fijos: `CODE_NOT_FOUND`,
  `CODE_OTHER_EVENT`, `MANUAL_NOT_ALLOWED`, `CODE_LOGIN_UNAVAILABLE`, `CODE_LOGIN_PAUSED`,
  `CODE_EXPIRED`, `CODE_LOCKED`, `CODE_REQUIRED`, `PORTAL_SWITCH_UNAVAILABLE` (del BFF),
  `CONSENT_REQUIRED`, `IMAGE_TOO_LARGE`, `PHOTO_CONFLICT`, `PDF_BUSY`, `NAMES_REQUIRED`,
  `PARTICIPANT_EXISTS`. Solo de respaldo (manda el texto del servidor, que trae la hora, la fecha o los
  intentos): `CODE_COOLDOWN`, `INVALID_CODE`, `NOT_APPROVED`, `OUTSIDE_WINDOW`,
  `ATTENDANCE_ALREADY_REGISTERED`, `LEGACY_QR_NOT_ALLOWED`, los de archivos, `EMAIL_IN_USE`,
  `ALREADY_REGISTERED`, `REGISTRATION_TYPE_INVALID` y `DUPLICATE_RECORD`.
- **FR-015**: «Mi portal de participante» en `MenuUsuario` con `acceso.perfilParticipante`; con
  `CODE_REQUIRED` o `GOOGLE_ACCOUNT_MISMATCH`, diálogo con `AccesoConCodigo` y el correo de la cuenta fijo.
- **FR-016**: Compatibilidad con el backend 013 en todo lo anterior (Edge Cases) hasta que se despliegue
  el 014.

## Success Criteria
- **SC-001**: Con el backend 013 en producción nada de lo que ya funcionaba cambia: el login es el mismo
  (sin la opción del código), «Mis inscripciones» y la credencial siguen, las secciones nuevas dicen
  «pronto disponible» y el escáner marca con el QR anterior.
- **SC-002**: Con el backend 014 un inscrito entra con el código sin ayuda; el código nunca abre el
  panel.
- **SC-003**: El escáner nunca envía al backend una lectura que no sea un código de 10 caracteres o un id
  numérico, y la misma lectura no genera dos marcas seguidas.
- **SC-004**: El JWT sigue sin llegar al navegador; la sesión del participante no se renueva; lo único
  del portal que queda en el dispositivo es la copia del fotocheck, que se borra al cerrar la sesión.
- **SC-005**: Las páginas nuevas declaran `perfil: 'participante'` o su `permiso`; ninguna decide con el
  código del rol.
- **SC-006**: Lint, typecheck, pruebas y build en verde; prueba en el navegador con el backend 014 local y
  con el 013 (inscrito con Google y con código, Owner, Comisión que marca).

## Fuera de alcance
- Certificados en el portal (spec 015 del backend).
- Cola sin conexión del escáner y retirar la aceptación del QR anterior (después del 31-oct-2026).
- Mostrar o regenerar el código de la credencial en el detalle de la inscripción del panel.
- Registro `MANUAL` desde el escáner.
