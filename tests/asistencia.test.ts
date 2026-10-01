import { describe, expect, it } from 'vitest'
import { actividadInicial, conservarValorTrasError, cuerpoMarca, etiquetaMetodo, idDeConsulta, textoMarca, type FormMarca } from '~/utils/asistencia'

const form = (cambios: Partial<FormMarca> = {}): FormMarca => ({ modo: 'qr', valor: '', tipoDocumento: '', fueraDeHorario: false, ...cambios })

describe('asistencia: cuerpo de la marca', () => {
  it('en modo QR envía el id leído con metodo QR', () => {
    expect(cuerpoMarca(form({ valor: ' 1234 ' }), false)).toEqual({ body: { participanteId: 1234, fueraDeHorario: false, metodo: 'QR' } })
  })

  it('en modo QR rechaza códigos que no son un id positivo', () => {
    for (const valor of ['abc', '12a', '0', '-5', '1.5', '99999999999999999999']) {
      expect(cuerpoMarca(form({ valor }), false)).toHaveProperty('error')
    }
  })

  it('en modo DNI envía el documento con metodo DOCUMENTO y sin tipo si no se eligió', () => {
    expect(cuerpoMarca(form({ modo: 'dni', valor: ' 12345678 ' }), false))
      .toEqual({ body: { numeroDocumento: '12345678', fueraDeHorario: false, metodo: 'DOCUMENTO' } })
  })

  it('en modo DNI agrega el tipo elegido (resuelve AMBIGUOUS_DOCUMENT)', () => {
    expect(cuerpoMarca(form({ modo: 'dni', valor: '001234567', tipoDocumento: 'ce' }), false))
      .toEqual({ body: { numeroDocumento: '001234567', tipoDocumento: 'ce', fueraDeHorario: false, metodo: 'DOCUMENTO' } })
  })

  it('en modo DNI valida el formato del backend (8 a 12 letras o números)', () => {
    for (const valor of ['1234567', '1234567890123', '1234 5678', '12-345678']) {
      expect(cuerpoMarca(form({ modo: 'dni', valor }), false)).toHaveProperty('error')
    }
  })

  it('sin valor devuelve un error', () => {
    expect(cuerpoMarca(form({ valor: '   ' }), true)).toHaveProperty('error')
    expect(cuerpoMarca(form({ modo: 'dni', valor: '' }), true)).toHaveProperty('error')
  })

  it('«fuera de horario» solo viaja con el permiso asistencia.fuera_horario', () => {
    expect(cuerpoMarca(form({ valor: '7', fueraDeHorario: true }), true)).toEqual({ body: { participanteId: 7, fueraDeHorario: true, metodo: 'QR' } })
    expect(cuerpoMarca(form({ valor: '7', fueraDeHorario: true }), false)).toEqual({ body: { participanteId: 7, fueraDeHorario: false, metodo: 'QR' } })
  })
})

describe('asistencia: textos', () => {
  it('conserva lo escrito solo ante AMBIGUOUS_DOCUMENT en modo DNI', () => {
    expect(conservarValorTrasError('dni', 'AMBIGUOUS_DOCUMENT')).toBe(true)
    expect(conservarValorTrasError('qr', 'AMBIGUOUS_DOCUMENT')).toBe(false)
    expect(conservarValorTrasError('dni', 'PARTICIPANT_NOT_FOUND')).toBe(false)
  })

  it('nombra el método y muestra «—» en las marcas antiguas', () => {
    expect(etiquetaMetodo('QR')).toBe('QR')
    expect(etiquetaMetodo('DOCUMENTO')).toBe('Documento')
    expect(etiquetaMetodo('QR_LEGADO')).toBe('QR (versión anterior)')
    expect(etiquetaMetodo(null)).toBe('—')
    expect(etiquetaMetodo('OTRO')).toBe('OTRO')
  })

  it('describe la marca con el documento tal cual llega (enmascarado)', () => {
    const participante = { id: 1, nombres: 'Ana', apellidos: 'Díaz', tipoDocumento: 'dni', numeroDocumento: '****5678' }
    expect(textoMarca({ esFueraDeHorario: false, participante })).toBe('✓ Ana Díaz · DNI ****5678')
    expect(textoMarca({ esFueraDeHorario: true, participante })).toBe('✓ Ana Díaz · DNI ****5678 · fuera de horario')
  })
})

describe('asistencia: enlace desde Eventos → Actividades', () => {
  it('lee ids positivos de la URL', () => {
    expect(idDeConsulta('12')).toBe(12)
    for (const valor of [undefined, null, '', '0', '-3', '1.5', 'abc', '12abc', ['12'], '99999999999999999999']) {
      expect(idDeConsulta(valor), String(valor)).toBeNull()
    }
  })

  it('elige la actividad del enlace si es de este evento', () => {
    expect(actividadInicial([{ id: 10 }, { id: 12 }], 12)).toEqual({ id: 12, ajena: false })
  })

  it('si la actividad del enlace es de otro evento, elige la primera y lo avisa', () => {
    expect(actividadInicial([{ id: 10 }, { id: 11 }], 12)).toEqual({ id: 10, ajena: true })
    expect(actividadInicial([], 12)).toEqual({ id: null, ajena: true })
  })

  it('sin enlace, la primera (o ninguna)', () => {
    expect(actividadInicial([{ id: 10 }, { id: 11 }], null)).toEqual({ id: 10, ajena: false })
    expect(actividadInicial([], null)).toEqual({ id: null, ajena: false })
  })
})
