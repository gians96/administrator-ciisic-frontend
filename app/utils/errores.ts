/** Error normalizado a partir de respuestas del backend o del BFF. */
export interface ErrorApi {
  status: number
  code: string
  message: string
  fields?: Record<string, string>
}

interface ErrorFetch {
  status?: number
  statusCode?: number
  data?: unknown
  message?: string
}

/**
 * Mensajes del panel por código de error del backend. Tienen prioridad sobre el texto del
 * servidor porque explican qué hacer a continuación.
 */
export const MENSAJES_POR_CODIGO: Readonly<Record<string, string>> = {
  EMAIL_CREDENTIAL_NOT_FOUND: 'La credencial de correo no existe o ya fue eliminada. Actualiza la página.',
  EMAIL_CREDENTIAL_IN_USE: 'La credencial está asignada a uno o más eventos. Asígnales otra credencial (o «Usar la predeterminada») y vuelve a intentarlo.',
  ACCESS_TOKEN_NOT_FOUND: 'El token de acceso no existe o ya fue eliminado. Actualiza la lista.',

  // Inicio de sesión con Google
  GOOGLE_NOT_CONFIGURED: 'El inicio de sesión con Google aún no está configurado. Los administradores pueden entrar con su correo y contraseña.',
  GOOGLE_UNAVAILABLE: 'No se pudo validar tu cuenta con Google en este momento. Intenta nuevamente en unos minutos.',
  GOOGLE_SESSION_EXPIRED: 'El inicio de sesión con Google caducó. Vuelve a pulsar «Continuar con Google».',
  INVALID_GOOGLE_TOKEN: 'Google no confirmó tu inicio de sesión (la respuesta caducó o no es válida). Vuelve a intentarlo.',
  GOOGLE_EMAIL_NOT_VERIFIED: 'Tu correo de Google aún no está verificado. Verifícalo en tu cuenta de Google y vuelve a intentarlo.',
  GOOGLE_NOT_AUTHORITATIVE: 'Google no puede confirmar ese correo porque no es de Gmail ni de una cuenta institucional de Google (por ejemplo, Outlook o Yahoo). Entra con una cuenta de Gmail o institucional.',
  GOOGLE_ACCOUNT_MISMATCH: 'Tu correo ya está vinculado a otra cuenta de Google. Entra con esa cuenta o pide a los organizadores que desvinculen Google de tu registro.',
  GOOGLE_ACCOUNT_IN_USE: 'Esta cuenta de Google ya está vinculada a otra persona. Entra con otra cuenta o pide a los organizadores que la desvinculen.',
  GOOGLE_ACCOUNT_NOT_REGISTERED: 'Tu cuenta de Google no está registrada como administrador ni como inscrito. Si te inscribiste a un evento, entra con la cuenta de Google del correo que usaste al inscribirte.',
  RATE_LIMITED: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',

  // Sesión y perfiles (staff / inscrito)
  SESSION_INVALIDATED: 'Tu sesión se cerró porque cambiaron los datos de tu cuenta (por ejemplo, el correo, la contraseña o el vínculo con Google) o fue desactivada. Vuelve a ingresar; si entras con Google, usa la cuenta de tu correo actual.',
  SESSION_EXPIRED: 'Tu sesión expiró o llegó a su duración máxima (12 horas). Ingresa nuevamente.',
  SESSION_UNAVAILABLE: 'No se pudo verificar tu sesión en este momento. Intenta nuevamente en unos segundos.',
  LOGIN_UNAVAILABLE: 'No se pudo iniciar sesión porque el servidor no responde. Intenta nuevamente en unos minutos.',
  FORBIDDEN_PROFILE: 'Tu tipo de cuenta no tiene acceso a esta sección.',

  // Permisos y eventos asignados (spec 013)
  FORBIDDEN: 'Tu cuenta no tiene permiso para esta acción. Si lo necesitas, pídelo a un Owner o a un Administrador del sistema.',
  EVENT_NOT_ASSIGNED: 'No tienes asignado este evento. Elige uno de tus eventos en la barra superior.',
  STATUS_NOT_ALLOWED: 'No tienes permiso para cancelar inscripciones.',

  // Equipo y administradores
  ROLE_NOT_ASSIGNABLE: 'No puedes asignar ese rol. Un Administrador del sistema solo crea y gestiona cuentas de Tesorero y Comisión.',
  ADMIN_NOT_MANAGEABLE: 'No puedes ver ni modificar esta cuenta: solo un Owner gestiona a los Owners y Administradores del sistema.',
  LAST_OWNER: 'Es el último Owner activo: no se puede cambiar su rol, desactivar ni eliminar. Primero asigna el rol de Owner a otra cuenta.',
  ADMIN_CHANGED: 'La cuenta cambió mientras la editabas (por ejemplo, otra persona cambió su rol). Actualiza la lista y vuelve a intentarlo.',
  SELF_UPDATE_FORBIDDEN: 'No puedes cambiar tu propio rol, estado, eventos ni permisos (tampoco tu correo ni tu vínculo con Google si no eres Owner). Pide el cambio a otra persona con acceso al equipo.',
  EVENTS_REQUIRED: 'Asigna al menos un evento a esta cuenta.',
  EVENT_NOT_FOUND: 'Alguno de los eventos elegidos ya no existe. Actualiza la lista y vuelve a elegirlos.',
  PERMISSIONS_REQUIRED: 'Elige al menos un permiso para la cuenta de la Comisión.',
  PERMISSION_NOT_ELIGIBLE: 'Alguno de los permisos elegidos no se puede asignar a la Comisión (por ejemplo, ver pagos o validar inscripciones).',

  // Asistencia
  OUT_OF_HOURS_NOT_ALLOWED: 'No tienes permiso para marcar asistencia fuera del horario de la actividad. Desmarca «Fuera de horario» o pide ese permiso.',
  PARTICIPANT_NOT_FOUND: 'No se encontró a la persona: no está inscrita en este evento o su registro ya no existe.',
  AMBIGUOUS_DOCUMENT: 'Hay más de un inscrito con ese número de documento. Indica el tipo de documento (DNI o CE) y vuelve a intentarlo.',
  ATTENDANCE_NOT_FOUND: 'La asistencia no existe o ya fue anulada. Actualiza la lista.',

  // Asistencia por el QR del fotocheck (spec 014)
  CODE_NOT_FOUND: 'El QR no corresponde a ninguna credencial. Vuelve a escanear o registra con el documento.',
  CODE_OTHER_EVENT: 'La credencial es de otro evento. Revisa el evento elegido en la barra superior.',
  MANUAL_NOT_ALLOWED: 'No tienes permiso para registrar asistencia manual.',

  // Acceso al portal con un código por correo y paso del staff a su portal (spec 014)
  CODE_LOGIN_UNAVAILABLE: 'El acceso con código no está disponible en este momento. Entra con Google o inténtalo más tarde.',
  CODE_LOGIN_PAUSED: 'El acceso con código está pausado por seguridad. Entra con Google o inténtalo más tarde.',
  CODE_EXPIRED: 'El código venció o ya no es válido. Pide uno nuevo.',
  CODE_LOCKED: 'Demasiados intentos con este correo. Espera un momento o entra con Google.',
  CODE_REQUIRED: 'Para entrar a tu portal de participante confirma con un código que te enviaremos al correo de tu cuenta.',
  PORTAL_SWITCH_UNAVAILABLE: 'El paso a tu portal de participante aún no está disponible. Intenta más tarde.',

  // Portal: foto y fotocheck (spec 014)
  CONSENT_REQUIRED: 'Debes aceptar el uso de tu foto en el fotocheck.',
  IMAGE_TOO_LARGE: 'La foto es demasiado grande: como máximo 4096 × 4096 píxeles. Redúcela e intenta otra vez.',
  PHOTO_CONFLICT: 'Tu foto se está actualizando desde otra ventana. Intenta nuevamente.',
  PDF_BUSY: 'Hay muchas credenciales generándose en este momento. Intenta nuevamente en unos segundos.',

  // Alta de participantes (spec 014)
  NAMES_REQUIRED: 'No se pudieron obtener los nombres del documento. Ingresa los nombres y apellidos.',
  PARTICIPANT_EXISTS: 'Ya existe un participante con ese documento.',

  // Configuración del sistema
  UNDC_API_NOT_CONFIGURED: 'Falta la URL o la API key de API_UNDC. Guárdalas y vuelve a probar la conexión.',
  INVALID_URL: 'La URL no es válida: usa https (http solo para localhost) y no incluyas usuario ni contraseña.',
  HOST_NOT_ALLOWED: 'La URL apunta a una dirección interna o su dominio no se pudo resolver. Usa una dirección pública.',
}

/**
 * Mensajes de respaldo cuando el servidor no envía uno (el detalle va en `fields`). Aquí van los
 * códigos cuyo mensaje del servidor trae datos (la hora, la fecha, los intentos que quedan) o cambia
 * según la pantalla (foto del portal o QR de pagos): el del servidor tiene prioridad.
 */
const RESPALDO_POR_CODIGO: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: 'Revisa los datos marcados en el formulario.',

  // Código por correo (spec 014): el servidor dice cuánto esperar o cuántos intentos quedan
  CODE_COOLDOWN: 'Espera un momento antes de pedir otro código.',
  INVALID_CODE: 'El código no es correcto.',

  // Asistencia y credenciales (spec 013 y 014): el servidor trae el horario, la hora o la fecha
  NOT_APPROVED: 'La inscripción aún no está aprobada.',
  OUTSIDE_WINDOW: 'La actividad no está en su horario de registro de asistencia.',
  ATTENDANCE_ALREADY_REGISTERED: 'La asistencia de esta persona ya estaba registrada en esta actividad.',
  LEGACY_QR_NOT_ALLOWED: 'Este QR anterior ya no es válido. Pide el fotocheck del portal o registra con el documento.',

  // Archivos (foto del portal, QR de pagos)
  FILE_REQUIRED: 'Adjunta el archivo.',
  INVALID_FILE_TYPE: 'El tipo de archivo no está permitido.',
  INVALID_FILE_CONTENT: 'El archivo no es una imagen válida o está dañado.',
  UPLOAD_LIMIT_EXCEEDED: 'El archivo supera el tamaño permitido.',
  UPLOAD_INVALID: 'El archivo enviado no es válido.',
  PHOTO_NOT_FOUND: 'No hay una foto registrada.',
  INSCRIPTION_NOT_FOUND: 'La inscripción no existe.',

  // Participantes e inscripciones de cortesía (spec 014)
  EMAIL_IN_USE: 'El correo ya está registrado por otra persona.',
  ALREADY_REGISTERED: 'La persona ya tiene una inscripción en este evento.',
  REGISTRATION_TYPE_INVALID: 'El tipo de inscripción no existe o no pertenece a este evento.',
  DUPLICATE_RECORD: 'Ya existe un registro con estos datos.',
}

function cuerpo(data: unknown): Partial<ErrorApi> {
  if (!data || typeof data !== 'object') return {}
  const valor = data as Record<string, unknown>
  // createError de Nitro anida el cuerpo en `data`
  const origen = (valor.data && typeof valor.data === 'object' ? valor.data : valor) as Record<string, unknown>
  return {
    code: typeof origen.code === 'string' ? origen.code : undefined,
    message: typeof origen.message === 'string' ? origen.message : undefined,
    fields: origen.fields && typeof origen.fields === 'object' ? origen.fields as Record<string, string> : undefined,
  }
}

export function aErrorApi(error: unknown): ErrorApi {
  const e = (error ?? {}) as ErrorFetch
  const status = e.status ?? e.statusCode ?? 0
  const datos = cuerpo(e.data)
  const porDefecto = status === 0
    ? 'No se pudo conectar con el servidor.'
    : status >= 500 ? 'Ocurrió un error en el servidor. Intenta nuevamente.' : 'No se pudo completar la operación.'
  const code = datos.code ?? (status === 401 ? 'SESSION_EXPIRED' : 'ERROR')
  return {
    status,
    code,
    message: MENSAJES_POR_CODIGO[code] ?? datos.message ?? RESPALDO_POR_CODIGO[code] ?? porDefecto,
    fields: datos.fields,
  }
}

/**
 * Mensaje con el detalle de campos de validación, si los hay. `etiquetas` traduce las claves de
 * `fields` (p. ej. `remitenteCorreo`) a los nombres que ve el usuario.
 */
export function mensajeError(error: unknown, etiquetas: Readonly<Record<string, string>> = {}): string {
  const e = aErrorApi(error)
  const campos = Object.entries(e.fields ?? {})
  if (!campos.length) return e.message
  const detalle = campos.map(([campo, texto]) => `${etiquetas[campo] ?? campo}: ${texto}`).join(' · ')
  return `${e.message} (${detalle})`
}
