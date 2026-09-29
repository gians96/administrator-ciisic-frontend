import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Nonce del inicio de sesión con Google (spec 007 del panel). Lo emite el servidor del panel, viaja
 * dentro del ID token y el backend lo compara: un ID token obtenido en una landing (mismo client ID)
 * no sirve para entrar al panel. Un solo uso y 15 minutos de vida.
 */
export const COOKIE_NONCE_GOOGLE = 'ciisic_google_nonce'
const RUTA_COOKIE = '/api/auth/google'
const VIDA_NONCE_SEGUNDOS = 15 * 60

export function emitirNonceGoogle(event: H3Event): string {
  const nonce = randomBytes(32).toString('base64url')
  setCookie(event, COOKIE_NONCE_GOOGLE, nonce, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: RUTA_COOKIE,
    maxAge: VIDA_NONCE_SEGUNDOS,
  })
  return nonce
}

/** Lee y consume el nonce (se borra siempre, aunque el inicio de sesión falle). */
export function consumirNonceGoogle(event: H3Event): string | null {
  const nonce = getCookie(event, COOKIE_NONCE_GOOGLE) || null
  deleteCookie(event, COOKIE_NONCE_GOOGLE, { path: RUTA_COOKIE })
  return nonce
}
