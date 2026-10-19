import { describe, expect, it } from 'vitest'
import type { Categoria, TipoInscripcion } from '~/types/api'
import {
  OPCIONES_DISPONIBILIDAD,
  OPCIONES_MODALIDAD,
  ayudaDisponibilidad,
  ayudaModalidad,
  ayudaPrecioUndc,
  cuerpoTipo,
  formularioDeTipo,
  precioUndcAlElegirVirtual,
  sePuedeIgualarPrecioUndc,
  type FormularioTipo,
} from '~/utils/tiposInscripcion'

const formulario = (cambios: Partial<FormularioTipo> = {}): FormularioTipo => ({
  codigo: ' General_Sin_Kit ',
  nombre: 'PROFESIONALES Y PUBLICO EN GENERAL',
  etiqueta: ' SIN KIT ',
  descripcion: '  ',
  precio: 80,
  precioInstitucional: 60,
  disponiblePara: 'TODOS',
  modalidad: 'PRESENCIAL',
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
  it('normaliza los campos y envía la disponibilidad y la modalidad', () => {
    expect(cuerpo(formulario())).toEqual({
      codigo: 'general_sin_kit',
      nombre: 'PROFESIONALES Y PUBLICO EN GENERAL',
      etiqueta: 'SIN KIT',
      descripcion: null,
      precio: 80,
      precioInstitucional: 60,
      disponiblePara: 'TODOS',
      modalidad: 'PRESENCIAL',
      activo: true,
      orden: 2,
      caracteristicas: [{ icon: 'heroicons:check', text: 'Acceso a todas las ponencias' }],
    })
  })

  it('envía «VIRTUAL» sin tocar los precios (30 / 30 es un tipo válido)', () => {
    const body = cuerpo(formulario({ codigo: 'estudiantes_virtual', etiqueta: 'VIRTUAL', precio: 30, precioInstitucional: 30, modalidad: 'VIRTUAL' }))
    expect(body).toMatchObject({ codigo: 'estudiantes_virtual', etiqueta: 'VIRTUAL', precio: 30, precioInstitucional: 30, disponiblePara: 'TODOS', modalidad: 'VIRTUAL' })
  })

  it('una modalidad desconocida viaja como PRESENCIAL (nunca un valor que el backend rechazaría con 422)', () => {
    const rara = formulario({ modalidad: 'HIBRIDA' as unknown as FormularioTipo['modalidad'] })
    expect(cuerpo(rara)).toMatchObject({ modalidad: 'PRESENCIAL' })
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

  it('sin permiso de pagos no envía precios, pero sí la disponibilidad y la modalidad (no es un precio)', () => {
    const body = cuerpo(formulario({ precio: '', precioInstitucional: '', disponiblePara: 'INSTITUCIONAL', modalidad: 'VIRTUAL' }), true)
    expect(body).not.toHaveProperty('precio')
    expect(body).not.toHaveProperty('precioInstitucional')
    expect(body).toMatchObject({ disponiblePara: 'INSTITUCIONAL', modalidad: 'VIRTUAL' })
  })
})

const tipo = (cambios: Partial<TipoInscripcion> = {}): TipoInscripcion => ({
  id: 7,
  categoriaId: 1,
  codigo: 'estudiantes_virtual',
  nombre: 'ESTUDIANTES',
  etiqueta: 'VIRTUAL',
  descripcion: null,
  caracteristicas: null,
  precio: 30,
  precioInstitucional: 30,
  disponiblePara: 'TODOS',
  modalidad: 'VIRTUAL',
  activo: true,
  orden: 3,
  ...cambios,
})

const categoria: Pick<Categoria, 'nombre' | 'tipos'> = { nombre: 'ESTUDIANTES', tipos: [tipo(), tipo({ id: 8 })] }

describe('formulario de un tipo (modalidad)', () => {
  it('un tipo nuevo nace presencial, con el nombre de la categoría y el siguiente orden', () => {
    expect(formularioDeTipo(null, categoria)).toMatchObject({ nombre: 'ESTUDIANTES', modalidad: 'PRESENCIAL', disponiblePara: 'TODOS', activo: true, orden: 3 })
  })

  it('al editar un tipo virtual parte de VIRTUAL con sus precios', () => {
    expect(formularioDeTipo(tipo(), categoria)).toMatchObject({ modalidad: 'VIRTUAL', precio: 30, precioInstitucional: 30, etiqueta: 'VIRTUAL' })
  })

  it('un tipo que el backend aún no devuelve con modalidad (o con una desconocida o null) parte de PRESENCIAL', () => {
    const { modalidad: _quitada, ...sinModalidad } = tipo()
    expect(formularioDeTipo(sinModalidad, categoria).modalidad).toBe('PRESENCIAL')
    expect(formularioDeTipo(tipo({ modalidad: null as unknown as TipoInscripcion['modalidad'] }), categoria).modalidad).toBe('PRESENCIAL')
    expect(formularioDeTipo(tipo({ modalidad: 'HIBRIDA' as unknown as TipoInscripcion['modalidad'] }), categoria).modalidad).toBe('PRESENCIAL')
  })

  it('sin permiso de pagos (precios null) los precios quedan en 0 y no se envían', () => {
    const form = formularioDeTipo(tipo({ precio: null, precioInstitucional: null }), categoria)
    expect(form).toMatchObject({ precio: 0, precioInstitucional: 0, modalidad: 'VIRTUAL' })
    expect(cuerpo(form, true)).not.toHaveProperty('precio')
  })
})

describe('tarifa única de un tipo virtual', () => {
  it('al elegir «Virtual» con el precio UNDC de fábrica (0 o vacío) lo iguala al regular', () => {
    expect(precioUndcAlElegirVirtual({ precio: 30, precioInstitucional: 0 })).toBe(30)
    expect(precioUndcAlElegirVirtual({ precio: 50, precioInstitucional: '' })).toBe(50)
  })

  it('no pisa un precio UNDC que la persona ya escribió', () => {
    expect(precioUndcAlElegirVirtual({ precio: 30, precioInstitucional: 25 })).toBe(25)
    expect(precioUndcAlElegirVirtual({ precio: 30, precioInstitucional: 30 })).toBe(30)
  })

  it('sin precio regular escrito no inventa uno', () => {
    expect(precioUndcAlElegirVirtual({ precio: '', precioInstitucional: 0 })).toBe(0)
    expect(precioUndcAlElegirVirtual({ precio: '', precioInstitucional: '' })).toBe('')
  })

  it('ofrece «Igualar al precio regular» solo en un virtual con los precios distintos y precio UNDC aplicable', () => {
    const virtual = { modalidad: 'VIRTUAL' as const, disponiblePara: 'TODOS' as const, precio: 30, precioInstitucional: 0 }
    expect(sePuedeIgualarPrecioUndc(virtual)).toBe(true)
    expect(sePuedeIgualarPrecioUndc({ ...virtual, precioInstitucional: '' })).toBe(true)
    expect(sePuedeIgualarPrecioUndc({ ...virtual, precioInstitucional: 30 })).toBe(false)
    expect(sePuedeIgualarPrecioUndc({ ...virtual, modalidad: 'PRESENCIAL' })).toBe(false)
    expect(sePuedeIgualarPrecioUndc({ ...virtual, disponiblePara: 'EXTERNOS' })).toBe(false)
    expect(sePuedeIgualarPrecioUndc({ ...virtual, precio: '' })).toBe(false)
  })

  it('la ayuda del precio UNDC avisa la tarifa única en un virtual, y mantiene las anteriores', () => {
    expect(ayudaPrecioUndc('TODOS', 'VIRTUAL')).toContain('Tarifa única')
    expect(ayudaPrecioUndc('TODOS', 'PRESENCIAL')).toBe('0 = gratis para la comunidad UNDC.')
    expect(ayudaPrecioUndc('EXTERNOS', 'PRESENCIAL')).toContain('No aplica')
    expect(ayudaPrecioUndc('EXTERNOS', 'VIRTUAL')).toContain('No aplica')
  })
})

describe('opciones y ayuda de «Modalidad»', () => {
  it('ofrece presencial primero (por defecto) y virtual', () => {
    expect(OPCIONES_MODALIDAD.map((opcion) => opcion.valor)).toEqual(['PRESENCIAL', 'VIRTUAL'])
  })

  it('la ayuda no promete certificado, horas ni enlaces', () => {
    for (const modalidad of ['PRESENCIAL', 'VIRTUAL'] as const) {
      expect(ayudaModalidad(modalidad)).not.toMatch(/certificad|horas|https?:/i)
    }
    expect(ayudaModalidad('VIRTUAL')).toContain('Virtual')
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
