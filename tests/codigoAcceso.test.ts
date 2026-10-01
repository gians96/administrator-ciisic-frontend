import { describe, expect, it } from 'vitest'
import {
  codigoSolicitadoDe,
  esCodigoValido,
  esCorreoDeAcceso,
  formatoCuentaRegresiva,
  mensajeErrorCodigo,
  minutosDeVida,
  normalizarCodigo,
  normalizarCorreo,
  pasarAlCodigoTrasError,
  segundosParaReintentar,
} from '~/utils/codigoAcceso'

const AHORA = Date.parse('2026-10-26T15:00:00.000Z')

/** Error de `$fetch` del navegador con el cuerpo del BFF (anidado en `data`) y sus encabezados. */
function errorBff(estado: number, cuerpo: Record<string, unknown>, encabezados: Record<string, string> = {}) {
  return { status: estado, data: { statusCode: estado, data: { success: false, ...cuerpo } }, response: { headers: new Headers(encabezados) } }
}

describe('código por correo: correo y código', () => {
  it('normaliza y valida el correo', () => {
    expect(normalizarCorreo('  Ana@Gmail.COM ')).toBe('ana@gmail.com')
    expect(esCorreoDeAcceso(' Ana@Gmail.com ')).toBe(true)
    for (const malo of ['', 'ana', 'ana@gmail', 'ana @gmail.com', `${'a'.repeat(190)}@x.pe`]) expect(esCorreoDeAcceso(malo), malo).toBe(false)
  })

  it('deja solo los dígitos (pegado con espacios o guiones), como mucho 6', () => {
    expect(normalizarCodigo('123 456')).toBe('123456')
    expect(normalizarCodigo('123-456')).toBe('123456')
    expect(normalizarCodigo('Tu código es 987654.')).toBe('987654')
    expect(normalizarCodigo('12345678')).toBe('123456')
    expect(normalizarCodigo('abc')).toBe('')
  })

  it('código válido: exactamente 6 dígitos', () => {
    expect(esCodigoValido('123456')).toBe(true)
    for (const malo of ['12345', '1234567', '12345a', '123 456', '']) expect(esCodigoValido(malo), malo).toBe(false)
  })

  it('lee la respuesta del BFF con respaldo de 10 min y 60 s', () => {
    expect(codigoSolicitadoDe({ success: true, expiraEnSegundos: 600, reintentarEnSegundos: 60 })).toEqual({ expiraEnSegundos: 600, reintentarEnSegundos: 60 })
    expect(codigoSolicitadoDe({ expiraEnSegundos: 0, reintentarEnSegundos: 30 })).toEqual({ expiraEnSegundos: 600, reintentarEnSegundos: 30 })
    expect(codigoSolicitadoDe(undefined)).toEqual({ expiraEnSegundos: 600, reintentarEnSegundos: 60 })
  })
})

describe('código por correo: esperas', () => {
  it('lee fields.reintentarEnSegundos (texto del backend)', () => {
    expect(segundosParaReintentar(errorBff(429, { code: 'CODE_COOLDOWN', fields: { reintentarEnSegundos: '42' } }), AHORA)).toBe(42)
  })

  it('o el encabezado Retry-After (segundos o fecha HTTP)', () => {
    expect(segundosParaReintentar(errorBff(429, { code: 'RATE_LIMITED' }, { 'Retry-After': '600' }), AHORA)).toBe(600)
    expect(segundosParaReintentar(errorBff(503, { code: 'CODE_LOGIN_PAUSED' }, { 'Retry-After': new Date(AHORA + 120_000).toUTCString() }), AHORA)).toBe(120)
  })

  it('sin espera válida, null', () => {
    expect(segundosParaReintentar(errorBff(401, { code: 'INVALID_CODE', fields: { restantes: '3' } }), AHORA)).toBeNull()
    expect(segundosParaReintentar(errorBff(429, { code: 'CODE_COOLDOWN', fields: { reintentarEnSegundos: 'x' } }), AHORA)).toBeNull()
    expect(segundosParaReintentar(new Error('fetch failed'), AHORA)).toBeNull()
    expect(segundosParaReintentar(null, AHORA)).toBeNull()
  })

  it('cuenta regresiva m:ss y minutos de vida', () => {
    expect(formatoCuentaRegresiva(42)).toBe('0:42')
    expect(formatoCuentaRegresiva(60)).toBe('1:00')
    expect(formatoCuentaRegresiva(3599)).toBe('59:59')
    expect(formatoCuentaRegresiva(-3)).toBe('0:00')
    expect(formatoCuentaRegresiva(Number.NaN)).toBe('0:00')
    expect(minutosDeVida(600)).toBe(10)
    expect(minutosDeVida(20)).toBe(1)
  })

  it('las esperas largas (tope diario de CODE_COOLDOWN, CODE_LOGIN_PAUSED) en horas y minutos, no «833:20»', () => {
    expect(formatoCuentaRegresiva(3600)).toBe('1 h')
    expect(formatoCuentaRegresiva(3601)).toBe('1 h 1 min')
    expect(formatoCuentaRegresiva(5400)).toBe('1 h 30 min')
    expect(formatoCuentaRegresiva(50_000)).toBe('13 h 54 min')
    expect(formatoCuentaRegresiva(86_400)).toBe('24 h')
  })
})

describe('código por correo: errores', () => {
  it('CODE_COOLDOWN pasa al paso del código (hay uno reciente); los demás no', () => {
    expect(pasarAlCodigoTrasError(errorBff(429, { code: 'CODE_COOLDOWN', message: 'Espera' }))).toBe(true)
    expect(pasarAlCodigoTrasError(errorBff(429, { code: 'RATE_LIMITED' }))).toBe(false)
    expect(pasarAlCodigoTrasError(errorBff(503, { code: 'CODE_LOGIN_UNAVAILABLE' }))).toBe(false)
  })

  it('INVALID_CODE dice cuántos intentos quedan', () => {
    expect(mensajeErrorCodigo(errorBff(401, { code: 'INVALID_CODE', message: 'x', fields: { restantes: '3' } }))).toBe('El código no es correcto. Te quedan 3 intentos.')
    expect(mensajeErrorCodigo(errorBff(401, { code: 'INVALID_CODE', message: 'x', fields: { restantes: '1' } }))).toBe('El código no es correcto. Te queda 1 intento.')
    expect(mensajeErrorCodigo(errorBff(401, { code: 'INVALID_CODE', message: 'x', fields: { restantes: '0' } }))).toBe('El código no es correcto y ya no quedan intentos con él. Pide uno nuevo.')
    // Sin fields: el mensaje del servidor
    expect(mensajeErrorCodigo(errorBff(401, { code: 'INVALID_CODE', message: 'El código no es correcto. Pide uno nuevo.' }))).toBe('El código no es correcto. Pide uno nuevo.')
  })

  it('los demás códigos usan los mensajes del panel', () => {
    expect(mensajeErrorCodigo(errorBff(401, { code: 'CODE_EXPIRED', message: 'x' }))).toBe('El código venció o ya no es válido. Pide uno nuevo.')
    expect(mensajeErrorCodigo(errorBff(429, { code: 'CODE_LOCKED', message: 'x' }))).toMatch(/Demasiados intentos con este correo/)
    expect(mensajeErrorCodigo(errorBff(503, { code: 'CODE_LOGIN_PAUSED', message: 'x' }))).toMatch(/pausado por seguridad/)
    expect(mensajeErrorCodigo(errorBff(503, { code: 'CODE_LOGIN_UNAVAILABLE', message: 'x' }))).toMatch(/no está disponible/)
    // CODE_COOLDOWN conserva el texto del servidor (cambia según el tope: minuto, hora o día)
    expect(mensajeErrorCodigo(errorBff(429, { code: 'CODE_COOLDOWN', message: 'Alcanzaste el máximo de códigos por día.' }))).toBe('Alcanzaste el máximo de códigos por día.')
  })
})
