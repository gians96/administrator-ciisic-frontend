# Tasks: delegaciones con planes y tarifa propios (spec 021)

- [x] T001 `app/types/api.ts`: `PlanDelegacion`, `CambiosPlanes`, `Delegacion*` nuevos y permisos `delegaciones.gestionar|ver|inscribir`
- [x] T002 `app/utils/delegaciones.ts`: planes, estimado por plan, validación y cuerpos (`planesParaAlta`, `cambiosDePlanes`), dominio y link individual; fuera la tarifa global
- [x] T003 `PlanesEditor.vue`, `FilasIntegrantes.vue` (plan por fila y por lista pegada) y `DelegacionAlta.vue`
- [x] T004 `DelegacionDetalle.vue`: planes y precios, links y correo, plan por integrante, botones por permiso; borrar `TarifaDelegacionesForm.vue`
- [x] T005 Página `/delegaciones` y `DelegacionesPanel.vue`; menú y permisos (`utils/permisos.ts`); quitar la pestaña de Eventos
- [x] T006 Mensajes de error nuevos (`utils/errores.ts`) y pruebas Vitest (`tests/delegaciones.test.ts`, `tests/permisos.test.ts`)
- [x] T007 `AGENTS.md` y `docs/overview.md`
- [ ] T008 Probar en el navegador contra el backend local (Owner, Administrador, Tesorero y Comisión)
- [x] T009 Visor del voucher en un modal (`VisorVoucher.vue`, `useApi().leerArchivo`), detalle responsive (tarjetas bajo `md`, `AccionesVoucher.vue`, `AppModal` con paddings móviles) y borrar voucher también con `inscripciones.validar` (Tesorero; backend 029)
