interface RespuestaGoogle {
  data: {
    jwt: string
    tipo: 'ADMIN' | 'PARTICIPANTE'
    usuario?: Record<string, unknown>
    participante?: Record<string, unknown>
    expiraEn?: number | string
  }
}

/**
 * Canjea la credencial (ID token) de Google por la sesión del panel: el backend verifica la firma,
 * la audiencia y el nonce, y decide el perfil (administrador activo o inscrito). Los errores del
 * backend se propagan con su código para que el login explique qué pasó.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody<{ credential?: unknown }>(event)
  if (!esCredencialGoogle(body?.credential)) {
    throw createError({ statusCode: 422, data: { success: false, code: 'VALIDATION_ERROR', message: 'La respuesta de Google no es válida. Vuelve a intentarlo.' } })
  }
  const nonce = consumirNonceGoogle(event)
  if (!nonce) {
    throw createError({ statusCode: 400, data: { success: false, code: 'GOOGLE_SESSION_EXPIRED', message: 'El inicio de sesión con Google expiró. Vuelve a intentarlo.' } })
  }
  try {
    const { data } = await $fetch<RespuestaGoogle>(backendUrl(event, '/api/v1/auth/google'), {
      method: 'POST',
      body: { idToken: body.credential, nonce },
      headers: { 'x-forwarded-for': getRequestIP(event, { xForwardedFor: true }) ?? '' },
    })
    guardarSesion(event, data.jwt, vidaSesionSegundos(data.expiraEn))
    return data.tipo === 'PARTICIPANTE'
      ? { success: true, tipo: 'PARTICIPANTE' as const, participante: data.participante }
      : { success: true, tipo: 'ADMIN' as const, usuario: data.usuario }
  } catch (error) {
    const fallo = error as { statusCode?: number, data?: { code?: string, message?: string } }
    throw createError({
      statusCode: fallo.statusCode ?? 502,
      data: {
        success: false,
        code: fallo.data?.code ?? 'GOOGLE_UNAVAILABLE',
        message: fallo.data?.message ?? 'No se pudo iniciar sesión con Google. Intenta nuevamente.',
      },
    })
  }
})
