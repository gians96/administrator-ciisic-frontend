import { describe, expect, it } from 'vitest'
import { VIDA_SESION_POR_DEFECTO, vidaSesionSegundos } from '../server/utils/vida-sesion'

const AHORA = Date.parse('2026-09-29T15:00:00.000Z')

describe('vida de la cookie de sesión', () => {
  it('usa los segundos que informa el backend (número o texto)', () => {
    expect(vidaSesionSegundos(3600, AHORA)).toBe(3600)
    expect(vidaSesionSegundos(7200.9, AHORA)).toBe(7200)
    expect(vidaSesionSegundos(' 1800 ', AHORA)).toBe(1800)
  })

  it('calcula la vida restante desde una fecha ISO', () => {
    expect(vidaSesionSegundos('2026-09-29T16:00:00.000Z', AHORA)).toBe(3600)
    expect(vidaSesionSegundos('2026-09-29T10:30:00-05:00', AHORA)).toBe(1800)
  })

  it('usa 1 hora si no viene, no es válida o ya pasó', () => {
    expect(VIDA_SESION_POR_DEFECTO).toBe(3600)
    for (const valor of [undefined, null, '', 'mañana', 0, -5, Number.NaN, '2026-09-29T14:00:00.000Z', {}]) {
      expect(vidaSesionSegundos(valor, AHORA)).toBe(3600)
    }
  })

  it('limita vidas absurdas a 30 días', () => {
    expect(vidaSesionSegundos(10 ** 12, AHORA)).toBe(30 * 24 * 3600)
  })
})
