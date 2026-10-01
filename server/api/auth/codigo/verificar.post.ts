/**
 * Canjea el código del correo por una sesión de participante (`POST /v1/auth/participant/code/verify`).
 * El código **siempre** abre el portal del inscrito, nunca el panel del staff. La cookie dura lo que el
 * JWT (12 h, no se renueva). Si en este navegador había una sesión de staff, sus peticiones aún en curso
 * ya no la renuevan ni la vuelven a guardar.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody<{ correo?: unknown, codigo?: unknown }>(event).catch(() => null)
  const correo = correoDeSolicitud(body?.correo)
  const codigo = codigoDeSolicitud(body?.codigo)
  if (!correo) lanzarError(event, errorValidacion({ correo: 'Ingresa un correo válido.' }))
  if (!codigo) lanzarError(event, errorValidacion({ codigo: 'Escribe los 6 dígitos del código.' }))

  let respuesta: unknown
  try {
    respuesta = await $fetch(backendUrl(event, '/api/v1/auth/participant/code/verify'), {
      method: 'POST',
      body: { correo, codigo },
      headers: { 'x-forwarded-for': ipCliente(event) ?? '' },
    })
  } catch (error) {
    lanzarError(event, errorPropagado(error, RESPALDO_CODIGO))
  }
  const sesion = sesionParticipanteDe(respuesta)
  if (!sesion) lanzarError(event, errorPropagado(null, RESPALDO_CODIGO))

  olvidarSesion(tokenDeSesion(event))
  guardarSesion(event, sesion.jwt, vidaSesionSegundos(sesion.expiraEn))
  return { success: true, tipo: 'PARTICIPANTE' as const, participante: sesion.participante }
})
