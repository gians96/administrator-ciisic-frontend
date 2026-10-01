/**
 * Pide un código de acceso al portal para un correo (`POST /v1/auth/participant/code`). El backend
 * responde siempre 202 con el mismo cuerpo, exista o no el correo. Se reenvía la IP real del cliente
 * (los topes por IP viven en el backend) y se propagan el código, el estado, `Retry-After` y `fields`.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody<{ correo?: unknown }>(event).catch(() => null)
  const correo = correoDeSolicitud(body?.correo)
  if (!correo) lanzarError(event, errorValidacion({ correo: 'Ingresa un correo válido.' }))

  let respuesta: unknown
  try {
    respuesta = await $fetch(backendUrl(event, '/api/v1/auth/participant/code'), {
      method: 'POST',
      body: { correo },
      headers: { 'x-forwarded-for': ipCliente(event) ?? '' },
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_CODIGO))
  }
  setResponseStatus(event, 202)
  return { success: true, ...codigoSolicitadoDe(respuesta) }
})
