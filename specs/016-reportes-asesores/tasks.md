# Tasks: reportes de seguimiento por asesor en el panel (spec 016)

- [x] T001 Permisos `reportes.ver`, `reportes.exportar` y `reportes.gestionar` en `app/utils/permisos.ts` y `app/types/api.ts`; ítem «Reportes» en el menú
- [x] T002 Tipos del seguimiento en `app/types/api.ts` y mensajes de error del backend 025 en `app/utils/errores.ts`
- [x] T003 `app/utils/reportes.ts`: situaciones, filtros ↔ URL ↔ API, secciones por ciclo, avance, barra y ruta de descarga
- [x] T004 `useApi().descargar` (blob con el nombre del servidor) y `guardarArchivo` en `app/utils/descargas.ts` (también lo usa el portal)
- [x] T005 `app/pages/reportes.vue`: filtros, indicadores, avance, pestañas «Por ciclo y sección», «Por asesor» y «Alumnos», descargas
- [x] T006 `components/reportes`: `BarraAvance`, `CabeceraContadores`, `CeldasContadores` y `PadronImportar` (revisar → confirmar)
- [x] T007 Pruebas Vitest (`tests/reportes.test.ts`) y ajuste de `tests/permisos.test.ts` (36 permisos; Tesorero con reportes)
- [x] T008 Probado en el navegador contra el backend local con el Excel real (Owner): filtros, pestañas, descargas y carga
- [ ] T009 Probar con una cuenta Tesorero y una de la Comisión (sin `pagos.ver`: sin montos), y en producción tras desplegar el backend 025
