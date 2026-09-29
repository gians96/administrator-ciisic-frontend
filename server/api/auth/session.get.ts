interface RespuestaSesion {
  success: boolean
  tipo?: 'ADMIN' | 'PARTICIPANTE'
  user?: Record<string, unknown>
  participante?: Record<string, unknown>
}

const SIN_SESION = { authenticated: false, tipo: null, user: null, participante: null } as const

/** Sesión actual (administrador o inscrito) según el backend. Si el token ya no vale, se cierra. */
export default defineEventHandler(async (event) => {
  const token = tokenDeSesion(event)
  if (!token) return SIN_SESION
  try {
    const respuesta = await $fetch<RespuestaSesion>(backendUrl(event, '/api/v1/auth/session'), {
      headers: { authorization: `Bearer ${token}` },
    })
    const esParticipante = respuesta.tipo === 'PARTICIPANTE' || (!respuesta.tipo && Boolean(respuesta.participante) && !respuesta.user)
    return esParticipante
      ? { authenticated: true, tipo: 'PARTICIPANTE' as const, user: null, participante: respuesta.participante ?? null }
      : { authenticated: true, tipo: 'ADMIN' as const, user: respuesta.user ?? null, participante: null }
  } catch {
    cerrarSesion(event)
    return SIN_SESION
  }
})
