# Feature Specification: Resumen y Semana Sistémica

**Status**: Implementado · **Contratos**: `backend-ciisic` specs 002 (summary) y 005 (sports-summary)
**Input**: "Poder saber cuánto se hizo… dentro de la Semana Sistémica de la Facultad de Ingeniería."

## User Scenarios & Testing

### User Story 1 - KPIs del evento (Priority: P1)
Como organizador quiero ver inscripciones totales, por revisar, aprobadas, recaudado y por
validar, estudiantes UNDC verificados, inscripciones por día y por estado, y el detalle por
tipo de inscripción.

### User Story 2 - Semana Sistémica (Priority: P1)
Quiero ver lo recaudado en el congreso (aprobado) y en deportes (vouchers validados, por
disciplina y tipo de participante) y el total; si deportes-fi falla, ver el error sin perder
el resto del resumen.

## Requirements
- **FR-001**: Gráficos Chart.js con etiquetas accesibles (`role="img"` + descripción).
- **FR-002**: Accesos directos a "Revisar pendientes" (filtro en la URL) y a Integraciones.
