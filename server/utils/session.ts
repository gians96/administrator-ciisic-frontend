import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'ciisic_admin_session'

export function backendUrl(event: H3Event, path: string): string {
  const { backendBaseUrl } = useRuntimeConfig(event)
  return `${String(backendBaseUrl).replace(/\/+$/, '')}${path}`
}

export function tokenDeSesion(event: H3Event): string | undefined {
  return getCookie(event, SESSION_COOKIE) || undefined
}

/**
 * Guarda el JWT en la cookie httpOnly. `maxAgeSegundos` es la vida del JWT según el backend
 * (`vidaSesionSegundos(expiraEn)`), para que la cookie no sobreviva ni caduque antes que el token.
 */
export function guardarSesion(event: H3Event, token: string, maxAgeSegundos: number): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSegundos,
  })
}

export function cerrarSesion(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/**
 * Protección CSRF para mutaciones: además de la cookie SameSite=Strict, se exige que el
 * encabezado Origin (si existe) coincida con el origen del propio panel.
 */
export function assertSameOrigin(event: H3Event): void {
  const method = event.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return
  const origin = getRequestHeader(event, 'origin')
  if (!origin) return
  const own = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
  if (origin !== own) {
    throw createError({ statusCode: 403, data: { success: false, code: 'CSRF_ORIGIN', message: 'Origen no permitido' } })
  }
}
