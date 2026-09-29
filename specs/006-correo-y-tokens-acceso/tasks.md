# Tasks: Credenciales de correo y tokens de acceso

## Base
- [x] T001 Mensajes por código (`EMAIL_CREDENTIAL_NOT_FOUND`, `EMAIL_CREDENTIAL_IN_USE`, `ACCESS_TOKEN_NOT_FOUND`) y etiquetas de `fields` en `app/utils/errores.ts` con pruebas
- [x] T002 Tipos del contrato en `app/types/api.ts` (credencial, prueba, envío, token, evento)

## US1/US2 - Credenciales de correo (SuperAdmin)
- [x] T003 [P] Utilidades `app/utils/credencialesCorreo.ts` (formulario, PUT parcial, validación, estado, planes Brevo, orden) con pruebas
- [x] T004 Página `app/pages/correo.vue` solo SuperAdmin: lista con estados de carga/vacío/error, ayuda y alerta sin predeterminada activa
- [x] T005 Alta/edición con API key write-only ("Dejar vacío para conservar") y errores por campo
- [x] T006 Probar (cuenta y créditos), Enviar prueba (modal con correo), predeterminada, activar/desactivar y eliminar con confirmación
- [x] T007 Entrada "Correo" en `AppSidebar` solo para SuperAdmin

## US4 - Tokens de acceso por evento (SuperAdmin)
- [x] T008 [P] Utilidades `app/utils/tokensAcceso.ts` (estado efectivo, prefijo, expiración en hora de Lima) con pruebas
- [x] T009 [P] Composable `app/composables/useCopiar.ts` con pruebas
- [x] T010 `app/components/eventos/TokensAccesoPanel.vue`: lista, generar (nombre + expiración), mostrar una sola vez con Copiar e instrucción `NUXT_BACKEND_EVENT_TOKEN`, revocar
- [x] T011 Pestaña "Acceso" en `app/pages/eventos/[id].vue` solo para SuperAdmin

## US3 - Credencial por evento
- [x] T012 Campo "Credencial de correo" en `EventoForm.vue` (select para SuperAdmin, solo lectura para Admin) que envía `credencialCorreoId`; al copiar de otro evento propone su credencial

## Cierre
- [x] T013 Alinear tipos y validaciones con los contratos del backend (`backend-ciisic/specs/006-credenciales-correo` y `007-tokens-acceso-evento`)
- [x] T014 `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde
- [x] T015 Prueba integrada con backend-ciisic local: credencial creada (key enmascarada) y probada contra Brevo (error legible), token de acceso generado y mostrado una vez, usado por la landing; aprobación con credencial PDF y error de envío registrado en la credencial (2026-09-29)
