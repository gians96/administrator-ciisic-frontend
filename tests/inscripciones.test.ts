import { describe, expect, it } from 'vitest'
import type { Permiso } from '~/types/api'
import { accionesInscripcion, descripcionInscripciones, hayAcciones, placeholderBusqueda } from '~/utils/inscripciones'
import { PERMISOS, PERMISOS_SOLO_OWNER } from '~/utils/permisos'

const con = (permisos: Permiso[]) => (permiso: Permiso) => permisos.includes(permiso)

const OWNER = con([...PERMISOS])
const ADMINISTRADOR = con(PERMISOS.filter((p) => !PERMISOS_SOLO_OWNER.includes(p)))
const TESORERO = con(['resumen.ver', 'inscripciones.ver', 'inscripciones.exportar', 'credenciales.reenviar', 'pagos.ver', 'inscripciones.validar'])
const COMISION = con(['inscripciones.ver', 'credenciales.reenviar'])
const SOLO_VER = con(['inscripciones.ver'])

describe('inscripciones: acciones del detalle', () => {
  it('el Administrador valida, cancela y reenvía', () => {
    expect(accionesInscripcion('PENDIENTE', ADMINISTRADOR)).toEqual({
      verCredencial: false, reenviarCredencial: false, enRevision: true, rechazar: true, aprobar: true, cancelar: true, eliminar: false,
    })
    expect(accionesInscripcion('APROBADO', ADMINISTRADOR)).toEqual({
      verCredencial: true, reenviarCredencial: true, enRevision: false, rechazar: true, aprobar: false, cancelar: true, eliminar: false,
    })
    expect(accionesInscripcion('CANCELADO', ADMINISTRADOR).cancelar).toBe(false)
  })

  it('solo el Owner elimina, y solo inscripciones rechazadas o canceladas (spec 017 del backend)', () => {
    expect(accionesInscripcion('RECHAZADO', OWNER).eliminar).toBe(true)
    expect(accionesInscripcion('CANCELADO', OWNER).eliminar).toBe(true)
    for (const estado of ['PENDIENTE', 'EN_REVISION', 'APROBADO'] as const) expect(accionesInscripcion(estado, OWNER).eliminar).toBe(false)
    for (const estado of ['RECHAZADO', 'CANCELADO'] as const) {
      expect(accionesInscripcion(estado, ADMINISTRADOR).eliminar).toBe(false)
      expect(accionesInscripcion(estado, TESORERO).eliminar).toBe(false)
    }
  })

  it('el Tesorero valida pero no cancela (sin inscripciones.cancelar)', () => {
    const acciones = accionesInscripcion('EN_REVISION', TESORERO)
    expect(acciones).toMatchObject({ enRevision: false, rechazar: true, aprobar: true, cancelar: false })
  })

  it('cancelar exige también inscripciones.validar (la ruta de estado lo pide)', () => {
    expect(accionesInscripcion('PENDIENTE', con(['inscripciones.cancelar'])).cancelar).toBe(false)
  })

  it('sin inscripciones.validar no hay botones de validación', () => {
    const acciones = accionesInscripcion('PENDIENTE', COMISION)
    expect(acciones).toMatchObject({ enRevision: false, rechazar: false, aprobar: false, cancelar: false })
    expect(hayAcciones(acciones)).toBe(false)
  })

  it('reenviar la credencial exige credenciales.reenviar y una inscripción aprobada', () => {
    expect(accionesInscripcion('APROBADO', COMISION)).toMatchObject({ verCredencial: true, reenviarCredencial: true })
    expect(accionesInscripcion('APROBADO', SOLO_VER)).toMatchObject({ verCredencial: true, reenviarCredencial: false })
    expect(hayAcciones(accionesInscripcion('APROBADO', SOLO_VER))).toBe(true)
  })
})

describe('inscripciones: textos según permisos', () => {
  it('describe el listado según lo que la cuenta puede hacer', () => {
    expect(descripcionInscripciones(TESORERO)).toMatch(/aprueba o rechaza/)
    expect(descripcionInscripciones(COMISION)).toMatch(/reenvía sus credenciales/)
    expect(descripcionInscripciones(SOLO_VER)).toBe('Consulta a los inscritos del evento.')
  })

  it('sin pagos.ver la búsqueda no ofrece el número de operación', () => {
    expect(placeholderBusqueda(true)).toMatch(/operación/)
    expect(placeholderBusqueda(false)).not.toMatch(/operación/)
  })
})
