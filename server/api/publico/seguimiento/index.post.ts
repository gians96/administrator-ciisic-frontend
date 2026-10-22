/**
 * Vista pública del seguimiento: la del docente con su enlace (`GET /v1/public/advisor`), la de un ciclo
 * (`/v1/public/cycle`) o la del docente con su DNI (`POST /v1/public/advisor/lookup`), según `tipo`. Sin sesión: el
 * navegador envía el token del `#` de su enlace (o el DNI) en el cuerpo y el BFF lo reenvía al backend, en el
 * encabezado `X-Link-Token` o en el cuerpo, junto con la IP real del visitante (los topes por IP viven en el
 * backend). Nada de esto se guarda en cachés.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ token?: unknown, tipo?: unknown, documento?: unknown }>(event).catch(() => null)
  const lectura = credencialDeCuerpo(body)
  if ('error' in lectura) lanzarError(event, lectura.error)

  const { ruta, opciones } = peticionAlBackend(lectura.credencial, ipCliente(event))
  try {
    return await $fetch(backendUrl(event, `/api/v1/${ruta}`), { ...opciones, retry: 0 })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_ENLACE))
  }
})
