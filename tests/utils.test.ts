import { describe, expect, it } from 'vitest'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { aParametros, filtrosDesdeQuery } from '~/utils/filtros'
import { fechaDia, modalidadPago, nombreCompleto, slug, soles, tamanoArchivo } from '~/utils/formato'

describe('formato', () => {
  it('muestra montos en soles', () => {
    expect(soles(1460)).toMatch(/S\/\s?1,460\.00/)
    expect(soles(null)).toMatch(/0\.00/)
  })

  it('muestra fechas de calendario sin corrimiento de zona horaria', () => {
    expect(fechaDia('2026-10-26')).toContain('26')
    expect(fechaDia('2026-10-26')).toContain('2026')
    expect(fechaDia(null)).toBe('—')
    expect(fechaDia('no-fecha')).toBe('—')
  })

  it('genera códigos de evento legibles', () => {
    expect(slug('IX CIISIC 2027')).toBe('ix-ciisic-2027')
    expect(slug('  Semana Sistémica — Edición Ñandú ')).toBe('semana-sistemica-edicion-nandu')
  })

  it('describe la modalidad de pago', () => {
    expect(modalidadPago('banco', 'bcp')).toBe('Banco · BCP')
    expect(modalidadPago('billetera', null, 'yape')).toBe('Billetera · Yape')
    expect(modalidadPago(null)).toBe('—')
  })

  it('otros formatos', () => {
    expect(nombreCompleto({ nombres: 'Ana', apellidos: 'Quispe' })).toBe('Ana Quispe')
    expect(tamanoArchivo(2048)).toBe('2.0 KB')
  })
})

describe('errores de la API', () => {
  it('lee el cuerpo normalizado del backend', () => {
    const e = aErrorApi({ status: 409, data: { success: false, code: 'ALREADY_REGISTERED', message: 'Ya inscrito' } })
    expect(e).toEqual({ status: 409, code: 'ALREADY_REGISTERED', message: 'Ya inscrito', fields: undefined })
  })

  it('lee errores del BFF anidados en data', () => {
    const e = aErrorApi({ statusCode: 401, data: { data: { code: 'SESSION_EXPIRED', message: 'Tu sesión expiró.' } } })
    expect(e.code).toBe('SESSION_EXPIRED')
    expect(e.message).toBe('Tu sesión expiró.')
  })

  it('incluye los campos de validación en el mensaje', () => {
    const texto = mensajeError({ status: 422, data: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', fields: { codigo: 'Formato inválido' } } })
    expect(texto).toBe('Datos inválidos (codigo: Formato inválido)')
  })

  it('usa mensajes por defecto sin conexión', () => {
    expect(aErrorApi(new Error('fetch failed')).message).toBe('No se pudo conectar con el servidor.')
  })
})

describe('filtros de inscripciones', () => {
  it('lee la query ignorando valores inválidos', () => {
    expect(filtrosDesdeQuery({ estado: 'pendiente', tipoInscripcionId: 'abc', esEstudianteUndc: 'quizas', page: '3' }))
      .toEqual({ estado: 'PENDIENTE', categoria: '', tipoInscripcionId: '', esEstudianteUndc: '', q: '', page: 3 })
  })

  it('serializa solo los filtros con valor', () => {
    expect(aParametros({ estado: 'APROBADO', categoria: '', tipoInscripcionId: '2', esEstudianteUndc: 'true', q: ' ana ', page: 2 }))
      .toEqual({ estado: 'APROBADO', tipoInscripcionId: '2', esEstudianteUndc: 'true', q: 'ana', page: '2' })
    expect(aParametros({ estado: '', categoria: '', tipoInscripcionId: '', esEstudianteUndc: '', q: '', page: 5 }, false)).toEqual({})
  })
})
