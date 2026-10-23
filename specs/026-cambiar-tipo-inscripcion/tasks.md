# Tasks: cambiar el tipo de una inscripción (spec 026)

- [x] T001 Permiso `inscripciones.cambiar_tipo` en el catálogo y en `PERMISOS_SOLO_OWNER` (`utils/permisos.ts`, `types/api.ts`) y pruebas del catálogo
- [x] T002 `app/utils/cambioTipo.ts`: quién lo ve, opciones del selector, descuento tras el cambio, avisos y mensaje final, con pruebas (`tests/cambioTipo.test.ts`)
- [x] T003 `components/inscripciones/CambiarTipoDialogo.vue` y el botón «Cambiar tipo» en el detalle
- [x] T004 Historial «Cambios de tipo» en el detalle (se conserva al cambiar el estado) y fila del listado al día (`tipoDeFila`)
- [x] T005 Mensajes de error nuevos (`utils/errores.ts`)
- [x] T006 `AGENTS.md` y `docs/overview.md`
- [x] T007 Probado en el navegador contra el backend 035 local (BD de pruebas aislada, correo desactivado): el Owner cambia #317 (de «Profesionales y público en general · Con kit» a «Docente, egresados y administrativos…»): conserva S/ 120.00, sin el descuento de S/ 20.00, historial con autor y motivo y fila del listado al día; pasar a virtual mueve sus ponencias pendientes y volver a presencial sin cupo responde `TALK_FULL_ON_TYPE_CHANGE` sin cambiar nada; Administrador y Tesorero no ven el botón y la API les responde 403; un integrante de una delegación no tiene botón y la API responde `INSCRIPTION_IN_DELEGATION`. Pendiente: probar contra un backend anterior
