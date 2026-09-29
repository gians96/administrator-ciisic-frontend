/** Vida de la sesión si el backend no informa `expiraEn` (la del JWT del backend: 1 h). */
export const VIDA_SESION_POR_DEFECTO = 3600
/** Tope defensivo: el JWT caduca antes; solo evita cookies con vidas absurdas. */
const VIDA_SESION_MAXIMA = 30 * 24 * 3600

/**
 * Segundos que debe durar la cookie de sesión según `expiraEn` del backend: segundos de vida
 * (número o texto numérico) o el instante de expiración en ISO 8601. Sin un valor válido y
 * futuro, 3600.
 */
export function vidaSesionSegundos(expiraEn: unknown, ahora: number = Date.now()): number {
  let segundos = Number.NaN
  if (typeof expiraEn === 'number') {
    segundos = expiraEn
  } else if (typeof expiraEn === 'string' && expiraEn.trim()) {
    const texto = expiraEn.trim()
    segundos = /^\d+(?:\.\d+)?$/.test(texto) ? Number(texto) : (Date.parse(texto) - ahora) / 1000
  }
  if (!Number.isFinite(segundos) || segundos < 1) return VIDA_SESION_POR_DEFECTO
  return Math.min(Math.floor(segundos), VIDA_SESION_MAXIMA)
}
