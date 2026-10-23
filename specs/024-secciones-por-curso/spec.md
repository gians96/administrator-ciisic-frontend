# Feature Specification: Alumnos en varias secciones (secciones por curso)

**Created**: 2026-10-23 · **Status**: Implementado (pendiente de desplegar tras el backend 033) · **Contrato**: `backend-ciisic/specs/033-padron-secciones-jp/contracts/api-secciones-por-curso.md`

**Input**: la sección va ligada al **curso**, así que un alumno puede cursar en varias secciones (teoría y laboratorio, o un curso repetido de otro ciclo). El backend (spec 033) ahora envía
todas las secciones de cada alumno con su asesor y cuenta al alumno una vez en los totales. El panel debe mostrarlas sin romper nada cuando falten (backend anterior).

## Decisiones

- **Aditivo y tolerante**: `secciones` es opcional en los tipos (`AlumnoSeguimiento.secciones?`, `AlumnoDocente.secciones?`); ausente o vacío = solo la sección principal que ya se mostraba.
- **Reportes** (`/reportes`): en el listado de alumnos, debajo de la sección y el turno principales aparece «También: II-B, IV-B» (`otrasSecciones`). Los totales, las tablas por ciclo y por
  sección y los filtros los calcula el backend; el panel no recalcula nada.
- **Vistas públicas** (`/seguimiento`, `/seguimiento/ciclo`, `/docentes`): cada alumno trae `secciones` (etiquetas dentro del alcance de quien mira, nunca las de otro docente). El filtro de ciclo
  y de sección se cumple en **cualquiera** de ellas (`seccionesDelAlumnoDocente`) y los contadores por ciclo cuentan al alumno una vez en cada ciclo en que cursa, en orden académico (`ciclosDe`).
- Sin cambios de permisos, de rutas ni del BFF.

## User Scenarios & Testing

1. **Given** un alumno cursa en `VI-A1` y repite un curso de `II-B`, **When** el docente de `II-B` entra con su DNI, **Then** lo ve en el filtro del ciclo II y de la sección `II-B`, con solo lo que le corresponde.
2. **When** el staff abre Reportes, **Then** ese alumno sale una vez en el listado con «También: II-B».
3. **Given** un backend anterior (sin `secciones`), **Then** las pantallas se ven como antes.

## Requirements

- **FR-001**: `otrasSecciones` da las demás secciones (objetos de la fila o etiquetas de la vista pública) y nada si cursa en una sola o el backend no las envía.
- **FR-002**: `filtrarAlumnosDocente` y `ciclosDe` consideran todas las secciones del alumno.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck` y `bun run test` en verde.
