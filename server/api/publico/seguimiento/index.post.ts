/**
 * Vista del docente con su enlace (`GET /v1/public/advisor` del backend). Sin sesión: el navegador envía el token
 * del `#` de su enlace en el cuerpo y el BFF lo reenvía en `X-Link-Token` junto con la IP real del visitante
 * (los topes por IP viven en el backend). Nada de esto se guarda en cachés.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ token?: unknown }>(event).catch(() => null)
  const token = tokenDeCuerpo(body?.token)
  if (!token) lanzarError(event, ENLACE_NO_VALIDO)

  try {
    return await $fetch(backendUrl(event, '/api/v1/public/advisor'), {
      headers: { 'x-link-token': token, 'x-forwarded-for': ipCliente(event) ?? '' },
      retry: 0,
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_ENLACE))
  }
})
