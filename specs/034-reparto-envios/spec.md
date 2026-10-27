# Feature Specification: Reparto de los envíos masivos entre credenciales (panel)

**Created**: 2026-10-26 · **Status**: Implementado en el panel (pendiente de desplegar después del backend 044)

**Input**: el Owner preguntó qué pasa si ANGEL tiene 295 envíos y hay que mandar 320, y cómo saber que al llegar al límite el sistema usa solo la otra credencial. El backend ya cambia solo (spec 044);
el panel debe **mostrarlo**: cómo se repartirá antes de enviar y cuántos salieron por cada credencial al terminar.

> Contrato: `backend-ciisic/specs/044-reparto-envios/`. El panel solo informa: **quién envía y cuándo se corta lo decide el backend**; `repartoPrevisto` replica su regla para avisar antes.

## Decisiones

- **Vista previa en la confirmación** (`PanelEnvio`, las dos pantallas de envío masivo): una línea con el reparto de las personas elegidas — «320 correos: 295 por ANGEL y 25 por LORENA», «100 correos: todos por ANGEL» — con la misma cadena del backend
  (`repartoPrevisto`: la credencial del evento primero, luego las activas por prioridad, saltando las sin créditos; una de Gmail, que no informa créditos, recibe lo que falte y se marca «sin cupo conocido»).
- **Alerta ámbar si no alcanza**: «Solo hay envíos para 894 de 900 (…): los últimos 6 quedarían sin enviar. Agrega otra credencial o espera a que se renueve el cupo.»; si no hay ninguna con envíos, «el envío se rechazará».
  Es una **estimación**: no bloquea el botón (el servidor decide y vuelve a revisar al empezar).
- **Solo para quien configura el correo** (`auth.puede('correo.configurar')`: Owner y Administrador): Tesorero y Comisión envían pero no pueden leer los créditos. Al abrir la confirmación se piden las credenciales
  (`GET email-credentials`) y, si alguna revisión de Brevo falta o venció, se revisan (`POST …/check`); con un backend anterior (sin `creditosDisponibles`) o si algo falla, la línea simplemente no aparece.
- **Resultado**: «Salieron por ANGEL (295) y LORENA (25).» (`ResultadoEnvio.porCredencial`, que cualquiera ve: lleva solo el nombre). `sumarResultados` fusiona las tandas por credencial.
- **Cortes**: `enviarPorTandas` corta si el servidor responde `agotado: true` (cuenta solo a quienes alcanzó) o si una tanda entera no salió (`sin-salida`: no se insiste con el resto); en los dos casos lo que faltó sigue «Sin enviar»
  y el resumen dice qué hacer. `409 EMAIL_CREDITS_EXHAUSTED` al empezar se muestra como el corte por error.
- Se quitó un punto doble en «Se cortó el envío: …»: el mensaje del servidor ya termina en punto.

## Fuera de alcance

- Estado de entrega de cada correo (entregado, rebotó, en cola de Brevo) y seguimiento por persona.
- Bloquear el envío cuando la estimación no alcanza.

## Despliegue

Backend 044 primero. Con el backend anterior el panel se ve como antes (sin línea de reparto, sin «Salieron por…»; el `409` no existe).
