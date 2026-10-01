# Feature Specification: Roles y permisos en el panel (Owner, Administrador del sistema, Tesorero y Comisión)

**Feature Branch**: `feat/roles-permisos` · **Created**: 2026-10-01 · **Status**: En implementación
**Contrato**: backend-ciisic spec 013, ya desplegada (resumen en [plan.md](plan.md))
**Input**: "como funciona el tema de los permisos y roles ... poner owner administrador de sistema,
tesorero ... solo owner y administrador del sistema pueden ver la configuración ... el owner puede crear
administradores y todo tipo y también el mismo owner, pero el administrador no, el tesorero solo puede
ver resumen inscripciones todo lo que tiene que ver del congreso ... los administradores pueden designar
a cierto equipo de la comisión tecnológica pero no acceso a todo para que puedan por ejemplo marcar
asistencia de los inscritos"

Roles (código del backend → nombre visible): `SUPERADMIN` → **Owner** y `ADMIN` → **Administrador del
sistema**, con alcance global; `TESORERO` → **Tesorero** y `COMISION` → **Comisión tecnológica**, con
alcance por evento (solo sus eventos). El panel decide todo por **permisos** (`usuario.acceso.permisos`),
nunca por el código del rol. El tipo de sesión `'ADMIN' | 'PARTICIPANTE'` es el perfil (staff o inscrito),
no el rol, y no cambia.

## User Scenarios & Testing

### User Story 1 - Cada cuenta ve solo lo que puede usar (Priority: P1)
Como cuenta de staff quiero ver en el menú solo las pantallas que mis permisos permiten y empezar en la
que me sirve.

**Acceptance Scenarios**:
1. **Given** un Owner, **Then** veo todo el menú, incluido «Sistema», y la barra superior dice «Owner».
2. **Given** un Administrador del sistema, **Then** veo todo menos «Sistema»; **When** abro `/sistema` por
   URL, **Then** vuelvo a mi página de inicio (Resumen).
3. **Given** un Tesorero, **Then** veo Resumen, Inscripciones, Asistencia, Ponencias y Mensajes y ninguna
   pantalla de Configuración; **When** abro `/eventos` por URL, **Then** vuelvo al Resumen.
4. **Given** una cuenta de la Comisión con «Marcar asistencia», **When** entro, **Then** llego directo a
   `/asistencia` y el menú solo muestra lo que me dieron.
5. **Given** una cuenta sin ningún permiso del menú, **Then** llego a `/sin-acceso` con «Volver a
   intentar» y «Cerrar sesión»; **When** me asignan permisos y pulso «Volver a intentar», **Then** entro a
   mi inicio sin volver a ingresar.
6. **Given** que vengo del login con `redirect` a una página que mi cuenta no puede abrir, **Then** voy a
   mi inicio, no a esa página.

### User Story 2 - Trabajar solo en mis eventos (Priority: P1)
Como Tesorero o Comisión quiero ver y operar solo los eventos que me asignaron.

**Acceptance Scenarios**:
1. **Given** una cuenta por evento, **Then** el selector de la barra superior lista solo mis eventos (la
   vista reducida de `GET /events`) y recuerda el que elegí en este navegador para mi cuenta.
2. **Given** que otra cuenta entra en el mismo navegador, **Then** no hereda el evento elegido por la
   anterior: se vuelve a pedir la lista y se valida la selección.
3. **Given** que me quitan un evento mientras lo uso, **When** el backend responde 403
   `EVENT_NOT_ASSIGNED`, **Then** el panel relee mi acceso y mis eventos, cambia a uno válido y me muestra
   el mensaje.
4. **Given** que no tengo eventos asignados, **Then** no hay evento seleccionado y la pantalla lo explica
   en lugar de fallar.
5. **Given** la vista reducida de eventos, **Then** ninguna pantalla que abre una cuenta por evento usa
   campos que esa vista no trae (`credencialCorreo`, `totalInscripciones`, `dominioInstitucional`…).

### User Story 3 - Montos y pagos solo con `pagos.ver` (Priority: P1)
Como Owner quiero que la Comisión no vea montos ni datos de pago, y que el Tesorero sí.

**Acceptance Scenarios**:
1. **Given** una cuenta sin `pagos.ver`, **When** abro el Resumen, **Then** veo los conteos, pero los
   montos (y los de la tarjeta de la Semana Sistémica) no aparecen o muestran «—», nunca «S/ 0.00».
2. **Given** una cuenta sin `pagos.ver`, **When** abro Inscripciones, **Then** no veo las columnas de pago
   ni el voucher, y en el detalle no aparece el bloque de pago ni el precio del tipo.
3. **Given** un Tesorero, **Then** veo montos y vouchers y puedo aprobar, rechazar y poner en revisión,
   pero no cancelar ni eliminar inscripciones.

### User Story 4 - Botones según los permisos (Priority: P1)
Como cuenta de staff quiero ver solo las acciones que puedo hacer, para no chocar con un «No tienes
permiso».

**Acceptance Scenarios**:
1. **Given** Inscripciones, **Then** «Aprobar», «Rechazar» y «En revisión» exigen `inscripciones.validar`;
   «Cancelar», `inscripciones.cancelar`; «Eliminar», `inscripciones.eliminar`; «Exportar CSV»,
   `inscripciones.exportar`; «Reenviar credencial», `credenciales.reenviar`.
2. **Given** Asistencia, **Then** marcar exige `asistencia.marcar`; la casilla «Fuera de horario»,
   `asistencia.fuera_horario`; «Anular» (con confirmación), `asistencia.anular`; exportar,
   `asistencia.exportar`. La lista muestra el método (QR, documento, manual) y quién registró.
3. **Given** una cuenta sin `inscripciones.ver`, **Then** el documento de la asistencia se ve enmascarado
   (`****5678`), tal como lo envía el backend.
4. **When** marco por documento y dos inscritos del evento comparten el número (409
   `AMBIGUOUS_DOCUMENT`), **Then** se me pide el tipo de documento y se reintenta con `tipoDocumento`.
5. **Given** Mensajes, **Then** «Eliminar» exige `mensajes.eliminar`. **Given** Eventos, **Then**
   «Eliminar» exige `eventos.eliminar`, la credencial de correo `correo.configurar` y la pestaña «Acceso»
   `eventos.configurar`.

### User Story 5 - Armar el equipo (Priority: P1)
Como Owner quiero crear cuentas de cualquier rol; como Administrador del sistema, Tesoreros y cuentas de
la Comisión con sus eventos y permisos.

**Acceptance Scenarios**:
1. **Given** un Owner, **When** creo una cuenta, **Then** puedo elegir los 4 roles; **Given** un
   Administrador, **Then** solo Tesorero y Comisión (los roles salen de `GET /roles`) y en la lista solo
   veo esas cuentas y la mía.
2. **When** elijo Tesorero o Comisión, **Then** aparece el selector de eventos (obligatorio); con Comisión
   aparecen las casillas de los permisos elegibles con su nombre, con «Marcar asistencia» marcada por
   defecto.
3. **When** marco un permiso, **Then** se marcan los que implica; **Then** no puedo desmarcar uno que otro
   marcado exige, y se me dice cuál.
4. **Given** mi propia cuenta, **Then** no se me ofrece desactivarme ni cambiar mi rol, mis eventos o mis
   permisos; sin ser Owner, tampoco mi correo ni desvincular mi Google.
5. **Then** la lista muestra Rol, Eventos y Permisos de cada cuenta y el botón dice «Nueva cuenta».
6. **When** el backend rechaza el cambio (`LAST_OWNER`, `ADMIN_CHANGED`, `EVENTS_REQUIRED`,
   `PERMISSION_NOT_ELIGIBLE`…), **Then** veo el mensaje en español junto al campo o como aviso.
7. **When** elimino una cuenta que ya revisó inscripciones o registró asistencias, **Then** se me avisa
   que se desactivó en lugar de eliminarse.

### User Story 6 - Sesión que se renueva y expira (Priority: P2)
Como cuenta de staff quiero trabajar toda la jornada sin que el JWT de 1 h me saque, y que se me explique
cuándo debo volver a ingresar.

**Acceptance Scenarios**:
1. **Given** una sesión activa, **When** al JWT le quedan menos de 20 min, **Then** el BFF lo renueva sin
   que lo note; las peticiones simultáneas comparten una sola renovación.
2. **Given** 12 h desde que ingresé, **When** el JWT caduca, **Then** voy a `/login` con el aviso
   «llegó a su duración máxima» y con `redirect` para volver a la página.
3. **Given** que cambian mi correo, mi contraseña o mi Google, o me desactivan, **Then** la siguiente
   petición me lleva al login con el aviso de sesión invalidada.
4. **Given** que cambian mi rol, mis eventos o mis permisos, **Then** la sesión no se cierra: al siguiente
   403, al recargar o con «Volver a intentar» el menú se actualiza.
5. **Given** que el backend no responde, **When** se verifica la sesión, **Then** recibo 503
   `SESSION_UNAVAILABLE` y la cookie se conserva (no me saca del panel).

### Edge Cases
- Sesión sin `acceso` (respuesta anterior a la spec 013): Owner → todos los permisos, Administrador →
  todos menos `sistema.configurar`, cualquier otro rol → ninguno. Los permisos y los ids de evento
  desconocidos o inválidos se ignoran.
- Un 403 `FORBIDDEN` repetido no provoca bucles: el acceso se relee como máximo cada 15 s y un candado
  evita reacciones anidadas (la recarga de eventos también usa la API). El error se relanza para que la
  pantalla lo muestre.
- Si el inicio de la cuenta es la misma página que se le niega, va a `/sin-acceso`; `/sin-acceso` no exige
  permiso y saca a la cuenta que ya puede abrir alguna sección.
- La renovación falla (401 `SESSION_EXPIRED`/`SESSION_INVALIDATED`, 429 `RATE_LIMITED`, backend caído): la
  petición sigue con el JWT actual; cuando caduque, el backend responde 401 y el panel va al login.
- «Fuera de horario» marcado dentro del horario: el backend guarda `false` (la marca no queda como fuera de
  horario).
- Mensajes antiguos sin evento: una cuenta por evento recibe 404 `NOT_FOUND`.
- Marcar sin `asistencia.fuera_horario` con la casilla puesta → 403 `OUT_OF_HOURS_NOT_ALLOWED`; cancelar
  sin `inscripciones.cancelar` → 403 `STATUS_NOT_ALLOWED` (la pantalla no debería ofrecerlos).
- Anular una asistencia ya anulada → 404 `ATTENDANCE_NOT_FOUND`; volver a marcarla la reactiva.

## Requirements
- **FR-001**: Tipos del contrato en `app/types/api.ts`: `CodigoRol`, `Permiso` (los 29 del catálogo),
  `AccesoPanel`, `PermisoElegible`, `RolAsignable`; `Usuario.acceso`; `Administrador` con `alcance`,
  `eventos` y `permisos`; montos, precios y datos de pago que pueden llegar en `null`.
- **FR-002**: `app/utils/permisos.ts` con el catálogo (`ETIQUETAS_PERMISO`, `DEPENDENCIAS`),
  `tienePermiso` (basta uno de la lista), `accesoDeSesion`, `MENU`/`menuPara`/`inicioPara`,
  `conDependencias`, `requeridoPor` y `dependenciasDe`. Es el **único** archivo que menciona códigos de rol
  (`ETIQUETAS_ROL`, `etiquetaRol`, `tonoRol` y el respaldo por rol de `accesoDeSesion`).
- **FR-003**: Cada página de staff declara `definePageMeta({ permiso })` con el mismo permiso que su ítem
  del `MENU`; `app/types/router.d.ts` lo tipa como `Permiso | Permiso[]` (un permiso inventado no compila).
  Desaparece `soloSuperAdmin`.
- **FR-004**: El middleware usa `redireccionPara(tipo, meta, acceso, ruta)` y `destinoTrasLogin` (redirect
  solo si la cuenta puede abrirlo); página `/sin-acceso` sin permiso.
- **FR-005**: Store de sesión con `acceso`, `puede(permiso)` y `refrescarAcceso()` (máximo una lectura cada
  15 s salvo `forzar`; ante fallos que no son 401 conserva la sesión). Menús y botones usan `auth.puede`.
- **FR-006**: Store de eventos con la selección recordada por cuenta (`panel_evento_seleccionado:<id>`, la
  clave anterior como respaldo validado), nueva lista al cambiar de cuenta, sin selección con la lista
  vacía y `recargar()`.
- **FR-007**: `useApi`: un 401 lleva a `/login?motivo=…&redirect=…`; un 403 `FORBIDDEN` o
  `EVENT_NOT_ASSIGNED` relee el acceso y los eventos, sale de la página si ya no está permitida y relanza
  el error.
- **FR-008**: BFF: `server/utils/renovar-sesion.ts` renueva el JWT del staff con `POST /v1/auth/refresh`
  cuando le quedan < 20 min (en el proxy y en `session.get`), con una renovación compartida por JWT durante
  60 s; `session.get` cierra la sesión solo ante un 401 del backend y, si no responde, devuelve 503
  `SESSION_UNAVAILABLE` sin borrar la cookie.
- **FR-009**: Montos en `null`: `soles(null)` muestra «—» y el número de operación también; sin
  `pagos.ver` se ocultan columnas, voucher y montos (inscripciones, detalle, diálogo de aprobar, resumen y
  Semana Sistémica).
- **FR-010**: Acciones por permiso en Inscripciones, Asistencia, Mensajes y Eventos (US4).
- **FR-011**: Asistencia con `metodo`, `registradoPor`, documento enmascarado, `tipoDocumento` ante
  `AMBIGUOUS_DOCUMENT` y anulación lógica.
- **FR-012**: Equipo y administradores: roles de `GET /roles`, `eventoIds` y `permisos` según el rol final,
  casillas de la Comisión con dependencias, acciones según la delegación y la propia cuenta, columnas de
  eventos y permisos, rol obligatorio al crear y «Nueva cuenta».
- **FR-013**: Mensajes por código en `app/utils/errores.ts`: `FORBIDDEN`, `EVENT_NOT_ASSIGNED`,
  `SESSION_INVALIDATED`, `SESSION_EXPIRED`, `SESSION_UNAVAILABLE`, `ROLE_NOT_ASSIGNABLE`,
  `ADMIN_NOT_MANAGEABLE`, `LAST_OWNER`, `ADMIN_CHANGED`, `SELF_UPDATE_FORBIDDEN`, `EVENTS_REQUIRED`,
  `EVENT_NOT_FOUND`, `PERMISSIONS_REQUIRED`, `PERMISSION_NOT_ELIGIBLE`, `OUT_OF_HOURS_NOT_ALLOWED`,
  `STATUS_NOT_ALLOWED`, `PARTICIPANT_NOT_FOUND`, `AMBIGUOUS_DOCUMENT`, `ATTENDANCE_NOT_FOUND`.
- **FR-014**: La barra superior y la lista del equipo muestran el nombre visible del rol (Owner,
  Administrador del sistema, Tesorero, Comisión tecnológica).

## Success Criteria
- **SC-001**: Fuera de `app/utils/permisos.ts` ningún archivo decide con `'SUPERADMIN'` o `'ADMIN'` como rol.
- **SC-002**: Toda página de staff (salvo `/sin-acceso`) declara su `permiso`, y coincide con el de su ítem
  del menú.
- **SC-003**: Ninguna cuenta ve en el menú ni abre por URL una pantalla sin su permiso, y ningún botón
  ofrece una acción que el backend rechazaría por permiso.
- **SC-004**: Sin `pagos.ver` nunca se muestra «S/ 0.00» por un monto `null`.
- **SC-005**: Una sesión de staff activa dura hasta 12 h aunque cada JWT dure 1 h; el JWT sigue sin llegar
  al navegador.
- **SC-006**: Lint, typecheck, pruebas y build en verde; prueba en el navegador con una cuenta de cada rol.
