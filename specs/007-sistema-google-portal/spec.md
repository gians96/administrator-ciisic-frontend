# Feature Specification: Sistema, inicio de sesión con Google y portal del inscrito

**Feature Branch**: `feat/panel-admin` · **Created**: 2026-09-29 · **Status**: En implementación
**Contrato**: acordado con `backend-ciisic`, que lo implementa en paralelo (resumen en [plan.md](plan.md))
**Input**: "Página «Sistema» (SuperAdmin) para API_UNDC, Google, URL del panel y la landing anterior…
Login con Google… Perfil de participante y «Mis inscripciones»… Google vinculado en administradores y
participantes; correo verificado con Google en las inscripciones."

## User Scenarios & Testing

### User Story 1 - Configurar el sistema sin redesplegar (Priority: P1)
Como SuperAdmin quiero configurar desde el panel la conexión con API_UNDC (URL, API key y tiempo de
espera), el client ID de Google, la URL pública del panel y las rutas de la landing anterior; probar la
conexión con API_UNDC y saber quién hizo el último cambio.

**Acceptance Scenarios**:
1. **Given** un Admin (no SuperAdmin), **When** intento abrir `/sistema`, **Then** se me redirige al inicio y
   no veo «Sistema» en el menú.
2. **Given** una API key guardada, **Then** solo veo `••••9f3a`; el campo va vacío («Dejar vacío para
   conservar») y la key solo se envía si escribo una nueva. «Quitar key» la borra (`null`) previa confirmación.
3. **Given** que cambio solo el tiempo de espera, **When** guardo la tarjeta, **Then** el PUT lleva solo
   `undcApiTimeoutMs` y los cambios sin guardar de otras tarjetas se conservan.
4. **When** pulso «Probar conexión», **Then** veo el mensaje, el código HTTP y la latencia, y el estado
   (Conectada / Con error / Sin probar) se actualiza. Sin URL o sin key el botón está deshabilitado.
5. **Given** una URL sin https (http solo para localhost), un tiempo fuera de 1000–30000 ms o un client ID
   con otro formato, **Then** veo el error en español junto al campo y no se envía nada.
6. **Given** la tarjeta de Google, **Then** veo que el client ID no es secreto (no hace falta client secret) y
   la lista de orígenes a autorizar en Google Cloud (el del panel y el de la URL configurada) con la
   indicación de agregar el dominio de cada landing.
7. **When** desactivo las rutas de la landing anterior, **Then** se me pide confirmación explicando que la
   landing anterior dejará de poder inscribir.

### User Story 2 - Entrar con Google (Priority: P1)
Como administrador o como inscrito a un evento quiero entrar con mi cuenta de Google.

**Acceptance Scenarios**:
1. **Given** Google configurado, **Then** el login muestra «o continúa con Google», el botón y el texto
   «¿Te inscribiste a un evento? Entra con la cuenta de Google del correo que usaste al inscribirte». Sin
   client ID no aparece nada de eso y el acceso con contraseña sigue igual.
2. **Given** un administrador activo, **When** entra con Google, **Then** va a `redirect` (si es una ruta
   interna) o al inicio.
3. **Given** un inscrito, **When** entra con Google, **Then** va a `/mis-inscripciones`.
4. **Given** una cuenta no registrada, con el correo sin verificar, no autoritativa (p. ej. Outlook con
   cuenta de Google) o vinculada a otra persona, **Then** veo el mensaje de ese caso, nunca «credenciales
   inválidas».
5. **Given** que un intento falló o pasaron más de 15 minutos, **When** vuelvo a intentarlo, **Then** el botón
   usa un nonce nuevo (el anterior es de un solo uso).

### User Story 3 - Mis inscripciones (Priority: P1)
Como inscrito quiero ver mis inscripciones y descargar mi credencial cuando esté aprobada.

**Acceptance Scenarios**:
1. **Given** una sesión de inscrito, **When** abro cualquier página del panel, **Then** vuelvo a
   `/mis-inscripciones`: sin menú lateral ni selector de evento, con mi nombre, correo y «Salir».
2. **Given** mis inscripciones, **Then** veo por cada una el evento y sus fechas, el tipo y etiqueta, el monto
   (con precio regular y descuento si lo hubo), el pago, el estado, el motivo si fue rechazada y la fecha
   de revisión.
3. **Given** una inscripción con la credencial disponible, **Then** veo «Descargar credencial» (PDF por el BFF).
4. **Given** que no tengo inscripciones, **Then** se me explica que se buscan por el correo de la
   inscripción y que solo funcionan cuentas de Google (Gmail o institucionales).
5. **Given** que un administrador cambió mi correo, **When** vuelvo a consultar, **Then** la sesión se cierra y
   el login me explica el motivo (`SESSION_INVALIDATED`).

### User Story 4 - Cuentas de Google en el panel (Priority: P2)
Como SuperAdmin quiero ver qué administradores tienen Google vinculado y desvincularlo; como Admin, lo
mismo con los participantes; y al revisar una inscripción, saber si el correo se verificó con Google.

**Acceptance Scenarios**:
1. **Given** un administrador o participante con Google vinculado, **Then** veo «Google vinculado» y la
   acción «Desvincular Google», que pide confirmación.
2. **Given** una inscripción con el correo verificado, **Then** el detalle dice «Correo verificado con Google
   (Estudiante / Personal UNDC / Externo)» y la lista muestra un indicador junto al correo.

### Edge Cases
- El script de Google no carga (red o bloqueador): mensaje con «Reintentar»; la contraseña sigue funcionando.
- Una sesión de inscrito que llama a `/api/backend/**` recibe 403 `FORBIDDEN_PROFILE`; una de administrador
  en `/api/portal/**`, también.
- Un administrador que abre `/mis-inscripciones` vuelve al inicio.
- `redirect` externo (`//otro.sitio`, `/\otro.sitio`, `https://…`) se ignora.
- Un JWT sin `aud` (emitido antes de los perfiles) no es de inscrito: el BFF lo deja pasar al backend, que decide.
- «Probar conexión» usa la configuración guardada: con cambios sin guardar en la tarjeta, el botón se deshabilita.
- Borrar el client ID de Google o la conexión con API_UNDC pide confirmación (deja sin Google a todos o sin
  verificación de estudiantes).

## Requirements
- **FR-001**: `/sistema` con `definePageMeta({ soloSuperAdmin: true })` y entrada «Sistema» en Configuración
  solo para SuperAdmin.
- **FR-002**: Cuatro tarjetas (API UNDC, Google, URL del panel, Landing anterior) y «Actualizado por X el …».
  Cada tarjeta guarda solo sus campos cambiados (PUT parcial); la API key es write-only.
- **FR-003**: Validación en el navegador con las reglas del backend: URL https (http solo localhost) sin
  usuario ni contraseña, timeout entero 1000–30000, key 10–500, client ID
  `^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$`.
- **FR-004**: `GET /api/auth/google` devuelve `{ clientId, nonce }` y guarda el nonce (32 bytes base64url) en la
  cookie httpOnly `ciisic_google_nonce` (SameSite Strict, path `/api/auth/google`, 15 min); sin client ID
  devuelve `{ clientId: null }` sin cookie.
- **FR-005**: `POST /api/auth/google` valida el origen y la credencial (≤ 4096, 3 segmentos), consume el nonce
  (sin él, 400 `GOOGLE_SESSION_EXPIRED`), crea la sesión con la vida del JWT y propaga los errores del backend
  con su `code`.
- **FR-006**: El store de sesión distingue `ADMIN` y `PARTICIPANTE`; el middleware usa `redireccionPara` y
  `destinoTrasLogin` (utilidades puras). Meta de página `perfil: 'admin' | 'participante'`.
- **FR-007**: `/api/backend/**` rechaza sesiones de inscrito (403 `FORBIDDEN_PROFILE`); `/api/portal/**` solo
  acepta sesiones de inscrito y reenvía a `/api/v1/me/**` con las mismas validaciones de ruta; en 401 cierra
  la sesión.
- **FR-008**: Layout `participante` (marca, nombre, correo, Salir) y página `/mis-inscripciones` con estados de
  carga, vacío y error.
- **FR-009**: Mensajes por código en `app/utils/errores.ts`: `GOOGLE_*`, `INVALID_GOOGLE_TOKEN`,
  `SESSION_INVALIDATED`, `FORBIDDEN_PROFILE`, `UNDC_API_NOT_CONFIGURED`, `HOST_NOT_ALLOWED`, `INVALID_URL`.
- **FR-010**: Administradores y participantes: insignia «Google vinculado» y «Desvincular Google»
  (`{ desvincularGoogle: true }`); inscripciones: verificación del correo en el detalle e indicador en la lista.

## Success Criteria
- **SC-001**: Una sesión de inscrito no llega a ninguna página ni ruta administrativa (middleware y BFF).
- **SC-002**: Ni el JWT ni el nonce son legibles desde JavaScript; la API key de API_UNDC nunca vuelve del backend.
- **SC-003**: La única variable de entorno del panel es `NUXT_BACKEND_BASE_URL`.
- **SC-004**: Lint, typecheck, pruebas y build en verde.
