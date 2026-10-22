# Feature Specification: Reportes de seguimiento por asesor en el panel

**Created**: 2026-10-21 · **Status**: Implementado · **Contrato**: `backend-ciisic/specs/025-reportes-asesores/contracts/api-seguimiento-asesores.md`

**Input**: la facultad lleva en un Excel (`ESTUDIANTES 2026-2` + `RESUMEN`) a sus 434 estudiantes, en qué ciclo y sección
están y qué docentes son sus **asesores**, y cruza a mano con las inscripciones para saber quién pagó. Cada asesor
necesita su lista (quién pagó y quién no, con celular y correo) y la facultad un panorama general. Se agrega la
pantalla **Reportes**, que muestra el seguimiento **al momento de consultarlo** y descarga el reporte en Excel o PDF,
por docente o general. El cálculo y los archivos son del backend (spec 025); el panel solo los muestra y los descarga.

## User Scenarios & Testing

### User Story 1 - Veo cómo van los estudiantes (Priority: P1)

1. **Given** el padrón está cargado, **When** abro Reportes, **Then** veo alumnos, pagaron, en revisión, rechazados, sin
   inscripción, avance y recaudado (este solo con `pagos.ver`), y tablas por ciclo y sección (con sus asesores) y por asesor.
2. **When** filtro por asesor, ciclo, sección o turno, **Then** los indicadores y las tablas se limitan a ese grupo y la
   URL conserva los filtros (se puede compartir).
3. **When** pulso «Actualizar», **Then** se vuelve a calcular con las inscripciones de ese momento.

### User Story 2 - Descargo el reporte de un docente o el general (Priority: P1)

1. **Given** estoy en «Por asesor», **When** pulso «Excel» o «PDF» de un docente, **Then** descargo su reporte completo (todas
   sus secciones) con su nombre como nombre de archivo, sin importar los filtros puestos.
2. **When** pulso «Excel» o «PDF» del encabezado, **Then** descargo el reporte con los filtros actuales.
3. **Given** el backend responde un error (sin padrón, límite de descargas, sesión vencida), **Then** se muestra su mensaje
   en un aviso, no el JSON.

### User Story 3 - Busco alumnos (Priority: P1)

1. **Given** abro «Alumnos» (o pulso «Alumnos» en una fila), **Then** veo la lista paginada con sección, contacto, asesores y
   situación, y filtro por situación (incluida «No pagaron») y busco por nombre, código, DNI o correo.

### User Story 4 - Cargo el padrón (Priority: P2)

1. **Given** tengo `reportes.gestionar` (Owner y Administrador), **When** subo el Excel y pulso «Revisar archivo», **Then** veo
   semestre, alumnos, asesores, secciones y las advertencias sin que se guarde nada.
2. **When** confirmo, **Then** se reemplaza el padrón del evento y la pantalla se actualiza.
3. **Given** no hay padrón y no tengo ese permiso, **Then** se me indica pedirlo a un Owner o Administrador.

## Requirements

- **FR-001**: la página `/reportes` exige `reportes.ver` (mismo permiso que su ítem del menú, bajo «Congreso», tras Asistencia).
- **FR-002**: «Excel» y «PDF» solo se muestran con `reportes.exportar`; «Cargar / Actualizar padrón», con `reportes.gestionar`.
- **FR-003**: sin `pagos.ver` el backend envía montos y recaudado en `null` (`conPago: false`): se ocultan esas columnas y
  tarjetas.
- **FR-004**: las descargas usan `$fetch` en blob (`useApi().descargar`) con el nombre de `Content-Disposition`.
- **FR-005**: los filtros de la URL se validan (`filtrosReporteDesdeQuery`) y los que ya no existen en el padrón se quitan.
- **FR-006**: la carga siempre se revisa antes de confirmar; cambiar el archivo o el semestre invalida la revisión.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck` y `bun run test` en verde.
- **SC-002**: contra el backend local con el Excel de octubre: 434 alumnos, 29 secciones y 26 asesores (con la designación oficial); descargas de Excel y
  PDF por asesor y general con el nombre del docente.
