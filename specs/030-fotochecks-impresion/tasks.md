# Tasks: Fotochecks para imprimir (panel)

- [x] T001 `app/utils/fotochecks.ts` (medidas y rejilla, lectura del CSV, QR, configuración, filtros, personas a mano, almacenamiento) con pruebas (`tests/fotochecks.test.ts`)
- [x] T002 Logos (`public/fotocheck/`), `uqr` como dependencia directa y Poppins 700 en las fuentes
- [x] T003 `FotocheckTarjeta` y `FotochecksHoja`: formato de la credencial web en oscuro y claro, logo de la Facultad, sangrado y la variante sin QR
- [x] T004 `FotochecksVistaPrevia`: hojas apiladas, zoom, guías y solo las visibles montadas; modo ampliado
- [x] T005 `FotochecksInscritos` (cargar, buscar, filtrar, elegir, «ya impreso», agregar a mano) y `FotochecksDiseno` (Diseño · Medidas · Textos)
- [x] T006 `/fotochecks` y `useImpresionFotochecks` (impresión del navegador, `@page`, título del PDF, Ctrl+P); menú (`MENU`) y `tests/permisos.test.ts`
- [x] T007 Probado contra un backend simulado: carga de 126 aprobados (122 con código), «ya impreso», agregar a mano, aviso sin la columna «Código QR» y PDF de la página real con Edge (13 hojas A4 horizontal, fuentes incrustadas, fondo oscuro sin «gráficos de fondo»)
- [ ] T008 Producción: desplegar después del backend 040; imprimir una hoja de prueba en la impresora real y medir el fotocheck (6.7 × 10 cm); ajustar el margen a lo que la impresora alcance
