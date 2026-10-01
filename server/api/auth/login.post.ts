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
      headers: { 'x-forwarded-for': ipCliente(event) ?? '' },
    })
    guardarSesion(event, response.jwt, vidaSesionSegundos(response.expiraEn))
    // El acceso con contraseña es solo para administradores
    return { success: true, tipo: 'ADMIN' as const, usuario: response.usuario }
  } catch (error) {
    // Backend caído (5xx o red): 503, no «contraseña incorrecta»
    throw createError(errorLogin(estadoHttp(error)))
  }
})
