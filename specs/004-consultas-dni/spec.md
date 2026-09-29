# Feature Specification: Módulo de consultas DNI

**Status**: Implementado · **Contrato**: `backend-ciisic/specs/003-consultas-dni/contracts/api-consultas.md`
**Input**: "En este módulo de consultas puedo agregar qué tipo de proveedor es el token y la cantidad de consultas límite que tiene, y fecha de refresco, y poder agregar múltiples…"

## User Scenarios & Testing

### User Story 1 - Registrar tokens (Priority: P1)
Como administrador quiero agregar tokens de Decolecta o apiperu con alias, límite, consumo
inicial, periodo y fecha de renovación, prioridad y estado activo, sabiendo que el token
se guarda cifrado y no se vuelve a mostrar.

### User Story 2 - Monitorear y operar (Priority: P1)
Quiero ver por token el uso (barra usadas/límite), la próxima renovación, el estado
(Activo/Agotado/Inválido) y el último error; probarlo con un DNI, reiniciar su contador,
pausarlo o eliminarlo; y saber cuántos tokens y consultas quedan disponibles.

### User Story 3 - Auditoría (Priority: P2)
Quiero un gráfico de consultas por día y resultado (30 días), una bitácora paginada con
DNI enmascarado y una consulta manual de DNI.

## Requirements
- **FR-001**: Alerta visible cuando no hay tokens disponibles (la landing pasa a ingreso manual).
- **FR-002**: La prueba advierte que consume una consulta real.
- **FR-003**: El campo de token es `password` y opcional al editar (vacío = conservar).
