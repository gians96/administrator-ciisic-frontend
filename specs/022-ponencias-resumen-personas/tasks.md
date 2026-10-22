# Tasks: resumen por persona de las ponencias especializadas (spec 022)

- [x] T001 `app/utils/ponenciasEspecializadas.ts`: tipos del resumen, situaciones, filtros y URL, selección, comunicado propuesto, validación, cuerpos y resumen del resultado; motivo `SIN_CONGRESO`
- [x] T002 Página `app/pages/ponencias-especializadas/resumen.vue` y ítem «Resumen» del menú (`utils/permisos.ts`)
- [x] T003 `components/especializadas/ResumenComunicado.vue`: cancelar y avisar, texto editable, copiar, confirmación y resultado
- [x] T004 Mensajes de error nuevos (`utils/errores.ts`) y pruebas Vitest (`tests/ponenciasEspecializadas.test.ts`, `tests/permisos.test.ts`)
- [x] T005 `AGENTS.md` y `docs/overview.md`
- [x] T006 Probado en el navegador contra el backend 031 local con una BD de pruebas sin credencial de correo activa: filtros y URL, elegir a quienes no pueden, cancelar (omite a quien ya asistió), acceso libre (sin casillas), Excel y celular. Pendiente: probar contra un backend anterior
