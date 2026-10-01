import { createError, type H3Event } from 'h3'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as accesoCodigo from '../server/utils/acceso-codigo'
import * as jwtPublico from '../server/utils/jwt-publico'
import * as respuestasAuth from '../server/utils/respuestas-auth'
import * as vidaSesion from '../server/utils/vida-sesion'

/**
 * Manejadores del BFF del código por correo y del paso al portal, con las funciones que Nitro importa
 * solas reemplazadas por las reales (puras) o por espías (cookie, encabezados, `$fetch`).
 */
type Manejador = (event: H3Event) => Promise<unknown>

const evento = {} as H3Event
const espias = {
  fetch: vi.fn(),
  guardarSesion: vi.fn(),
  cerrarSesion: vi.fn(),
  olvidarSesion: vi.fn(),
  setResponseStatus: vi.fn(),
  setResponseHeader: vi.fn(),
  tokenDeSesion: vi.fn(),
}
let cuerpo: unknown = null

function instalarGlobales() {
  const globales: Record<string, unknown> = {
    ...accesoCodigo,
    ...respuestasAuth,
    ...vidaSesion,
    esSesionDeParticipante: jwtPublico.esSesionDeParticipante,
    defineEventHandler: (manejador: Manejador) => manejador,
    createError,
    assertSameOrigin: () => undefined,
    readBody: async () => cuerpo,
    backendUrl: (_: H3Event, ruta: string) => `http://backend.test${ruta}`,
    ipCliente: () => '190.12.34.56',
    $fetch: espias.fetch,
    guardarSesion: espias.guardarSesion,
    cerrarSesion: espias.cerrarSesion,
    olvidarSesion: espias.olvidarSesion,
    setResponseStatus: espias.setResponseStatus,
    setResponseHeader: espias.setResponseHeader,
    tokenDeSesion: espias.tokenDeSesion,
  }
  for (const [nombre, valor] of Object.entries(globales)) vi.stubGlobal(nombre, valor)
}

function jwt(payload: unknown): string {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  return `${parte({ alg: 'HS256' })}.${parte(payload)}.firma`
}

function errorHttp(estado: number, data?: unknown, encabezados: Record<string, string> = {}) {
  return Object.assign(new Error(String(estado)), { statusCode: estado, data, response: { headers: new Headers(encabezados) } })
}

/** Error de h3 lanzado por el manejador. */
async function fallo(promesa: Promise<unknown>): Promise<{ statusCode: number, data: { code: string, fields?: Record<string, string> } }> {
  try {
    await promesa
  } catch (error) {
    return error as never
  }
  throw new Error('El manejador no falló')
}

const PARTICIPANTE = { id: 29, nombres: 'ANA', apellidos: 'PÉREZ GARCÍA', correo: 'ana@gmail.com' }
const EN_12_HORAS = () => new Date(Date.now() + 12 * 3600 * 1000).toISOString()
const STAFF = jwt({ aud: 'ciisic-admin', sub: '40' })

let solicitar: Manejador
let verificar: Manejador
let portal: Manejador

beforeAll(async () => {
  instalarGlobales()
  solicitar = (await import('../server/api/auth/codigo/index.post')).default as unknown as Manejador
  verificar = (await import('../server/api/auth/codigo/verificar.post')).default as unknown as Manejador
  portal = (await import('../server/api/auth/portal.post')).default as unknown as Manejador
})

beforeEach(() => {
  for (const espia of Object.values(espias)) espia.mockReset()
  cuerpo = null
  instalarGlobales()
})

describe('POST /api/auth/codigo', () => {
  it('reenvía el correo normalizado con la IP real y responde 202', async () => {
    cuerpo = { correo: ' Ana@Gmail.com ' }
    espias.fetch.mockResolvedValue({ success: true, data: { expiraEnSegundos: 600, reintentarEnSegundos: 60 } })
    expect(await solicitar(evento)).toEqual({ success: true, expiraEnSegundos: 600, reintentarEnSegundos: 60 })
    expect(espias.fetch).toHaveBeenCalledWith('http://backend.test/api/v1/auth/participant/code', {
      method: 'POST',
      body: { correo: 'ana@gmail.com' },
      headers: { 'x-forwarded-for': '190.12.34.56' },
    })
    expect(espias.setResponseStatus).toHaveBeenCalledWith(evento, 202)
  })

  it('correo inválido: 422 sin llamar al backend', async () => {
    cuerpo = { correo: 'ana' }
    const error = await fallo(solicitar(evento))
    expect(error.statusCode).toBe(422)
    expect(error.data.code).toBe('VALIDATION_ERROR')
    expect(espias.fetch).not.toHaveBeenCalled()
  })

  it('429 CODE_COOLDOWN: propaga el código, fields y Retry-After', async () => {
    cuerpo = { correo: 'ana@gmail.com' }
    espias.fetch.mockRejectedValue(errorHttp(429, { success: false, code: 'CODE_COOLDOWN', message: 'Espera', fields: { reintentarEnSegundos: '42' } }, { 'Retry-After': '42' }))
    const error = await fallo(solicitar(evento))
    expect(error.statusCode).toBe(429)
    expect(error.data).toMatchObject({ code: 'CODE_COOLDOWN', fields: { reintentarEnSegundos: '42' } })
    expect(espias.setResponseHeader).toHaveBeenCalledWith(evento, 'Retry-After', 42)
  })

  it('backend 013 (sin la ruta): 503 CODE_LOGIN_UNAVAILABLE', async () => {
    cuerpo = { correo: 'ana@gmail.com' }
    espias.fetch.mockRejectedValue(errorHttp(404, { success: false, code: 'NOT_FOUND', message: 'Ruta no encontrada' }))
    const error = await fallo(solicitar(evento))
    expect(error.statusCode).toBe(503)
    expect(error.data.code).toBe('CODE_LOGIN_UNAVAILABLE')
  })
})

describe('POST /api/auth/codigo/verificar', () => {
  it('guarda la sesión de participante por 12 h y olvida la de staff anterior', async () => {
    cuerpo = { correo: 'ana@gmail.com', codigo: '123 456' }
    espias.tokenDeSesion.mockReturnValue(STAFF)
    espias.fetch.mockResolvedValue({ success: true, data: { jwt: 'jwt-p', tipo: 'PARTICIPANTE', participante: PARTICIPANTE, expiraEn: EN_12_HORAS() } })
    expect(await verificar(evento)).toEqual({ success: true, tipo: 'PARTICIPANTE', participante: PARTICIPANTE })
    expect(espias.fetch).toHaveBeenCalledWith('http://backend.test/api/v1/auth/participant/code/verify', {
      method: 'POST',
      body: { correo: 'ana@gmail.com', codigo: '123456' },
      headers: { 'x-forwarded-for': '190.12.34.56' },
    })
    expect(espias.olvidarSesion).toHaveBeenCalledWith(STAFF)
    const [, token, vida] = espias.guardarSesion.mock.calls[0] ?? []
    expect(token).toBe('jwt-p')
    expect(vida).toBeGreaterThan(12 * 3600 - 5)
    expect(vida).toBeLessThanOrEqual(12 * 3600)
  })

  it('INVALID_CODE: propaga los intentos que quedan y no toca la cookie', async () => {
    cuerpo = { correo: 'ana@gmail.com', codigo: '000000' }
    espias.fetch.mockRejectedValue(errorHttp(401, { success: false, code: 'INVALID_CODE', message: 'No', fields: { restantes: '4' } }))
    const error = await fallo(verificar(evento))
    expect(error.statusCode).toBe(401)
    expect(error.data).toMatchObject({ code: 'INVALID_CODE', fields: { restantes: '4' } })
    expect(espias.guardarSesion).not.toHaveBeenCalled()
    expect(espias.cerrarSesion).not.toHaveBeenCalled()
  })

  it('código mal formado: 422 sin llamar al backend', async () => {
    cuerpo = { correo: 'ana@gmail.com', codigo: '12a' }
    expect((await fallo(verificar(evento))).data.code).toBe('VALIDATION_ERROR')
    expect(espias.fetch).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/portal', () => {
  it('canjea el Bearer del staff por la sesión de participante', async () => {
    espias.tokenDeSesion.mockReturnValue(STAFF)
    espias.fetch.mockResolvedValue({ success: true, data: { jwt: 'jwt-p', tipo: 'PARTICIPANTE', participante: PARTICIPANTE, expiraEn: EN_12_HORAS() } })
    expect(await portal(evento)).toEqual({ success: true, tipo: 'PARTICIPANTE', participante: PARTICIPANTE })
    expect(espias.fetch).toHaveBeenCalledWith('http://backend.test/api/v1/auth/participant/switch', { method: 'POST', headers: { authorization: `Bearer ${STAFF}` } })
    expect(espias.olvidarSesion).toHaveBeenCalledWith(STAFF)
    expect(espias.guardarSesion.mock.calls[0]?.[1]).toBe('jwt-p')
  })

  it('409 CODE_REQUIRED se propaga y conserva la sesión del staff', async () => {
    espias.tokenDeSesion.mockReturnValue(STAFF)
    espias.fetch.mockRejectedValue(errorHttp(409, { success: false, code: 'CODE_REQUIRED', message: 'Pide un código' }))
    const error = await fallo(portal(evento))
    expect(error.statusCode).toBe(409)
    expect(error.data.code).toBe('CODE_REQUIRED')
    expect(espias.guardarSesion).not.toHaveBeenCalled()
    expect(espias.cerrarSesion).not.toHaveBeenCalled()
  })

  it('401 del backend cierra la sesión', async () => {
    espias.tokenDeSesion.mockReturnValue(STAFF)
    espias.fetch.mockRejectedValue(errorHttp(401, { success: false, code: 'SESSION_INVALIDATED', message: 'Cerrada' }))
    expect((await fallo(portal(evento))).statusCode).toBe(401)
    expect(espias.cerrarSesion).toHaveBeenCalled()
    expect(espias.olvidarSesion).toHaveBeenCalledWith(STAFF)
  })

  it('sin sesión, 401; con sesión de participante, 403; backend 013, 503', async () => {
    espias.tokenDeSesion.mockReturnValue(undefined)
    expect((await fallo(portal(evento))).statusCode).toBe(401)
    espias.tokenDeSesion.mockReturnValue(jwt({ aud: 'ciisic-participante' }))
    expect((await fallo(portal(evento))).data.code).toBe('FORBIDDEN_PROFILE')
    expect(espias.fetch).not.toHaveBeenCalled()
    espias.tokenDeSesion.mockReturnValue(STAFF)
    espias.fetch.mockRejectedValue(errorHttp(404, { success: false, code: 'NOT_FOUND', message: 'Ruta no encontrada' }))
    const error = await fallo(portal(evento))
    expect(error.statusCode).toBe(503)
    expect(error.data.code).toBe('PORTAL_SWITCH_UNAVAILABLE')
  })
})
