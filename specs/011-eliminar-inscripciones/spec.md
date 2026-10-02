# Feature Specification: Eliminar inscripciones rechazadas o canceladas (solo Owner)

**Created**: 2026-10-02 · **Status**: Implementado · **Backend**: `backend-ciisic/specs/017-reinscripcion/`

## Escenarios

1. **Given** soy Owner y abro el detalle de una inscripción `RECHAZADO` o `CANCELADO`, **Then** veo
   «Eliminar»; al confirmar se llama `DELETE /v1/inscriptions/:id`, se cierra el detalle y se recarga
   el listado.
2. **Given** soy Administrador del sistema, Tesorero o Comisión, **Then** no veo «Eliminar» (el backend
   tampoco me lo permite: `inscripciones.eliminar` es solo del Owner).
3. **Given** la inscripción está `PENDIENTE`, `EN_REVISION` o `APROBADO`, **Then** nadie ve «Eliminar».
4. La confirmación explica que no hace falta eliminar para volver a inscribirse: el backend reutiliza
   una inscripción rechazada o cancelada al enviar el formulario de nuevo (spec 017 del backend).

## Requisitos

- **FR-001**: `accionesInscripcion` devuelve `eliminar` = `inscripciones.eliminar` y estado `RECHAZADO` o `CANCELADO`.
- **FR-002**: `PERMISOS_SOLO_OWNER` (`sistema.configurar`, `inscripciones.eliminar`) también en el
  respaldo por rol de las sesiones sin `acceso`.
