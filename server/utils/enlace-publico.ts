import { errorValidacion } from './acceso-codigo'
import type { ErrorPropagado, RespaldoError } from './respuestas-auth'

/**
 * Vista pública del docente (spec 017; backend 026), del ciclo (spec 018; backend 027) y del docente con su DNI
 * (spec 019; backend 028): validaciones y errores de las rutas `/api/publico/seguimiento*`, que no llevan sesión.
 * El token llega en el cuerpo (el navegador lo lee del `#` de la URL) y se reenvía al backend en el encabezado
 * `X-Link-Token`: nunca va en una URL. El DNI llega y se reenvía en el **cuerpo** de un `POST`, por lo mismo.
 */

/** Token del enlace: 43 caracteres base64url (256 bits), como los emite el backend. */
const TOKEN_ENLACE = /^[A-Za-z0-9_-]{43}$/

export function tokenDeCuerpo(valor: unknown): string | null {
  const token = typeof valor === 'string' ? valor.trim() : ''
  return TOKEN_ENLACE.test(token) ? token : null
}

/** DNI del docente: 8 dígitos (o 7, al que el backend completa el cero); cualquier otra cosa no es un DNI. */
export function documentoDeCuerpo(valor: unknown): string | null {
  const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor).replace(/\s+/g, '') : ''
  return /^\d{7,8}$/.test(texto) ? texto : null
}

/** Qué abre la persona: el enlace de un docente, el de un ciclo o la entrada con el DNI. */
export type TipoEnlace = 'asesor' | 'ciclo' | 'documento'

/** Vista que se pide: la del docente (por defecto), la de un ciclo o la del docente con su DNI; cualquier otro valor no es válido. */
export function tipoDeCuerpo(valor: unknown): TipoEnlace | null {
  if (valor === undefined) return 'asesor'
  return valor === 'asesor' || valor === 'ciclo' || valor === 'documento' ? valor : null
}

/** Ruta del backend que atiende cada enlace con token (sin el prefijo `/api/v1`). */
export const RUTA_BACKEND: Readonly<Record<Exclude<TipoEnlace, 'documento'>, string>> = { asesor: 'public/advisor', ciclo: 'public/cycle' }

/** Ruta del backend de la entrada con el DNI (`POST`, con el DNI en el cuerpo). */
export const RUTA_CONSULTA_DNI = 'public/advisor/lookup'

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

/** Mismo error para un DNI ausente, mal escrito o que no es de ningún docente. */
export const DOCENTE_NO_ENCONTRADO: ErrorPropagado = {
  statusCode: 404,
  data: { success: false, code: 'ADVISOR_DOCUMENT_NOT_FOUND', message: 'No encontramos un docente con ese DNI.' },
  reintentarEnSegundos: null,
}

/** Cuando el backend no responde. */
export const RESPALDO_ENLACE: RespaldoError = {
  code: 'LINK_UNAVAILABLE',
  message: 'No se pudo consultar el seguimiento en este momento. Intenta nuevamente en unos minutos.',
}

/** Lo que identifica a quien consulta: el token de su enlace o el DNI del docente. */
export type Credencial =
  | { tipo: 'asesor' | 'ciclo', token: string }
  | { tipo: 'documento', documento: string }

/** Lee y valida la credencial del cuerpo; un `tipo` o una credencial inválidos devuelven el error que corresponde (sin pistas de más). */
export function credencialDeCuerpo(cuerpo: { token?: unknown, tipo?: unknown, documento?: unknown } | null | undefined): { credencial: Credencial } | { error: ErrorPropagado } {
  const tipo = tipoDeCuerpo(cuerpo?.tipo)
  if (!tipo) return { error: errorValidacion({ tipo: 'Debe ser asesor, ciclo o documento.' }) }
  if (tipo === 'documento') {
    const documento = documentoDeCuerpo(cuerpo?.documento)
    return documento ? { credencial: { tipo, documento } } : { error: DOCENTE_NO_ENCONTRADO }
  }
  const token = tokenDeCuerpo(cuerpo?.token)
  return token ? { credencial: { tipo, token } } : { error: ENLACE_NO_VALIDO }
}

export interface PeticionAlBackend {
  /** Ruta sin el prefijo `/api/v1`. */
  ruta: string
  opciones: { method: 'GET' | 'POST', headers: Record<string, string>, body?: Record<string, string> }
}

/** Cómo se pide al backend: ruta, método, encabezados y cuerpo según la credencial (y el formato, si es una descarga). */
export function peticionAlBackend(credencial: Credencial, ip: string | null, descarga?: FormatoDescarga): PeticionAlBackend {
  const headers: Record<string, string> = { 'x-forwarded-for': ip ?? '' }
  if (credencial.tipo === 'documento') {
    return {
      ruta: descarga ? `${RUTA_CONSULTA_DNI}/export` : RUTA_CONSULTA_DNI,
      opciones: { method: 'POST', headers, body: descarga ? { documento: credencial.documento, formato: descarga } : { documento: credencial.documento } },
    }
  }
  headers['x-link-token'] = credencial.token
  return {
    ruta: descarga ? `${RUTA_BACKEND[credencial.tipo]}/export?formato=${descarga}` : RUTA_BACKEND[credencial.tipo],
    opciones: { method: 'GET', headers },
  }
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
