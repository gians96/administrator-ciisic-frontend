# Feature Specification: Envíos masivos a los inscritos presenciales (panel)

**Created**: 2026-10-25 · **Status**: Implementado en el panel (falta desplegar después del backend 038 y 039) · **Contrato**: `backend-ciisic/specs/039-envios-masivos-presenciales/contracts/api-envios-masivos.md`

**Input**: el usuario quiere, desde el panel, (1) enviar a los **inscritos presenciales** el enlace de su **credencial 3D** (landing spec 013), y (2) en
`/ponencias-especializadas`, **elegir a todos los inscritos presenciales, editar un mensaje y enviarlo en un mismo envío** (no personalizado) con el enlace a
`/inscripcion-ponencias` de la landing, **marcando a quién ya se le envió** para elegir después solo a quien falta.

> **Numeración**: es la spec **029** del panel. Backend = specs 038 (la API) y 039 (el envío masivo) · Landing = spec 013.

## Decisiones

- **Dos pantallas, un mismo componente** (`components/envios/PanelEnvio.vue`): estadísticas del evento (presenciales, ya enviado, sin enviar), búsqueda y filtro «Enviados y sin enviar»,
  tabla con casillas y la columna «Enlace enviado» / «Mensaje enviado» (fecha o «Sin enviar»), «Elegir a todos los sin enviar (N)» (todos, no solo la página: pide los ids al backend) y paginación.
- **Credencial 3D** (`/credenciales`, menú «Congreso», ver = `inscripciones.ver`, enviar = `credenciales.reenviar`): cada persona recibe **su** enlace. Texto fijo.
- **Enviar el enlace a las ponencias** (`/ponencias-especializadas/enviar-enlace`, menú «Ponencias especializadas» y tarjeta «Invitar a los inscritos presenciales» en el Programa; ver =
  `especializadas.ver`, enviar = `especializadas.inscribir`): editor de **asunto y mensaje** (texto propuesto con el nombre del evento, `restablecer`), **vista previa** del correo con su botón
  «Inscribirme a las ponencias», y **«Enviarme una prueba»** (sale como `[Prueba]` y no marca a nadie). Mismo texto para todas las personas: no hay `{nombre}`.
- **Por tandas con avance** (`enviarPorTandas`, `TAMANO_TANDA_ENVIO` = 25): una petición a la vez; si una falla (p. ej. `409 LANDING_URL_MISSING`) se corta ahí y se informa lo logrado; «Detener» corta entre tandas.
  Lo que no se envió sigue «Sin enviar»: se reintenta eligiéndolo de nuevo. Sin `reenviar` el servidor omite a quien ya lo recibió (interruptor «Volver a enviar a quien ya lo recibió», apagado por defecto).
  Se pide marcar «Entiendo que los correos se envían de inmediato».
- **El panel no decide a quién**: el servidor vuelve a comprobar que cada persona esté aprobada y sea presencial (`noElegibles`) y reserva la marca antes de enviar (dos cuentas a la vez no duplican).
- **Sistema**: la tarjeta «URL del panel» pasa a «URL del panel y de la landing» con el campo `urlLanding` (solo Owner); sin esa URL los envíos responden `409 LANDING_URL_MISSING` y el correo de aprobación sale sin el botón de la credencial.
- Un backend anterior (ruta inexistente) muestra «Esta pantalla aún no está disponible» (`esNoDisponible`).

## Requisitos

- **FR-001**: lógica pura en `app/utils/enviosMasivos.ts` con pruebas (rutas, filtros en la URL, selección entre páginas, tandas, resultado, mensaje y validación con los mismos largos del backend).
- **FR-002**: nunca se muestra ni se envía documento de más: la lista trae nombre, documento, correo, tipo y marca (lo mismo que ya ven `inscripciones.ver` y `especializadas.ver`).
- **FR-003**: errores nuevos traducidos (`LANDING_URL_MISSING`, `EMAIL_SEND_FAILED`; los de correo y filtros ya existían).

## Fuera de alcance

- Programar envíos, guardar plantillas o un historial de campañas; enviar a quien no es presencial o no está aprobado.
- Personalizar el mensaje de las ponencias con el nombre de cada persona (es genérico a propósito).
