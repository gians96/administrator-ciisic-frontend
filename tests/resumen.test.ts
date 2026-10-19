import { describe, expect, it } from 'vitest'
import type { ResumenDeportes, ResumenModalidad, ResumenSemana } from '~/types/api'
import { conteosDeportes, filasPorModalidad } from '~/utils/resumen'

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

describe('resumen: presencial vs virtual', () => {
  const fila = (modalidad: string, inscripciones: number, aprobadas: number, montoAprobado: number | null): ResumenModalidad => ({
    modalidad: modalidad as ResumenModalidad['modalidad'],
    inscripciones,
    aprobadas,
    montoAprobado,
  })

  it('ordena presencial y virtual con sus conteos y montos', () => {
    const filas = filasPorModalidad([fila('VIRTUAL', 12, 9, 450), fila('PRESENCIAL', 100, 80, 9600)])
    expect(filas).toEqual([
      { modalidad: 'PRESENCIAL', nombre: 'Presencial', inscripciones: 100, aprobadas: 80, montoAprobado: 9600 },
      { modalidad: 'VIRTUAL', nombre: 'Virtual', inscripciones: 12, aprobadas: 9, montoAprobado: 450 },
    ])
  })

  it('sin el dato (backend anterior a la spec 018) o vacío no hay bloque', () => {
    expect(filasPorModalidad(undefined)).toEqual([])
    expect(filasPorModalidad(null)).toEqual([])
    expect(filasPorModalidad([])).toEqual([])
  })

  it('si falta una modalidad la completa con ceros', () => {
    expect(filasPorModalidad([fila('PRESENCIAL', 5, 3, 360)])).toEqual([
      { modalidad: 'PRESENCIAL', nombre: 'Presencial', inscripciones: 5, aprobadas: 3, montoAprobado: 360 },
      { modalidad: 'VIRTUAL', nombre: 'Virtual', inscripciones: 0, aprobadas: 0, montoAprobado: 0 },
    ])
  })

  it('sin pagos.ver los montos siguen en null y los conteos se conservan', () => {
    const filas = filasPorModalidad([fila('PRESENCIAL', 100, 80, null), fila('VIRTUAL', 12, 9, null)])
    expect(filas.map((f) => f.montoAprobado)).toEqual([null, null])
    expect(filas.map((f) => f.inscripciones)).toEqual([100, 12])
    // Aunque falte una modalidad, el monto no se inventa en 0
    expect(filasPorModalidad([fila('PRESENCIAL', 5, 3, null)])[1]).toMatchObject({ inscripciones: 0, montoAprobado: null })
  })

  it('una modalidad desconocida cuenta como presencial', () => {
    const filas = filasPorModalidad([fila('PRESENCIAL', 10, 8, 960), fila('HIBRIDA', 2, 1, 120), fila('VIRTUAL', 1, 1, 30)])
    expect(filas[0]).toMatchObject({ modalidad: 'PRESENCIAL', inscripciones: 12, aprobadas: 9, montoAprobado: 1080 })
    expect(filas[1]).toMatchObject({ modalidad: 'VIRTUAL', inscripciones: 1, aprobadas: 1, montoAprobado: 30 })
  })
})
