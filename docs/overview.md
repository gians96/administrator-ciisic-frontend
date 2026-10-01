# Visión general

El panel trabaja sobre el **evento seleccionado** (selector en la cabecera; por defecto el evento
principal). Las cuentas por evento solo ven sus eventos en el selector y el panel recuerda, por
cuenta y navegador, el último que eligieron. Perfiles y pantallas:

## Administración (staff)

Cada cuenta de staff tiene un rol, y el panel muestra pantallas y botones según sus **permisos**
(los envía el backend en la sesión; spec 008, contrato en backend-ciisic spec 013).

| Rol | Alcance | Qué hace |
|---|---|---|
| **Owner** | Todos los eventos | Todo. Único que configura Sistema y que gestiona Owners y Administradores |
| **Administrador del sistema** | Todos los eventos | Todo menos Sistema. Gestiona Tesoreros y Comisión |
| **Tesorero** | Sus eventos | Resumen e inscripciones con montos y vouchers, validar pagos (sin cancelar ni eliminar), exportar, reenviar credenciales; ver asistencia, ponencias y mensajes |
| **Comisión tecnológica** | Sus eventos | Los permisos elegidos para su cuenta (por defecto, marcar asistencia); nunca pagos, validación ni configuración |

### Pantallas y permisos

| Pantalla | Qué permite | Permiso de la página | Acciones con permiso propio |
|---|---|---|---|
| Resumen (`/`) | KPIs del evento, inscripciones por día/estado/tipo, recaudado, tarjeta "Semana Sistémica" (congreso + deportes) | `resumen.ver` | Montos: `pagos.ver` |
| Inscripciones | Filtros, detalle con verificación UNDC y de correo (Google) | `inscripciones.ver` | Montos, pago y voucher: `pagos.ver` · aprobar/rechazar/en revisión: `inscripciones.validar` · cancelar: `inscripciones.cancelar` · eliminar: `inscripciones.eliminar` · CSV: `inscripciones.exportar` · reenviar credencial: `credenciales.reenviar` |
| Asistencia | Registro por actividad (hora de Lima), método y quién registró | `asistencia.ver` | Marcar: `asistencia.marcar` · fuera de horario: `asistencia.fuera_horario` · anular: `asistencia.anular` · exportar: `asistencia.exportar` · documento completo: `inscripciones.ver` |
| Ponencias | Consulta y descarga | `ponencias.ver` | — |
| Mensajes | Consulta | `mensajes.ver` | Eliminar: `mensajes.eliminar` |
| Eventos (lista, nuevo y detalle) | General (datos, remitente), Datos de pago (cuentas y billeteras con su QR: arrastrar y soltar), Categorías y tipos, Actividades, Integraciones (deportes-fi), **Acceso** (tokens de la landing) | `eventos.configurar` | Eliminar: `eventos.eliminar` · credencial de correo: `correo.configurar` |
| Tipos de inscripción | Planes del evento | `eventos.configurar` | — |
| Consultas DNI | Pool de tokens (Decolecta/apiperu), uso, bitácora, consulta manual | `consultas_dni.gestionar` | — |
| Participantes | Consulta y edición; desvincular Google | `participantes.gestionar` | — |
| Correo | Credenciales de Brevo, prueba de cuenta, correo de prueba | `correo.configurar` | — |
| Equipo y administradores | Alta con acceso «Solo Google» o «Contraseña o Google», rol, eventos (Tesorero y Comisión) y permisos (Comisión), activar/desactivar, desvincular Google | `administradores.gestionar` | El Owner gestiona todas las cuentas; el Administrador, solo Tesoreros, Comisión y la suya |
| Sistema | API_UNDC (probar conexión), client ID de Google, URL del panel, landing anterior | `sistema.configurar` | — |
| Sin acceso (`/sin-acceso`) | Cuenta sin ninguna sección, o cuenta por evento sin eventos asignados: «Volver a intentar» y «Cerrar sesión» | — | — |

### Qué ve cada rol

| Pantalla | Owner | Administrador del sistema | Tesorero | Comisión tecnológica |
|---|---|---|---|---|
| Resumen | Sí | Sí | Sí, con montos | Con `resumen.ver`, sin montos |
| Inscripciones | Todo | Todo | Con pagos y validación; sin cancelar ni eliminar | Con `inscripciones.ver`, sin pagos ni validación; CSV y reenviar si se los dieron |
| Asistencia | Todo | Todo | Ver y exportar (no marca) | Según sus permisos (marcar incluye ver) |
| Ponencias · Mensajes | Sí (y eliminar mensajes) | Sí (y eliminar mensajes) | Ver | Ver, si se los dieron |
| Eventos · Tipos · Consultas DNI · Participantes · Correo | Sí | Sí | — | — |
| Equipo y administradores | Todas las cuentas | Tesoreros, Comisión y la suya | — | — |
| Sistema | Sí | — | — | — |
| Eventos del selector | Todos | Todos | Los suyos | Los suyos |
| Página de inicio | Resumen | Resumen | Resumen | Asistencia si marca; si no, la primera de su menú |

Una pantalla sin permiso no aparece en el menú y, abierta por URL, lleva a la página de inicio de
la cuenta. Sin `pagos.ver` el backend envía los montos en `null` y el panel muestra «—». El
backend es la autoridad: rechaza con 403 lo que la cuenta no puede hacer aunque la pantalla lo
ofrezca (el avance de los botones por permiso está en
[`specs/008-roles-permisos/tasks.md`](../specs/008-roles-permisos/tasks.md)).

## Portal del inscrito

`/mis-inscripciones`: el inscrito entra con la cuenta de Google de su correo de inscripción
(Gmail o institucional) y ve, por evento, tipo, monto y descuento, pago, estado, motivo de
rechazo y fecha de revisión; descarga su credencial cuando está aprobada. No ve el menú ni
ninguna pantalla de administración.

## Inicio de sesión

- Staff (Owner, Administrador del sistema, Tesorero, Comisión): correo y contraseña, o
  **Continuar con Google** si el correo de la cuenta Google es el de una cuenta de staff activa
  (cualquier dominio). Las cuentas «Solo Google» no tienen contraseña: únicamente entran con Google.
- La sesión se renueva sola mientras se usa el panel, hasta 12 h desde el ingreso; después, o si
  cambian el correo, la contraseña o el Google de la cuenta, o la desactivan, el login explica el
  motivo. Los cambios de rol, eventos o permisos no cierran la sesión.
- Inscritos: solo Google.
