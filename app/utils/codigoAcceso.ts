import { aErrorApi } from '~/utils/errores'

/**
 * Acceso al portal del inscrito con un código de 6 dígitos que llega a su correo (backend-ciisic spec
 * 014, `contracts/api-acceso-codigo.md`). El BFF (`/api/auth/codigo`, `/api/auth/codigo/verificar`)
 * reenvía al backend; aquí, la lógica del formulario de dos pasos (`AccesoConCodigo`).
 */

export const LONGITUD_CODIGO = 6
/** Mismo tope que el backend. */
export const LONGITUD_MAXIMA_CORREO = 191
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FORMATO_CODIGO = /^\d{6}$/

/** Respuesta de `POST /api/auth/codigo` (siempre igual, exista o no el correo). */
export interface CodigoSolicitado {
  /** Vida del código (10 min). */
  expiraEnSegundos: number
  /** Espera para pedir otro (60 s). */
  reintentarEnSegundos: number
}

const VIDA_CODIGO_POR_DEFECTO = 600
const ESPERA_POR_DEFECTO = 60

/** Correo como lo guarda el backend: sin espacios alrededor y en minúsculas. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase()
}

/** Correo con forma válida (después de `normalizarCorreo`) y de hasta 191 caracteres. */
export function esCorreoDeAcceso(correo: string): boolean {
  const valor = normalizarCorreo(correo)
  return valor.length <= LONGITUD_MAXIMA_CORREO && FORMATO_CORREO.test(valor)
}

/** Solo los dígitos de lo escrito o pegado («123 456», «123-456»), como mucho 6. */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, LONGITUD_CODIGO)
}

/** Exactamente 6 dígitos. */
export function esCodigoValido(codigo: string): boolean {
  return FORMATO_CODIGO.test(codigo)
}

function enteroPositivo(valor: unknown, respaldo: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.ceil(valor) : respaldo
}

/** Vida y espera de la respuesta del BFF; sin valores válidos, 600 s y 60 s. */
export function codigoSolicitadoDe(respuesta: unknown): CodigoSolicitado {
  const datos = (respuesta && typeof respuesta === 'object' ? respuesta : {}) as Record<string, unknown>
  return {
    expiraEnSegundos: enteroPositivo(datos.expiraEnSegundos, VIDA_CODIGO_POR_DEFECTO),
    reintentarEnSegundos: enteroPositivo(datos.reintentarEnSegundos, ESPERA_POR_DEFECTO),
  }
}

/** Segundos de un valor de espera: número o texto con segundos, o una fecha HTTP (`Retry-After`). */
function segundosDe(valor: unknown, ahora: number): number | null {
  let segundos = Number.NaN
  if (typeof valor === 'number') {
    segundos = valor
  } else if (typeof valor === 'string' && valor.trim()) {
    const texto = valor.trim()
    segundos = /^\d+(?:\.\d+)?$/.test(texto) ? Number(texto) : (Date.parse(texto) - ahora) / 1000
  }
  return Number.isFinite(segundos) && segundos > 0 ? Math.ceil(segundos) : null
}

/**
 * Segundos que hay que esperar tras un error (`429 CODE_COOLDOWN`, `CODE_LOCKED`, `RATE_LIMITED`,
 * `503 CODE_LOGIN_PAUSED`…): `fields.reintentarEnSegundos` (el backend lo envía como texto) o el
 * encabezado `Retry-After` de la respuesta. Sin espera, `null`.
 */
export function segundosParaReintentar(error: unknown, ahora: number = Date.now()): number | null {
  const desdeCampos = segundosDe(aErrorApi(error).fields?.reintentarEnSegundos, ahora)
  if (desdeCampos !== null) return desdeCampos
  const headers = (error as { response?: { headers?: { get?: (nombre: string) => string | null } } } | null)?.response?.headers
  return typeof headers?.get === 'function' ? segundosDe(headers.get('retry-after'), ahora) : null
}

/**
 * Cuenta regresiva: «m:ss» hasta 59:59 (`0:42`, `1:00`); desde una hora, en horas y minutos (el tope
 * diario de `CODE_COOLDOWN` o la pausa de `CODE_LOGIN_PAUSED`): `1 h`, `13 h 54 min`.
 */
export function formatoCuentaRegresiva(segundos: number): string {
  const total = Number.isFinite(segundos) ? Math.max(0, Math.ceil(segundos)) : 0
  if (total < 3600) return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  const minutos = Math.ceil(total / 60)
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

/** Minutos enteros de vida del código para el texto «vence en 10 minutos». */
export function minutosDeVida(segundos: number): number {
  return Math.max(1, Math.round(segundos / 60))
}

/**
 * Tras pedir un código: `CODE_COOLDOWN` significa que hace poco se pidió uno para ese correo (los dos
 * últimos siguen sirviendo), así que el formulario pasa a escribir el código en vez de quedarse en el
 * correo.
 */
export function pasarAlCodigoTrasError(error: unknown): boolean {
  return aErrorApi(error).code === 'CODE_COOLDOWN'
}

/**
 * Mensaje de un error del acceso con código. `INVALID_CODE` dice cuántos intentos quedan con ese código
 * (`fields.restantes`); los demás usan `aErrorApi` (mensajes de `errores.ts` o el del servidor).
 */
export function mensajeErrorCodigo(error: unknown): string {
  const e = aErrorApi(error)
  if (e.code === 'INVALID_CODE') {
    const restantes = Number(e.fields?.restantes)
    if (Number.isInteger(restantes) && restantes > 0) return `El código no es correcto. Te ${restantes === 1 ? 'queda 1 intento' : `quedan ${restantes} intentos`}.`
    if (restantes === 0) return 'El código no es correcto y ya no quedan intentos con él. Pide uno nuevo.'
  }
  return e.message
}
