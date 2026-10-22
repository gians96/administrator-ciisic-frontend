import { describe, expect, it } from 'vitest'
import {
  estadoDelEnlace,
  haceCuanto,
  mensajeParaCiclo,
  mensajeParaDocente,
  tipoDeSeguimiento,
  tokenDelHash,
  urlEnlaceCiclo,
  urlEnlaceDocente,
  urlWhatsapp,
} from '~/utils/enlacesDocentes'

const TOKEN = 'k3J9_-abcdefghijklmnopqrstuvwxyz0123456789ABC'.slice(0, 43)

describe('enlaces de docentes: URL y token', () => {
  it('el token va tras el # para que ningún servidor lo reciba', () => {
    expect(TOKEN).toHaveLength(43)
    expect(urlEnlaceDocente('https://panel.ejemplo.pe', TOKEN)).toBe(`https://panel.ejemplo.pe/seguimiento#${TOKEN}`)
    expect(urlEnlaceDocente('https://panel.ejemplo.pe///', TOKEN)).toBe(`https://panel.ejemplo.pe/seguimiento#${TOKEN}`)
    expect(new URL(urlEnlaceDocente('https://panel.ejemplo.pe', TOKEN)).search).toBe('')
  })

  it('lee el token del hash, con o sin almohadilla, y descarta lo que no tiene el formato', () => {
    expect(tokenDelHash(`#${TOKEN}`)).toBe(TOKEN)
    expect(tokenDelHash(` ${TOKEN} `)).toBe(TOKEN)
    expect(tokenDelHash('')).toBeNull()
    expect(tokenDelHash('#corto')).toBeNull()
    expect(tokenDelHash(`#${TOKEN}x`)).toBeNull()
    expect(tokenDelHash(`#${'ñ'.repeat(43)}`)).toBeNull()
    expect(tokenDelHash(null)).toBeNull()
    expect(tokenDelHash(undefined)).toBeNull()
  })
})

describe('enlaces de ciclos: URL, ruta y mensaje', () => {
  it('el enlace del ciclo tiene su propia ruta y también lleva el token tras el #', () => {
    expect(urlEnlaceCiclo('https://panel.ejemplo.pe', TOKEN)).toBe(`https://panel.ejemplo.pe/seguimiento/ciclo#${TOKEN}`)
    expect(urlEnlaceCiclo('https://panel.ejemplo.pe///', TOKEN)).toBe(`https://panel.ejemplo.pe/seguimiento/ciclo#${TOKEN}`)
    expect(new URL(urlEnlaceCiclo('https://panel.ejemplo.pe', TOKEN)).search).toBe('')
    // El del docente no cambia: los ya entregados siguen valiendo
    expect(urlEnlaceDocente('https://panel.ejemplo.pe', TOKEN)).toBe(`https://panel.ejemplo.pe/seguimiento#${TOKEN}`)
  })

  it('la página decide qué vista abrir por la ruta', () => {
    expect(tipoDeSeguimiento('/seguimiento')).toBe('asesor')
    expect(tipoDeSeguimiento('/seguimiento/')).toBe('asesor')
    expect(tipoDeSeguimiento('/seguimiento/ciclo')).toBe('ciclo')
    expect(tipoDeSeguimiento('/seguimiento/ciclo/')).toBe('ciclo')
    expect(tipoDeSeguimiento('/seguimiento/ciclos')).toBe('asesor')
  })

  it('el estado del enlace sirve igual para un ciclo', () => {
    expect(estadoDelEnlace({ token: null, ultimoAcceso: null })).toBe('SIN_ENLACE')
    expect(estadoDelEnlace({ token: TOKEN, ultimoAcceso: '2026-10-22T10:00:00.000Z' })).toBe('ABIERTO')
  })

  it('el mensaje trae el ciclo, el enlace y pide no compartirlo', () => {
    const mensaje = mensajeParaCiclo(' VI ', `https://panel.ejemplo.pe/seguimiento/ciclo#${TOKEN}`, 'VIII CIISIC 2026')
    expect(mensaje).toContain('del ciclo VI del VIII CIISIC 2026')
    expect(mensaje).toContain(`https://panel.ejemplo.pe/seguimiento/ciclo#${TOKEN}`)
    expect(mensaje).toMatch(/no lo comparta/)
    expect(mensajeParaCiclo('II', 'https://a.pe/seguimiento/ciclo#t')).not.toMatch(/ del CIISIC| del undefined/)
  })
})

describe('enlaces de docentes: estado y tiempos', () => {
  it('distingue sin enlace, sin abrir y abierto', () => {
    expect(estadoDelEnlace(undefined)).toBe('SIN_ENLACE')
    expect(estadoDelEnlace({ token: null, ultimoAcceso: null })).toBe('SIN_ENLACE')
    expect(estadoDelEnlace({ token: TOKEN, ultimoAcceso: null })).toBe('SIN_ABRIR')
    expect(estadoDelEnlace({ token: TOKEN, ultimoAcceso: '2026-10-22T10:00:00.000Z' })).toBe('ABIERTO')
  })

  it('dice hace cuánto fue el último acceso', () => {
    const ahora = Date.parse('2026-10-22T12:00:00.000Z')
    const antes = (ms: number) => new Date(ahora - ms).toISOString()
    expect(haceCuanto(null, ahora)).toBe('nunca')
    expect(haceCuanto('no es una fecha', ahora)).toBe('nunca')
    expect(haceCuanto(antes(20_000), ahora)).toBe('hace instantes')
    expect(haceCuanto(antes(5 * 60_000), ahora)).toBe('hace 5 min')
    expect(haceCuanto(antes(3 * 3_600_000), ahora)).toBe('hace 3 h')
    expect(haceCuanto(antes(86_400_000), ahora)).toBe('hace 1 día')
    expect(haceCuanto(antes(3 * 86_400_000), ahora)).toBe('hace 3 días')
    expect(haceCuanto(antes(30 * 86_400_000), ahora)).toMatch(/2026/)
    // Un reloj adelantado no da tiempos negativos
    expect(haceCuanto(antes(-60_000), ahora)).toBe('hace instantes')
  })
})

describe('enlaces de docentes: mensaje y WhatsApp', () => {
  it('el mensaje trae el enlace, el evento y pide no compartirlo', () => {
    const mensaje = mensajeParaDocente('  DRA. ANGOMA ASTUCURI MIRIAM ', `https://panel.ejemplo.pe/seguimiento#${TOKEN}`, 'VIII CIISIC 2026')
    expect(mensaje).toContain('Estimado(a) DRA. ANGOMA ASTUCURI MIRIAM:')
    expect(mensaje).toContain('del VIII CIISIC 2026')
    expect(mensaje).toContain(`https://panel.ejemplo.pe/seguimiento#${TOKEN}`)
    expect(mensaje).toMatch(/no lo comparta/)
    expect(mensajeParaDocente('X', 'https://a.pe/seguimiento#t')).not.toMatch(/ del /)
  })

  it('arma el enlace de WhatsApp solo con celulares peruanos válidos', () => {
    expect(urlWhatsapp('920301747')).toBe('https://wa.me/51920301747')
    expect(urlWhatsapp('+51 920 301 747')).toBe('https://wa.me/51920301747')
    expect(urlWhatsapp('51920301747')).toBe('https://wa.me/51920301747')
    expect(urlWhatsapp('920301747', 'Hola Ana')).toBe('https://wa.me/51920301747?text=Hola%20Ana')
    for (const invalido of [null, undefined, '', '12345', '820301747', '9203017478', '5192030174']) expect(urlWhatsapp(invalido)).toBeNull()
  })
})
