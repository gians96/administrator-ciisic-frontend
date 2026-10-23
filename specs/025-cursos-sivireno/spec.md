# Feature Specification: Seguimiento por curso y docente (SIVIRENO)

**Created**: 2026-10-23 · **Status**: Implementado (pendiente de desplegar tras el backend 034) · **Contrato**: `backend-ciisic/specs/034-padron-cursos-sivireno/contracts/api-cursos-sivireno.md`

**Input**: los docentes preguntaban de dónde salía cada alumno. El backend (spec 034) ahora arma el seguimiento con la programación académica de SIVIRENO: cada **curso** (asignatura, ciclo, sección, turno y docente) con sus
matriculados, y el docente de un curso es el asesor de sus alumnos. Se pidió un **listado completo** y una **pestaña «Por curso»** donde, al elegir un curso, salga su listado de alumnos con quién pagó.

## Decisiones

- **Aditivo y tolerante**: `cursos`, `porCurso` y `opciones.cursos` son opcionales en los tipos; sin ellos (backend anterior o padrón del Excel) las pantallas se ven como antes y no aparece nada de cursos.
- **Reportes** (`/reportes`):
  - Pestaña **«Por curso (N)»** (la primera y la que se abre si hay cursos): tabla con curso, sección, docente y los contadores de pago; búsqueda por curso, código, sección o docente (en el navegador, `buscarCursos`); «Alumnos» abre el listado de ese curso
    con quién pagó (`cursoId`) y «Descargar» baja su Excel o PDF (siempre el del curso completo).
  - Pestaña **«Listado completo»** (la de alumnos): cada alumno con sus **cursos y docentes** (curso · sección · docente), situación y contacto; filtro por curso y por docente. El Excel general trae la hoja «Listado completo» (una fila por alumno y curso).
  - «Por asesor» pasa a «Por docente». Un filtro nuevo «Curso» en la barra y como etiqueta que se quita.
  - Totales, tablas y descargas las calcula el backend (un alumno cuenta una vez en el total y una vez en cada curso): el panel no recalcula.
- **Vistas públicas** (`/docentes`, `/seguimiento`, `/seguimiento/ciclo`): tarjetas **por curso** (con su avance; en el ciclo, con el docente) que filtran la lista, y cada alumno muestra sus cursos dentro del alcance de quien mira. El filtro por curso se
  combina con ciclo, situación y búsqueda (`filtrarAlumnosDocente`, `cursoId`).
- `AsesorEditar`: un docente de SIVIRENO (`desdeSivireno`) solo edita nombre y DNI; sus secciones salen de sus cursos y se muestran de solo lectura.
- Sin cambios de permisos, de rutas ni del BFF.

## User Scenarios & Testing

1. **Given** Reportes con cursos, **When** abro «Por curso», **Then** veo los cursos con docente y quién pagó; al pulsar «Alumnos» veo su listado y puedo descargarlo.
2. **Given** un docente entra con su DNI, **Then** ve **sus** cursos como tarjetas, filtra por uno y cada alumno muestra en qué cursos suyos está.
3. **Given** un backend anterior (sin cursos), **Then** todo se ve como antes.

## Requirements

- **FR-001**: `cursoId` viaja en la URL, en los parámetros de la API, en las etiquetas de filtros y en la descarga; uno inválido o inexistente se descarta.
- **FR-002**: `buscarCursos` ignora acentos y mayúsculas y pide todas las palabras (curso, código, sección-ciclo o docente).
- **FR-003**: `filtrarAlumnosDocente` filtra por curso y se combina con la situación y la búsqueda.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck` y `bun run test` en verde.
