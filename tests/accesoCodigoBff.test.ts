import { describe, expect, it } from 'vitest'
import {
  accesoCodigoDisponible,
  codigoDeSolicitud,
  codigoSolicitadoDe,
  correoDeSolicitud,
  errorValidacion,
  RESPALDO_CODIGO,
  RESPALDO_PORTAL,
  sesionParticipanteDe,
} from '../server/utils/acceso-codigo'
import { errorPropagado, segundosDeEspera } from '../server/utils/respuestas-auth'
import { vidaSesionSegundos } from '../server/utils/vida-sesion'

const AHORA = Date.parse('2026-10-26T15:00:00.000Z')

/** Error como el de `$fetch` (ofetch): estado, cuerpo del backend y la `Response` con sus encabezados. */
function errorHttp(estado: number, data?: unknown, encabezados: Record<string, string> = {}) {
  return Object.assign(new Error(String(estado)), { statusCode: estado, status: estado, data, response: { headers: new Headers(encabezados) } })
}

describe('BFF del código: datos de la petición', () => {
  it('correo recortado y en minúsculas; inválido o enorme, null', () => {
    expect(correoDeSolicitud('  Ana@Gmail.com ')).toBe('ana@gmail.com')
    expect(correoDeSolicitud('ana@undc.edu.pe')).toBe('ana@undc.edu.pe')
    for (const malo of ['', 'ana', 'ana@', '@gmail.com', 'ana gmail@x.com', 42, null, undefined, `${'a'.repeat(190)}@x.pe`]) {
      expect(correoDeSolicitud(malo), String(malo)).toBeNull()
    }
  })

  it('código de 6 dígitos sin espacios ni guiones', () => {
    expect(codigoDeSolicitud('123456')).toBe('123456')
    expect(codigoDeSolicitud('123 456')).toBe('123456')
    expect(codigoDeSolicitud('123-456')).toBe('123456')
    for (const malo of ['12345', '1234567', 'abcdef', '12345a', '', 123456, null, ' '.repeat(40)]) {
      expect(codigoDeSolicitud(malo), String(malo)).toBeNull()
    }
  })

  it('422 de validación con el campo', () => {
    expect(errorValidacion({ correo: 'Ingresa un correo válido.' })).toEqual({
      statusCode: 422,
      data: { success: false, code: 'VALIDATION_ERROR', message: 'Ingresa un correo válido.', fields: { correo: 'Ingresa un correo válido.' } },
      reintentarEnSegundos: null,
    })
  })
})

describe('BFF del código: respuestas del backend', () => {
  it('202: vida del código y espera (con respaldo de 600 y 60 s)', () => {
    expect(codigoSolicitadoDe({ success: true, data: { expiraEnSegundos: 600, reintentarEnSegundos: 60 } })).toEqual({ expiraEnSegundos: 600, reintentarEnSegundos: 60 })
    expect(codigoSolicitadoDe({ data: { expiraEnSegundos: 300.2, reintentarEnSegundos: 'x' } })).toEqual({ expiraEnSegundos: 301, reintentarEnSegundos: 60 })
    expect(codigoSolicitadoDe(null)).toEqual({ expiraEnSegundos: 600, reintentarEnSegundos: 60 })
  })

  it('sesión de participante de verify o switch; sin JWT o de staff, null', () => {
    const participante = { id: 29, nombres: 'ANA', apellidos: 'PÉREZ', correo: 'ana@gmail.com' }
    const respuesta = { success: true, data: { jwt: 'a.b.c', tipo: 'PARTICIPANTE', participante, expiraEn: '2026-10-27T03:00:00.000Z' } }
    expect(sesionParticipanteDe(respuesta)).toEqual({ jwt: 'a.b.c', participante, expiraEn: '2026-10-27T03:00:00.000Z' })
    expect(sesionParticipanteDe({ data: { jwt: 'a.b.c', participante } })?.jwt).toBe('a.b.c')
    expect(sesionParticipanteDe({ data: { jwt: 'a.b.c', tipo: 'ADMIN', participante } })).toBeNull()
    expect(sesionParticipanteDe({ data: { jwt: '', participante } })).toBeNull()
    expect(sesionParticipanteDe({ data: { jwt: 'a.b.c' } })).toBeNull()
    expect(sesionParticipanteDe(undefined)).toBeNull()
  })

  it('la cookie del participante dura las 12 h del JWT', () => {
    expect(vidaSesionSegundos('2026-10-27T03:00:00.000Z', AHORA)).toBe(12 * 3600)
  })

  it('accesoCodigo.disponible solo si el backend lo informa en true (el 013 no lo envía)', () => {
    expect(accesoCodigoDisponible({ success: true, data: { google: { clientId: 'x' }, accesoCodigo: { disponible: true } } })).toBe(true)
    expect(accesoCodigoDisponible({ data: { accesoCodigo: { disponible: false } } })).toBe(false)
    expect(accesoCodigoDisponible({ data: { google: { clientId: 'x' }, urlPanel: 'https://panel' } })).toBe(false)
    expect(accesoCodigoDisponible({ data: { accesoCodigo: { disponible: 'true' } } })).toBe(false)
    expect(accesoCodigoDisponible(null)).toBe(false)
  })
})

describe('BFF: espera de Retry-After o fields', () => {
  it('segundos (texto o número) o fecha HTTP; si no, null', () => {
    expect(segundosDeEspera('42', AHORA)).toBe(42)
    expect(segundosDeEspera(42.1, AHORA)).toBe(43)
    expect(segundosDeEspera(new Date(AHORA + 90_000).toUTCString(), AHORA)).toBe(90)
    expect(segundosDeEspera('0', AHORA)).toBeNull()
    expect(segundosDeEspera('-5', AHORA)).toBeNull()
    expect(segundosDeEspera('pronto', AHORA)).toBeNull()
    expect(segundosDeEspera(new Date(AHORA - 1000).toUTCString(), AHORA)).toBeNull()
    expect(segundosDeEspera(undefined, AHORA)).toBeNull()
  })
})

describe('BFF: errores propagados del backend', () => {
  it('propaga estado, código, mensaje y fields', () => {
    const error = errorHttp(401, { success: false, code: 'INVALID_CODE', message: 'El código no es correcto. Te quedan 3 intentos.', fields: { restantes: '3' } })
    expect(errorPropagado(error, RESPALDO_CODIGO, AHORA)).toEqual({
      statusCode: 401,
      data: { success: false, code: 'INVALID_CODE', message: 'El código no es correcto. Te quedan 3 intentos.', fields: { restantes: '3' } },
      reintentarEnSegundos: null,
    })
  })

  it('429 CODE_COOLDOWN: la espera de fields y de Retry-After', () => {
    const conCampos = errorHttp(429, { code: 'CODE_COOLDOWN', message: 'Espera un momento antes de pedir otro código.', fields: { reintentarEnSegundos: '42' } }, { 'Retry-After': '42' })
    expect(errorPropagado(conCampos, RESPALDO_CODIGO, AHORA)).toMatchObject({
      statusCode: 429,
      data: { code: 'CODE_COOLDOWN', fields: { reintentarEnSegundos: '42' } },
      reintentarEnSegundos: 42,
    })
    // RATE_LIMITED del limitador: solo Retry-After; el BFF lo agrega a fields
    const soloEncabezado = errorHttp(429, { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes.' }, { 'Retry-After': '600' })
    expect(errorPropagado(soloEncabezado, RESPALDO_CODIGO, AHORA)).toMatchObject({
      statusCode: 429,
      data: { code: 'RATE_LIMITED', fields: { reintentarEnSegundos: '600' } },
      reintentarEnSegundos: 600,
    })
    // Un limitador sin cuerpo JSON
    expect(errorPropagado(errorHttp(429, 'Too many requests'), RESPALDO_CODIGO, AHORA).data.code).toBe('RATE_LIMITED')
  })

  it('503 de negocio (CODE_LOGIN_PAUSED, CODE_LOGIN_UNAVAILABLE) se conserva con su espera', () => {
    const error = errorHttp(503, { code: 'CODE_LOGIN_PAUSED', message: 'Pausado' }, { 'Retry-After': '3600' })
    expect(errorPropagado(error, RESPALDO_CODIGO, AHORA)).toMatchObject({ statusCode: 503, data: { code: 'CODE_LOGIN_PAUSED', message: 'Pausado' }, reintentarEnSegundos: 3600 })
  })

  it('backend caído, 5xx sin código o la ruta inexistente (backend 013): 503 con el respaldo', () => {
    for (const error of [new TypeError('fetch failed'), errorHttp(500, { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' }), errorHttp(502), errorHttp(503)]) {
      expect(errorPropagado(error, RESPALDO_CODIGO, AHORA)).toEqual({ statusCode: 503, data: { success: false, ...RESPALDO_CODIGO }, reintentarEnSegundos: null })
    }
    // El backend 013 no tiene /auth/participant/*: 404 «Ruta no encontrada»
    const sinRuta = errorHttp(404, { success: false, code: 'NOT_FOUND', message: 'Ruta no encontrada' })
    expect(errorPropagado(sinRuta, RESPALDO_PORTAL, AHORA)).toEqual({ statusCode: 503, data: { success: false, ...RESPALDO_PORTAL }, reintentarEnSegundos: null })
    expect(errorPropagado(errorHttp(405), RESPALDO_PORTAL, AHORA).data.code).toBe('PORTAL_SWITCH_UNAVAILABLE')
  })

  it('el paso al portal propaga CODE_REQUIRED, PARTICIPANT_NOT_FOUND, GOOGLE_ACCOUNT_MISMATCH y 401', () => {
    expect(errorPropagado(errorHttp(409, { code: 'CODE_REQUIRED', message: 'Pide un código' }), RESPALDO_PORTAL, AHORA)).toMatchObject({ statusCode: 409, data: { code: 'CODE_REQUIRED' } })
    expect(errorPropagado(errorHttp(404, { code: 'PARTICIPANT_NOT_FOUND', message: 'No' }), RESPALDO_PORTAL, AHORA)).toMatchObject({ statusCode: 404, data: { code: 'PARTICIPANT_NOT_FOUND' } })
    expect(errorPropagado(errorHttp(403, { code: 'GOOGLE_ACCOUNT_MISMATCH', message: 'Otra' }), RESPALDO_PORTAL, AHORA)).toMatchObject({ statusCode: 403, data: { code: 'GOOGLE_ACCOUNT_MISMATCH' } })
    expect(errorPropagado(errorHttp(401, { code: 'SESSION_INVALIDATED', message: 'Cerrada' }), RESPALDO_PORTAL, AHORA)).toMatchObject({ statusCode: 401, data: { code: 'SESSION_INVALIDATED' } })
  })

  it('descarta fields que no son texto', () => {
    const error = errorHttp(422, { code: 'VALIDATION_ERROR', message: 'Datos', fields: { correo: 'Inválido', otro: { anidado: true } } })
    expect(errorPropagado(error, RESPALDO_CODIGO, AHORA).data.fields).toEqual({ correo: 'Inválido' })
  })
})
