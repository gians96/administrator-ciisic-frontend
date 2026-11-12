/**
 * El PDF firmado de un certificado por su código (`GET /v1/public/certificates/:codigo/file`). `?descargar=true` lo
 * baja como archivo; sin él se abre en el navegador (visor de la página `/certificado/<código>`).
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const codigo = codigoCertificado(getRouterParam(event, 'codigo'))
  if (!codigo) lanzarError(event, CERTIFICADO_NO_ENCONTRADO)
  const descargar = getQuery(event).descargar === 'true'
  const respuesta = await $fetch.raw(backendUrl(event, `/api/v1/public/certificates/${codigo}/file${descargar ? '?descargar=true' : ''}`), {
    headers: { 'x-forwarded-for': ipCliente(event) ?? '' },
    responseType: 'arrayBuffer',
    ignoreResponseError: true,
    retry: 0,
  }).catch((error: unknown) => lanzarError(event, errorPropagado(error, RESPALDO_CERTIFICADOS)))

  if (!respuesta.ok) {
    lanzarError(event, errorPropagado({ status: respuesta.status, data: jsonDeBytes(respuesta._data), response: respuesta }, RESPALDO_CERTIFICADOS))
  }
  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  const disposicion = respuesta.headers.get('content-disposition')
  if (disposicion) setResponseHeader(event, 'Content-Disposition', disposicion)
  return Buffer.from(respuesta._data as ArrayBuffer)
})
