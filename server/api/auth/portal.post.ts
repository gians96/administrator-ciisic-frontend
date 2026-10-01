/**
 * El staff pasa a su propio portal de participante (`POST /v1/auth/participant/switch`, spec 014 del
 * backend) con el Bearer de su sesión. Solo si entró con Google y hay un inscrito con su mismo correo; si
 * entró con contraseña, el backend responde 409 `CODE_REQUIRED` y el panel ofrece el código al correo
 * de la cuenta. La cookie pasa a la sesión de participante (12 h): para volver al panel se ingresa de
 * nuevo. Se propagan los errores (`CODE_REQUIRED`, `PARTICIPANT_NOT_FOUND`, `GOOGLE_ACCOUNT_MISMATCH`…);
 * un 401 cierra la sesión del staff.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const token = tokenDeSesion(event)
  if (!token) {
    throw createError({ statusCode: 401, data: { success: false, code: 'SESSION_EXPIRED', message: 'Tu sesión expiró. Inicia sesión nuevamente.' } })
  }
  if (esSesionDeParticipante(token)) {
    throw createError({ statusCode: 403, data: { success: false, code: 'FORBIDDEN_PROFILE', message: 'Ya estás en tu portal de participante.' } })
  }

  let respuesta: unknown
  try {
    respuesta = await $fetch(backendUrl(event, '/api/v1/auth/participant/switch'), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
  } catch (error) {
    const propagado = errorPropagado(error, RESPALDO_PORTAL)
    if (propagado.statusCode === 401) {
      olvidarSesion(token)
      cerrarSesion(event)
    }
    lanzarError(event, propagado)
  }
  const sesion = sesionParticipanteDe(respuesta)
  if (!sesion) lanzarError(event, errorPropagado(null, RESPALDO_PORTAL))

  // Las peticiones del staff aún en curso no renuevan ni vuelven a guardar su JWT sobre esta cookie
  olvidarSesion(token)
  guardarSesion(event, sesion.jwt, vidaSesionSegundos(sesion.expiraEn))
  return { success: true, tipo: 'PARTICIPANTE' as const, participante: sesion.participante }
})
