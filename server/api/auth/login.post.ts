interface LoginResponse {
  jwt: string
  usuario: Record<string, unknown>
  /** Vida del JWT: segundos o fecha ISO de expiración. */
  expiraEn?: number | string
}

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody<{ correo?: string, contrasena?: string }>(event)
  if (!body?.correo || !body?.contrasena) {
    throw createError({ statusCode: 422, data: { success: false, code: 'VALIDATION_ERROR', message: 'Ingresa correo y contraseña.' } })
  }
  try {
    const response = await $fetch<LoginResponse>(backendUrl(event, '/api/v1/auth/login'), {
      method: 'POST',
      body: { correo: body.correo, contrasena: body.contrasena },
      headers: { 'x-forwarded-for': getRequestIP(event, { xForwardedFor: true }) ?? '' },
    })
    guardarSesion(event, response.jwt, vidaSesionSegundos(response.expiraEn))
    return { success: true, usuario: response.usuario }
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 429) {
      throw createError({ statusCode: 429, data: { success: false, code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera unos minutos.' } })
    }
    throw createError({ statusCode: 401, data: { success: false, code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' } })
  }
})
