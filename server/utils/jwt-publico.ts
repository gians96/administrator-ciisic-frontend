/**
 * Lectura del payload de un JWT **sin verificar la firma**, solo para enrutar en el BFF (saber si la
 * sesión es de administrador o de inscrito). La autoridad es el backend, que verifica firma, emisor,
 * audiencia y vigencia en cada llamada.
 */
export const AUDIENCIA_ADMIN = 'ciisic-admin'
export const AUDIENCIA_PARTICIPANTE = 'ciisic-participante'

/** Tamaño máximo aceptado para la credencial (ID token) de Google. */
const LONGITUD_MAXIMA_CREDENCIAL = 4096
/** Tres segmentos base64url separados por punto. */
const FORMATO_JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/

export function payloadJwt(token: string | null | undefined): Record<string, unknown> | null {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3 || !partes[1]) return null
  try {
    const payload: unknown = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'))
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** `aud` del JWT como lista (puede venir como texto o como arreglo). */
export function audienciasJwt(token: string | null | undefined): string[] {
  const aud = payloadJwt(token)?.aud
  if (typeof aud === 'string') return [aud]
  return Array.isArray(aud) ? aud.filter((valor): valor is string => typeof valor === 'string') : []
}

/** Sesión de inscrito (portal). Un JWT sin `aud` (anterior a los perfiles) no lo es: decide el backend. */
export function esSesionDeParticipante(token: string | null | undefined): boolean {
  return audienciasJwt(token).includes(AUDIENCIA_PARTICIPANTE)
}

/** Credencial de Google con forma de JWT (tres segmentos base64url) y de tamaño razonable. */
export function esCredencialGoogle(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= LONGITUD_MAXIMA_CREDENCIAL && FORMATO_JWT.test(valor)
}
