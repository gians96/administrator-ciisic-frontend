import { describe, expect, it } from 'vitest'
import {
  AVISO_MODALIDAD_NO_GUARDADA,
  AVISO_SERVIDOR_SIN_MODALIDAD,
  backendConModalidad,
  backendSinModalidad,
  esVirtual,
  etiquetaDeInsignia,
  etiquetaModalidad,
  hayTiposVirtuales,
  INDICACIONES_VIRTUAL,
  LUGAR_VIRTUAL,
  MODALIDADES_ASISTENCIA,
  modalidadDe,
  modalidadVirtualNoGuardada,
} from '~/utils/modalidad'
import { modalidadPago } from '~/utils/formato'

describe('modalidad de asistencia: tolerancia', () => {
  it('solo «VIRTUAL» es virtual; ausente, null o desconocida es presencial', () => {
    expect(modalidadDe('VIRTUAL')).toBe('VIRTUAL')
    expect(modalidadDe('PRESENCIAL')).toBe('PRESENCIAL')
    expect(modalidadDe(undefined)).toBe('PRESENCIAL')
    expect(modalidadDe(null)).toBe('PRESENCIAL')
    expect(modalidadDe('HIBRIDA')).toBe('PRESENCIAL')
    expect(modalidadDe('virtual')).toBe('PRESENCIAL')
    expect(modalidadDe(1)).toBe('PRESENCIAL')
  })

  it('esVirtual lee tipo.modalidad y tolera un tipo ausente (cortesía sin tipo)', () => {
    expect(esVirtual({ modalidad: 'VIRTUAL' })).toBe(true)
    expect(esVirtual({ modalidad: 'PRESENCIAL' })).toBe(false)
    expect(esVirtual({})).toBe(false)
    expect(esVirtual({ modalidad: null })).toBe(false)
    expect(esVirtual(null)).toBe(false)
    expect(esVirtual(undefined)).toBe(false)
  })

  it('las modalidades válidas son las dos, presencial primero', () => {
    expect([...MODALIDADES_ASISTENCIA]).toEqual(['PRESENCIAL', 'VIRTUAL'])
  })

  it('el nombre visible de la modalidad', () => {
    expect(etiquetaModalidad('VIRTUAL')).toBe('Virtual')
    expect(etiquetaModalidad('PRESENCIAL')).toBe('Presencial')
    expect(etiquetaModalidad(undefined)).toBe('Presencial')
  })

  it('no se confunde con la modalidad de pago', () => {
    // «billetera» es modalidad de PAGO: se traduce con modalidadPago; para la asistencia no es una modalidad
    expect(modalidadPago('billetera', null, 'yape')).toBe('Billetera · Yape')
    expect(modalidadDe('billetera')).toBe('PRESENCIAL')
    expect(etiquetaModalidad('billetera')).toBe('Presencial')
  })
})

describe('etiqueta de la insignia de un tipo', () => {
  it('en un virtual se omite la etiqueta que solo repite «VIRTUAL»', () => {
    expect(etiquetaDeInsignia({ etiqueta: 'VIRTUAL', modalidad: 'VIRTUAL' })).toBeNull()
    expect(etiquetaDeInsignia({ etiqueta: ' virtual ', modalidad: 'VIRTUAL' })).toBeNull()
  })

  it('conserva cualquier otra etiqueta, también en un virtual', () => {
    expect(etiquetaDeInsignia({ etiqueta: 'CON KIT', modalidad: 'PRESENCIAL' })).toBe('CON KIT')
    expect(etiquetaDeInsignia({ etiqueta: 'EN LÍNEA', modalidad: 'VIRTUAL' })).toBe('EN LÍNEA')
  })

  it('un presencial con la etiqueta «VIRTUAL» (backend anterior) la conserva: es lo que se ve hoy', () => {
    expect(etiquetaDeInsignia({ etiqueta: 'VIRTUAL' })).toBe('VIRTUAL')
    expect(etiquetaDeInsignia({ etiqueta: 'VIRTUAL', modalidad: 'PRESENCIAL' })).toBe('VIRTUAL')
  })

  it('sin etiqueta o sin tipo, nada', () => {
    expect(etiquetaDeInsignia({ etiqueta: null })).toBeNull()
    expect(etiquetaDeInsignia({ etiqueta: '' })).toBeNull()
    expect(etiquetaDeInsignia(null)).toBeNull()
  })
})

describe('el backend envía la modalidad (spec 018)', () => {
  it('es cierto cuando algún tipo la trae, aunque sea PRESENCIAL', () => {
    expect(backendConModalidad([{ tipos: [{ modalidad: 'PRESENCIAL' }] }])).toBe(true)
    expect(backendConModalidad([{ tipos: [{}, { modalidad: 'VIRTUAL' }] }])).toBe(true)
  })

  it('es falso con un backend anterior (ningún tipo la trae) o sin tipos: el filtro ?modalidad= se ignoraría', () => {
    expect(backendConModalidad([{ tipos: [{}, {}] }])).toBe(false)
    expect(backendConModalidad([{ tipos: [] }])).toBe(false)
    expect(backendConModalidad([])).toBe(false)
  })
})

describe('hay tipos virtuales (filtro «Modalidad» del listado)', () => {
  it('es cierto con algún tipo virtual', () => {
    expect(hayTiposVirtuales([{ tipos: [{ modalidad: 'PRESENCIAL' }] }, { tipos: [{}, { modalidad: 'VIRTUAL' }] }])).toBe(true)
  })

  it('es falso con la spec 018 desplegada pero sin ningún tipo virtual (aún no se crean): el filtro sería ruido', () => {
    expect(hayTiposVirtuales([{ tipos: [{ modalidad: 'PRESENCIAL' }, { modalidad: 'PRESENCIAL' }] }])).toBe(false)
    expect(backendConModalidad([{ tipos: [{ modalidad: 'PRESENCIAL' }] }])).toBe(true)
  })

  it('es falso con un backend anterior, con modalidades desconocidas, sin tipos o sin categorías', () => {
    expect(hayTiposVirtuales([{ tipos: [{}, {}] }])).toBe(false)
    expect(hayTiposVirtuales([{ tipos: [{ modalidad: 'HIBRIDA' }, { modalidad: null }] }])).toBe(false)
    expect(hayTiposVirtuales([{ tipos: [] }])).toBe(false)
    expect(hayTiposVirtuales([])).toBe(false)
  })
})

describe('editor de tipos contra un backend sin la spec 018', () => {
  it('detecta el backend anterior solo cuando hay tipos y ninguno trae modalidad', () => {
    expect(backendSinModalidad([{ tipos: [{}, {}] }, { tipos: [{}] }])).toBe(true)
    // con la 018 todos los tipos traen la clave, también los presenciales
    expect(backendSinModalidad([{ tipos: [{ modalidad: 'PRESENCIAL' }] }])).toBe(false)
    expect(backendSinModalidad([{ tipos: [{}, { modalidad: 'VIRTUAL' }] }])).toBe(false)
  })

  it('un evento sin tipos no permite saberlo: no se advierte', () => {
    expect(backendSinModalidad([{ tipos: [] }])).toBe(false)
    expect(backendSinModalidad([])).toBe(false)
  })

  it('un tipo guardado como VIRTUAL que vuelve presencial o sin modalidad se detecta (el backend anterior descarta la clave)', () => {
    expect(modalidadVirtualNoGuardada('VIRTUAL', { modalidad: undefined })).toBe(true)
    expect(modalidadVirtualNoGuardada('VIRTUAL', {})).toBe(true)
    expect(modalidadVirtualNoGuardada('VIRTUAL', { modalidad: 'PRESENCIAL' })).toBe(true)
  })

  it('no hay falsa alarma: virtual guardado, presencial pedido, o sin respuesta para comparar', () => {
    expect(modalidadVirtualNoGuardada('VIRTUAL', { modalidad: 'VIRTUAL' })).toBe(false)
    expect(modalidadVirtualNoGuardada('PRESENCIAL', {})).toBe(false)
    expect(modalidadVirtualNoGuardada('PRESENCIAL', { modalidad: 'PRESENCIAL' })).toBe(false)
    expect(modalidadVirtualNoGuardada('VIRTUAL', undefined)).toBe(false)
    expect(modalidadVirtualNoGuardada('VIRTUAL', null)).toBe(false)
  })

  it('los avisos explican el orden de despliegue y no prometen enlaces, horas ni certificado', () => {
    for (const texto of [AVISO_SERVIDOR_SIN_MODALIDAD, AVISO_MODALIDAD_NO_GUARDADA]) {
      expect(texto).toContain('spec 018')
      expect(texto).toContain('Despliega primero el backend')
      expect(texto).not.toMatch(/https?:|www\.|certificad|horas/i)
    }
    expect(AVISO_MODALIDAD_NO_GUARDADA).toContain('PRESENCIAL')
  })
})

describe('textos neutros de la modalidad virtual', () => {
  it('no prometen enlaces, horas ni certificado (decisiones de negocio abiertas)', () => {
    for (const texto of [INDICACIONES_VIRTUAL, LUGAR_VIRTUAL]) {
      expect(texto).not.toMatch(/https?:|www\.|certificad|horas/i)
    }
    expect(INDICACIONES_VIRTUAL).toContain('La organización te compartirá las indicaciones')
  })
})
