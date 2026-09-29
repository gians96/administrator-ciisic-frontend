# Feature Specification: Eventos, tipos de inscripción y actividades

**Status**: Implementado · **Contrato**: `backend-ciisic/specs/002-multi-evento/contracts/api-admin.md`
**Input**: "Gestión de eventos, gestión de tipo de inscripción… reusarse para los demás eventos."

## User Scenarios & Testing

### User Story 1 - Crear la siguiente edición (Priority: P1)
Como administrador quiero crear un evento (IX CIISIC 2027) indicando nombre, código,
fechas, estado y ventana de inscripciones, y copiar las categorías y tipos del evento
anterior para solo ajustar precios.

### User Story 2 - Gestionar tipos y precios (Priority: P1)
Quiero crear/editar categorías (marcar la estudiantil) y tipos con precio regular, precio
UNDC, etiqueta (CON KIT / SIN KIT), características con íconos, orden y activar/desactivar
sin borrar historial.

### User Story 3 - Datos de pago sin redesplegar (Priority: P2)
Quiero editar titular, cuentas bancarias (CCI) y billeteras (Yape/QR) que muestra la landing.

### User Story 4 - Actividades e integraciones (Priority: P2)
Quiero definir las actividades del evento (fecha y horario en hora de Lima) y conectar
eventos de deportes-fi con su token por evento.

## Requirements
- **FR-001**: Listado de eventos con estado, principal, inscripciones abiertas y total.
- **FR-002**: Formulario de evento con código autogenerado desde el nombre corto.
- **FR-003**: Pestañas General · Datos de pago · Categorías y tipos · Actividades · Integraciones.
- **FR-004**: Errores de validación del backend se muestran junto a cada campo.
- **FR-005**: El token de integración es write-only (solo se ve `••••1234`).
