interface RespuestaConfiguracion {
  data?: { google?: { clientId?: string | null } }
}

/**
 * Datos para mostrar el botón de Google: el client ID que el SuperAdmin guardó en Sistema y un
 * nonce nuevo. Si Google no está configurado (o el backend no responde), no hay botón.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const clientId = await $fetch<RespuestaConfiguracion>(backendUrl(event, '/api/v1/auth/config'))
    .then((respuesta) => respuesta.data?.google?.clientId?.trim() || null)
    .catch(() => null)
  if (!clientId) return { clientId: null, nonce: null }
  return { clientId, nonce: emitirNonceGoogle(event) }
})
