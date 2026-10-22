/**
 * Descarga del reporte del docente (`GET /v1/public/advisor/export`): Excel o PDF sin DNI, correo ni montos.
 * Misma regla que la vista: sin sesión, token en el cuerpo y reenviado en `X-Link-Token`.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ token?: unknown, formato?: unknown }>(event).catch(() => null)
  const token = tokenDeCuerpo(body?.token)
  if (!token) lanzarError(event, ENLACE_NO_VALIDO)
  const formato = formatoDeDescarga(body?.formato)
  if (!formato) lanzarError(event, errorValidacion({ formato: 'Debe ser xlsx o pdf.' }))

  // `ignoreResponseError`: así el cuerpo de un error llega como bytes y se lee aquí, sin perder el código
  const respuesta = await $fetch.raw(backendUrl(event, `/api/v1/public/advisor/export?formato=${formato}`), {
    responseType: 'arrayBuffer',
    ignoreResponseError: true,
    retry: 0,
    headers: { 'x-link-token': token, 'x-forwarded-for': ipCliente(event) ?? '' },
  }).catch((error: unknown) => lanzarError(event, errorPropagado(error, RESPALDO_ENLACE)))

  if (!respuesta.ok) {
    lanzarError(event, errorPropagado({ status: respuesta.status, data: jsonDeBytes(respuesta._data), response: respuesta }, RESPALDO_ENLACE))
  }
  setResponseHeader(event, 'Content-Type', respuesta.headers.get('content-type') ?? 'application/octet-stream')
  const nombre = respuesta.headers.get('content-disposition')
  if (nombre) setResponseHeader(event, 'Content-Disposition', nombre)
  return Buffer.from(respuesta._data as ArrayBuffer)
})
