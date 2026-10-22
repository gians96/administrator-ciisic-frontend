# Feature Specification: Resumen por persona de las ponencias especializadas, cancelación y comunicado (panel)

**Created**: 2026-10-22 · **Status**: Implementado en el panel (falta probarlo en el navegador y desplegar) · **Contrato**: `backend-ciisic/specs/031-ponencias-resumen-personas/contracts/api-ponencias-resumen-personas.md`

**Input**: con la spec 020 las ponencias especializadas solo admiten a quien tiene su inscripción al congreso con el pago aprobado, pero quedaron inscritas personas que entraron
cuando el acceso era libre. El staff necesita ver, **una fila por persona** (no por ponencia ni ponente), quién puede estar inscrito y quién no, con filtros; descargar el reporte;
y a quien no puede, cancelarle la inscripción y darle un comunicado por correo.

## Decisiones

- **Pantalla nueva «Resumen»** (`/ponencias-especializadas/resumen`, `especializadas.ver`, ítem del menú tras «Inscripciones»). Tarjetas con los totales de **todo** el evento
  (personas, pueden, no pueden, sin validar, avisadas), botones de situación en el congreso con su cuenta (no inscrito, rechazado o cancelado, pago en revisión, pago aprobado),
  filtros (puede, validación, modo del congreso, comunicado y búsqueda) sincronizados con la URL y una tabla con una fila por persona.
- **El panel no decide quién puede**: lo calcula el backend en cada consulta (`puede`, `situacion`). El panel solo deja elegir a quien no puede (`esSeleccionable`) y el servidor
  vuelve a comprobarlo: si el pago ya se aprobó o la persona ya asistió, la omite y lo informa.
- **Elegir**: casillas por fila y por página (la selección sobrevive al cambiar de página) y «Elegir a todos los que no pueden» (respeta los filtros puestos, hasta 100 por envío).
  Con el acceso libre encendido todas pueden: no hay casillas ni acciones y se avisa con la franja ámbar.
- **Cancelar y avisar** y **Solo avisar** (`especializadas.inscribir`) abren el mismo diálogo (`ResumenComunicado`): resumen de a quiénes alcanza (inscripciones vigentes, con y sin
  correo), asunto y mensaje **editables** con un texto propuesto (`comunicadoPropuesto`; `{nombre}` se reemplaza en el servidor), «Copiar texto» para avisar por otro medio a quien no
  tiene correo, «Restablecer texto» y una casilla de confirmación obligatoria. Al cancelar se puede apagar «Enviar el comunicado por correo». El diálogo termina mostrando qué pasó
  (`resumenDeResultado`): cancelaciones, correos enviados, sin correo, fallidos, sin credencial y personas omitidas con su motivo.
- **Descargar Excel** con los mismos filtros (`rutaDescargaResumen`, `useApi().descargar`; el nombre lo envía el servidor).
- **Inscripciones**: el motivo nuevo `SIN_CONGRESO` se muestra como «Cancelada: sin inscripción aprobada al congreso».
- **Tolerante**: un backend sin la spec 031 responde 404 de ruta y la pantalla dice que aún no está disponible. Errores nuevos en `errores.ts`: `FREE_ACCESS_ENABLED`,
  `EMAIL_CREDENTIAL_UNAVAILABLE`, `ATTENDEES_NOT_FOUND`.

## Despliegue

**Backend 031 primero** (su migración es aditiva: valor `SIN_CONGRESO` del motivo y la columna `aviso_enviado_en`); luego este panel. Nada se envía ni se cancela hasta que alguien lo
confirme en el diálogo.
