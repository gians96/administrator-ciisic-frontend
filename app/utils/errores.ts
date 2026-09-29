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
  return {
    status,
    code: datos.code ?? (status === 401 ? 'SESSION_EXPIRED' : 'ERROR'),
    message: datos.message ?? porDefecto,
    fields: datos.fields,
  }
}

/** Mensaje con el detalle de campos de validación, si los hay. */
export function mensajeError(error: unknown): string {
  const e = aErrorApi(error)
  if (!e.fields) return e.message
  const detalle = Object.entries(e.fields).map(([campo, texto]) => `${campo}: ${texto}`).join(' · ')
  return `${e.message} (${detalle})`
}
