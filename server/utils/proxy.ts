import type { H3Event } from 'h3'
import { esSesionDeParticipante } from './jwt-publico'
import { assertSameOrigin, backendUrl, cerrarSesion, tokenDeSesion } from './session'

const RUTA_VALIDA = /^[\w\-./]+$/

/** Ruta relativa que se puede reenviar al backend: caracteres seguros y sin segmentos `.` ni `..`. */
export function esRutaReenviable(ruta: string): boolean {
  return RUTA_VALIDA.test(ruta) && !ruta.split('/').some((segmento) => segmento === '..' || segmento === '.')
}

export type PerfilProxy = 'ADMIN' | 'PARTICIPANTE'

interface OpcionesProxy {
  /** Perfil de sesión que acepta el proxy; el otro recibe 403 `FORBIDDEN_PROFILE`. */
  perfil: PerfilProxy
  /** Prefijo en el backend: `/api/v1` (administración) o `/api/v1/me` (portal del inscrito). */
  prefijo: string
  /** Si la raíz del proxy (sin ruta) llega al prefijo. */
  rutaVaciaPermitida?: boolean
}

const MENSAJE_PERFIL: Readonly<Record<PerfilProxy, string>> = {
  ADMIN: 'Esta sección es solo para administradores.',
  PARTICIPANTE: 'Esta sección es solo para inscritos.',
}

/**
 * Reenvía `/<proxy>/<ruta>` a `<backend><prefijo>/<ruta>` con el Bearer de la cookie de sesión y transmite
 * cuerpos multipart y archivos sin cargarlos en memoria. Valida el `Origin` en mutaciones, la ruta y el
 * perfil de la sesión (leído del `aud` del JWT). Si el backend invalida el token (401), cierra la sesión.
 */
export function proxyAutenticado(event: H3Event, opciones: OpcionesProxy) {
  assertSameOrigin(event)
  const token = tokenDeSesion(event)
  if (!token) {
    throw createError({ statusCode: 401, data: { success: false, code: 'SESSION_EXPIRED', message: 'Tu sesión expiró. Inicia sesión nuevamente.' } })
  }

  const perfil: PerfilProxy = esSesionDeParticipante(token) ? 'PARTICIPANTE' : 'ADMIN'
  if (perfil !== opciones.perfil) {
    throw createError({ statusCode: 403, data: { success: false, code: 'FORBIDDEN_PROFILE', message: MENSAJE_PERFIL[opciones.perfil] } })
  }

  const ruta = getRouterParam(event, 'path') ?? ''
  if (ruta ? !esRutaReenviable(ruta) : !opciones.rutaVaciaPermitida) {
    throw createError({ statusCode: 400, data: { success: false, code: 'BAD_PATH', message: 'Ruta inválida' } })
  }

  const { search } = getRequestURL(event)
  const destino = backendUrl(event, `${ruta ? `${opciones.prefijo}/${ruta}` : opciones.prefijo}${search}`)
  return proxyRequest(event, destino, {
    headers: {
      authorization: `Bearer ${token}`,
      cookie: '',
      // Llamada servidor a servidor: sin los encabezados del navegador. Si se reenviara `Origin`,
      // el backend lo evaluaría contra su CORS_ORIGINS (pensado para la landing) y respondería 403.
      origin: '',
      referer: '',
    },
    onResponse(proxyEvent, response) {
      // Si el backend invalida el token (expirado, sesión invalidada), se cierra la sesión del panel
      if (response.status === 401) cerrarSesion(proxyEvent)
    },
  })
}
