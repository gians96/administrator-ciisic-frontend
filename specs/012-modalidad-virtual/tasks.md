# Tasks: Modalidad virtual de asistencia

- [x] T001 `ModalidadAsistencia`, `modalidad?` en los tipos del panel y `ResumenModalidad` en `app/types/api.ts`
- [x] T002 `app/utils/modalidad.ts` (tolerancia, etiquetas, textos neutros, `backendConModalidad`) y `AppBadgeVirtual.vue`, con `tests/modalidad.test.ts`
- [x] T003 `app/utils/tiposInscripcion.ts`: `OPCIONES_MODALIDAD`, `formularioDeTipo`, `cuerpoTipo` con `modalidad` y tarifa única, con `tests/tiposInscripcion.test.ts`
- [x] T004 `CategoriasTipos.vue`: selector «Modalidad» con ayuda, «Igualar al precio regular», insignia «Virtual» e hints con ejemplo `estudiantes_virtual`
- [x] T005 `app/utils/filtros.ts` (`modalidad`) y `app/pages/inscripciones/index.vue`: insignia en Tipo, filtro «Modalidad» (solo si el backend envía la modalidad), `limpiar()` y rejilla; el CSV hereda el filtro; `tests/utils.test.ts`
- [x] T006 `InscripcionDetalle.vue`: «Modalidad de asistencia» e insignia «Virtual»
- [x] T007 Resumen: `filasPorModalidad` (`app/utils/resumen.ts`), bloque Presencial / Virtual y marca en «Por tipo» (`app/pages/index.vue`), con `tests/resumen.test.ts`
- [x] T008 Escáner: aviso ámbar «Inscripción virtual…» no bloqueante en `resultadoDeMarca` (sin `esperaContinuar`), con `tests/asistencia.test.ts`
- [x] T009 Portal: `explicacionEstado` y `lugarDelEvento` (`app/utils/misInscripciones.ts`), `mis-inscripciones.vue`, insignia y nota en el fotocheck (`PortalTarjetaFotocheck.vue`, `mi-fotocheck.vue`), con `tests/misInscripciones.test.ts`
- [x] T010 `docs/overview.md` (filas y glosario), `docs/arquitectura.md`, `AGENTS.md` (índice 001–012, regla y terminología)
- [x] T011 `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde, 2026-10-19
- [x] T012 Prueba en el navegador contra un backend simulado, con y sin `modalidad` (editor y precarga de la tarifa única, insignias, filtro y CSV, detalle, Resumen, aviso del escáner, portal y fotocheck; sin `modalidad` todo se ve como antes), 2026-10-19
- [ ] T013 Prueba integrada contra backend-ciisic real con la spec 018 (crear «ESTUDIANTES · VIRTUAL» a 30 / 30, filtrar y exportar el CSV, Resumen, marcar un virtual en el escáner, portal) y contra el 013/014
- [ ] T014 «Mi asistencia»: nota para los virtuales cuando `GET /me/attendances` traiga la modalidad (pedirlo al backend)
- [ ] T015 Revisar los textos cuando la organización responda cómo se entrega el acceso, los certificados y la asistencia de los virtuales
