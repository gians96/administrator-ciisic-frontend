# Tasks: Portal del participante y escáner de asistencia

## Fase 0 - Documentación
- [x] T001 Enmienda 1.3.0 de la constitución (principio VI: el inscrito entra con Google o con un código por correo; páginas del portal con `perfil: 'participante'`; el staff pasa a su portal en un solo sentido)
- [x] T002 Spec 009 (spec, plan y tasks); `docs/overview.md` (pantallas del portal y del escáner con su permiso), `docs/arquitectura.md` (código, paso al portal, IP real, portal y escáner), `docs/configuracion-y-despliegue.md` (URL interna, orden de despliegue con el backend 014), `AGENTS.md` y `README.md`

## Base (BFF, sesión y utilidades)
- [x] T003 [P] `server/utils/ip-cliente.ts` (`ultimaIpReenviada`, `ipValida`, `ipCliente`): login, Google y código reenvían la última entrada de `X-Forwarded-For`, nunca la primera (`tests/ipCliente.test.ts`)
- [x] T004 [P] `server/utils/acceso-codigo.ts` (validación del correo y del código, `codigoSolicitadoDe`, `sesionParticipanteDe`, `accesoCodigoDisponible`, `RESPALDO_CODIGO`, `RESPALDO_PORTAL`, `lanzarError`) y `errorPropagado`/`segundosDeEspera` en `server/utils/respuestas-auth.ts` (404 `NOT_FOUND`/405 del backend → 503 con respaldo; `Retry-After` y `fields` conservados) (`tests/accesoCodigoBff.test.ts`, `tests/bffCodigo.test.ts`)
- [x] T005 Rutas `GET /api/auth/config`, `POST /api/auth/codigo`, `POST /api/auth/codigo/verificar` y `POST /api/auth/portal` (sesión de participante con la vida de `expiraEn`; `olvidarSesion` del JWT anterior; un 401 del cambio al portal cierra la sesión)
- [x] T006 [P] `esRenovable` en `server/utils/renovar-sesion.ts`: solo se renueva la sesión del staff (`tests/renovarSesion.test.ts`)
- [x] T007 [P] Mensajes de la spec 014 en `app/utils/errores.ts` (fijos y de respaldo) y `PORTAL_SWITCH_UNAVAILABLE` (`tests/erroresPortal.test.ts`)
- [x] T008 [P] Utilidades puras con pruebas: `app/utils/codigoAcceso.ts`, `lecturaQr.ts` (`interpretarLectura`, `debeProcesar`), `portal.ts` (`NAVEGACION_PORTAL`, `esNoDisponible`, `pideCodigoParaPortal`, tipos del portal) y `foto.ts` (límites, `recorteCuadrado`, `formularioFoto`, consentimiento)
- [x] T009 Store `auth` (`solicitarCodigo`, `verificarCodigo`, `irAlPortal`), `destinoTrasLogin` con `redirect` a páginas del portal (`tests/sesion.test.ts`) y `usePortal` (401 → login con motivo y `redirect`)
- [x] T010 `AccesoConCodigo.vue` y login: opción plegada solo con `accesoCodigo.disponible`, dos pasos, cuenta regresiva por correo, intentos restantes
- [x] T011 `MenuUsuario`: «Mi portal de participante» con `acceso.perfilParticipante`; `CODE_REQUIRED` o `GOOGLE_ACCOUNT_MISMATCH` → diálogo con el código al correo de la cuenta; con el 013, aviso sin cerrar la sesión
- [x] T012 Layout `participante` con `NAVEGACION_PORTAL` (pestañas y barra inferior); `InscripcionPortal.fotocheck?`

## US2 - Fotocheck
- [ ] T013 Página `mi-fotocheck` (elige entre las inscripciones con fotocheck; con una, la abre) con `app/components/portal/*` y `app/utils/fotocheck.ts`: QR del backend, código, evento, nombre, documento enmascarado, tipo, foto, Wake Lock y enlace al PDF; `NOT_APPROVED`, `INSCRIPTION_NOT_FOUND` y «pronto disponible»
- [ ] T014 «Ver fotocheck» en `mis-inscripciones.vue` cuando hay fotocheck
- [ ] T015 Copia sin conexión del último fotocheck en `localStorage` (`ciisic-portal:fotocheck`, con la foto y sin el JWT), del participante que la vio; `plugins/fotocheck-guardado.client.ts` la borra al cerrarse la sesión o cambiar de persona; con prueba

## US3 - Escáner
- [ ] T016 `app/pages/escanear.vue` (`permiso: 'asistencia.marcar'`, layout `escaner` a pantalla completa con volver, selector de evento, actividad y menú de la cuenta) e ítem «Escanear asistencia» del `MENU` con el mismo permiso; actividad del evento seleccionado (por defecto la que está en su ventana o la próxima de hoy, `actividadParaEscaner`); `inicioPara` lleva al escáner a la cuenta que solo marca asistencia (`soloMarcaAsistencia`); con pruebas (`tests/asistencia.test.ts`, `tests/permisos.test.ts`)
- [ ] T017 Lector de cámara (`vue-qrcode-reader`, cámara trasera, `qr_code`, wasm de ZXing servido por el panel desde `public/zxing-wasm/<versión>/`, `bun run escaner:wasm`) con el mensaje de cada error de cámara; lector USB (Enter) y DNI
- [ ] T018 Resultado a pantalla completa verde, ámbar (`alerta: 'QR_LEGADO'`: «QR antiguo: verifica el DNI»; `ATTENDANCE_ALREADY_REGISTERED`: «Ya estaba registrada») o rojo, con foto de `/api/backend/inscriptions/:id/photo` (marcador si falla), vibración, pitido que se puede silenciar, `aria-live`, «Reintentar» ante errores de red o 5xx y las últimas 10 lecturas; «Fuera de horario» solo con `asistencia.fuera_horario`; `{ codigo }` con 422 `VALIDATION_ERROR` (backend 013) → «QR no reconocido»
- [ ] T019 `/asistencia`: modo QR con `interpretarLectura` (`inputmode="text"`, `{ codigo }` o `{ participanteId, metodo: 'QR' }`) y aviso ámbar; «Abrir escáner» con `?evento=&actividad=`; `cuerpoMarca` actualizado con prueba

## US5, US6 y US7 - Portal
- [ ] T020 `app/pages/mi-perfil.vue`: datos, celular (`PATCH /api/portal/profile`), foto recodificada con canvas, consentimiento obligatorio, ver y quitar con confirmación; secciones «pronto disponible» con el 013
- [ ] T021 `app/pages/mi-asistencia.vue` (`GET /api/portal/attendances`): por evento, actividades y «asistidas / actividades»
- [ ] T022 `app/pages/mis-certificados.vue`: estado vacío mientras `GET /api/portal/certificates` responda 404

## US8 - Alta de participantes y cortesías
- [ ] T023 Participantes: «Nuevo participante» (`participantes.gestionar`) con `NAMES_REQUIRED`, `PARTICIPANT_EXISTS` («Abrir registro» con `fields.id`) y `EMAIL_IN_USE`; celular vacío permitido al editar
- [ ] T024 «Inscripción de cortesía» (`inscripciones.cortesia`): tipo del evento seleccionado (incluidos los inactivos), «Enviar credencial», `ALREADY_REGISTERED`, `REGISTRATION_TYPE_INVALID` y reenviar si `credencialEnviada` es `false`

## Cierre
- [x] T025 `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde con la base (28 archivos, 307 pruebas); prueba en el navegador con el build contra un backend simulado en modo 014 y 013
- [ ] T026 `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde con las pantallas (T013–T024)
- [ ] T027 Prueba integrada con backend-ciisic 014 local (y otra vez con el 013): inscrito con Google y con código, staff con Google y con contraseña hacia su portal, Comisión que marca con QR nuevo, QR anterior y DNI, foto en el perfil y en el escáner (la hace el equipo)
- [ ] T028 Despliegue del panel 009 en producción **antes** que el backend 014, con `NUXT_BACKEND_BASE_URL` interna y confirmación humana; verificar contra el 013 y, tras desplegar el 014, repetir T027 en producción
