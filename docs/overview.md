# Visión general

El panel trabaja sobre el **evento seleccionado** (selector en la cabecera; por defecto el evento
principal). Las cuentas por evento solo ven sus eventos en el selector y el panel recuerda, por
cuenta y navegador, el último que eligieron. Perfiles y pantallas:

## Administración (staff)

Cada cuenta de staff tiene un rol, y el panel muestra pantallas y botones según sus **permisos**
(los envía el backend en la sesión; spec 008, contrato en backend-ciisic spec 013).

| Rol | Alcance | Qué hace |
|---|---|---|
| **Owner** | Todos los eventos | Todo. Único que configura Sistema, que elimina inscripciones (rechazadas o canceladas) y que gestiona Owners y Administradores |
| **Administrador del sistema** | Todos los eventos | Todo menos Sistema y eliminar inscripciones. Gestiona Tesoreros y Comisión |
| **Tesorero** | Sus eventos | Resumen e inscripciones con montos y vouchers, validar pagos (sin cancelar ni eliminar), exportar, reenviar credenciales; ver asistencia, ponencias y mensajes |
| **Comisión tecnológica** | Sus eventos | Los permisos elegidos para su cuenta (por defecto, marcar asistencia); nunca pagos, validación ni configuración |

### Pantallas y permisos

| Pantalla | Qué permite | Permiso de la página | Acciones con permiso propio |
|---|---|---|---|
| Resumen (`/`) | KPIs del evento, inscripciones por día/estado/tipo, recaudado, tarjeta "Semana Sistémica" (congreso + deportes) | `resumen.ver` | Montos: `pagos.ver` |
| Inscripciones | Filtros, detalle con verificación UNDC y de correo (Google) | `inscripciones.ver` | Montos, pago y voucher: `pagos.ver` · aprobar/rechazar/en revisión: `inscripciones.validar` · cancelar: `inscripciones.cancelar` · eliminar (solo rechazadas o canceladas; solo el Owner): `inscripciones.eliminar` · CSV: `inscripciones.exportar` · reenviar credencial: `credenciales.reenviar` |
| Asistencia | Registro por actividad (hora de Lima), método (QR, QR anterior, documento, manual) y quién registró; marca con el QR (código del fotocheck o QR anterior, con aviso ámbar) o el documento | `asistencia.ver` | Marcar: `asistencia.marcar` · fuera de horario: `asistencia.fuera_horario` · anular: `asistencia.anular` · exportar: `asistencia.exportar` · documento completo: `inscripciones.ver` |
| Escanear asistencia (`/escanear`) | Escáner para la puerta a pantalla completa (sin menú lateral): cámara, lector USB o DNI sobre una actividad del evento seleccionado; resultado verde, ámbar («QR antiguo: verifica el DNI» o «Ya estaba registrada») o rojo, con nombre, documento, tipo y foto; últimas 10 lecturas. Se abre también desde «Abrir escáner» en Asistencia | `asistencia.marcar` | Fuera de horario: `asistencia.fuera_horario` |
| Ponencias | Consulta y descarga | `ponencias.ver` | — |
| Mensajes | Consulta | `mensajes.ver` | Eliminar: `mensajes.eliminar` |
| Eventos (lista, nuevo y detalle) | General (datos, remitente), Datos de pago (cuentas y billeteras con su QR: arrastrar y soltar), Categorías y tipos, Actividades, Integraciones (deportes-fi), **Acceso** (tokens de la landing) | `eventos.configurar` | Eliminar: `eventos.eliminar` · credencial de correo: `correo.configurar` |
| Tipos de inscripción | Planes del evento: precio, precio UNDC y **Disponible para** (todos, solo comunidad UNDC o solo externos; spec 010) | `eventos.configurar` | — |
| Consultas DNI | Pool de tokens (Decolecta/apiperu), uso, bitácora, consulta manual | `consultas_dni.gestionar` | — |
| Participantes | Consulta y edición (el celular puede quedar vacío); desvincular Google; «Nuevo participante» sin inscripción (ponentes, organizadores, inscripción en persona; con DNI, nombres de RENIEC) | `participantes.gestionar` | «Inscripción de cortesía» (aprobada, sin pago, credencial opcional): `inscripciones.cortesia` |
| Correo | Credenciales de Brevo, prueba de cuenta, correo de prueba | `correo.configurar` | — |
| Equipo y administradores | Alta con acceso «Solo Google» o «Contraseña o Google», rol, eventos (Tesorero y Comisión) y permisos (Comisión), activar/desactivar, desvincular Google | `administradores.gestionar` | El Owner gestiona todas las cuentas; el Administrador, solo Tesoreros, Comisión y la suya |
| Sistema | API_UNDC (probar conexión), client ID de Google, URL del panel, landing anterior | `sistema.configurar` | — |
| Sin acceso (`/sin-acceso`) | Cuenta sin ninguna sección, o cuenta por evento sin eventos asignados: «Volver a intentar» y «Cerrar sesión» | — | — |

### Qué ve cada rol

| Pantalla | Owner | Administrador del sistema | Tesorero | Comisión tecnológica |
|---|---|---|---|---|
| Resumen | Sí | Sí | Sí, con montos | Con `resumen.ver`, sin montos |
| Inscripciones | Todo (eliminar solo rechazadas o canceladas) | Todo menos eliminar | Con pagos y validación; sin cancelar ni eliminar | Con `inscripciones.ver`, sin pagos ni validación; CSV y reenviar si se los dieron |
| Asistencia | Todo | Todo | Ver y exportar (no marca) | Según sus permisos (marcar incluye ver) |
| Escanear asistencia | Sí | Sí | — | Si marca asistencia |
| Ponencias · Mensajes | Sí (y eliminar mensajes) | Sí (y eliminar mensajes) | Ver | Ver, si se los dieron |
| Eventos · Tipos · Consultas DNI · Participantes (con alta y cortesías) · Correo | Sí | Sí | — | — |
| Equipo y administradores | Todas las cuentas | Tesoreros, Comisión y la suya | — | — |
| Sistema | Sí | — | — | — |
| Eventos del selector | Todos | Todos | Los suyos | Los suyos |
| Página de inicio | Resumen | Resumen | Resumen | El escáner si solo marca asistencia (los permisos por defecto); Asistencia si marca y tiene otros permisos; si no, la primera de su menú |

Una pantalla sin permiso no aparece en el menú y, abierta por URL, lleva a la página de inicio de
la cuenta. Sin `pagos.ver` el backend envía los montos en `null` y el panel muestra «—». El
backend es la autoridad: rechaza con 403 lo que la cuenta no puede hacer aunque la pantalla lo
ofrezca (el avance de los botones por permiso está en
[`specs/008-roles-permisos/tasks.md`](../specs/008-roles-permisos/tasks.md); el del escáner, el
alta de participantes y las cortesías, en
[`specs/009-portal-escaner/tasks.md`](../specs/009-portal-escaner/tasks.md)).

## Portal del inscrito

El inscrito no ve el menú ni ninguna pantalla de administración: solo las secciones del portal
(pestañas en la computadora, barra inferior en el celular). Todas declaran
`perfil: 'participante'` (spec 009; contrato en backend-ciisic spec 014).

| Sección | Qué muestra |
|---|---|
| Inscripciones (`/mis-inscripciones`) | Por evento: tipo, monto y descuento, pago, estado, motivo de rechazo y fecha de revisión; credencial PDF y «Ver fotocheck» cuando está aprobada |
| Fotocheck (`/mi-fotocheck`) | Fotocheck virtual de una inscripción aprobada: QR grande con el código de la credencial, el código en texto, evento, nombre, documento enmascarado (`****1234`), tipo de inscripción y foto, con un reloj «en vivo»; la pantalla no se apaga mientras está abierto y el último fotocheck se puede ver sin conexión en ese dispositivo (se borra al cerrar sesión) |
| Asistencia (`/mi-asistencia`) | Por evento aprobado, sus actividades y en cuáles asistió («asistidas / actividades») |
| Certificados (`/mis-certificados`) | Llegan con la spec 015 del backend; hasta entonces, estado vacío |
| Perfil (`/mi-perfil`) | Nombres, documento y correo (no se editan); celular editable; foto opcional (JPG o PNG, el panel la recorta en un cuadrado de 600 × 600 px) con consentimiento, que sale en el fotocheck, la credencial y el escáner; ver y quitar la foto |

Mientras producción tenga el backend anterior (013), las secciones que el backend aún no tiene
muestran «Esta sección estará disponible pronto.» en lugar de un error.

## Inicio de sesión

- Staff (Owner, Administrador del sistema, Tesorero, Comisión): correo y contraseña, o
  **Continuar con Google** si el correo de la cuenta Google es el de una cuenta de staff activa
  (cualquier dominio). Las cuentas «Solo Google» no tienen contraseña: únicamente entran con Google.
- La sesión se renueva sola mientras se usa el panel, hasta 12 h desde el ingreso; después, o si
  cambian el correo, la contraseña o el Google de la cuenta, o la desactivan, el login explica el
  motivo. Los cambios de rol, eventos o permisos no cierran la sesión.
- Inscritos: **Continuar con Google** con la cuenta del correo de inscripción, o **Entrar con un
  código a mi correo** (6 dígitos, vence en 10 min; se puede pedir otro al minuto). El código
  siempre abre el portal, nunca el panel. La sesión dura 12 h y no se renueva. La opción del código
  solo aparece si el backend la ofrece (necesita una credencial de correo activa).
- Staff que también está inscrito con su mismo correo: **Mi portal de participante** en el menú de
  su cuenta. Si entró con Google pasa directo; si entró con contraseña, confirma con un código a su
  correo. Para volver al panel ingresa de nuevo.
