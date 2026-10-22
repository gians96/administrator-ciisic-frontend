# Tasks: resumen por persona de las ponencias especializadas (spec 022)

- [x] T001 `app/utils/ponenciasEspecializadas.ts`: tipos del resumen, situaciones, filtros y URL, selección, comunicado propuesto, validación, cuerpos y resumen del resultado; motivo `SIN_CONGRESO`
- [x] T002 Página `app/pages/ponencias-especializadas/resumen.vue` y ítem «Resumen» del menú (`utils/permisos.ts`)
- [x] T003 `components/especializadas/ResumenComunicado.vue`: cancelar y avisar, texto editable, copiar, confirmación y resultado
- [x] T004 Mensajes de error nuevos (`utils/errores.ts`) y pruebas Vitest (`tests/ponenciasEspecializadas.test.ts`, `tests/permisos.test.ts`)
- [x] T005 `AGENTS.md` y `docs/overview.md`
- [ ] T006 Probar en el navegador contra el backend local (sin enviar correos reales): filtros, elegir, cancelar sin correo, acceso libre y backend anterior
