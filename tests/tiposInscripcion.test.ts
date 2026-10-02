import { describe, expect, it } from 'vitest'
import { OPCIONES_DISPONIBILIDAD, ayudaDisponibilidad, cuerpoTipo, type FormularioTipo } from '~/utils/tiposInscripcion'

const formulario = (cambios: Partial<FormularioTipo> = {}): FormularioTipo => ({
  codigo: ' General_Sin_Kit ',
  nombre: 'PROFESIONALES Y PUBLICO EN GENERAL',
  etiqueta: ' SIN KIT ',
  descripcion: '  ',
  precio: 80,
  precioInstitucional: 60,
  disponiblePara: 'TODOS',
  activo: true,
  orden: 2,
  ...cambios,
})

const cuerpo = (form: FormularioTipo, preciosOcultos = false) => {
  const resultado = cuerpoTipo(form, [{ icon: '', text: ' Acceso a todas las ponencias ' }, { icon: 'heroicons:x-mark', text: '  ' }], { preciosOcultos })
  if (!resultado.ok) throw new Error(JSON.stringify(resultado.errores))
  return resultado.body
}

describe('cuerpo del tipo de inscripción', () => {
  it('normaliza los campos y envía la disponibilidad', () => {
    expect(cuerpo(formulario())).toEqual({
      codigo: 'general_sin_kit',
      nombre: 'PROFESIONALES Y PUBLICO EN GENERAL',
      etiqueta: 'SIN KIT',
      descripcion: null,
      precio: 80,
      precioInstitucional: 60,
      disponiblePara: 'TODOS',
      activo: true,
      orden: 2,
      caracteristicas: [{ icon: 'heroicons:check', text: 'Acceso a todas las ponencias' }],
    })
  })

  it('un precio vacío es un error, no 0 (0 sería «gratis»)', () => {
    expect(cuerpoTipo(formulario({ precioInstitucional: '' }), [], { preciosOcultos: false })).toEqual({
      ok: false,
      errores: { precioInstitucional: 'Ingresa el precio UNDC o elige «Solo externos» en Disponible para.' },
    })
    expect(cuerpoTipo(formulario({ precio: '' }), [], { preciosOcultos: false })).toMatchObject({ ok: false, errores: { precio: 'Ingresa el precio regular.' } })
  })

  it('0 sigue siendo un precio válido (gratis para la comunidad UNDC)', () => {
    expect(cuerpo(formulario({ precioInstitucional: 0 }))).toMatchObject({ precioInstitucional: 0 })
  })

  it('«solo externos» no pide el precio UNDC y lo envía igual al regular', () => {
    expect(cuerpo(formulario({ disponiblePara: 'EXTERNOS', precioInstitucional: '' }))).toMatchObject({ disponiblePara: 'EXTERNOS', precio: 80, precioInstitucional: 80 })
    expect(cuerpo(formulario({ disponiblePara: 'EXTERNOS', precioInstitucional: 0 }))).toMatchObject({ precioInstitucional: 80 })
  })

  it('sin permiso de pagos no envía precios, pero sí la disponibilidad', () => {
    const body = cuerpo(formulario({ precio: '', precioInstitucional: '', disponiblePara: 'INSTITUCIONAL' }), true)
    expect(body).not.toHaveProperty('precio')
    expect(body).not.toHaveProperty('precioInstitucional')
    expect(body).toMatchObject({ disponiblePara: 'INSTITUCIONAL' })
  })
})

describe('opciones y ayuda de «Disponible para»', () => {
  it('ofrece los tres valores del backend en orden', () => {
    expect(OPCIONES_DISPONIBILIDAD.map((opcion) => opcion.valor)).toEqual(['TODOS', 'INSTITUCIONAL', 'EXTERNOS'])
  })

  it('explica quién es la comunidad UNDC según la categoría', () => {
    expect(ayudaDisponibilidad(true)).toContain('estudiante verificado')
    expect(ayudaDisponibilidad(false)).toContain('@undc.edu.pe')
  })
})
