interface SessionResponse {
  success: boolean
  user: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  const token = tokenDeSesion(event)
  if (!token) return { authenticated: false, user: null }
  try {
    const response = await $fetch<SessionResponse>(backendUrl(event, '/api/v1/auth/session'), {
      headers: { authorization: `Bearer ${token}` },
    })
    return { authenticated: true, user: response.user }
  } catch {
    cerrarSesion(event)
    return { authenticated: false, user: null }
  }
})
