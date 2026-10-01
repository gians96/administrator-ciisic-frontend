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
