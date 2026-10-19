import { describe, expect, it } from 'vitest'
import { explicacionEstado, lugarDelEvento, ordenarInscripciones, rangoFechas, type InscripcionPortal } from '../app/utils/misInscripciones'

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

  it('una inscripción virtual aprobada recibe un texto neutro sobre las indicaciones de conexión', () => {
    const virtual = base({
      estado: { codigo: 'APROBADO', nombre: 'Aprobado' },
      credencial: { disponible: true, enviadaEn: '2026-09-30T10:00:00Z' },
      tipoInscripcion: { nombre: 'ESTUDIANTES', etiqueta: 'VIRTUAL', categoria: 'ESTUDIANTES', modalidad: 'VIRTUAL' },
    })
    const texto = explicacionEstado(virtual)
    expect(texto).toContain('virtual')
    expect(texto).toContain('La organización te compartirá las indicaciones para conectarte')
    // Cómo se entrega el acceso, el certificado y las horas siguen abiertos: no se promete nada de eso
    expect(texto).not.toMatch(/https?:|certificad|horas|enlace/i)
    expect(texto).not.toBe(explicacionEstado({ ...virtual, tipoInscripcion: null }))
  })

  it('los demás estados de una inscripción virtual se explican igual que siempre', () => {
    const tipoInscripcion = { nombre: 'ESTUDIANTES', etiqueta: 'VIRTUAL', categoria: 'ESTUDIANTES', modalidad: 'VIRTUAL' as const }
    expect(explicacionEstado(base({ tipoInscripcion }))).toContain('revisará tu voucher')
    expect(explicacionEstado(base({ tipoInscripcion, estado: { codigo: 'RECHAZADO', nombre: 'Rechazado' } }))).toContain('motivo')
  })

  it('presencial, sin modalidad (backend anterior) o desconocida: el texto de siempre', () => {
    const aprobada = { estado: { codigo: 'APROBADO' as const, nombre: 'Aprobado' }, credencial: { disponible: true, enviadaEn: '2026-09-30T10:00:00Z' } }
    const tipo = { nombre: 'ESTUDIANTES', etiqueta: 'CON KIT', categoria: 'ESTUDIANTES' }
    const esperado = explicacionEstado(base({ ...aprobada }))
    expect(esperado).toContain('por correo')
    expect(explicacionEstado(base({ ...aprobada, tipoInscripcion: tipo }))).toBe(esperado)
    expect(explicacionEstado(base({ ...aprobada, tipoInscripcion: { ...tipo, modalidad: 'PRESENCIAL' } }))).toBe(esperado)
    expect(explicacionEstado(base({ ...aprobada, tipoInscripcion: { ...tipo, modalidad: 'HIBRIDA' as 'VIRTUAL' } }))).toBe(esperado)
  })

  it('en lugar de la sede muestra «Modalidad virtual» si la inscripción es virtual', () => {
    const evento = { ...base({}).evento, sede: 'UNDC · Tacna' }
    const tipo = { nombre: 'ESTUDIANTES', etiqueta: 'VIRTUAL', categoria: 'ESTUDIANTES' }
    expect(lugarDelEvento({ evento, tipoInscripcion: { ...tipo, modalidad: 'VIRTUAL' } })).toBe('Modalidad virtual')
    expect(lugarDelEvento({ evento, tipoInscripcion: { ...tipo, modalidad: 'PRESENCIAL' } })).toBe('UNDC · Tacna')
    expect(lugarDelEvento({ evento, tipoInscripcion: tipo })).toBe('UNDC · Tacna')
    expect(lugarDelEvento({ evento, tipoInscripcion: null })).toBe('UNDC · Tacna')
    expect(lugarDelEvento({ evento: { ...evento, sede: null }, tipoInscripcion: null })).toBeNull()
    // Un virtual sin sede también dice que es virtual
    expect(lugarDelEvento({ evento: { ...evento, sede: null }, tipoInscripcion: { ...tipo, modalidad: 'VIRTUAL' } })).toBe('Modalidad virtual')
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
