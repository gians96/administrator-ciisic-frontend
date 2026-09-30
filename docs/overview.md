# Visión general

El panel trabaja sobre el **evento seleccionado** (selector en la cabecera; por defecto el evento
principal). Perfiles y pantallas:

## Administración

| Pantalla | Qué permite | Rol |
|---|---|---|
| Resumen | KPIs del evento, inscripciones por día/estado/tipo, recaudado, tarjeta "Semana Sistémica" (congreso + deportes) | Admin |
| Inscripciones | Filtros, detalle con voucher, verificación UNDC y de correo (Google), aprobar/rechazar/en revisión, reenviar credencial, CSV | Admin |
| Asistencia | Registro por actividad (hora de Lima) | Admin |
| Ponencias · Mensajes · Participantes | Consulta y gestión; desvincular Google de un participante | Admin |
| Eventos | General (datos, remitente, credencial de correo), Datos de pago (cuentas y billeteras con su QR: arrastrar y soltar), Categorías y tipos, Actividades, Integraciones (deportes-fi), **Acceso** (tokens de la landing, SuperAdmin) | Admin / SuperAdmin |
| Tipos de inscripción | Planes del evento | Admin |
| Consultas DNI | Pool de tokens (Decolecta/apiperu), uso, bitácora, consulta manual | Admin |
| Correo | Credenciales de Brevo, prueba de cuenta, correo de prueba | SuperAdmin |
| Sistema | API_UNDC (probar conexión), client ID de Google, URL del panel, landing anterior | SuperAdmin |
| Administradores | Alta con acceso «Solo Google» o «Contraseña o Google», roles, activar/desactivar, desvincular Google | SuperAdmin |

## Portal del inscrito

`/mis-inscripciones`: el inscrito entra con la cuenta de Google de su correo de inscripción
(Gmail o institucional) y ve, por evento, tipo, monto y descuento, pago, estado, motivo de
rechazo y fecha de revisión; descarga su credencial cuando está aprobada. No ve el menú ni
ninguna pantalla de administración.

## Inicio de sesión

- Administradores: correo y contraseña, o **Continuar con Google** si el correo de la cuenta
  Google es el de un administrador activo (cualquier dominio). Las cuentas «Solo Google» no
  tienen contraseña: únicamente entran con Google.
- Inscritos: solo Google.
