import type { H3Event } from 'h3'
import type { ErrorPropagado, RespaldoError } from './respuestas-auth'

/**
 * Acceso al portal con un código por correo y paso del staff a su portal (backend-ciisic spec 014,
 * `contracts/api-acceso-codigo.md`). Funciones puras para los manejadores de `server/api/auth/codigo/*`
 * y `server/api/auth/portal.post.ts`, más `lanzarError` (encabezado `Retry-After` y error de h3).
 */

/** Mismo tope que el backend. */
export const LONGITUD_MAXIMA_CORREO = 191
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FORMATO_CODIGO = /^\d{6}$/

/** Vida del código y espera para pedir otro si el backend no las informa (10 min y 60 s). */
export const VIDA_CODIGO_POR_DEFECTO = 600
export const ESPERA_CODIGO_POR_DEFECTO = 60

/** Respaldo de `/api/auth/codigo*` sin backend o con uno anterior a la 014 (la ruta no existe). */
export const RESPALDO_CODIGO: Readonly<RespaldoError> = Object.freeze({
  code: 'CODE_LOGIN_UNAVAILABLE',
  message: 'El acceso con código no está disponible en este momento. Entra con Google.',
})

/** Respaldo de `/api/auth/portal` sin backend o con uno anterior a la 014. */
export const RESPALDO_PORTAL: Readonly<RespaldoError> = Object.freeze({
  code: 'PORTAL_SWITCH_UNAVAILABLE',
  message: 'El paso a tu portal de participante aún no está disponible. Intenta más tarde.',
})

/** Correo de la petición del navegador: recortado y en minúsculas; si no es un correo, `null`. */
export function correoDeSolicitud(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const correo = valor.trim().toLowerCase()
  return correo.length <= LONGITUD_MAXIMA_CORREO && FORMATO_CORREO.test(correo) ? correo : null
}

/** Código de 6 dígitos sin espacios ni guiones (como lo limpia el backend); si no, `null`. */
export function codigoDeSolicitud(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 32) return null
  const codigo = valor.replace(/[\s-]/g, '')
  return FORMATO_CODIGO.test(codigo) ? codigo : null
}

/** Respuesta de `POST /v1/auth/participant/code` (siempre la misma, exista o no el correo). */
export interface CodigoSolicitado {
  expiraEnSegundos: number
  reintentarEnSegundos: number
}

function enteroPositivo(valor: unknown, respaldo: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.ceil(valor) : respaldo
}

function objetoDe(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null
}

/** Vida del código y espera para pedir otro, de la respuesta `202` del backend (`{ data }`). */
export function codigoSolicitadoDe(respuesta: unknown): CodigoSolicitado {
  const datos = objetoDe(objetoDe(respuesta)?.data)
  return {
    expiraEnSegundos: enteroPositivo(datos?.expiraEnSegundos, VIDA_CODIGO_POR_DEFECTO),
    reintentarEnSegundos: enteroPositivo(datos?.reintentarEnSegundos, ESPERA_CODIGO_POR_DEFECTO),
  }
}

/** Sesión de participante emitida por `verify` o `switch` (12 h, no se renueva). */
export interface SesionParticipante {
  jwt: string
  participante: Record<string, unknown>
  /** Instante ISO de expiración: la vida de la cookie sale de aquí (`vidaSesionSegundos`). */
  expiraEn: unknown
}

/** Sesión de la respuesta del backend (`{ data: { jwt, tipo: 'PARTICIPANTE', participante, expiraEn } }`), o `null`. */
export function sesionParticipanteDe(respuesta: unknown): SesionParticipante | null {
  const datos = objetoDe(objetoDe(respuesta)?.data)
  const participante = objetoDe(datos?.participante)
  if (!datos || typeof datos.jwt !== 'string' || !datos.jwt || !participante) return null
  if (datos.tipo !== undefined && datos.tipo !== 'PARTICIPANTE') return null
  return { jwt: datos.jwt, participante, expiraEn: datos.expiraEn }
}

/**
 * `accesoCodigo.disponible` de `GET /v1/auth/config`. Solo `true` lo muestra: el backend anterior a la
 * 014 no envía la clave y el login lo oculta.
 */
export function accesoCodigoDisponible(config: unknown): boolean {
  const accesoCodigo = objetoDe(objetoDe(objetoDe(config)?.data)?.accesoCodigo)
  return accesoCodigo?.disponible === true
}

/** 422 del BFF cuando la petición del navegador no trae un correo o un código con forma válida. */
export function errorValidacion(campos: Record<string, string>): ErrorPropagado {
  return {
    statusCode: 422,
    data: { success: false, code: 'VALIDATION_ERROR', message: Object.values(campos)[0] ?? 'Revisa los datos.', fields: campos },
    reintentarEnSegundos: null,
  }
}

/** Lanza el error al navegador con `Retry-After` si hay una espera. */
export function lanzarError(event: H3Event, error: ErrorPropagado): never {
  if (error.reintentarEnSegundos) setResponseHeader(event, 'Retry-After', error.reintentarEnSegundos)
  throw createError({ statusCode: error.statusCode, data: error.data })
}
