import type { EstadoTokenAcceso, TokenAcceso } from '~/types/api'

/** Variable de entorno (solo servidor) de la landing donde se configura el token. */
export const VARIABLE_TOKEN_LANDING = 'NUXT_BACKEND_EVENT_TOKEN'

const DIA_MS = 86_400_000
/** Perú no usa horario de verano: la hora de Lima es siempre UTC−5. */
const DESFASE_LIMA_MS = 5 * 3_600_000

export const ESTADOS_TOKEN_ACCESO: Readonly<Record<EstadoTokenAcceso, { texto: string, tono: 'ok' | 'error' | 'warn' }>> = {
  ACTIVO: { texto: 'Activo', tono: 'ok' },
  REVOCADO: { texto: 'Revocado', tono: 'error' },
  EXPIRADO: { texto: 'Expirado', tono: 'warn' },
}

/** Nombres legibles de las claves de `fields` (errores de validación del backend). */
export const ETIQUETAS_CAMPOS_TOKEN: Readonly<Record<string, string>> = {
  nombre: 'Nombre',
  expiraEn: 'Expiración',
}

/** Estado a mostrar: un token ACTIVO cuya expiración ya pasó se muestra como EXPIRADO. */
export function estadoEfectivoTokenAcceso(token: Pick<TokenAcceso, 'estado' | 'expiraEn'>, ahora: Date = new Date()): EstadoTokenAcceso {
  if (token.estado === 'ACTIVO' && token.expiraEn) {
    const expira = new Date(token.expiraEn).getTime()
    if (!Number.isNaN(expira) && expira <= ahora.getTime()) return 'EXPIRADO'
  }
  return token.estado
}

/** Token activo que vence dentro de `dias` días. */
export function venceProntoTokenAcceso(token: Pick<TokenAcceso, 'estado' | 'expiraEn'>, ahora: Date = new Date(), dias = 7): boolean {
  if (!token.expiraEn || estadoEfectivoTokenAcceso(token, ahora) !== 'ACTIVO') return false
  const restante = new Date(token.expiraEn).getTime() - ahora.getTime()
  return restante > 0 && restante <= dias * DIA_MS
}

/** `ciisic_AbCd` → `ciisic_AbCd…` (el backend solo devuelve el inicio del token). */
export function prefijoVisibleToken(prefijo: string | null | undefined): string {
  const limpio = prefijo?.trim() ?? ''
  if (!limpio) return '—'
  return /(?:…|\.\.\.)$/.test(limpio) ? limpio : `${limpio}…`
}

/** Activos primero y, dentro de cada grupo, los más recientes primero. */
export function ordenarTokensAcceso<T extends Pick<TokenAcceso, 'estado' | 'expiraEn' | 'creadoEn'>>(tokens: readonly T[], ahora: Date = new Date()): T[] {
  const activo = (token: T) => Number(estadoEfectivoTokenAcceso(token, ahora) === 'ACTIVO')
  return [...tokens].sort((a, b) => activo(b) - activo(a) || b.creadoEn.localeCompare(a.creadoEn))
}

/** Texto de confirmación al revocar. */
export function mensajeRevocarToken(token: Pick<TokenAcceso, 'nombre' | 'prefijo'>): string {
  return `¿Revocar «${token.nombre}» (${prefijoVisibleToken(token.prefijo)})? La landing que lo use dejará de poder consultar el backend de inmediato. No se puede deshacer.`
}

// ─── Formulario de alta ───

export type OpcionExpiracionToken = 'nunca' | '30' | '90' | '180' | '365' | 'fecha'

export const OPCIONES_EXPIRACION_TOKEN: ReadonlyArray<{ id: OpcionExpiracionToken, nombre: string }> = [
  { id: 'nunca', nombre: 'Sin expiración' },
  { id: '30', nombre: 'En 30 días' },
  { id: '90', nombre: 'En 90 días' },
  { id: '180', nombre: 'En 6 meses' },
  { id: '365', nombre: 'En 1 año' },
  { id: 'fecha', nombre: 'En una fecha…' },
]

export interface FormularioTokenAcceso {
  nombre: string
  expiracion: OpcionExpiracionToken
  /** `YYYY-MM-DD` cuando `expiracion === 'fecha'`. */
  fecha: string
}

/** Fecha de hoy (`YYYY-MM-DD`) en hora de Lima, para el mínimo del selector de fecha. */
export function hoyEnLima(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - DESFASE_LIMA_MS).toISOString().slice(0, 10)
}

/**
 * `expiraEn` (ISO) del alta: `null` = sin expiración; N días desde ahora; o el final del día
 * elegido en hora de Lima. También devuelve `null` si la fecha no es válida (validar antes).
 */
export function calcularExpiracionToken(opcion: OpcionExpiracionToken, fecha: string, ahora: Date = new Date()): string | null {
  if (opcion === 'nunca') return null
  if (opcion === 'fecha') {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim())
    if (!partes) return null
    const [anio, mes, dia] = partes.slice(1).map(Number) as [number, number, number]
    // 23:59:59.999 del día elegido como "hora local" y luego desplazado a UTC (+5 h)
    const finDelDia = new Date(Date.UTC(anio, mes - 1, dia, 23, 59, 59, 999))
    // Rechaza fechas imposibles (31 de febrero, mes 13) que Date desbordaría
    if (finDelDia.getUTCFullYear() !== anio || finDelDia.getUTCMonth() !== mes - 1 || finDelDia.getUTCDate() !== dia) return null
    return new Date(finDelDia.getTime() + DESFASE_LIMA_MS).toISOString()
  }
  return new Date(ahora.getTime() + Number(opcion) * DIA_MS).toISOString()
}

/** Error de la expiración elegida, o `null` si es válida. */
export function errorExpiracionToken(opcion: OpcionExpiracionToken, fecha: string, ahora: Date = new Date()): string | null {
  if (opcion !== 'fecha') return null
  if (!fecha.trim()) return 'Elige la fecha de expiración.'
  const iso = calcularExpiracionToken(opcion, fecha, ahora)
  if (!iso) return 'La fecha no es válida.'
  if (new Date(iso).getTime() <= ahora.getTime()) return 'La fecha debe ser hoy o posterior.'
  return null
}

/** Validación en el navegador (mismas claves que `fields` del backend). */
export function validarTokenAcceso(form: FormularioTokenAcceso, ahora: Date = new Date()): Record<string, string> {
  const errores: Record<string, string> = {}
  if (!form.nombre.trim()) errores.nombre = 'Ingresa un nombre para reconocer el token (p. ej. Landing producción).'
  const errorFecha = errorExpiracionToken(form.expiracion, form.fecha, ahora)
  if (errorFecha) errores.expiraEn = errorFecha
  return errores
}

export function cuerpoTokenAcceso(form: FormularioTokenAcceso, ahora: Date = new Date()): { nombre: string, expiraEn: string | null } {
  return { nombre: form.nombre.trim(), expiraEn: calcularExpiracionToken(form.expiracion, form.fecha, ahora) }
}
