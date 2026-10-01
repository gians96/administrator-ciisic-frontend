/**
 * Respuestas del BFF de autenticación según lo que responde el backend (`/api/auth/session` y
 * `/api/auth/login`). Funciones puras: los manejadores solo las conectan con la cookie y `$fetch`.
 */

/** Estado HTTP de un error de `$fetch` (`statusCode` o `status`); sin respuesta (red caída), `undefined`. */
export function estadoHttp(error: unknown): number | undefined {
  const fallo = (error ?? {}) as { statusCode?: unknown, status?: unknown }
  const estado = fallo.statusCode ?? fallo.status
  return typeof estado === 'number' && estado > 0 ? estado : undefined
}

/** Respuesta de `GET /v1/auth/session` del backend. */
export interface RespuestaSesionBackend {
  success?: boolean
  tipo?: 'ADMIN' | 'PARTICIPANTE'
  /** Staff: con su `acceso` (alcance, permisos, eventos). */
  user?: Record<string, unknown> | null
  participante?: Record<string, unknown> | null
}

/** Sin sesión (sin cookie o con una que el backend ya no acepta). */
export const SIN_SESION = { authenticated: false, tipo: null, user: null, participante: null } as const

export type CuerpoSesion =
  | typeof SIN_SESION
  | { authenticated: true, tipo: 'ADMIN', user: Record<string, unknown> | null, participante: null }
  | { authenticated: true, tipo: 'PARTICIPANTE', user: null, participante: Record<string, unknown> | null }

/** Cuerpo de `/api/auth/session` a partir de la respuesta del backend (sin `tipo`: se deduce de los datos). */
export function cuerpoSesion(respuesta: RespuestaSesionBackend): CuerpoSesion {
  const esParticipante = respuesta.tipo === 'PARTICIPANTE' || (!respuesta.tipo && Boolean(respuesta.participante) && !respuesta.user)
  return esParticipante
    ? { authenticated: true, tipo: 'PARTICIPANTE', user: null, participante: respuesta.participante ?? null }
    : { authenticated: true, tipo: 'ADMIN', user: respuesta.user ?? null, participante: null }
}

/**
 * Lectura de la sesión en el backend:
 * - `VIGENTE`: con el cuerpo para el panel;
 * - `CERRADA`: el backend respondió 401 (token caducado o sesión invalidada): se borra la cookie;
 * - `NO_DISPONIBLE`: 5xx, 429 o red: se conserva la cookie y el BFF responde 503.
 */
export type ConsultaSesion =
  | { estado: 'VIGENTE', cuerpo: CuerpoSesion }
  | { estado: 'CERRADA' }
  | { estado: 'NO_DISPONIBLE' }

export async function consultarSesion(pedir: () => Promise<RespuestaSesionBackend>): Promise<ConsultaSesion> {
  try {
    return { estado: 'VIGENTE', cuerpo: cuerpoSesion(await pedir()) }
  } catch (error) {
    return estadoHttp(error) === 401 ? { estado: 'CERRADA' } : { estado: 'NO_DISPONIBLE' }
  }
}

/** 503 de `/api/auth/session` cuando el backend no responde (la cookie se conserva). */
export const SESION_NO_DISPONIBLE = {
  statusCode: 503,
  data: { success: false, code: 'SESSION_UNAVAILABLE', message: 'No se pudo verificar tu sesión en este momento. Intenta nuevamente en unos segundos.' },
} as const

/**
 * Error de `/api/auth/login` según el estado del backend: 429 se conserva; 5xx o sin respuesta es
 * 503 `LOGIN_UNAVAILABLE` (no es culpa de la contraseña); cualquier otro rechazo, 401
 * `INVALID_CREDENTIALS` (sin detallar si el correo existe o la cuenta está inactiva).
 */
export function errorLogin(estado: number | undefined): { statusCode: number, data: { success: false, code: string, message: string } } {
  if (estado === 429) {
    return { statusCode: 429, data: { success: false, code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera unos minutos.' } }
  }
  if (estado === undefined || estado >= 500) {
    return { statusCode: 503, data: { success: false, code: 'LOGIN_UNAVAILABLE', message: 'No se pudo iniciar sesión porque el servidor no responde. Intenta nuevamente en unos minutos.' } }
  }
  return { statusCode: 401, data: { success: false, code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' } }
}

// ─── Errores del backend que el BFF propaga (código por correo y paso al portal, spec 014) ───

/** Error que el BFF devuelve al navegador con el estado, el código y los `fields` del backend. */
export interface ErrorPropagado {
  statusCode: number
  data: { success: false, code: string, message: string, fields?: Record<string, string> }
  /** Segundos para el encabezado `Retry-After` (429 y 503 temporales); `null` si no hay espera. */
  reintentarEnSegundos: number | null
}

/** Código y mensaje cuando el backend no responde o aún no tiene la ruta (imagen anterior a la 014). */
export interface RespaldoError {
  code: string
  message: string
}

/**
 * Segundos de espera de un `Retry-After` (segundos o fecha HTTP) o de `fields.reintentarEnSegundos`
 * (el backend lo envía como texto). Entero positivo, o `null` si no hay un valor válido.
 */
export function segundosDeEspera(valor: unknown, ahora: number = Date.now()): number | null {
  let segundos = Number.NaN
  if (typeof valor === 'number') {
    segundos = valor
  } else if (typeof valor === 'string' && valor.trim()) {
    const texto = valor.trim()
    segundos = /^\d+(?:\.\d+)?$/.test(texto) ? Number(texto) : (Date.parse(texto) - ahora) / 1000
  }
  return Number.isFinite(segundos) && segundos > 0 ? Math.ceil(segundos) : null
}

function objetoDe(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null
}

/** `fields` del backend con valores de texto (los demás se descartan). */
function camposDe(valor: unknown): Record<string, string> | undefined {
  const campos = objetoDe(valor)
  if (!campos) return undefined
  const texto = Object.entries(campos).filter((par): par is [string, string] => typeof par[1] === 'string')
  return texto.length ? Object.fromEntries(texto) : undefined
}

/** `Retry-After` de la respuesta de un error de `$fetch` (ofetch guarda la `Response` en `response`). */
function retryAfterDe(error: unknown): string | null {
  const headers = (objetoDe(error)?.response as { headers?: { get?: (nombre: string) => string | null } } | undefined)?.headers
  return typeof headers?.get === 'function' ? headers.get('retry-after') : null
}

/**
 * Error de una ruta de autenticación del backend listo para el navegador:
 * - sin respuesta (red), 5xx sin código de negocio o la ruta inexistente (404/405 `NOT_FOUND` o sin
 *   código: backend anterior a la spec 014) → 503 con el `respaldo`;
 * - cualquier otro → el mismo estado, código, mensaje y `fields`.
 * La espera (`Retry-After` o `fields.reintentarEnSegundos`) se conserva y va también en `fields`.
 */
export function errorPropagado(error: unknown, respaldo: RespaldoError, ahora: number = Date.now()): ErrorPropagado {
  const estado = estadoHttp(error)
  const cuerpo = objetoDe(objetoDe(error)?.data)
  const codigo = typeof cuerpo?.code === 'string' && cuerpo.code ? cuerpo.code : null
  const mensaje = typeof cuerpo?.message === 'string' && cuerpo.message ? cuerpo.message : null
  const campos = camposDe(cuerpo?.fields)
  const reintentarEnSegundos = segundosDeEspera(campos?.reintentarEnSegundos, ahora) ?? segundosDeEspera(retryAfterDe(error), ahora)
  const conEspera = (fields?: Record<string, string>) => (reintentarEnSegundos === null
    ? fields
    : { ...fields, reintentarEnSegundos: String(reintentarEnSegundos) })

  const sinRuta = (estado === 404 || estado === 405) && (!codigo || codigo === 'NOT_FOUND')
  const caido = estado === undefined || (estado >= 500 && !(estado === 503 && codigo))
  if (sinRuta || caido) {
    const fields = conEspera()
    return { statusCode: 503, data: { success: false, ...respaldo, ...(fields ? { fields } : {}) }, reintentarEnSegundos }
  }
  const fields = conEspera(campos)
  // Un limitador que respondió sin cuerpo JSON: 429 genérico
  const limitado = estado === 429 && !codigo
  return {
    statusCode: estado as number,
    data: {
      success: false,
      code: codigo ?? (limitado ? 'RATE_LIMITED' : 'ERROR'),
      message: mensaje ?? (limitado ? 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' : respaldo.message),
      ...(fields ? { fields } : {}),
    },
    reintentarEnSegundos,
  }
}
