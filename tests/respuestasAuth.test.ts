import { describe, expect, it } from 'vitest'
import { consultarSesion, cuerpoSesion, errorLogin, estadoHttp, SESION_NO_DISPONIBLE, SIN_SESION } from '../server/utils/respuestas-auth'

const USUARIO = { id: 40, nombres: 'Rosa', rolCodigo: 'COMISION', acceso: { alcance: 'EVENTO', permisos: ['asistencia.marcar', 'asistencia.ver'], eventoIds: [2] } }
const PARTICIPANTE = { id: 7, nombres: 'Luis' }

/** Error como el de `$fetch` (ofetch) con el estado del backend. */
const errorHttp = (estado: number) => Object.assign(new Error(String(estado)), { statusCode: estado, status: estado })

describe('BFF: estado de los errores del backend', () => {
  it('lee statusCode o status; sin respuesta (red), undefined', () => {
    expect(estadoHttp(errorHttp(503))).toBe(503)
    expect(estadoHttp({ status: 401 })).toBe(401)
    expect(estadoHttp(new TypeError('fetch failed'))).toBeUndefined()
    expect(estadoHttp({ statusCode: 0 })).toBeUndefined()
    expect(estadoHttp(null)).toBeUndefined()
  })
})

describe('BFF: GET /api/auth/session', () => {
  it('staff con su acceso o inscrito', () => {
    expect(cuerpoSesion({ success: true, tipo: 'ADMIN', user: USUARIO })).toEqual({ authenticated: true, tipo: 'ADMIN', user: USUARIO, participante: null })
    expect(cuerpoSesion({ success: true, tipo: 'PARTICIPANTE', participante: PARTICIPANTE }))
      .toEqual({ authenticated: true, tipo: 'PARTICIPANTE', user: null, participante: PARTICIPANTE })
    // Sin tipo (forma anterior) se deduce de los datos
    expect(cuerpoSesion({ participante: PARTICIPANTE }).tipo).toBe('PARTICIPANTE')
    expect(cuerpoSesion({ user: USUARIO }).tipo).toBe('ADMIN')
  })

  it('vigente: devuelve la sesión', async () => {
    expect(await consultarSesion(async () => ({ success: true, tipo: 'ADMIN', user: USUARIO })))
      .toEqual({ estado: 'VIGENTE', cuerpo: { authenticated: true, tipo: 'ADMIN', user: USUARIO, participante: null } })
  })

  it('un 401 (SESSION_INVALIDATED, token caducado) cierra la sesión', async () => {
    expect(await consultarSesion(() => Promise.reject(errorHttp(401)))).toEqual({ estado: 'CERRADA' })
  })

  it('5xx, 429 o la red caída no cierran la sesión: 503 SESSION_UNAVAILABLE', async () => {
    for (const error of [errorHttp(500), errorHttp(502), errorHttp(503), errorHttp(429), new TypeError('fetch failed')]) {
      expect(await consultarSesion(() => Promise.reject(error)), error.message).toEqual({ estado: 'NO_DISPONIBLE' })
    }
    expect(SESION_NO_DISPONIBLE.statusCode).toBe(503)
    expect(SESION_NO_DISPONIBLE.data.code).toBe('SESSION_UNAVAILABLE')
  })

  it('sin sesión: authenticated false', () => {
    expect(SIN_SESION).toEqual({ authenticated: false, tipo: null, user: null, participante: null })
  })
})

describe('BFF: POST /api/auth/login', () => {
  it('credenciales rechazadas: 401 INVALID_CREDENTIALS', () => {
    for (const estado of [401, 403, 400, 422]) {
      expect(errorLogin(estado), String(estado)).toMatchObject({ statusCode: 401, data: { code: 'INVALID_CREDENTIALS' } })
    }
  })

  it('demasiados intentos: 429', () => {
    expect(errorLogin(429)).toMatchObject({ statusCode: 429, data: { code: 'RATE_LIMITED' } })
  })

  it('backend caído (5xx o sin respuesta): 503, no «contraseña incorrecta»', () => {
    for (const estado of [500, 502, 503, undefined]) {
      expect(errorLogin(estado), String(estado)).toMatchObject({ statusCode: 503, data: { code: 'LOGIN_UNAVAILABLE' } })
    }
  })
})
