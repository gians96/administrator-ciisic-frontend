import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { esSesionDeStaff, payloadJwt } from './jwt-publico'
import { estadoHttp } from './respuestas-auth'
import { backendUrl, guardarSesion } from './session'
import { VIDA_SESION_POR_DEFECTO, vidaSesionSegundos } from './vida-sesion'

/**
 * Renovación de la sesión del staff (spec 013 del backend). Los JWT duran 1 h; cuando al de la cookie
 * le quedan menos de 20 min, el BFF pide uno nuevo a `POST /v1/auth/refresh` antes de reenviar la
 * petición. El backend corta la sesión a las 12 h del inicio (`401 SESSION_EXPIRED`) o si la cuenta
 * cambió (`401 SESSION_INVALIDATED`): ese JWT ya no se vuelve a intentar renovar (cada intento cuenta
 * en el límite de 30 renovaciones cada 15 min de la cuenta, que comparten varias estaciones) y la
 * petición sigue con él; cuando caduque, el backend responde 401 y el panel vuelve al login.
 */
export const MARGEN_RENOVACION_SEGUNDOS = 20 * 60

/** Cuánto se reutiliza una renovación, o un fallo pasajero (429, backend caído), para el mismo JWT. */
export const VIDA_RENOVACION_COMPARTIDA_MS = 60_000

export interface Renovacion {
  jwt: string
  /** `expiraEn` del backend: la vida de la cookie se calcula al guardarla. */
  expiraEn: unknown
}

/**
 * Resultado de pedir la renovación: el JWT nuevo, `RECHAZADA` (401 o 403: no cambia al reintentar con
 * el mismo JWT) o `NO_DISPONIBLE` (429, 5xx, red o respuesta sin JWT: se puede reintentar en 60 s).
 */
export type ResultadoRenovacion = Renovacion | 'RECHAZADA' | 'NO_DISPONIBLE'

/**
 * Si conviene renovar un JWT con `exp` (segundos) en el instante `ahora` (ms): le quedan menos de
 * 20 min y aún no caducó (uno caducado lo rechazaría también la renovación).
 */
export function debeRenovar(exp: unknown, ahora: number = Date.now()): boolean {
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return false
  const restante = exp - ahora / 1000
  return restante > 0 && restante < MARGEN_RENOVACION_SEGUNDOS
}

/** Resultado de un `POST /v1/auth/refresh` que respondió 2xx: el JWT nuevo o, si no trae uno, un fallo pasajero. */
export function renovacionDe(respuesta: unknown): ResultadoRenovacion {
  const datos = (respuesta as { data?: { jwt?: unknown, expiraEn?: unknown } } | null)?.data
  return typeof datos?.jwt === 'string' && datos.jwt ? { jwt: datos.jwt, expiraEn: datos.expiraEn } : 'NO_DISPONIBLE'
}

/** Resultado de un `POST /v1/auth/refresh` que falló con el estado `estado` (sin respuesta: `undefined`). */
export function fallaRenovacion(estado: number | undefined): ResultadoRenovacion {
  return estado === 401 || estado === 403 ? 'RECHAZADA' : 'NO_DISPONIBLE'
}

/** Instante (ms) en que caduca un JWT con `exp` (segundos); sin `exp` válido, dentro de la vida por defecto (1 h). */
function caducidadMs(exp: unknown, ahora: number): number {
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : ahora + VIDA_SESION_POR_DEFECTO * 1000
}

/**
 * Hasta cuándo (ms) se recuerda el resultado de renovar un JWT con `exp`: un rechazo, hasta que ese JWT
 * caduca (reintentar daría lo mismo); una renovación o un fallo pasajero, 60 s.
 */
export function recordarHasta(resultado: ResultadoRenovacion, exp: unknown, ahora: number): number {
  const corto = ahora + VIDA_RENOVACION_COMPARTIDA_MS
  return resultado === 'RECHAZADA' ? Math.max(caducidadMs(exp, ahora), corto) : corto
}

/** Clave de un JWT en memoria: su hash (el token no se guarda tal cual). */
function claveDe(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

export interface Renovador {
  /**
   * JWT nuevo para `token` (con `exp` en segundos), o `null` si no se renovó o si su sesión se cerró
   * mientras tanto. Las peticiones simultáneas con el mismo JWT comparten un único `pedir`.
   */
  renovar: (token: string, exp: unknown, pedir: () => Promise<ResultadoRenovacion>) => Promise<Renovacion | null>
  /** Se cerró la sesión de `token`: hasta que caduque no se renueva (ni se vuelve a guardar en la cookie). */
  cerrar: (token: string, exp: unknown) => void
  /** Entradas en memoria (pruebas). */
  tamano: () => number
}

/** Renovaciones por JWT anterior, con un reloj inyectable (pruebas). */
export function crearRenovador(reloj: () => number = () => Date.now()): Renovador {
  /** Resultado (o petición en curso: `hasta` infinito) por clave del JWT anterior. */
  const resultados = new Map<string, { promesa: Promise<ResultadoRenovacion>, hasta: number }>()
  /** JWT de sesiones cerradas, hasta su caducidad. */
  const cerradas = new Map<string, number>()

  function purgar(ahora: number) {
    for (const [clave, entrada] of resultados) if (entrada.hasta <= ahora) resultados.delete(clave)
    for (const [clave, hasta] of cerradas) if (hasta <= ahora) cerradas.delete(clave)
  }

  async function renovar(token: string, exp: unknown, pedir: () => Promise<ResultadoRenovacion>): Promise<Renovacion | null> {
    purgar(reloj())
    const clave = claveDe(token)
    if (cerradas.has(clave)) return null
    let entrada = resultados.get(clave)
    if (!entrada) {
      const nueva = { promesa: pedir().catch((): ResultadoRenovacion => 'NO_DISPONIBLE'), hasta: Number.POSITIVE_INFINITY }
      nueva.promesa.then((resultado) => { nueva.hasta = recordarHasta(resultado, exp, reloj()) })
      resultados.set(clave, nueva)
      entrada = nueva
    }
    const resultado = await entrada.promesa
    if (typeof resultado === 'string') return null
    // La sesión se cerró mientras se renovaba, o se cerró con el JWT ya renovado (una petición que aún
    // traía el anterior reutilizaría la renovación compartida): no se revive
    if (cerradas.has(clave) || cerradas.has(claveDe(resultado.jwt))) return null
    return resultado
  }

  function cerrar(token: string, exp: unknown) {
    const ahora = reloj()
    purgar(ahora)
    const clave = claveDe(token)
    resultados.delete(clave)
    cerradas.set(clave, caducidadMs(exp, ahora))
  }

  return { renovar, cerrar, tamano: () => resultados.size + cerradas.size }
}

const renovador = crearRenovador()

async function pedirRenovacion(event: H3Event, token: string): Promise<ResultadoRenovacion> {
  try {
    return renovacionDe(await $fetch(backendUrl(event, '/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    }))
  } catch (error) {
    return fallaRenovacion(estadoHttp(error))
  }
}

/**
 * Devuelve el JWT con el que reenviar la petición: el mismo, o uno renovado (guardado ya en la cookie)
 * si es de staff y le quedan menos de 20 min. Las peticiones simultáneas con el mismo JWT comparten una
 * sola renovación; un JWT de una sesión cerrada (`olvidarSesion`) no se renueva.
 */
export async function renovarSiHaceFalta(event: H3Event, token: string): Promise<string> {
  const exp = payloadJwt(token)?.exp
  if (!esSesionDeStaff(token) || !debeRenovar(exp)) return token
  const nueva = await renovador.renovar(token, exp, () => pedirRenovacion(event, token))
  if (!nueva) return token
  guardarSesion(event, nueva.jwt, vidaSesionSegundos(nueva.expiraEn))
  return nueva.jwt
}

/**
 * Al cerrar sesión: las peticiones aún en curso con este JWT no lo renuevan ni vuelven a guardar la
 * cookie (en una estación compartida, la siguiente persona entraría con la sesión anterior).
 */
export function olvidarSesion(token: string | undefined): void {
  if (token) renovador.cerrar(token, payloadJwt(token)?.exp)
}
