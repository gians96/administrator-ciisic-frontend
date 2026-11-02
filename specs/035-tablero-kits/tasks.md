# Tasks: Tablero de kits (panel)

- [x] T001 `app/utils/kit.ts`: `FILTROS_KIT`, `esFiltroKit`, `ETIQUETA_FILTRO_KIT`, `situacionKitFila`, `entregadoARevisar` y los textos y tonos de la insignia; `InscripcionFila.kit` en `types/api.ts`
- [x] T002 `app/utils/kitsTablero.ts`: tipos y `tableroKitsDe` (valida la respuesta), indicadores y vistas, contenido del kit, horas de Lima y ayudas de la lista (puro y probado)
- [x] T003 `app/composables/useEntregaKit.ts`: entregar o deshacer desde una lista (el flujo del detalle)
- [x] T004 Componentes `KitContenido`, `KitPorTipo` y `KitLista` y la página `/kits` con el ítem del menú (`asistencia.ver`)
- [x] T005 Inscripciones: filtro «Kit» (en `filtros.ts`, la URL y el CSV), insignias de kit, aviso de lista sin filtrar y botón «Entrega de kits»; Asistencia: la insignia «Kits:» abre el tablero
- [x] T006 Pruebas (`tests/kitsTablero.test.ts`, `tests/utils.test.ts`, `tests/permisos.test.ts`), `docs/overview.md` y AGENTS.md
- [x] T007 Probado en el navegador contra un **backend de prueba** con datos sintéticos (las reglas de permisos y de entrega del kit del backend; no contra el backend real ni MySQL, por la RAM): Owner (indicadores, vistas, filtro por tipo, entregar y deshacer con confirmación, entregar desde el detalle y que el tablero se actualice solo), Tesorero (lista y CSV, sin botones de entrega) y la cuenta de la puerta con solo `asistencia.*` (cifras, sin lista y con el aviso del permiso); filtro «Kit», insignias y botón al tablero en Inscripciones; 375 px de ancho sin desborde de página. Queda por ver contra el backend real con una BD local
- [ ] T008 Producción: desplegar después del backend 045
