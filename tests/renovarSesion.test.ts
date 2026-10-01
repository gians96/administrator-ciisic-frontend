import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { esSesionDeStaff } from '../server/utils/jwt-publico'
import {
  crearRenovador,
  debeRenovar,
  descartarRenovacionSiSeCerro,
  esRenovable,
  fallaRenovacion,
  MARGEN_RENOVACION_SEGUNDOS,
  olvidarSesion,
  recordarHasta,
  renovacionDe,
  renovarSiHaceFalta,
  sesionCerrada,
  sinCookie,
  VIDA_RENOVACION_COMPARTIDA_MS,
  type ResultadoRenovacion,
} from '../server/utils/renovar-sesion'

const AHORA = Date.parse('2026-10-26T15:00:00.000Z')
const AHORA_S = AHORA / 1000

function jwt(payload: unknown): string {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  return `${parte({ alg: 'HS256', typ: 'JWT' })}.${parte(payload)}.firma-no-verificada`
}

/** Promesa que se resuelve a mano (renovación en curso). */
function pendiente<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((r) => { resolver = r })
  return { promesa, resolver }
}

describe('renovación de la sesión del staff', () => {
  it('renueva cuando quedan menos de 20 minutos', () => {
    expect(MARGEN_RENOVACION_SEGUNDOS).toBe(20 * 60)
    expect(debeRenovar(AHORA_S + 19 * 60, AHORA)).toBe(true)
    expect(debeRenovar(AHORA_S + 60, AHORA)).toBe(true)
    expect(debeRenovar(AHORA_S + 1, AHORA)).toBe(true)
  })

  it('no renueva si aún queda tiempo de sobra', () => {
    expect(debeRenovar(AHORA_S + 20 * 60, AHORA)).toBe(false)
    expect(debeRenovar(AHORA_S + 3600, AHORA)).toBe(false)
  })

  it('no renueva un JWT caducado ni sin exp válido', () => {
    expect(debeRenovar(AHORA_S, AHORA)).toBe(false)
    expect(debeRenovar(AHORA_S - 60, AHORA)).toBe(false)
    for (const exp of [undefined, null, '1790000000', Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      expect(debeRenovar(exp, AHORA), String(exp)).toBe(false)
    }
  })

  it('solo las sesiones de staff (audiencia ciisic-admin) se renuevan', () => {
    expect(esSesionDeStaff(jwt({ aud: 'ciisic-admin' }))).toBe(true)
    expect(esSesionDeStaff(jwt({ aud: ['ciisic-admin'] }))).toBe(true)
    expect(esSesionDeStaff(jwt({ aud: 'ciisic-participante' }))).toBe(false)
    expect(esSesionDeStaff(jwt({ user: { id: 1 } }))).toBe(false)
    expect(esSesionDeStaff('no-es-un-jwt')).toBe(false)
    expect(esSesionDeStaff(undefined)).toBe(false)
  })
})

describe('renovación: respuesta del backend', () => {
  it('toma el JWT nuevo; sin él es un fallo pasajero', () => {
    expect(renovacionDe({ success: true, data: { jwt: 'nuevo', expiraEn: '2026-10-26T16:00:00.000Z' } }))
      .toEqual({ jwt: 'nuevo', expiraEn: '2026-10-26T16:00:00.000Z' })
    for (const respuesta of [null, {}, { data: {} }, { data: { jwt: '' } }, { data: { jwt: 3 } }]) {
      expect(renovacionDe(respuesta), JSON.stringify(respuesta)).toBe('NO_DISPONIBLE')
    }
  })

  it('401 (SESSION_EXPIRED, SESSION_INVALIDATED) y 403 son definitivos; 429, 5xx y la red, pasajeros', () => {
    expect(fallaRenovacion(401)).toBe('RECHAZADA')
    expect(fallaRenovacion(403)).toBe('RECHAZADA')
    for (const estado of [429, 500, 502, 503, undefined]) expect(fallaRenovacion(estado), String(estado)).toBe('NO_DISPONIBLE')
  })

  it('un rechazo se recuerda hasta que el JWT caduca; lo demás, 60 s', () => {
    const exp = AHORA_S + 15 * 60
    expect(recordarHasta('RECHAZADA', exp, AHORA)).toBe(exp * 1000)
    expect(recordarHasta('NO_DISPONIBLE', exp, AHORA)).toBe(AHORA + VIDA_RENOVACION_COMPARTIDA_MS)
    expect(recordarHasta({ jwt: 'x', expiraEn: null }, exp, AHORA)).toBe(AHORA + VIDA_RENOVACION_COMPARTIDA_MS)
    // Nunca menos de 60 s, ni sin exp válido
    expect(recordarHasta('RECHAZADA', AHORA_S + 10, AHORA)).toBe(AHORA + VIDA_RENOVACION_COMPARTIDA_MS)
    expect(recordarHasta('RECHAZADA', undefined, AHORA)).toBe(AHORA + 3600 * 1000)
  })
})

describe('renovación: peticiones simultáneas y reintentos', () => {
  const exp = AHORA_S + 10 * 60

  it('las peticiones simultáneas con el mismo JWT comparten una sola renovación', async () => {
    const renovador = crearRenovador(() => AHORA)
    const respuesta = pendiente<ResultadoRenovacion>()
    const pedir = vi.fn(() => respuesta.promesa)
    const a = renovador.renovar('jwt-a', exp, pedir)
    const b = renovador.renovar('jwt-a', exp, pedir)
    respuesta.resolver({ jwt: 'jwt-a2', expiraEn: 3600 })
    expect(await a).toEqual({ jwt: 'jwt-a2', expiraEn: 3600 })
    expect(await b).toEqual({ jwt: 'jwt-a2', expiraEn: 3600 })
    // Una petición que llega dentro de los 60 s con el JWT anterior reutiliza la misma renovación
    expect(await renovador.renovar('jwt-a', exp, pedir)).toEqual({ jwt: 'jwt-a2', expiraEn: 3600 })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('tras el tope de 12 h (401) no vuelve a pedir la renovación con ese JWT', async () => {
    let ahora = AHORA
    const renovador = crearRenovador(() => ahora)
    const pedir = vi.fn(async (): Promise<ResultadoRenovacion> => 'RECHAZADA')
    expect(await renovador.renovar('jwt-b', exp, pedir)).toBeNull()
    for (const minutos of [1, 2, 5, 9]) {
      ahora = AHORA + minutos * 60_000
      expect(await renovador.renovar('jwt-b', exp, pedir)).toBeNull()
    }
    expect(pedir).toHaveBeenCalledTimes(1)
    // Pasada su caducidad la entrada se descarta (ese JWT ya no se intentaría renovar)
    ahora = exp * 1000 + 1
    await renovador.renovar('otro', exp + 3600, async () => 'NO_DISPONIBLE')
    expect(renovador.tamano()).toBe(1)
  })

  it('un fallo pasajero (429, backend caído) se reintenta a los 60 s', async () => {
    let ahora = AHORA
    const renovador = crearRenovador(() => ahora)
    const pedir = vi.fn(async (): Promise<ResultadoRenovacion> => 'NO_DISPONIBLE')
    expect(await renovador.renovar('jwt-c', exp, pedir)).toBeNull()
    ahora = AHORA + 30_000
    await renovador.renovar('jwt-c', exp, pedir)
    expect(pedir).toHaveBeenCalledTimes(1)
    ahora = AHORA + VIDA_RENOVACION_COMPARTIDA_MS
    await renovador.renovar('jwt-c', exp, pedir)
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('un error inesperado al pedir cuenta como fallo pasajero', async () => {
    const renovador = crearRenovador(() => AHORA)
    expect(await renovador.renovar('jwt-d', exp, () => Promise.reject(new Error('red')))).toBeNull()
  })
})

describe('renovación: cierre de sesión', () => {
  const exp = AHORA_S + 10 * 60

  it('una renovación en curso no revive una sesión cerrada', async () => {
    const renovador = crearRenovador(() => AHORA)
    const respuesta = pendiente<ResultadoRenovacion>()
    const enCurso = renovador.renovar('jwt-e', exp, () => respuesta.promesa)
    renovador.cerrar('jwt-e', exp)
    respuesta.resolver({ jwt: 'jwt-e2', expiraEn: 3600 })
    expect(await enCurso).toBeNull()
  })

  it('tras cerrar, ni la renovación compartida ni una nueva se usan con ese JWT', async () => {
    const renovador = crearRenovador(() => AHORA)
    const pedir = vi.fn(async (): Promise<ResultadoRenovacion> => ({ jwt: 'jwt-f2', expiraEn: 3600 }))
    expect(await renovador.renovar('jwt-f', exp, pedir)).not.toBeNull()
    renovador.cerrar('jwt-f', exp)
    expect(await renovador.renovar('jwt-f', exp, pedir)).toBeNull()
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('cerrar con el JWT ya renovado tampoco deja que el anterior reutilice la renovación', async () => {
    const renovador = crearRenovador(() => AHORA)
    const pedir = vi.fn(async (): Promise<ResultadoRenovacion> => ({ jwt: 'jwt-k2', expiraEn: 3600 }))
    expect(await renovador.renovar('jwt-k', exp, pedir)).toEqual({ jwt: 'jwt-k2', expiraEn: 3600 })
    // La cookie ya tenía el renovado al cerrar sesión; llega tarde una petición con el anterior
    renovador.cerrar('jwt-k2', exp + 3600)
    expect(await renovador.renovar('jwt-k', exp, pedir)).toBeNull()
  })
})

describe('renovarSiHaceFalta (BFF)', () => {
  const setCookie = vi.fn()
  const fetchBackend = vi.fn()
  const evento = {} as H3Event

  function preparar() {
    setCookie.mockReset()
    fetchBackend.mockReset()
    vi.stubGlobal('useRuntimeConfig', () => ({ backendBaseUrl: 'http://backend.test/' }))
    vi.stubGlobal('setCookie', setCookie)
    vi.stubGlobal('$fetch', fetchBackend)
  }

  afterEach(() => vi.unstubAllGlobals())

  const jwtStaff = (sufijo: string, minutos: number) => jwt({ aud: 'ciisic-admin', sub: sufijo, exp: Math.floor(Date.now() / 1000) + minutos * 60 })

  it('guarda el JWT renovado en la cookie y lo usa', async () => {
    preparar()
    const token = jwtStaff('g', 10)
    fetchBackend.mockResolvedValue({ success: true, data: { jwt: 'jwt-g2', expiraEn: 3600 } })
    expect(await renovarSiHaceFalta(evento, token)).toBe('jwt-g2')
    expect(fetchBackend).toHaveBeenCalledWith('http://backend.test/api/v1/auth/refresh', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    expect(setCookie).toHaveBeenCalledWith(evento, 'ciisic_admin_session', 'jwt-g2', expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 3600 }))
  })

  it('solo la sesión del staff es renovable (la del participante dura 12 h y no se renueva)', () => {
    expect(esRenovable(jwt({ aud: 'ciisic-admin' }))).toBe(true)
    expect(esRenovable(jwt({ aud: 'ciisic-participante' }))).toBe(false)
    expect(esRenovable(jwt({ aud: ['ciisic-admin', 'ciisic-participante'] }))).toBe(false)
    expect(esRenovable(jwt({}))).toBe(false)
    expect(esRenovable(undefined)).toBe(false)
  })

  it('no renueva si sobra tiempo ni las sesiones de inscrito', async () => {
    preparar()
    const holgado = jwtStaff('h', 45)
    const inscrito = jwt({ aud: 'ciisic-participante', exp: Math.floor(Date.now() / 1000) + 300 })
    expect(await renovarSiHaceFalta(evento, holgado)).toBe(holgado)
    expect(await renovarSiHaceFalta(evento, inscrito)).toBe(inscrito)
    expect(fetchBackend).not.toHaveBeenCalled()
  })

  it('ante un 401 sigue con el JWT actual y no lo vuelve a intentar', async () => {
    preparar()
    const token = jwtStaff('i', 10)
    fetchBackend.mockRejectedValue(Object.assign(new Error('401'), { statusCode: 401, data: { code: 'SESSION_EXPIRED' } }))
    expect(await renovarSiHaceFalta(evento, token)).toBe(token)
    expect(await renovarSiHaceFalta(evento, token)).toBe(token)
    expect(fetchBackend).toHaveBeenCalledTimes(1)
    expect(setCookie).not.toHaveBeenCalled()
  })

  it('tras cerrar sesión no renueva ni guarda la cookie con ese JWT', async () => {
    preparar()
    const token = jwtStaff('j', 10)
    let responder!: (valor: unknown) => void
    fetchBackend.mockReturnValue(new Promise((r) => { responder = r }))
    const enCurso = renovarSiHaceFalta(evento, token)
    olvidarSesion(token)
    responder({ success: true, data: { jwt: 'jwt-j2', expiraEn: 3600 } })
    expect(await enCurso).toBe(token)
    expect(await renovarSiHaceFalta(evento, token)).toBe(token)
    expect(setCookie).not.toHaveBeenCalled()
    expect(fetchBackend).toHaveBeenCalledTimes(1)
  })
})

describe('renovación: sesión cerrada mientras se respondía', () => {
  const exp = AHORA_S + 10 * 60

  it('recuerda las sesiones cerradas hasta que su JWT caduca', () => {
    let ahora = AHORA
    const renovador = crearRenovador(() => ahora)
    expect(renovador.estaCerrada('jwt-m')).toBe(false)
    renovador.cerrar('jwt-m', exp)
    expect(renovador.estaCerrada('jwt-m')).toBe(true)
    ahora = exp * 1000 + 1
    expect(renovador.estaCerrada('jwt-m')).toBe(false)
  })

  it('quita solo la cookie de la sesión de los Set-Cookie', () => {
    expect(sinCookie(['ciisic_admin_session=jwt; Path=/; HttpOnly', 'otra=1; Path=/'], 'ciisic_admin_session')).toEqual(['otra=1; Path=/'])
    expect(sinCookie([' ciisic_admin_session=; Max-Age=0'], 'ciisic_admin_session')).toEqual([])
    expect(sinCookie(['ciisic_admin_session_x=1'], 'ciisic_admin_session')).toEqual(['ciisic_admin_session_x=1'])
  })

  function respuesta(setCookie: string | string[] | undefined) {
    const cabeceras = new Map<string, unknown>(setCookie === undefined ? [] : [['set-cookie', setCookie]])
    const res = {
      getHeader: (nombre: string) => cabeceras.get(nombre),
      setHeader: (nombre: string, valor: unknown) => { cabeceras.set(nombre, valor) },
      removeHeader: (nombre: string) => { cabeceras.delete(nombre) },
    }
    return { evento: { node: { res } } as unknown as H3Event, cabeceras }
  }

  const staff = (sufijo: string) => jwt({ aud: 'ciisic-admin', sub: sufijo, exp: Math.floor(Date.now() / 1000) + 600 })

  it('el staff pasó al portal mientras se renovaba: la respuesta tardía no le devuelve la cookie del staff', () => {
    const anterior = staff('n')
    const { evento, cabeceras } = respuesta(['ciisic_admin_session=jwt-n2; Path=/; HttpOnly'])
    // /api/auth/portal cerró la sesión del staff (olvidarSesion) antes de que esta respuesta saliera
    olvidarSesion(anterior)
    expect(sesionCerrada(anterior)).toBe(true)
    descartarRenovacionSiSeCerro(evento, anterior, 'jwt-n2')
    expect(cabeceras.has('set-cookie')).toBe(false)
  })

  it('también si al cerrar la cookie ya tenía el JWT renovado; y conserva otras cookies', () => {
    const anterior = staff('o')
    const renovado = staff('o2')
    const { evento, cabeceras } = respuesta([`ciisic_admin_session=${renovado}; Path=/`, 'otra=1'])
    olvidarSesion(renovado)
    descartarRenovacionSiSeCerro(evento, anterior, renovado)
    expect(cabeceras.get('set-cookie')).toEqual(['otra=1'])
  })

  it('sin cierre, o sin renovación en esta petición, no toca la respuesta', () => {
    const anterior = staff('p')
    const { evento, cabeceras } = respuesta('ciisic_admin_session=jwt-p2; Path=/')
    descartarRenovacionSiSeCerro(evento, anterior, 'jwt-p2')
    expect(cabeceras.get('set-cookie')).toBe('ciisic_admin_session=jwt-p2; Path=/')
    olvidarSesion(anterior)
    descartarRenovacionSiSeCerro(evento, anterior, anterior)
    expect(cabeceras.get('set-cookie')).toBe('ciisic_admin_session=jwt-p2; Path=/')
    expect(sesionCerrada(undefined)).toBe(false)
    expect(sesionCerrada('')).toBe(false)
  })
})
