/**
 * Vista con un enlace público (`GET /v1/public/advisor` del docente o `/v1/public/cycle` del ciclo, según `tipo`). Sin
 * sesión: el navegador envía el token del `#` de su enlace en el cuerpo y el BFF lo reenvía en `X-Link-Token` junto con
 * la IP real del visitante (los topes por IP viven en el backend). Nada de esto se guarda en cachés.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ token?: unknown, tipo?: unknown }>(event).catch(() => null)
  const token = tokenDeCuerpo(body?.token)
  if (!token) lanzarError(event, ENLACE_NO_VALIDO)
  const tipo = tipoDeCuerpo(body?.tipo)
  if (!tipo) lanzarError(event, errorValidacion({ tipo: 'Debe ser asesor o ciclo.' }))

  try {
    return await $fetch(backendUrl(event, `/api/v1/${RUTA_BACKEND[tipo]}`), {
      headers: { 'x-link-token': token, 'x-forwarded-for': ipCliente(event) ?? '' },
      retry: 0,
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_ENLACE))
  }
})
