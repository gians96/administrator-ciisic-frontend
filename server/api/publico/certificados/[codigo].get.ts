/**
 * Verificación pública de un certificado (página `/verificar/<código>`, sin sesión): reenvía a
 * `GET /api/v1/public/certificates/:codigo` del backend (spec 015) con la IP real del visitante en
 * `x-forwarded-for` (el backend limita por IP). Un código con otro formato responde 404 sin consultarlo;
 * cada IP puede consultar 20 veces por minuto (en la memoria de este proceso). Solo devuelve los datos
 * públicos. Sin backend, o con uno anterior a la 015 (la ruta no existe): 503
 * `CERTIFICATE_VERIFICATION_UNAVAILABLE`. `Cache-Control: no-store` (como todo `/api/**`).
 */
const limitador = crearLimitador({ maximo: MAXIMO_VERIFICACIONES_POR_MINUTO, ventanaMs: 60_000 })

export default defineEventHandler(async (event) => {
  const codigo = codigoParaVerificar(getRouterParam(event, 'codigo', { decode: true }))
  if (!codigo) lanzarError(event, errorCodigoNoEncontrado())

  const ip = ipCliente(event)
  const turno = limitador.consumir(ip ?? 'sin-ip')
  if (!turno.permitido) lanzarError(event, errorLimiteVerificacion(turno.reintentarEnSegundos))

  let respuesta: unknown
  try {
    respuesta = await $fetch(backendUrl(event, `/api/v1/public/certificates/${encodeURIComponent(codigo)}`), {
      headers: { 'x-forwarded-for': ip ?? '' },
      retry: 0,
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_VERIFICACION))
  }

  const datos = verificacionPublicaDe(respuesta)
  if (!datos) lanzarError(event, errorPropagado(undefined, RESPALDO_VERIFICACION))
  return { success: true, data: datos }
})
