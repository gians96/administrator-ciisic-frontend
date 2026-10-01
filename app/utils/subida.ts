/**
 * Subidas multipart con progreso (`useSubida`, XHR): la respuesta del BFF se convierte en lo mismo que
 * devolvería `$fetch` —el cuerpo JSON, o un error con `status`, `data` y `response.headers`—, así
 * `aErrorApi`, `segundosParaReintentar` y `decisionTrasErrorTanda` funcionan igual con las dos.
 */

interface CabecerasError {
  get: (nombre: string) => string | null
}

/** Error de una subida con la forma de un error de `$fetch` (`FetchError`). */
export interface ErrorSubida extends Error {
  status: number
  statusCode: number
  data: unknown
  response: { status: number, headers: CabecerasError, _data: unknown }
}

/** Cuerpo JSON de la respuesta; `null` si está vacío o no es JSON (p. ej. una página de error del proxy). */
export function cuerpoDeRespuesta(texto: string | null | undefined): unknown {
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

/** La respuesta es un éxito (2xx). */
export function esRespuestaExitosa(status: number): boolean {
  return status >= 200 && status < 300
}

/** Error de una respuesta HTTP que no es 2xx (`cabecera` lee las cabeceras de la respuesta). */
export function errorDeSubida(status: number, cuerpo: unknown, cabecera: (nombre: string) => string | null): ErrorSubida {
  const mensaje = cuerpo && typeof cuerpo === 'object' && typeof (cuerpo as { message?: unknown }).message === 'string'
    ? (cuerpo as { message: string }).message
    : `HTTP ${status}`
  return Object.assign(new Error(mensaje), {
    name: 'ErrorSubida',
    status,
    statusCode: status,
    data: cuerpo,
    response: { status, headers: { get: (nombre: string) => cabecera(nombre) }, _data: cuerpo },
  })
}

/** Sin respuesta (red caída, servidor apagado): `status` 0, como un `$fetch` sin respuesta. */
export function errorDeConexion(): ErrorSubida {
  return errorDeSubida(0, null, () => null)
}

/** Error de una subida cancelada (`AbortError`, como `fetch` con una señal abortada). */
export function errorCancelado(): Error {
  return Object.assign(new Error('Se canceló la subida.'), { name: 'AbortError' })
}

/** El error es una cancelación (`AbortError` propio o el de `$fetch`, que lo envuelve en `cause`). */
export function esCancelacion(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, cause } = error as { name?: unknown, cause?: unknown }
  if (name === 'AbortError') return true
  return Boolean(cause && typeof cause === 'object' && (cause as { name?: unknown }).name === 'AbortError')
}

/** Ruta del BFF del staff para una ruta del backend (`events/2/certificates/signed` → `/api/backend/events/2/certificates/signed`). */
export function rutaBff(ruta: string): string {
  return `/api/backend/${String(ruta).replace(/^\/+/, '')}`
}
