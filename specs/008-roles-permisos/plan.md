# Implementation Plan: Roles y permisos en el panel

## Contrato (backend-ciisic, spec 013)

Fuente de verdad: `backend-ciisic/specs/013-roles-permisos/contracts/api-roles-permisos.md`
([enlace](../../../backend-ciisic/specs/013-roles-permisos/contracts/api-roles-permisos.md)) y el
catálogo `backend-ciisic/src/core/permisos.ts`. El backend ya está desplegado con esta spec; aquí solo va
lo que usa el panel. La cuenta (rol, estado, eventos y permisos) se lee de la BD en cada petición: el
backend es la autoridad y el panel solo evita ofrecer lo que sería rechazado.

| Método y ruta | Permiso | Lo que usa el panel |
|---|---|---|
| `POST /auth/login`, `POST /auth/google` | pública | `usuario.acceso` (en `/auth/google`, dentro de `data`) |
| `GET /auth/session` | sesión | `user.acceso`, leído de la BD; cuenta borrada o inactiva → 401 `SESSION_INVALIDATED` |
| `POST /auth/refresh` (nueva) | staff, 30 cada 15 min | `{ data: { jwt, expiraEn (ISO), usuario } }`; 401 `SESSION_EXPIRED` (12 h desde el ingreso) o `SESSION_INVALIDATED`; 429 `RATE_LIMITED` |
| `GET /roles` | `administradores.gestionar` | Roles que la cuenta puede asignar; `COMISION` con `permisosElegibles[{ codigo, nombre, implica }]` y `permisosPorDefecto` |
| `GET, POST /admin`; `GET, PUT, DELETE /admin/:id` | `administradores.gestionar` | Cuentas con `alcance`, `eventos[{ id, nombreCorto }]` y `permisos`; cuerpo con `rolCodigo` (obligatorio al crear), `eventoIds?` y `permisos?`; `DELETE` → `{ desactivado }` |
| `GET /events` | staff | Global: sin cambios. Por evento: solo sus eventos, vista reducida (sin `credencialCorreo*`, `dominioInstitucional`, `remitenteNombre`, `asuntoAprobacion`, `totalInscripciones`; `datosPago` solo con `pagos.ver`) |
| `GET /events/:id/summary`, `…/integrations/sports-summary` | `resumen.ver` | Montos en `null` sin `pagos.ver` (los conteos se conservan) |
| `GET /events/:eventId/inscriptions`, `GET /inscriptions/:id` | `inscripciones.ver` | Sin `pagos.ver`: `monto`, `modalidadPago`, `numeroOperacion`, `fechaPago` en `null`, `tieneVoucher: false`, `pago.*` en `null`, `tipoInscripcion.precio*` en `null` |
| `PATCH /inscriptions/:id/status` | `inscripciones.validar` | `CANCELADO` exige además `inscripciones.cancelar` (403 `STATUS_NOT_ALLOWED`) |
| `…/inscriptions/export` · `resend-credential` · `voucher` · `DELETE /inscriptions/:id` | `inscripciones.exportar` · `credenciales.reenviar` · `pagos.ver` · `inscripciones.eliminar` | Botones por permiso |
| `GET /activities/:id/attendances` | `asistencia.ver` | Filas con `metodo`, `registradoPor` (ambos `null` en filas antiguas) y `numeroDocumento` enmascarado sin `inscripciones.ver` |
| `POST /activities/:id/attendances` | `asistencia.marcar` (120/min por cuenta) | `{ participanteId?, numeroDocumento?, tipoDocumento?, fueraDeHorario?, metodo? }`; 403 `OUT_OF_HOURS_NOT_ALLOWED`, 404 `PARTICIPANT_NOT_FOUND`, 409 `AMBIGUOUS_DOCUMENT` |
| `DELETE /attendances/:id` | `asistencia.anular` | Anulación lógica; 404 `ATTENDANCE_NOT_FOUND` |
| `GET /events/:eventId/attendances/export` | `asistencia.exportar` | Documento enmascarado sin `inscripciones.ver` |
| `DELETE /contact-messages/:id` · `DELETE /events/:id` | `mensajes.eliminar` · `eventos.eliminar` | Botones por permiso |
| `GET, PUT /settings` | `sistema.configurar` | Solo Owner |

Errores de la guarda: 401 `SESSION_INVALIDATED`; 403 `FORBIDDEN` (sin ninguno de los permisos de la ruta)
y `EVENT_NOT_ASSIGNED` (cuenta por evento fuera de sus eventos); 404 `NOT_FOUND` (cuenta por evento,
recurso sin evento). Equipo: 403 `ROLE_NOT_ASSIGNABLE`, `ADMIN_NOT_MANAGEABLE`; 422 `EVENTS_REQUIRED`,
`EVENT_NOT_FOUND` (`fields.eventoIds`), `PERMISSIONS_REQUIRED`, `PERMISSION_NOT_ELIGIBLE`
(`fields.permisos`); 409 `LAST_OWNER`, `ADMIN_CHANGED`, `SELF_UPDATE_FORBIDDEN`, `SELF_DELETE_FORBIDDEN`,
`EMAIL_IN_USE`.

### Permisos por rol

| Permiso | Owner | Administrador | Tesorero | Comisión |
|---|---|---|---|---|
| `sistema.configurar` | ✓ | — | — | — |
| Globales: `administradores.gestionar`, `eventos.configurar`, `eventos.eliminar`, `catalogos.configurar`, `correo.configurar`, `consultas_dni.gestionar`, `participantes.gestionar`, `inscripciones.cancelar`, `inscripciones.eliminar`, `legacy.usar` | ✓ | ✓ | — | — |
| `resumen.ver`, `inscripciones.ver`, `inscripciones.exportar`, `credenciales.reenviar`, `asistencia.ver`, `asistencia.exportar`, `ponencias.ver`, `mensajes.ver` | ✓ | ✓ | ✓ | elegibles |
| `pagos.ver`, `inscripciones.validar` | ✓ | ✓ | ✓ | nunca |
| `asistencia.marcar`, `asistencia.anular`, `asistencia.fuera_horario` | ✓ | ✓ | — | elegibles (por defecto `asistencia.marcar`) |
| `mensajes.eliminar` | ✓ | ✓ | — | nunca |

Dependencias (el backend las agrega al guardar y al cargar la cuenta): `inscripciones.exportar`,
`credenciales.reenviar` y `pagos.ver` → `inscripciones.ver`; `inscripciones.validar` → `pagos.ver`;
`asistencia.exportar`, `asistencia.marcar` y `asistencia.anular` → `asistencia.ver`;
`asistencia.fuera_horario` → `asistencia.marcar`; `mensajes.eliminar` → `mensajes.ver`. Delegación: el
Owner gestiona todas las cuentas; el Administrador, solo Tesoreros, Comisión y la suya.

## Arquitectura

```
Login / Google ─► BFF guarda la cookie ─► GET /api/auth/session ─► { tipo: 'ADMIN', user: { …, acceso } }
                                                                    │
store auth:  acceso = accesoDeSesion(usuario) ─► puede(permiso) ─► menú (menuPara) · inicio (inicioPara) · botones
middleware:  redireccionPara(tipo, meta, acceso, ruta) ─► la página | inicioPara(acceso) | /sin-acceso
useApi:      401 ─► /login?motivo=…&redirect=…
             403 FORBIDDEN | EVENT_NOT_ASSIGNED ─► refrescarAcceso() + eventos.recargar() ─► salir si ya no se permite
BFF:         proxy y session.get ─► exp − ahora < 20 min ─► POST /v1/auth/refresh ─► cookie con el JWT nuevo
```

### Permisos por página, menú y botones
- **Página**: `definePageMeta({ permiso: '…' })` (o una lista: basta uno). El middleware compara con
  `auth.acceso`; sin el permiso lleva a `inicioPara(acceso)` y, si eso daría la misma ruta, a `/sin-acceso`.
- **Menú**: `MENU` en `app/utils/permisos.ts`, cada ítem con el mismo permiso que su página; `menuPara`
  oculta ítems y secciones vacías. `inicioPara` es la primera página permitida; una cuenta por evento que
  marca asistencia empieza en `/asistencia`.
- **Botones y bloques**: `auth.puede(permiso)` en la plantilla. Sin `pagos.ver` se ocultan columnas y
  bloques de pago; un monto `null` se muestra «—».

### Acceso en la sesión
- `usuario.acceso = { alcance: 'GLOBAL' | 'EVENTO', permisos, eventoIds (null en globales),
  perfilParticipante }` llega en `/auth/login`, `/auth/google` y `/auth/session` (y en `/auth/refresh`, que
  el BFF no reenvía al navegador). `accesoDeSesion` lo normaliza.
- Los cambios de rol, eventos o permisos no cierran la sesión: el panel los conoce al recargar la página,
  tras un 403 (relectura con `refrescarAcceso`, como máximo cada 15 s) o con «Volver a intentar» en
  `/sin-acceso`.

### Renovación en el BFF
- `renovarSiHaceFalta` (en `proxyAutenticado` y `session.get`): si el JWT es de staff y le quedan menos de
  20 min, pide `POST /v1/auth/refresh` con el Bearer actual y guarda el nuevo en la cookie con su vida.
  Las peticiones que llegan con el mismo JWT comparten la renovación durante 60 s (el límite es de 30
  renovaciones cada 15 min por cuenta).
- Si la renovación falla, la petición sigue con el JWT actual; al caducar, el backend responde 401, el BFF
  borra la cookie y `useApi` lleva al login con `motivo=SESSION_EXPIRED` (máximo de 12 h) o
  `SESSION_INVALIDATED`.
- `/api/auth/session` solo cierra la sesión ante un 401; si el backend no responde, 503
  `SESSION_UNAVAILABLE` y la cookie se conserva.

### Evento seleccionado por cuenta
`useEventoStore` guarda la elección en `localStorage` (`panel_evento_seleccionado:<id de la cuenta>`; la
clave anterior se lee como respaldo y se valida contra la lista). Otra cuenta en el mismo navegador vuelve
a pedir la lista; con la lista vacía no hay selección.

## Archivos

| Archivo | Rol |
|---|---|
| `app/types/api.ts` | `CodigoRol`, `Permiso`, `AccesoPanel`, `PermisoElegible`, `RolAsignable`; `Usuario.acceso`; `Administrador` con alcance, eventos y permisos; montos que pueden ser `null` |
| `app/utils/permisos.ts` | Catálogo y dependencias, `tienePermiso`, `accesoDeSesion`, `MENU`, `menuPara`, `inicioPara`, `conDependencias`, `requeridoPor`, `dependenciasDe`; etiquetas y tono del rol (único lugar con códigos de rol) |
| `app/types/router.d.ts` | Meta `permiso` (en lugar de `soloSuperAdmin`) y `perfil` |
| `app/utils/sesion.ts` | `redireccionPara` con acceso y ruta, `destinoTrasLogin` con redirect permitido, `avisoLogin` (`SESSION_EXPIRED`), `rutaLoginTrasCierre` |
| `app/middleware/auth.global.ts` | Aplica perfil y permiso con las utilidades puras |
| `app/pages/*.vue` (14 de staff) | `definePageMeta({ permiso })` |
| `app/pages/sin-acceso.vue` | Cuenta sin secciones: «Volver a intentar» y «Cerrar sesión» |
| `app/stores/auth.ts` | `acceso`, `puede`, `refrescarAcceso` (sin `esSuperAdmin`) |
| `app/stores/evento.ts` | Selección por cuenta, recarga al cambiar de cuenta, `recargar` |
| `app/composables/useApi.ts` | 401 → login con motivo; 403 de permisos → relectura del acceso y de los eventos |
| `app/components/layout/AppSidebar.vue`, `app/layouts/default.vue` | Menú por permisos, logo a `inicioPara`, etiqueta del rol |
| `app/components/eventos/EventoForm.vue`, `app/pages/eventos/[id].vue` | Credencial de correo con `correo.configurar`; pestaña «Acceso» con `eventos.configurar`; «Eliminar» con `eventos.eliminar` |
| `app/utils/formato.ts` | `soles(null)` → «—» |
| `app/utils/errores.ts` | Mensajes de los códigos nuevos y `SESSION_UNAVAILABLE` |
| `app/utils/administradores.ts`, `app/pages/administradores.vue` | Rol obligatorio, etiquetas y tono; pantalla de equipo (eventos, permisos de la Comisión, delegación) |
| `app/pages/inscripciones/index.vue`, `app/components/inscripciones/InscripcionDetalle.vue` | Montos `null`; columnas y acciones por permiso |
| `app/pages/index.vue`, `app/components/dashboard/SemanaSistemicaCard.vue` | Montos solo con `pagos.ver` |
| `app/pages/asistencia.vue` | Marcar, anular, fuera de horario y exportar por permiso; método, quién registró, documento enmascarado, `tipoDocumento` |
| `app/pages/mensajes.vue` | «Eliminar» con `mensajes.eliminar` |
| `app/utils/inscripciones.ts` | Botones del detalle según estado y permisos (`accionesInscripcion`), textos de la lista sin `pagos.ver` |
| `app/utils/asistencia.ts` | Tipos de la marca, etiqueta del método, tipos de documento para `AMBIGUOUS_DOCUMENT`, formato del código |
| `app/utils/resumen.ts` | Conteos de la Semana Sistémica cuando los montos llegan en `null` |
| `app/components/administradores/CasillasEventosCuenta.vue`, `CasillasPermisosCuenta.vue` | Eventos de la cuenta y permisos de la Comisión (con dependencias) en el formulario del equipo |
| `server/utils/renovar-sesion.ts` | `debeRenovar`, `renovarSiHaceFalta` (renovación compartida) |
| `server/utils/proxy.ts`, `server/api/auth/session.get.ts` | Renuevan antes de reenviar; `session.get` distingue 401 de backend caído |
| `server/utils/jwt-publico.ts` | `esSesionDeStaff` |
| `tests/permisos.test.ts`, `tests/renovarSesion.test.ts`, `tests/sesion.test.ts`, `tests/utils.test.ts`, `tests/administradores.test.ts`, `tests/inscripciones.test.ts`, `tests/asistencia.test.ts`, `tests/resumen.test.ts` | Pruebas Vitest |

## Decisiones

- **Por permiso, nunca por rol.** Los códigos `SUPERADMIN`/`ADMIN`/`TESORERO`/`COMISION` solo aparecen en
  `app/utils/permisos.ts` (etiquetas, tono y el respaldo para sesiones sin `acceso`). Así un rol nuevo o un
  cambio de permisos en el backend no obliga a tocar pantallas. El `tipo: 'ADMIN'` de la sesión es el
  perfil (staff), no el rol.
- **Catálogo copiado del backend** (`ETIQUETAS_PERMISO`, `DEPENDENCIAS`): tipa `Permiso`, de modo que un
  permiso mal escrito en `definePageMeta` o en `puede()` no compila. Para las casillas de la Comisión manda
  `GET /roles` (`permisosElegibles` con `implica`, vía `dependenciasDe`). Un código que el panel no conoce
  se ignora; si el backend agrega permisos, se agregan aquí.
- **Respaldo sin `acceso`**: Owner todos, Administrador todos menos `sistema.configurar`, otros ninguno.
  Solo cubre respuestas anteriores a la spec 013; el backend ya invalida los JWT sin huella.
- **Inicio por cuenta**: la primera página del menú que puede abrir; la Comisión que marca asistencia,
  `/asistencia`; sin ninguna, `/sin-acceso` (sin permiso propio y con salida si ya puede entrar). Nunca se
  redirige a la misma ruta.
- **`redirect` tras el login** solo si es interno y la cuenta puede abrir esa página.
- **Relectura del acceso tras un 403** (`FORBIDDEN`, `EVENT_NOT_ASSIGNED`): como máximo cada 15 s, con un
  candado para que la recarga de eventos no dispare otra; los fallos que no son 401 conservan la sesión; el
  error siempre se relanza.
- **Renovación en el BFF, no en el navegador**: el JWT nunca llega a JavaScript (principio I). Margen de
  20 min sobre un JWT de 1 h; el corte de 12 h lo decide el backend. Una renovación por JWT durante 60 s
  para no agotar el límite con peticiones en paralelo.
- **Backend caído ≠ sesión cerrada**: `session.get` borra la cookie solo ante un 401.
- **Selección de evento por cuenta** en `localStorage` (preferencia, no sesión); se valida siempre contra
  la lista que devuelve el backend.
- **Montos**: ocultar columnas y bloques de pago sin `pagos.ver` en lugar de mostrar vacíos; donde un
  monto `null` igual se pinta, «—».
- **Equipo**: los roles ofrecidos salen de `GET /roles` (el backend decide la delegación). Las acciones que
  el backend rechazaría (propia cuenta, roles no gestionables) no se ofrecen, pero sus códigos tienen
  mensaje por si acaso. El rol es obligatorio al crear (sin valor por defecto).
- **Compatibilidad**: el backend conserva `SUPERADMIN`/`ADMIN` hasta después del 30-oct-2026; el panel
  muestra «Owner» y «Administrador del sistema» por `ETIQUETAS_ROL`.

## Constitution Check

- I. El JWT sigue en la cookie httpOnly; la renovación ocurre servidor a servidor en el BFF y el navegador
  solo recibe `acceso` (permisos y eventos), que no es secreto.
- II. Solo Tailwind v4 y tokens de marca (`/sin-acceso` y la etiqueta del rol usan los componentes base).
- III. Multi-evento: el selector muestra solo los eventos de la cuenta y la selección se recuerda por
  cuenta; las pantallas siguen trabajando sobre el evento seleccionado.
- IV. Textos en español, mensajes por código, confirmación al anular asistencias y al eliminar.
- V. Lógica en utilidades puras con pruebas Vitest (`permisos`, `sesion`, `renovar-sesion`, `formato`,
  `administradores`, `inscripciones`, `asistencia`, `resumen`); lint, typecheck, test y build en verde.
- VI (enmienda 1.2.0). Dos perfiles por audiencia; dentro del staff, permisos declarados por página con la
  meta `permiso`, menú y botones con `puede()`; el backend es la autoridad.
