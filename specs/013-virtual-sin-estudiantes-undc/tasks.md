# Tasks: Tipos que no admiten estudiantes UNDC

- [x] T001 `excluyeEstudiantesUndc?` en `TipoInscripcion` (`app/types/api.ts`)
- [x] T002 `app/utils/tiposInscripcion.ts`: campo del formulario, `cuerpoTipo`, `backendSinExcluyeEstudiantes`, `excluyeEstudiantesNoGuardado` y textos; con `tests/tiposInscripcion.test.ts`
- [x] T003 `CategoriasTipos.vue`: interruptor «No admitir estudiantes UNDC» bajo «Modalidad», advertencia contra un backend sin la spec 020, insignia «Sin estudiantes UNDC» y aviso tras guardar
- [x] T004 `AGENTS.md` (índice 001–013, regla y orden de despliegue) y `docs/overview.md`
- [ ] T005 Prueba en el navegador contra backend-ciisic real con la spec 020 (encender el interruptor en un tipo virtual, insignia, ver que se conserva al editar) y contra un backend anterior (aviso)
- [ ] T006 Producción: con el backend 020 ya desplegado, encender el interruptor en `estudiantes_virtual` y `general_virtual` desde este editor (o con `prisma/preflight/excluir-estudiantes-undc-virtual.sql` del backend)
