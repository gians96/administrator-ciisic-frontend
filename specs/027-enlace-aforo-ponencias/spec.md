# Feature Specification: Enlace público del aforo de las ponencias especializadas (panel)

**Created**: 2026-10-25 · **Status**: Implementado en el panel (falta desplegar) · **Contrato**: `backend-ciisic/specs/036-enlace-aforo-ponencias/contracts/api-enlace-aforo.md`

**Input**: el usuario quiere ver por tema el aforo, los inscritos y la asistencia de las ponencias especializadas en una página aparte de la landing, con un enlace
público que **solo él genera y comparte**. La página vive en la landing (spec 012: `/aforo-ponencias`); el panel crea y administra el enlace.

> **Numeración**: es la spec **027** del panel. Backend = spec 036 · Landing = spec 012.

## Decisiones

- **Solo el Owner**: permiso nuevo `especializadas.enlace_aforo` en el catálogo (`ETIQUETAS_PERMISO`) y en `PERMISOS_SOLO_OWNER`, como en el backend. La tarjeta solo se
  monta con `auth.puede('especializadas.enlace_aforo')`: el Administrador del sistema, el Tesorero y la Comisión no la ven (y el backend les responde `403`).
- **Tarjeta `EnlaceAforoCard`** en el Programa (`/ponencias-especializadas`), debajo de «Acceso a la inscripción»: sin enlace, «Crear enlace público»; con enlace, el enlace a la vista
  (campo de solo lectura), «Copiar enlace», «Copiar mensaje» (texto para WhatsApp o correo, `mensajeEnlaceAforo`) y el menú «Más» con «Abrir como se verá», «Renovar enlace» y
  «Desactivar enlace» (ambos con confirmación). Estado «Sin enlace», «Aún no se abre» o «Activo · Se abrió hace …» (`estadoDelEnlace`, `haceCuanto`). Aviso ámbar: cualquiera con
  el enlace ve las cifras (sin nombres); se renueva si se difunde.
- **URL**: `<landing>/aforo-ponencias#<token>` (`urlEnlaceAforo`): el origen es el de la landing (`origenLanding`; en desarrollo, el puerto 3000) y el token va tras el `#`
  (el navegador no lo envía a ningún servidor).
- Un enlace por evento: la tarjeta sigue al evento elegido (descarta respuestas tardías de otro evento).

## Despliegue

Backend 036 primero (sin él la tarjeta muestra el error del backend al cargar). La landing con la página puede ir antes o después: sin ella, «Abrir como se verá» da 404.
