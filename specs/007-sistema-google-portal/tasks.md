# Tasks: Sistema, inicio de sesión con Google y portal del inscrito

## Fase 0 - Correcciones
- [x] T001 `clonarLista` (toRaw + copia) en lugar de `structuredClone` en `DatosPagoForm` y `CategoriasTipos`, con pruebas
- [x] T002 Fechas y horas sin partir (`whitespace-nowrap`) en inscripciones, administradores, asistencia, actividades, mensajes, consultas y participantes
- [x] T003 Sin `sessionMaxAge` ni `public.*` en `nuxt.config.ts`; la cookie dura lo que el JWT (`vidaSesionSegundos(expiraEn)`, con pruebas); `.env.example` solo con `NUXT_BACKEND_BASE_URL`; README

## Base
- [x] T004 Enmienda 1.1.0 de la constitución (dos perfiles; env solo `NUXT_BACKEND_BASE_URL`)
- [x] T005 Mensajes por código en `app/utils/errores.ts` (`GOOGLE_*`, `INVALID_GOOGLE_TOKEN`, `SESSION_INVALIDATED`, `FORBIDDEN_PROFILE`, `UNDC_API_NOT_CONFIGURED`, `HOST_NOT_ALLOWED`, `INVALID_URL`) con pruebas
- [ ] T006 Tipos del contrato en `app/types/api.ts` (configuración, sesión, portal, vínculo con Google, verificación del correo)

## US1 - Sistema (SuperAdmin)
- [x] T007 [P] `app/utils/configuracionSistema.ts` (formulario, PUT parcial por tarjeta, key write-only y «Quitar key», validaciones, estado, orígenes, avisos) con pruebas
- [x] T008 `app/pages/sistema.vue`: tarjetas API UNDC (con «Probar conexión»), Google (orígenes autorizados), URL del panel y Landing anterior; «Actualizado por X el …»; carga/error
- [x] T009 Entrada «Sistema» en `AppSidebar` solo para SuperAdmin

## US3 (base) - Perfiles de sesión
- [ ] T010 [P] `server/utils/jwt-publico.ts` (`aud` sin verificar, formato de la credencial) con pruebas
- [ ] T011 [P] `app/utils/sesion.ts` (`leerSesion`, `redireccionPara`, `destinoTrasLogin`, `avisoLogin`) con pruebas
- [ ] T012 Store de sesión por perfil, `session.get.ts` con `tipo`, meta `perfil`, middleware con las utilidades puras
- [ ] T013 `server/utils/proxy.ts` compartido y 403 `FORBIDDEN_PROFILE` para sesiones de inscrito en `/api/backend/**`

## US2 - Login con Google
- [ ] T014 Tipos de Google Identity Services en `app/types/google-identity-services.d.ts`
- [ ] T015 `server/api/auth/google.get.ts` (client ID + nonce en cookie httpOnly) y `google.post.ts` (valida, consume el nonce, sesión con la vida del JWT, errores con su `code`)
- [ ] T016 `app/components/auth/BotonGoogle.vue` (GIS una vez, popup, tema oscuro, renovar nonce tras un intento fallido)
- [ ] T017 `app/pages/login.vue`: separador, botón, texto para inscritos, errores por código y destino según el perfil

## US3 - Mis inscripciones
- [ ] T018 `server/api/portal/[...path].ts` (solo inscritos → `/api/v1/me/**`, cierra la sesión en 401) y `app/composables/usePortal.ts`
- [ ] T019 [P] `app/utils/misInscripciones.ts` con pruebas
- [ ] T020 `app/layouts/participante.vue` y `app/pages/mis-inscripciones.vue` (tarjetas, credencial, carga/vacío/error)

## US4 - Cuentas de Google en el panel
- [ ] T021 [P] `app/utils/cuentaGoogle.ts` con pruebas
- [ ] T022 Administradores y participantes: «Google vinculado» y «Desvincular Google» con confirmación
- [ ] T023 Inscripciones: «Correo verificado con Google (…)» en el detalle e indicador en la lista

## Cierre
- [ ] T024 README y spec actualizados; `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde
- [ ] T025 Prueba integrada con backend-ciisic local (la hace el equipo)
