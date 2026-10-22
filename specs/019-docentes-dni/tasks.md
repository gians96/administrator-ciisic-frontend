# Tasks: DNI y secciones editables del docente, y página común de consulta (spec 019)

- [x] T001 Tipos (`DocenteAdmin`, `ListaDocentes`, `TipoSeguimiento` con `documento`) y `app/utils/docentes.ts` (DNI, secciones asignables, cambios, conteo)
- [x] T002 BFF: `credencialDeCuerpo` y `peticionAlBackend` (token en encabezado o DNI en el cuerpo de un `POST`); `index.post.ts` y `export.post.ts` simplificados
- [x] T003 `seguimiento.vue`: alias `/docentes`, pantalla del DNI, DNI solo en memoria, «Salir», filtro de ciclo y de sección (`ciclosDe`, `FiltrosDocente.ciclo`)
- [x] T004 `AsesorEditar.vue` (agregar, editar y eliminar docentes) y la pestaña «Por asesor» con DNI, «Editar» y «Agregar docente»
- [x] T005 `EnlacesPublicos` / `EnlacesDocentes`: bloque «Página única para los docentes» y etiqueta «Sin DNI»
- [x] T006 `PadronImportar`: conservar o reemplazar a los docentes al recargar el padrón
- [x] T007 Pruebas Vitest (`docentesDni`, `enlacePublicoBff`, `enlacesDocentes`, `seguimientoDocente`) y documentación
- [x] T008 Probado en el navegador contra el backend local: poner el DNI y agregar una sección desde Reportes, entrar a `/docentes` sin sesión (DNI válido, desconocido), filtro por ciclo, Excel sin credenciales, diálogos de enlaces y de recarga
- [ ] T009 Producción: tras desplegar el backend 028, registrar el DNI de los 26 docentes desde Reportes y repartir la dirección `/docentes`; probar con el DNI de un docente real
