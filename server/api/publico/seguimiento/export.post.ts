/**
 * Descarga del reporte con un enlace público o con el DNI del docente (`/v1/public/advisor/export`, `/v1/public/cycle/export`
 * o `POST /v1/public/advisor/lookup/export`, según `tipo`): Excel o PDF sin DNI ni correo de estudiantes (y sin celular en el
 * del ciclo) ni montos. Misma regla que la vista: sin sesión, credencial en el cuerpo y reenviada al backend.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ token?: unknown, tipo?: unknown, documento?: unknown, formato?: unknown }>(event).catch(() => null)
  const lectura = credencialDeCuerpo(body)
  if ('error' in lectura) lanzarError(event, lectura.error)
  const formato = formatoDeDescarga(body?.formato)
  if (!formato) lanzarError(event, errorValidacion({ formato: 'Debe ser xlsx o pdf.' }))

  const { ruta, opciones } = peticionAlBackend(lectura.credencial, ipCliente(event), formato)
  // `ignoreResponseError`: así el cuerpo de un error llega como bytes y se lee aquí, sin perder el código
  const respuesta = await $fetch.raw(backendUrl(event, `/api/v1/${ruta}`), {
    ...opciones,
    responseType: 'arrayBuffer',
    ignoreResponseError: true,
    retry: 0,
  }).catch((error: unknown) => lanzarError(event, errorPropagado(error, RESPALDO_ENLACE)))

  if (!respuesta.ok) {
    lanzarError(event, errorPropagado({ status: respuesta.status, data: jsonDeBytes(respuesta._data), response: respuesta }, RESPALDO_ENLACE))
  }
  setResponseHeader(event, 'Content-Type', respuesta.headers.get('content-type') ?? 'application/octet-stream')
  const nombre = respuesta.headers.get('content-disposition')
  if (nombre) setResponseHeader(event, 'Content-Disposition', nombre)
  return Buffer.from(respuesta._data as ArrayBuffer)
})
