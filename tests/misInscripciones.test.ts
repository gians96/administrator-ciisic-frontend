import { describe, expect, it } from 'vitest'
import { explicacionEstado, ordenarInscripciones, rangoFechas, type InscripcionPortal } from '../app/utils/misInscripciones'

const base = (cambios: Partial<InscripcionPortal>): InscripcionPortal => ({
  id: 1,
  evento: { codigo: 'ciisic-viii-2026', nombre: 'VIII Congreso', nombreCorto: 'VIII CIISIC 2026', fechaInicio: '2026-10-26', fechaFin: '2026-10-30', sede: null },
  tipoInscripcion: null,
  clasificacion: null,
  monto: 100,
  precioRegular: 120,
  descuento: 20,
  pago: { modalidad: 'billetera', banco: null, tipoOperacion: null, billeteraDigital: 'yape', numeroOperacion: 'OP-1', fechaPago: '2026-09-29' },
  estado: { codigo: 'PENDIENTE', nombre: 'Pendiente' },
  motivoRechazo: null,
  revisadoEn: null,
  credencial: { disponible: false, enviadaEn: null },
  creadoEn: '2026-09-29T20:31:00.000Z',
  ...cambios,
})

describe('portal del inscrito', () => {
  it('explica cada estado en lenguaje simple', () => {
    expect(explicacionEstado(base({}))).toContain('revisará tu voucher')
    expect(explicacionEstado(base({ estado: { codigo: 'APROBADO', nombre: 'Aprobado' }, credencial: { disponible: true, enviadaEn: null } }))).toContain('Descarga aquí')
    expect(explicacionEstado(base({ estado: { codigo: 'APROBADO', nombre: 'Aprobado' }, credencial: { disponible: true, enviadaEn: '2026-09-30T10:00:00Z' } }))).toContain('por correo')
    expect(explicacionEstado(base({ estado: { codigo: 'RECHAZADO', nombre: 'Rechazado' } }))).toContain('motivo')
  })

  it('muestra el rango de fechas del evento en hora de Lima', () => {
    expect(rangoFechas('2026-10-26', '2026-10-30')).toMatch(/^26 – 30 oct\.? 2026$/)
    expect(rangoFechas('2026-10-30', '2026-11-02')).toMatch(/^30 oct\.? – 2 nov\.? 2026$/)
    expect(rangoFechas('2026-10-26', '2026-10-26')).toMatch(/^26 oct\.? 2026$/)
  })

  it('pone primero lo que requiere atención y luego lo más reciente', () => {
    const lista = [
      base({ id: 1, estado: { codigo: 'APROBADO', nombre: 'Aprobado' }, creadoEn: '2026-09-30T00:00:00Z' }),
      base({ id: 2, estado: { codigo: 'PENDIENTE', nombre: 'Pendiente' }, creadoEn: '2025-10-01T00:00:00Z' }),
      base({ id: 3, estado: { codigo: 'RECHAZADO', nombre: 'Rechazado' }, creadoEn: '2026-01-01T00:00:00Z' }),
    ]
    expect(ordenarInscripciones(lista).map((i) => i.id)).toEqual([2, 3, 1])
  })
})
