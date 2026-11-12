/**
 * Consulta pública de certificados con el DNI (`POST /v1/public/certificates/lookup`). Sin sesión: el DNI va en el
 * cuerpo y se reenvía en el cuerpo, con la IP real del visitante (el tope de intentos fallidos vive en el backend).
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ documento?: unknown }>(event).catch(() => null)
  const documento = documentoCertificado(body?.documento)
  if (!documento) lanzarError(event, CERTIFICADO_NO_ENCONTRADO)
  try {
    return await $fetch(backendUrl(event, '/api/v1/public/certificates/lookup'), {
      method: 'POST',
      headers: { 'x-forwarded-for': ipCliente(event) ?? '' },
      body: { documento },
      retry: 0,
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_CERTIFICADOS))
  }
})
