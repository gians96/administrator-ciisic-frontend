# Feature Specification: Cambiar el tipo de una inscripción (solo Owner) (panel)

**Created**: 2026-10-23 · **Status**: Implementado en el panel (falta desplegar) · **Contrato**: `backend-ciisic/specs/035-cambiar-tipo-inscripcion/contracts/api-cambiar-tipo-inscripcion.md`

**Input**: algunos inscritos se equivocaron al elegir su tipo (p. ej. un docente de la facultad que se inscribió como «PROFESIONALES Y PUBLICO EN GENERAL · CON KIT» y debía estar en «Docente,
egresados y administrativos de la Facultad Ingeniería UNDC · CON KIT»). El usuario pidió que **el Owner pueda corregirlo** desde Inscripciones.

## Decisiones

- **Botón «Cambiar tipo»** en la tarjeta «Inscripción» del detalle, solo con `inscripciones.cambiar_tipo` (el Owner; `PERMISOS_SOLO_OWNER`) y **no** en un integrante de una delegación (su plan se cambia
  en Delegaciones; `puedeCambiarTipo`). No va en la barra de acciones del pie: el detalle sigue sin barra cuando no hay otras acciones.
- **Diálogo `CambiarTipoDialogo`**: muestra el tipo y la categoría de ahora, dos selectores dependientes (categoría y tipo, de `events/:id/registration-categories`; salen también los tipos inactivos,
  marcados) y un motivo opcional. Parte del tipo actual; **Cambiar tipo** se habilita solo con otro tipo elegido. Una categoría con un solo tipo lo elige sola.
- **El monto pagado no cambia**: el diálogo lo avisa si no coincide con el precio del tipo elegido (ni con su precio institucional) y cómo queda el descuento (`avisosDelCambio`, `descuentoTrasCambio`,
  igual que el backend). Avisa también si cambia la modalidad de asistencia (las ponencias especializadas pendientes de la persona pasan al modo nuevo; pasar a presencial puede fallar por falta de cupo)
  y, en una inscripción aprobada, que la credencial PDF se actualiza sola pero **no se envía ningún correo** (se reenvía a mano con «Reenviar credencial»).
- **Historial**: el detalle muestra «Cambios de tipo» (fecha, quién, tipo anterior → nuevo y motivo) cuando hay (`cambiosTipo`, solo en el detalle y en la respuesta del cambio). Al cambiar el estado se
  conserva el historial que ya se tenía (esa respuesta no lo trae).
- **El listado** refleja el cambio al instante en la columna Tipo (`tipoDeFila`) sin recargar.
- **Errores** en `errores.ts`: `TYPE_UNCHANGED`, `INSCRIPTION_IN_DELEGATION`, `INSCRIPTION_CHANGED` y `TALK_FULL_ON_TYPE_CHANGE` (este último muestra el texto del servidor, que nombra la ponencia).
- **Tolerante**: un backend anterior no tiene la ruta; la acción responde 404 y el diálogo lo muestra, y el detalle sigue funcionando (`cambiosTipo` ausente = sin historial).

## Despliegue

**Backend 035 primero** (su migración solo crea una tabla); luego este panel. Nada cambia hasta que el Owner confirme un cambio en el diálogo.
