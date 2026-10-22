import type { ErrorPropagado, RespaldoError } from './respuestas-auth'

/**
 * Enlaces públicos por docente (spec 017; backend 026) y por ciclo (spec 018; backend 027): validaciones y errores de las
 * rutas `/api/publico/seguimiento*`, que no llevan sesión. El token llega en el cuerpo (el navegador lo lee del `#`
 * de la URL) y se reenvía al backend en el encabezado `X-Link-Token`: nunca va en una URL.
 */

/** Token del enlace: 43 caracteres base64url (256 bits), como los emite el backend. */
const TOKEN_ENLACE = /^[A-Za-z0-9_-]{43}$/

export function tokenDeCuerpo(valor: unknown): string | null {
  const token = typeof valor === 'string' ? valor.trim() : ''
  return TOKEN_ENLACE.test(token) ? token : null
}

export type TipoEnlace = 'asesor' | 'ciclo'

/** Vista que se pide: la del docente (por defecto) o la de un ciclo; cualquier otro valor no es válido. */
export function tipoDeCuerpo(valor: unknown): TipoEnlace | null {
  if (valor === undefined) return 'asesor'
  return valor === 'asesor' || valor === 'ciclo' ? valor : null
}

/** Ruta del backend que atiende cada vista (sin el prefijo `/api/v1`). */
export const RUTA_BACKEND: Readonly<Record<TipoEnlace, string>> = { asesor: 'public/advisor', ciclo: 'public/cycle' }

export type FormatoDescarga = 'xlsx' | 'pdf'

export function formatoDeDescarga(valor: unknown): FormatoDescarga | null {
  if (valor === undefined) return 'xlsx'
  const formato = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
  return formato === 'xlsx' || formato === 'pdf' ? formato : null
}

/** Mismo error para un token ausente, mal formado o que el backend no reconoce: no se distingue cuál fue. */
export const ENLACE_NO_VALIDO: ErrorPropagado = {
  statusCode: 404,
  data: { success: false, code: 'LINK_NOT_FOUND', message: 'El enlace no es válido o fue desactivado.' },
  reintentarEnSegundos: null,
}

/** Cuando el backend no responde. */
export const RESPALDO_ENLACE: RespaldoError = {
  code: 'LINK_UNAVAILABLE',
  message: 'No se pudo consultar el seguimiento en este momento. Intenta nuevamente en unos minutos.',
}

/** Cuerpo JSON de una respuesta de error recibida como bytes (la descarga pide `arrayBuffer`); `null` si no lo es. */
export function jsonDeBytes(datos: unknown): unknown {
  if (!(datos instanceof ArrayBuffer) && !ArrayBuffer.isView(datos)) return null
  try {
    return JSON.parse(Buffer.from(datos instanceof ArrayBuffer ? datos : datos.buffer).toString('utf8'))
  } catch {
    return null
  }
}
