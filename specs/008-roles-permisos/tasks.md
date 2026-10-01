# Tasks: Roles y permisos en el panel

## Fase 0 - Documentación
- [x] T001 Enmienda 1.2.0 de la constitución (principio VI: dos perfiles por audiencia; dentro del staff, permisos declarados por página con la meta `permiso`; el backend es la autoridad)
- [x] T002 Spec 008 (spec, plan y tasks); `docs/overview.md` (permiso de cada pantalla y qué ve cada rol), `docs/arquitectura.md` y `AGENTS.md` (permiso en lugar de `soloSuperAdmin`, renovación de la sesión, specs 001–008)

## Base
- [x] T003 Tipos del contrato en `app/types/api.ts` (`CodigoRol`, `Permiso`, `AccesoPanel`, `PermisoElegible`, `RolAsignable`; `Usuario.acceso`; `Administrador` con alcance, eventos y permisos; montos, precios y datos de pago que pueden ser `null`)
- [x] T004 [P] `app/utils/permisos.ts` (catálogo, dependencias, `tienePermiso`, `accesoDeSesion` con respaldo por rol, `MENU`, `menuPara`, `inicioPara`, `conDependencias`, `requeridoPor`, `dependenciasDe`, etiquetas y tono del rol) con pruebas (`tests/permisos.test.ts`)
- [x] T005 [P] Mensajes por código en `app/utils/errores.ts` (`FORBIDDEN`, `EVENT_NOT_ASSIGNED`, `SESSION_INVALIDATED`, `SESSION_EXPIRED`, `SESSION_UNAVAILABLE`, `ROLE_NOT_ASSIGNABLE`, `ADMIN_NOT_MANAGEABLE`, `LAST_OWNER`, `ADMIN_CHANGED`, `SELF_UPDATE_FORBIDDEN`, `EVENTS_REQUIRED`, `EVENT_NOT_FOUND`, `PERMISSIONS_REQUIRED`, `PERMISSION_NOT_ELIGIBLE`, `OUT_OF_HOURS_NOT_ALLOWED`, `STATUS_NOT_ALLOWED`, `PARTICIPANT_NOT_FOUND`, `AMBIGUOUS_DOCUMENT`, `ATTENDANCE_NOT_FOUND`)
- [x] T006 [P] `soles(null)` → «—» (con prueba) y `?? '—'` en el número de operación de la lista y del detalle de inscripciones

## US1 - Menú y páginas por permiso
- [x] T007 `app/types/router.d.ts`: meta `permiso` (`Permiso | Permiso[]`) en lugar de `soloSuperAdmin`; `definePageMeta({ permiso })` en las 14 páginas de staff (un permiso inventado no compila)
- [x] T008 [P] `app/utils/sesion.ts`: `redireccionPara` con acceso y ruta (sin bucles, `/sin-acceso`), `destinoTrasLogin` con `redirect` solo si la cuenta puede abrirlo, `avisoLogin` con `SESSION_EXPIRED`, `rutaLoginTrasCierre`; pruebas en `tests/sesion.test.ts`
- [x] T009 `app/pages/sin-acceso.vue` («Volver a intentar» relee el acceso y los eventos; «Cerrar sesión»)
- [x] T010 Store de sesión: `acceso`, `puede()`, `refrescarAcceso()` (máximo cada 15 s; conserva la sesión ante fallos que no son 401); sin `esSuperAdmin` (`EventoForm` usa `correo.configurar` y la pestaña «Acceso» de `eventos/[id]` usa `eventos.configurar`)
- [x] T011 `AppSidebar` con `menuPara` y logo a `inicioPara`; etiqueta del rol en la barra superior (`default.vue`)

## US2 - Eventos asignados
- [x] T012 `app/stores/evento.ts`: selección por cuenta (`panel_evento_seleccionado:<id>`, clave anterior como respaldo), nueva lista al cambiar de cuenta, sin selección con la lista vacía, `recargar()`
- [x] T013 Pantallas que abre una cuenta por evento sin los campos que la vista reducida de `GET /events` no trae; aviso cuando la cuenta no tiene eventos asignados

## US6 - Sesión en el BFF
- [x] T014 [P] `server/utils/renovar-sesion.ts` (`debeRenovar`, `renovarSiHaceFalta`, renovación compartida 60 s) con pruebas (`tests/renovarSesion.test.ts`); usado en `proxy.ts` (asíncrono) y `session.get.ts`; `esSesionDeStaff` en `jwt-publico.ts`
- [x] T015 `server/api/auth/session.get.ts`: cierra la sesión solo ante un 401 del backend; si no responde, 503 `SESSION_UNAVAILABLE` con la cookie conservada
- [x] T016 `useApi`: 401 → `/login?motivo=…&redirect=…`; 403 `FORBIDDEN`/`EVENT_NOT_ASSIGNED` → relee el acceso y los eventos, sale de la página si ya no está permitida y relanza (con candado contra reacciones anidadas)

## US3 y US4 - Montos y botones por permiso
- [x] T017 Inscripciones: columnas de pago y voucher y monto del diálogo de aprobar con `pagos.ver`; aprobar, rechazar y en revisión con `inscripciones.validar`; cancelar con `inscripciones.cancelar`; eliminar con `inscripciones.eliminar`; CSV con `inscripciones.exportar`; reenviar con `credenciales.reenviar`
- [x] T018 Resumen y `SemanaSistemicaCard`: montos solo con `pagos.ver`
- [x] T019 Asistencia: marcar (`asistencia.marcar`), «Fuera de horario» (`asistencia.fuera_horario`), anular con confirmación (`asistencia.anular`), exportar (`asistencia.exportar`); columnas de método y quién registró; documento enmascarado; pedir `tipoDocumento` ante `AMBIGUOUS_DOCUMENT`
- [x] T020 Mensajes: «Eliminar» con `mensajes.eliminar`; Eventos: «Eliminar» con `eventos.eliminar`

## US5 - Equipo y administradores
- [x] T021 Mínimo: etiqueta y tono del rol, el selector ofrece los 4 roles y el rol es obligatorio al crear (con prueba)
- [x] T022 [P] `app/utils/administradores.ts`: cuerpo con `eventoIds` y `permisos` según el rol final, reglas de la propia cuenta y de la delegación, con pruebas
- [x] T023 `app/pages/administradores.vue`: roles desde `GET /roles`, selector de eventos, casillas de la Comisión (`conDependencias`, `requeridoPor`, `permisosPorDefecto`), columnas de eventos y permisos, acciones según la delegación y la propia cuenta, «Nueva cuenta», aviso de «desactivada en lugar de eliminada»

## Cierre
- [x] T024 `bun run lint`, `bun run typecheck` y `bun run test` en verde al cerrar la base (16 archivos, 152 pruebas)
- [x] T025 `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde con las pantallas (T013, T017–T020, T022–T023) y las correcciones (T028): 20 archivos, 241 pruebas
- [ ] T026 Prueba integrada en el navegador con backend-ciisic local y una cuenta de cada rol (Owner, Administrador del sistema, Tesorero y Comisión) (la hace el equipo)
- [ ] T027 Despliegue del panel en producción (`admin-ciisic.episundc.pe`, Dokploy) antes del VIII CIISIC (26-oct-2026), con confirmación humana

## Correcciones de la revisión
- [x] T028 Asistencia, Inscripciones y Resumen no muestran ni usan datos del evento anterior (se vacían al cambiar de evento, descartan respuestas tardías y no marcan sin una actividad del evento elegido); «Registrar» desde Actividades lleva `?evento=` y avisa si la actividad no es del evento; el store de eventos se vacía al cambiar de cuenta o cerrar sesión; sesión sin verificar (backend caído) → login con aviso `SESSION_UNAVAILABLE` y «Reintentar», y `/api/auth/login` responde 503 `LOGIN_UNAVAILABLE`; cuenta por evento sin eventos → `/sin-acceso`; tras un 401/403 de `/auth/refresh` ese JWT no se reintenta hasta su `exp`; al cerrar sesión el JWT no se renueva ni revive la cookie; `releerAcceso()` forzado tras `STATUS_NOT_ALLOWED` y `OUT_OF_HOURS_NOT_ALLOWED`; correo y Google propios con `sistema.configurar` y «Solo Google» bloqueado si el Owner cambia su correo; un segundo 401 en el login conserva `redirect`; tipos `EventoResumido`/`EventoListado` (pruebas en `renovarSesion`, `respuestasAuth`, `sesion`, `permisos`, `administradores` y `asistencia`)
