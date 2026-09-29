# Feature Specification: Gestión de inscripciones y asistencia

**Status**: Implementado · **Contrato**: `backend-ciisic/specs/002-multi-evento/contracts/api-admin.md`
**Input**: "Panel visual para administración de las inscripciones, aprobarlas…"

## User Scenarios & Testing

### User Story 1 - Revisar y aprobar (Priority: P1)
Como administrador quiero ver las inscripciones del evento, filtrarlas (estado, categoría,
tipo, UNDC verificado, búsqueda por DNI/nombre/correo/nº de operación), abrir el detalle
con el voucher y aprobar o rechazar con motivo.

**Acceptance Scenarios**:
1. **Given** una inscripción pendiente, **When** la apruebo y confirmo, **Then** queda
   "Aprobado" y veo si la credencial se envió; si falló, puedo reenviarla.
2. **Given** que rechazo, **Then** debo escribir un motivo (mín. 3 caracteres).
3. **Given** un estudiante no verificado en categoría estudiantil, **Then** veo la insignia
   "Estudiante externo · validar" y el motivo de la verificación.
4. **Given** filtros aplicados, **When** comparto la URL, **Then** se abren los mismos filtros.
5. **Given** filtros aplicados, **When** exporto CSV, **Then** el archivo respeta esos filtros.

### User Story 2 - Registrar asistencia (Priority: P2)
Como organizador quiero elegir la actividad y registrar asistencia escaneando el QR de la
credencial con un lector USB (escribe el código + Enter) o escribiendo el DNI; ver la lista
de asistentes, quitar registros y exportar la matriz participantes × actividades.

## Requirements
- **FR-001**: Tabla paginada (20) con estado, tipo, monto, pago, UNDC y fecha.
- **FR-002**: Drawer de detalle: participante, inscripción, pago con vista previa del voucher
  (imagen o PDF), verificación, revisión; acciones Aprobar/Rechazar/En revisión/Reenviar/Ver credencial.
- **FR-003**: Asistencia con opción "fuera de horario" y mensajes del backend (no aprobado, fuera de
  ventana, ya registrado).
- **FR-004**: Exportación CSV de inscripciones (servidor) y de asistencia (cliente, con BOM).
