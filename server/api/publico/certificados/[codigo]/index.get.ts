/** Datos públicos de un certificado por su código (`GET /v1/public/certificates/:codigo`): sin documento ni contacto. */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const codigo = codigoCertificado(getRouterParam(event, 'codigo'))
  if (!codigo) lanzarError(event, CERTIFICADO_NO_ENCONTRADO)
  try {
    return await $fetch(backendUrl(event, `/api/v1/public/certificates/${codigo}`), {
      headers: { 'x-forwarded-for': ipCliente(event) ?? '' },
      retry: 0,
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_CERTIFICADOS))
  }
})
