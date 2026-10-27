# Feature Specification: Acceso virtual — enlace de ingreso al congreso para los inscritos virtuales (panel)

**Created**: 2026-10-26 · **Status**: Implementado en el panel (falta desplegar después del backend 043) · **Contrato**: `backend-ciisic/specs/043-acceso-virtual/contracts/api-acceso-virtual.md`

**Input**: el usuario necesita enviar a los inscritos **virtuales** un enlace para que puedan ingresar al congreso y tener en el panel la opción de enviárselo a quienes están inscritos de manera virtual.

> **Numeración**: es la spec **033** del panel. Backend = spec 043. Amplía los envíos masivos de la spec 029: mismo componente, un tercer canal.

## Decisiones

- **Una pantalla nueva, `/acceso-virtual`** («Acceso virtual», menú «Congreso» junto a «Credencial 3D»; ver = `inscripciones.ver`, enviar y probar = `credenciales.reenviar`), que reutiliza `components/envios/PanelEnvio.vue` con
  `canal="virtual"`: totales de los **virtuales aprobados** del evento (virtuales, ya enviado, sin enviar), búsqueda y filtro «Enviados y sin enviar», tabla con casillas y la columna «Acceso enviado»,
  «Elegir a todos los sin enviar (N)» (todos, no solo la página) y envío por tandas de 25 con avance y «Detener».
- **El enlace lo escribe quien envía** (campo «Enlace para ingresar al congreso», obligatorio): el de la transmisión (Zoom, Meet, YouTube…). Se valida igual que el backend (`esEnlaceDeAcceso`: `https://`, con servidor, sin
  usuario ni contraseña ni espacios, hasta 500) y el botón de envío queda bloqueado con un aviso mientras sea inválido. Se recuerda el último de cada evento en este navegador (`localStorage`, `ciisic:acceso-virtual:enlace:<evento>`, con
  `try/catch`): es solo una comodidad, no se manda a ningún lado fuera del envío y se puede cambiar.
- **Mensaje**: asunto y texto editables (propuesta con el nombre del evento, «Restablecer texto»), **vista previa** del correo con el botón «Ingresar al congreso» y el enlace escrito, y **«Enviarme una prueba»** (sale como `[Prueba]`
  y no marca a nadie). Mismo texto y mismo enlace para todas las personas: no hay `{nombre}`.
- **Volver a enviar**: sin «Volver a enviar a quien ya lo recibió» el servidor omite a quien ya tiene la marca; si el enlace cambia (otro día u otra sala) se activa para reenviarlo a todos.
- **El panel no decide a quién**: el servidor vuelve a comprobar que cada persona esté aprobada y sea virtual (`noElegibles`: «no están aprobadas o no son virtuales») y reserva la marca antes de enviar.
- Sin credencial de correo activa el backend responde `409 EMAIL_CREDENTIAL_UNAVAILABLE` (ya traducido). **No** necesita la URL de la landing. Un backend anterior (ruta inexistente) muestra «Esta pantalla aún no está disponible».
- `PanelEnvio` pasa a leer del canal sus textos (`TEXTOS_CANAL`: etiqueta de la primera tarjeta, vacío, columna) y `resumenDeEnvio` recibe el canal para decir «presenciales» o «virtuales».

## Requisitos

- **FR-001**: lógica pura en `app/utils/enviosMasivos.ts` con pruebas: ruta `virtual-access`, `esEnlaceDeAcceso`, `mensajeVirtualPropuesto`, `validarMensajeVirtual`, `cuerpoMensajeVirtual`, `claveEnlaceVirtual` y los textos del canal.
- **FR-002**: nunca se muestra ni se envía documento de más: la lista trae nombre, documento, correo, tipo y marca (lo mismo que ya ve `inscripciones.ver`).
- **FR-003**: el enlace no se escribe en la URL de la página, `useHead` ni consola.

## Fuera de alcance

- Guardar el enlace en el evento, mostrarlo en el portal del inscrito o personalizarlo por persona.
- Programar envíos, guardar plantillas o un historial de campañas.
