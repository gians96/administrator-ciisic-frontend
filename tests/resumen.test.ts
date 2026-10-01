import { describe, expect, it } from 'vitest'
import type { ResumenDeportes, ResumenSemana } from '~/types/api'
import { conteosDeportes } from '~/utils/resumen'

const resumenDeportes = (aprobados: number, total: number, participantes: number): ResumenDeportes => ({
  event: { id: 1, name: 'Deportes', startDate: '2026-10-26', endDate: '2026-10-30' },
  currency: 'PEN',
  teams: { total, pending: total - aprobados, approved: aprobados, rejected: 0, cancelled: 0 },
  participants: { total: participantes },
  payments: { validated: { count: 0, amount: null }, pending: { count: 0, amount: null }, rejected: { count: 0, amount: null } },
  byDiscipline: [],
  byParticipantType: [],
  generatedAt: '2026-10-01T00:00:00.000Z',
})

describe('resumen: conteos de deportes sin montos', () => {
  it('suma solo las integraciones que respondieron', () => {
    const deportes: ResumenSemana['deportes'] = [
      { integracionId: 1, nombre: 'Fútbol', ok: true, resumen: resumenDeportes(3, 5, 40), error: null },
      { integracionId: 2, nombre: 'Vóley', ok: true, resumen: resumenDeportes(2, 2, 12), error: null },
      { integracionId: 3, nombre: 'Caída', ok: false, resumen: null, error: 'Sin conexión' },
    ]
    expect(conteosDeportes({ deportes })).toEqual({ sincronizadas: 2, equiposAprobados: 5, equiposTotales: 7, participantes: 52 })
  })

  it('sin resumen devuelve ceros', () => {
    expect(conteosDeportes(null)).toEqual({ sincronizadas: 0, equiposAprobados: 0, equiposTotales: 0, participantes: 0 })
    expect(conteosDeportes({ deportes: [] }).sincronizadas).toBe(0)
  })
})
