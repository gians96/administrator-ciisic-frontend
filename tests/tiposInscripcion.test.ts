import { describe, expect, it } from 'vitest'
import type { Categoria, TipoInscripcion } from '~/types/api'
import {
  AVISO_EXCLUYE_NO_GUARDADO,
  OPCIONES_DISPONIBILIDAD,
  OPCIONES_MODALIDAD,
  avisoCambioModalidad,
  avisoTarifaUnica,
  ayudaDisponibilidad,
  ayudaModalidad,
  ayudaPrecioUndc,
  backendSinExcluyeEstudiantes,
  cuerpoTipo,
  excluyeEstudiantesNoGuardado,
  formularioDeTipo,
  precioUndcAlCambiarModalidad,
  precioUndcAlElegirVirtual,
  sePuedeIgualarPrecioUndc,
  type FormularioTipo,
  type PrecargaPrecioUndc,
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
  excluyeEstudiantesUndc: false,
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
      excluyeEstudiantesUndc: false,
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

describe('precio UNDC al cambiar la modalidad del formulario', () => {
  const sinPrecarga = { creando: true, precarga: null }

  it('en un tipo nuevo, «Virtual» con el precio UNDC de fábrica lo iguala al regular y recuerda lo que había', () => {
    expect(precioUndcAlCambiarModalidad('VIRTUAL', { precio: 30, precioInstitucional: 0 }, sinPrecarga))
      .toEqual({ precioInstitucional: 30, precarga: { antes: 0, despues: 30 } })
    expect(precioUndcAlCambiarModalidad('VIRTUAL', { precio: 50, precioInstitucional: '' }, sinPrecarga))
      .toEqual({ precioInstitucional: 50, precarga: { antes: '', despues: 50 } })
  })

  it('en un tipo nuevo, no pisa un precio UNDC que la persona ya escribió ni inventa uno sin precio regular', () => {
    expect(precioUndcAlCambiarModalidad('VIRTUAL', { precio: 30, precioInstitucional: 25 }, sinPrecarga)).toEqual({ precioInstitucional: 25, precarga: null })
    // sin cambio no hay nada que deshacer
    expect(precioUndcAlCambiarModalidad('VIRTUAL', { precio: 0, precioInstitucional: 0 }, sinPrecarga)).toEqual({ precioInstitucional: 0, precarga: null })
    expect(precioUndcAlCambiarModalidad('VIRTUAL', { precio: '', precioInstitucional: '' }, sinPrecarga)).toEqual({ precioInstitucional: '', precarga: null })
  })

  it('al EDITAR un tipo no toca el precio UNDC: un 0 legítimo (gratis para la comunidad UNDC) no se pisa', () => {
    // Antes: elegir «Virtual» en un tipo de 120 / 0 dejaba el UNDC en 120 y volver a «Presencial» no lo restauraba
    const editando = { creando: false, precarga: null }
    expect(precioUndcAlCambiarModalidad('VIRTUAL', { precio: 120, precioInstitucional: 0 }, editando)).toEqual({ precioInstitucional: 0, precarga: null })
    expect(precioUndcAlCambiarModalidad('PRESENCIAL', { precio: 120, precioInstitucional: 0 }, editando)).toEqual({ precioInstitucional: 0, precarga: null })
  })

  it('volver a «Presencial» restaura el precio UNDC que había antes de la precarga', () => {
    const precarga: PrecargaPrecioUndc = { antes: 0, despues: 30 }
    expect(precioUndcAlCambiarModalidad('PRESENCIAL', { precio: 30, precioInstitucional: 30 }, { creando: true, precarga }))
      .toEqual({ precioInstitucional: 0, precarga: null })
    expect(precioUndcAlCambiarModalidad('PRESENCIAL', { precio: 30, precioInstitucional: 30 }, { creando: true, precarga: { antes: '', despues: 30 } }))
      .toEqual({ precioInstitucional: '', precarga: null })
  })

  it('volver a «Presencial» no pisa un precio UNDC que la persona cambió a mano después', () => {
    expect(precioUndcAlCambiarModalidad('PRESENCIAL', { precio: 30, precioInstitucional: 25 }, { creando: true, precarga: { antes: 0, despues: 30 } }))
      .toEqual({ precioInstitucional: 25, precarga: null })
    expect(precioUndcAlCambiarModalidad('PRESENCIAL', { precio: 80, precioInstitucional: 60 }, sinPrecarga)).toEqual({ precioInstitucional: 60, precarga: null })
  })

  it('ida y vuelta completa en un tipo nuevo: Presencial → Virtual → Presencial deja el formulario como estaba', () => {
    const inicial = { precio: 30, precioInstitucional: 0 }
    const ida = precioUndcAlCambiarModalidad('VIRTUAL', inicial, sinPrecarga)
    const vuelta = precioUndcAlCambiarModalidad('PRESENCIAL', { ...inicial, precioInstitucional: ida.precioInstitucional }, { creando: true, precarga: ida.precarga })
    expect(vuelta.precioInstitucional).toBe(0)
  })
})

describe('confirmación de la tarifa única de un tipo virtual', () => {
  const virtual = { modalidad: 'VIRTUAL' as const, disponiblePara: 'TODOS' as const, precio: 30, precioInstitucional: 0 }
  const visibles = { preciosOcultos: false }

  it('un virtual de 30 con precio UNDC 0 se confirma: la comunidad UNDC se inscribiría gratis', () => {
    // Caso: se elige «Virtual» antes de escribir el precio regular y el UNDC queda en 0
    const aviso = avisoTarifaUnica(virtual, visibles)
    expect(aviso).toContain('30')
    expect(aviso).toContain('Con 0, la comunidad UNDC se inscribe gratis')
    expect(aviso).toContain('¿Guardar así?')
  })

  it('un precio UNDC distinto de 0 también se confirma, sin la nota de «gratis»', () => {
    const aviso = avisoTarifaUnica({ ...virtual, precio: 50, precioInstitucional: 40 }, visibles)
    expect(aviso).toContain('50')
    expect(aviso).toContain('40')
    expect(aviso).not.toContain('gratis')
  })

  it('tarifa única (30 / 30 y 50 / 50): no se pregunta nada', () => {
    expect(avisoTarifaUnica({ ...virtual, precioInstitucional: 30 }, visibles)).toBeNull()
    expect(avisoTarifaUnica({ ...virtual, precio: 50, precioInstitucional: 50 }, visibles)).toBeNull()
    // el precio sale del input numérico como número o como texto sin normalizar
    expect(avisoTarifaUnica({ ...virtual, precioInstitucional: 30.0 }, visibles)).toBeNull()
  })

  it('presencial, solo externos y sin pagos.ver (no se envían precios): no se pregunta', () => {
    expect(avisoTarifaUnica({ ...virtual, modalidad: 'PRESENCIAL' }, visibles)).toBeNull()
    expect(avisoTarifaUnica({ ...virtual, disponiblePara: 'EXTERNOS' }, visibles)).toBeNull()
    expect(avisoTarifaUnica(virtual, { preciosOcultos: true })).toBeNull()
  })

  it('un virtual solo para la comunidad UNDC con precios distintos también se confirma (el UNDC es el que paga)', () => {
    expect(avisoTarifaUnica({ ...virtual, disponiblePara: 'INSTITUCIONAL' }, visibles)).not.toBeNull()
  })

  it('cambiar la modalidad de un tipo con inscripciones se confirma, con el número afectado', () => {
    const aviso = avisoCambioModalidad({ modalidad: 'VIRTUAL', totalInscripciones: 150 }, 'PRESENCIAL')
    expect(aviso).toContain('150 inscripciones')
    expect(aviso).toContain('presencial')
    expect(aviso).toContain('¿Guardar así?')
    expect(avisoCambioModalidad({ modalidad: 'PRESENCIAL', totalInscripciones: 1 }, 'VIRTUAL')).toContain('1 inscripción.')
  })

  it('sin cambio, sin inscripciones, tipo nuevo o total desconocido: no se pregunta', () => {
    expect(avisoCambioModalidad({ modalidad: 'VIRTUAL', totalInscripciones: 150 }, 'VIRTUAL')).toBeNull()
    expect(avisoCambioModalidad({ modalidad: 'VIRTUAL', totalInscripciones: 0 }, 'PRESENCIAL')).toBeNull()
    expect(avisoCambioModalidad({ modalidad: 'VIRTUAL' }, 'PRESENCIAL')).toBeNull()
    expect(avisoCambioModalidad(null, 'VIRTUAL')).toBeNull()
  })

  it('un tipo sin modalidad (backend anterior) cuenta como presencial: pasar a virtual con inscripciones se confirma', () => {
    expect(avisoCambioModalidad({ totalInscripciones: 3 }, 'VIRTUAL')).toContain('3 inscripciones')
    expect(avisoCambioModalidad({ modalidad: null as never, totalInscripciones: 3 }, 'PRESENCIAL')).toBeNull()
  })

  it('no promete certificado, horas ni enlaces', () => {
    expect(avisoTarifaUnica(virtual, visibles)).not.toMatch(/https?:|www\.|certificad|horas/i)
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

describe('«No admitir estudiantes UNDC» (spec 020 del backend)', () => {
  it('un tipo nuevo parte apagado y un tipo con el interruptor encendido lo conserva al editar', () => {
    expect(formularioDeTipo(null, categoria).excluyeEstudiantesUndc).toBe(false)
    expect(formularioDeTipo(tipo({ excluyeEstudiantesUndc: true }), categoria).excluyeEstudiantesUndc).toBe(true)
  })

  it('un tipo que el backend aún no devuelve con el campo (o con un valor raro) parte apagado', () => {
    expect(formularioDeTipo(tipo(), categoria).excluyeEstudiantesUndc).toBe(false)
    expect(formularioDeTipo(tipo({ excluyeEstudiantesUndc: null as unknown as boolean }), categoria).excluyeEstudiantesUndc).toBe(false)
    expect(formularioDeTipo(tipo({ excluyeEstudiantesUndc: 'true' as unknown as boolean }), categoria).excluyeEstudiantesUndc).toBe(false)
  })

  it('viaja siempre en el cuerpo, también sin permiso de pagos (no es un precio)', () => {
    expect(cuerpo(formulario({ excluyeEstudiantesUndc: true }))).toMatchObject({ excluyeEstudiantesUndc: true })
    expect(cuerpo(formulario())).toMatchObject({ excluyeEstudiantesUndc: false })
    const sinPagos = cuerpo(formulario({ precio: '', precioInstitucional: '', excluyeEstudiantesUndc: true }), true)
    expect(sinPagos).not.toHaveProperty('precio')
    expect(sinPagos).toMatchObject({ excluyeEstudiantesUndc: true })
  })

  it('un backend anterior (ningún tipo trae el campo) se detecta; sin tipos no se sabe', () => {
    expect(backendSinExcluyeEstudiantes([{ tipos: [tipo(), tipo({ id: 8 })] }])).toBe(true)
    expect(backendSinExcluyeEstudiantes([{ tipos: [tipo(), tipo({ id: 8, excluyeEstudiantesUndc: false })] }])).toBe(false)
    expect(backendSinExcluyeEstudiantes([{ tipos: [tipo({ excluyeEstudiantesUndc: true })] }])).toBe(false)
    expect(backendSinExcluyeEstudiantes([{ tipos: [] }])).toBe(false)
    expect(backendSinExcluyeEstudiantes([])).toBe(false)
  })

  it('avisa si se pidió encenderlo y el tipo guardado no lo tiene', () => {
    expect(excluyeEstudiantesNoGuardado(true, tipo())).toBe(true)
    expect(excluyeEstudiantesNoGuardado(true, tipo({ excluyeEstudiantesUndc: false }))).toBe(true)
    expect(excluyeEstudiantesNoGuardado(true, tipo({ excluyeEstudiantesUndc: true }))).toBe(false)
    // Apagarlo o no pedirlo nunca avisa, y sin respuesta no se puede saber
    expect(excluyeEstudiantesNoGuardado(false, tipo())).toBe(false)
    expect(excluyeEstudiantesNoGuardado(true, undefined)).toBe(false)
    expect(AVISO_EXCLUYE_NO_GUARDADO).toContain('spec 020')
  })
})
