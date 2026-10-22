# Tasks: enlace público por ciclo (spec 018)

- [x] T001 Tipos (`EnlaceCiclo`, `VistaCiclo`, `AlumnoCiclo`, `TipoSeguimiento`) y utilidades (`urlEnlaceCiclo`, `tipoDeSeguimiento`, `mensajeParaCiclo`); los filtros de la vista del docente pasan a servir también al ciclo
- [x] T002 BFF: `tipoDeCuerpo` y `RUTA_BACKEND`; `index.post.ts` y `export.post.ts` reenvían a `public/advisor` o `public/cycle` según `tipo`
- [x] T003 Página `seguimiento.vue`: alias `/seguimiento/ciclo`, vista del ciclo con tarjetas de sección y docente, sin celular
- [x] T004 Diálogo `EnlacesPublicos` (pestañas Docentes y Ciclos) con `EnlacesDocentes` y `EnlacesCiclos` como listas
- [x] T005 Reportes: pestaña «Por ciclo» (indicadores, enlace, descarga por ciclo), «Por sección» renombrada y menú «Enlaces públicos»
- [x] T006 Pruebas Vitest (utilidades, filtros sin celular y BFF) y documentación
- [x] T007 Probado en el navegador contra el backend local: crear enlaces de ciclo, vista sin sesión (375 px y escritorio), filtro por sección, Excel y PDF sin credenciales, enlace de docente sin cambios, tipos y tokens inválidos
- [ ] T008 Producción: tras desplegar el backend 027, crear los enlaces de ciclo desde Reportes y entregarlos; probar uno real en un celular
