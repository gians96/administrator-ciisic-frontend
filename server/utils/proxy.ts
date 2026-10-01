import type { H3Event } from 'h3'
import { esSesionDeParticipante } from './jwt-publico'
import { descartarRenovacionSiSeCerro, renovarSiHaceFalta, sesionCerrada } from './renovar-sesion'
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
 * perfil de la sesión (leído del `aud` del JWT). Renueva el JWT del staff si está por caducar
 * (`renovarSiHaceFalta`). Si el backend invalida el token (401), cierra la sesión. Si la sesión se cerró
 * en otra petición mientras tanto (salir o paso al portal), la respuesta no toca la cookie.
 */
export async function proxyAutenticado(event: H3Event, opciones: OpcionesProxy) {
  assertSameOrigin(event)
  const tokenActual = tokenDeSesion(event)
  if (!tokenActual) {
    throw createError({ statusCode: 401, data: { success: false, code: 'SESSION_EXPIRED', message: 'Tu sesión expiró. Inicia sesión nuevamente.' } })
  }

  const perfil: PerfilProxy = esSesionDeParticipante(tokenActual) ? 'PARTICIPANTE' : 'ADMIN'
  if (perfil !== opciones.perfil) {
    throw createError({ statusCode: 403, data: { success: false, code: 'FORBIDDEN_PROFILE', message: MENSAJE_PERFIL[opciones.perfil] } })
  }

  const ruta = getRouterParam(event, 'path') ?? ''
  if (ruta ? !esRutaReenviable(ruta) : !opciones.rutaVaciaPermitida) {
    throw createError({ statusCode: 400, data: { success: false, code: 'BAD_PATH', message: 'Ruta inválida' } })
  }

  const { search } = getRequestURL(event)
  const destino = backendUrl(event, `${ruta ? `${opciones.prefijo}/${ruta}` : opciones.prefijo}${search}`)
  // El backend no envía cookies: la del JWT renovado (si la hay) no se pisa al copiar sus encabezados
  const token = await renovarSiHaceFalta(event, tokenActual)
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
      // Si mientras se reenviaba la sesión se cerró o pasó al portal, esta respuesta no toca la cookie:
      // ni devuelve el JWT renovado del staff ni borra la cookie que ya es de la sesión nueva
      const cerrada = sesionCerrada(tokenActual) || sesionCerrada(token)
      descartarRenovacionSiSeCerro(proxyEvent, tokenActual, token)
      // Si el backend invalida el token (expirado, sesión invalidada), se cierra la sesión del panel
      if (response.status === 401 && !cerrada) cerrarSesion(proxyEvent)
    },
  })
}
