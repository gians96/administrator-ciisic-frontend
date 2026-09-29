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

  // Sesión y perfiles (administrador / inscrito)
  SESSION_INVALIDATED: 'Tu sesión se cerró porque cambiaron los datos de tu registro (por ejemplo, el correo). Vuelve a entrar con la cuenta de Google de tu correo actual.',
  FORBIDDEN_PROFILE: 'Tu tipo de cuenta no tiene acceso a esta sección.',

  // Configuración del sistema
  UNDC_API_NOT_CONFIGURED: 'Falta la URL o la API key de API_UNDC. Guárdalas y vuelve a probar la conexión.',
  INVALID_URL: 'La URL no es válida: usa https (http solo para localhost) y no incluyas usuario ni contraseña.',
  HOST_NOT_ALLOWED: 'La URL apunta a una dirección interna o su dominio no se pudo resolver. Usa una dirección pública.',
}

/** Mensajes de respaldo cuando el servidor no envía uno (el detalle va en `fields`). */
const RESPALDO_POR_CODIGO: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: 'Revisa los datos marcados en el formulario.',
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
