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
