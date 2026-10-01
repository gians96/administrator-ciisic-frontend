/**
 * Sesión actual (staff o inscrito) según el backend; el staff llega con su `acceso`. Renueva el JWT
 * del staff si está por caducar. Solo un 401 del backend (token caducado o sesión invalidada) cierra
 * la sesión; si el backend no responde (5xx, red) se responde 503 `SESSION_UNAVAILABLE` y la cookie
 * se conserva (`consultarSesion`).
 */
export default defineEventHandler(async (event) => {
  const tokenActual = tokenDeSesion(event)
  if (!tokenActual) return SIN_SESION
  const token = await renovarSiHaceFalta(event, tokenActual)
  const consulta = await consultarSesion(() => $fetch<RespuestaSesionBackend>(backendUrl(event, '/api/v1/auth/session'), {
    headers: { authorization: `Bearer ${token}` },
  }))
  // Si la sesión se cerró o pasó al portal mientras tanto, no se devuelve la cookie del JWT renovado
  descartarRenovacionSiSeCerro(event, tokenActual, token)
  if (consulta.estado === 'VIGENTE') return consulta.cuerpo
  if (consulta.estado === 'CERRADA') {
    if (!sesionCerrada(tokenActual) && !sesionCerrada(token)) cerrarSesion(event)
    return SIN_SESION
  }
  throw createError(SESION_NO_DISPONIBLE)
})
