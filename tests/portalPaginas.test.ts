import { describe, expect, it } from 'vitest'
import { actividadesPorDia, diaDeActividad, horaDeRegistro, horarioActividad, porcentajeAsistencia, resumenAsistencia } from '~/utils/miAsistencia'
import { certificadosDe, detalleCertificado, MENSAJE_SIN_CERTIFICADOS, nombreTipoCertificado } from '~/utils/misCertificados'
import { errorCelularPerfil, esPerfilAmpliado, nombreTipoDocumento, normalizarCelularPerfil } from '~/utils/miPerfil'
import type { ActividadPortal } from '~/utils/portal'

function actividad(id: number, fecha: string, asistio = false): ActividadPortal {
  return { id, nombre: `Actividad ${id}`, fecha, horaInicio: '09:00', horaFin: '10:30', asistio, registradoEn: asistio ? '2026-10-26T14:05:00.000Z' : null }
}

describe('mi asistencia', () => {
  it('agrupa por día conservando el orden', () => {
    const dias = actividadesPorDia([actividad(1, '2026-10-26'), actividad(2, '2026-10-26', true), actividad(3, '2026-10-27')])
    expect(dias.map((dia) => [dia.fecha, dia.actividades.map((a) => a.id)])).toEqual([['2026-10-26', [1, 2]], ['2026-10-27', [3]]])
    expect(actividadesPorDia([])).toEqual([])
  })

  it('porcentaje y resumen', () => {
    expect(porcentajeAsistencia({ asistidas: 1, totalActividades: 3 })).toBe(33)
    expect(porcentajeAsistencia({ asistidas: 3, totalActividades: 3 })).toBe(100)
    expect(porcentajeAsistencia({ asistidas: 0, totalActividades: 0 })).toBe(0)
    expect(resumenAsistencia({ asistidas: 1, totalActividades: 3 })).toBe('1 de 3 actividades')
    expect(resumenAsistencia({ asistidas: 1, totalActividades: 1 })).toBe('1 de 1 actividad')
  })

  it('horario, día y hora de registro en Lima', () => {
    expect(horarioActividad({ horaInicio: '09:00', horaFin: '10:30' })).toBe('09:00 – 10:30')
    expect(diaDeActividad('2026-10-26')).toMatch(/lunes.*26.*octubre/)
    expect(diaDeActividad('x')).toBe('x')
    expect(horaDeRegistro('2026-10-26T14:05:00.000Z')).toBe('09:05')
    expect(horaDeRegistro(null)).toBeNull()
    expect(horaDeRegistro('no-es-fecha')).toBeNull()
  })
})

describe('mi perfil', () => {
  it('normaliza y valida el celular como el backend (/^\\+?\\d{9,15}$/)', () => {
    expect(normalizarCelularPerfil(' +51 (987) 654-321 ')).toBe('+51987654321')
    expect(errorCelularPerfil('987 654 321')).toBeNull()
    expect(errorCelularPerfil('+51987654321')).toBeNull()
    expect(errorCelularPerfil('   ')).toMatch(/Escribe tu número/)
    expect(errorCelularPerfil('98765')).toMatch(/celular válido/)
    expect(errorCelularPerfil('9876543210123456')).toMatch(/celular válido/)
    expect(errorCelularPerfil('98765432a')).toMatch(/celular válido/)
  })

  it('perfil ampliado solo con el backend 014', () => {
    expect(esPerfilAmpliado({ celular: '987654321', foto: { tiene: false, actualizadaEn: null } })).toBe(true)
    expect(esPerfilAmpliado({ celular: '', foto: { tiene: false, actualizadaEn: null } })).toBe(true)
    expect(esPerfilAmpliado({})).toBe(false)
  })

  it('nombre del tipo de documento', () => {
    expect(nombreTipoDocumento('dni')).toBe('DNI')
    expect(nombreTipoDocumento('CE')).toBe('Carné de extranjería')
    expect(nombreTipoDocumento('pasaporte')).toBe('PASAPORTE')
    expect(nombreTipoDocumento(null)).toBe('Documento')
  })
})

describe('mis certificados', () => {
  it('solo elementos con id; otra forma: lista vacía', () => {
    expect(certificadosDe([{ id: 1 }, null, { id: 'x' }, 'y'])).toEqual([{ id: 1 }])
    expect(certificadosDe({ items: [] })).toEqual([])
    expect(MENSAJE_SIN_CERTIFICADOS).toBe('Aquí verás tus certificados cuando estén firmados.')
  })

  it('tipo y detalle', () => {
    expect(nombreTipoCertificado('Ponente')).toBe('Ponente')
    expect(nombreTipoCertificado({ nombre: 'Asistente' })).toBe('Asistente')
    expect(nombreTipoCertificado(null)).toBe('Certificado')
    expect(detalleCertificado({ fechaEmision: '2026-10-30', horas: 20, codigoImpreso: 'ABC123' })).toMatch(/^Emitido el .*30.* · 20 horas · Código ABC123$/)
    expect(detalleCertificado({ horas: 1 })).toBe('1 hora')
    expect(detalleCertificado({})).toBe('')
  })
})
