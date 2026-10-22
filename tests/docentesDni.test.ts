import { describe, expect, it } from 'vitest'
import type { SeccionRef } from '~/types/api'
import {
  cambiosDeSecciones,
  claveDeSeccionDocente,
  conteoDeDni,
  dniDelDocente,
  seccionesAsignables,
  seccionesPorCiclo,
  soloDigitosDni,
} from '~/utils/docentes'

const s = (ciclo: string, seccion: string): SeccionRef => ({ ciclo, seccion })

describe('DNI del docente', () => {
  it('acepta 8 dígitos y completa el cero inicial de 7, como el backend', () => {
    expect(dniDelDocente('12345678')).toBe('12345678')
    expect(dniDelDocente(' 1234 5678 ')).toBe('12345678')
    expect(dniDelDocente('2442123')).toBe('02442123')
  })

  it('rechaza todo lo demás', () => {
    for (const invalido of [null, undefined, '', '123', '123456', '123456789', '1234567a', '12-345678', 'abcdefgh']) expect(dniDelDocente(invalido)).toBeNull()
  })

  it('al escribir solo quedan dígitos y hasta 8', () => {
    expect(soloDigitosDni('12a3-4 5678999')).toBe('12345678')
    expect(soloDigitosDni('')).toBe('')
  })
})

describe('secciones del docente', () => {
  const PADRON = [s('I', 'A'), s('II', 'A'), s('II', 'B'), s('VI', 'A1')]

  it('agrupa por ciclo conservando el orden', () => {
    expect(seccionesPorCiclo(PADRON)).toEqual([
      { ciclo: 'I', secciones: [s('I', 'A')] },
      { ciclo: 'II', secciones: [s('II', 'A'), s('II', 'B')] },
      { ciclo: 'VI', secciones: [s('VI', 'A1')] },
    ])
    expect(seccionesPorCiclo([])).toEqual([])
  })

  it('ofrece las del padrón y también las que ya tiene aunque el padrón ya no las traiga', () => {
    const asignables = seccionesAsignables(PADRON, [s('II', 'B'), s('IX', 'Z')])
    expect(asignables.map(claveDeSeccionDocente)).toEqual(['I|A', 'II|A', 'II|B', 'VI|A1', 'IX|Z'])
  })

  it('dice qué se agrega y qué se quita al cambiar las secciones', () => {
    const cambios = cambiosDeSecciones([s('I', 'A'), s('II', 'B')], [s('I', 'A'), s('VI', 'A1')])
    expect(cambios).toEqual({ agregadas: [s('VI', 'A1')], quitadas: [s('II', 'B')] })
    expect(cambiosDeSecciones([s('I', 'A')], [s('I', 'A')])).toEqual({ agregadas: [], quitadas: [] })
    expect(cambiosDeSecciones([], [s('I', 'A')]).agregadas).toHaveLength(1)
  })
})

describe('DNI registrados', () => {
  it('cuenta cuántos docentes tienen y cuántos no tienen DNI', () => {
    expect(conteoDeDni([{ documento: '12345678' }, { documento: null }, { documento: '87654321' }])).toEqual({ con: 2, sin: 1 })
    expect(conteoDeDni([])).toEqual({ con: 0, sin: 0 })
  })
})
