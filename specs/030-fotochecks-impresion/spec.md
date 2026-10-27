# Feature Specification: Fotochecks para imprimir (panel)

**Created**: 2026-10-26 · **Status**: Implementado en el panel (falta desplegar después del backend 040) · **Contrato**: `backend-ciisic/specs/040-csv-codigo-qr/spec.md`

**Input**: el usuario quiere **imprimir los fotochecks** de los inscritos (6.7 × 10 cm, para el porta-fotocheck) en hojas **A4**, con el formato de la credencial 3D de la landing en
modo **oscuro y claro**, el **logo de la Facultad de Ingeniería**, medidas **personalizables**, un apartado donde **gestionar** a quién se imprime y una **vista previa** de cómo se imprimirá.

> **Numeración**: es la spec **030** del panel. Backend = spec 040 (la columna «Código QR» del CSV de inscripciones) · Landing = `CredencialVertical` (spec 013), de donde sale el diseño.

## Decisiones

- **De dónde salen los datos**: del CSV de inscripciones (`GET events/:id/inscriptions/export?estado=APROBADO`, `inscripciones.exportar`), la única vía en bloque al código del QR (la 040; el
  código nunca sale en los listados). La pantalla lo lee con `useApi().leerArchivo`, ubica las columnas **por su título** y conserva solo nombre, código, tipo y modalidad; también acepta un CSV
  exportado a mano. Sin la columna «Código QR» (backend sin la 040) lo explica y no carga nada. Los **virtuales** no se imprimen salvo «Incluir virtuales» (no marcan asistencia).
- **Cuántos caben**: medidas en **cm** (fotocheck 6.7 × 10 por defecto; hoja A4, Carta, A3, A5 o personalizada; margen 0.4, separación 0.2 y sangrado 0.1). `calcularRejilla` da columnas × filas y la
  orientación **Automática** elige la que más acomoda: **8 por A4 horizontal** (4 × 2), 4 en vertical (6 si margen + separación ≤ 0.45 cm; una tercera fila pide 10 cm y solo sobran 9.7) y 16 en A3 vertical.
- **Diseño**: el de la credencial web en unidades `cqw` (escala a cualquier medida): cabecera con el logo del congreso y el de la Facultad, nombre del congreso, nombre grande, QR sobre cuadro blanco y
  código. **Oscuro** (como la web) o **claro**, con un **acento** único configurable en lugar de las tecnologías de cada persona (no vienen en el CSV). Cuadro recto con **sangrado** y borde fino como guía de corte;
  casillas para mostrar u ocultar cada elemento, nombre en mayúsculas y textos del evento editables (por defecto los del evento elegido).
- **Vista previa de impresión**: `FotochecksVistaPrevia` apila las hojas tal como saldrán, con la misma `FotochecksHoja` y las mismas medidas que la impresión; zoom, guías (margen y lugar de cada fotocheck, solo
  de pantalla), modo ampliado y solo monta las hojas visibles (`IntersectionObserver`).
- **PDF**: «Imprimir / Guardar PDF» abre el cuadro de impresión del navegador con todas las hojas (`useImpresionFotochecks`): PDF vectorial con las fuentes incrustadas y sin librerías de PDF. `@page` fija la hoja,
  `print-color-adjust: exact` imprime el fondo oscuro sin activar «gráficos de fondo» y el título del documento es el nombre sugerido del archivo. Las reglas de impresión solo valen bajo `html.imprimiendo-fotochecks`.
- **Gestión**: búsqueda, filtros (tipo, pendientes o impresos), selección entre páginas, marca de **«ya impreso»** (solo ids de inscripción, por evento, en este navegador) para imprimir después solo los pendientes
  y **personas a mano** (ponentes, organizadores) con o sin código: sin código la tarjeta lleva una banda con el rol. Las personas a mano viven solo en memoria.
- **Seguridad**: el código del QR es una credencial (spec 040): solo en memoria, nunca en `localStorage`, URL, consola ni en la tabla. Lo único que se guarda es el diseño y los ids ya impresos.

## Requisitos

- **FR-001**: lógica pura en `app/utils/fotochecks.ts` con pruebas (rejilla, lectura del CSV con el formato real del backend, QR, configuración, filtros, personas a mano y almacenamiento).
- **FR-002**: la página `/fotochecks` y su ítem del menú exigen `inscripciones.exportar` (el mismo permiso que el CSV con el código).
- **FR-003**: la impresión no afecta a otras pantallas y las hojas completas solo existen mientras se imprime.

## Fuera de alcance

- Tecnologías por persona (chips, color y marca de agua de la web): endpoint nuevo en el backend y catálogo e íconos de la landing en el panel.
- Botón «Descargar PDF» directo (jsPDF) y regenerar códigos de inscripciones.
