import { describe, expect, it } from 'vitest'
import type { Categoria, InscripcionDetalle, Permiso, TipoInscripcion } from '~/types/api'
import {
  avisosDelCambio, categoriaDelTipo, descuentoTrasCambio, etiquetaOpcionTipo, mensajeTrasCambio, nombreDeTipo, puedeCambiarTipo, tipoElegido,
} from '~/utils/cambioTipo'
import { soles } from '~/utils/formato'
import { tipoDeFila } from '~/utils/inscripciones'
import { PERMISOS, PERMISOS_SOLO_OWNER } from '~/utils/permisos'

const con = (permisos: Permiso[]) => (permiso: Permiso) => permisos.includes(permiso)
const OWNER = con([...PERMISOS])
const ADMINISTRADOR = con(PERMISOS.filter((p) => !PERMISOS_SOLO_OWNER.includes(p)))
const TESORERO = con(['resumen.ver', 'inscripciones.ver', 'pagos.ver', 'inscripciones.validar'])

function tipo(cambios: Partial<TipoInscripcion> = {}): TipoInscripcion {
  return {
    id: 7, categoriaId: 3, codigo: 'general_con_kit', nombre: 'PROFESIONALES Y PUBLICO EN GENERAL', etiqueta: 'CON KIT', descripcion: null, caracteristicas: null,
    precio: 140, precioInstitucional: 120, disponiblePara: 'TODOS', modalidad: 'PRESENCIAL', excluyeEstudiantesUndc: false, activo: true, orden: 1, ...cambios,
  }
}

const DOCENTES = tipo({ id: 9, categoriaId: 4, codigo: 'docentes_con_kit', nombre: 'Docente, egresados y administrativos de la Facultad Ingeniería UNDC', precio: 120, precioInstitucional: 120 })
const GENERAL_VIRTUAL = tipo({ id: 11, codigo: 'general_virtual', etiqueta: 'VIRTUAL', precio: 50, precioInstitucional: 50, modalidad: 'VIRTUAL' })

function categoria(id: number, nombre: string, tipos: TipoInscripcion[]): Categoria {
  return { id, eventoId: 2, codigo: nombre.slice(0, 6).toUpperCase(), nombre, descripcion: null, caracteristicas: null, precioDesde: null, esEstudiantil: false, orden: id, tipos }
}

const CATEGORIAS = [
  categoria(3, 'PROFESIONALES Y PUBLICO EN GENERAL', [tipo(), tipo({ id: 8, etiqueta: 'SIN KIT', precio: 100, precioInstitucional: 80 }), GENERAL_VIRTUAL]),
  categoria(4, DOCENTES.nombre, [DOCENTES]),
]

function detalle(cambios: Record<string, unknown> = {}): InscripcionDetalle {
  return {
    id: 317, eventoId: 2, evento: { id: 2, codigo: 'ciisic-viii-2026', nombreCorto: 'VIII CIISIC 2026' },
    creadoEn: '2026-10-01T17:18:00.000Z', actualizadoEn: '2026-10-01T17:18:00.000Z',
    participante: { id: 50, tipoDocumento: 'dni', numeroDocumento: '02442123', nombres: 'JAIR EMERSON', apellidos: 'FERREYROS YUCRA', correo: 'jferreyros@undc.edu.pe', celular: '951881199' },
    tipoInscripcion: { ...tipo(), categoria: { id: 3, codigo: 'PROFESIONALES', nombre: 'PROFESIONALES Y PUBLICO EN GENERAL', esEstudiantil: false } },
    clasificacion: null,
    estado: { id: 2, codigo: 'PENDIENTE', nombre: 'Pendiente' },
    pago: { monto: 120, descuento: 20, tieneDescuento: true, modalidad: 'billetera', banco: null, tipoOperacion: null, billeteraDigital: 'yape', numeroOperacion: '13960309', fechaPago: '2026-10-01', tieneVoucher: true, voucherMime: 'image/png' },
    verificacion: { esEstudianteUndc: false, esCorreoInstitucional: true, codigoEstudiante: null, detalle: null },
    delegacion: null,
    revision: { motivoRechazo: null, revisadoPor: null, revisadoEn: null, credencialEnviadaEn: null },
    ...cambios,
  } as unknown as InscripcionDetalle
}

describe('cambiar tipo: quién ve el botón', () => {
  it('solo el Owner (inscripciones.cambiar_tipo)', () => {
    expect(puedeCambiarTipo(detalle(), OWNER)).toBe(true)
    expect(puedeCambiarTipo(detalle(), ADMINISTRADOR)).toBe(false)
    expect(puedeCambiarTipo(detalle(), TESORERO)).toBe(false)
  })

  it('no en un integrante de una delegación: su plan se cambia en Delegaciones', () => {
    const enGrupo = detalle({ delegacion: { id: 8, nombre: 'UNH', codigoLink: 'abc', totalIntegrantes: 3, pago: null } })
    expect(puedeCambiarTipo(enGrupo, OWNER)).toBe(false)
  })

  it('el permiso es del Owner y no del Administrador', () => {
    expect(PERMISOS_SOLO_OWNER).toContain('inscripciones.cambiar_tipo')
    expect(PERMISOS).toContain('inscripciones.cambiar_tipo')
  })
})

describe('cambiar tipo: opciones del selector', () => {
  it('nombre y etiqueta, como en el detalle', () => {
    expect(nombreDeTipo(tipo())).toBe('PROFESIONALES Y PUBLICO EN GENERAL · CON KIT')
    expect(nombreDeTipo(tipo({ etiqueta: null }))).toBe('PROFESIONALES Y PUBLICO EN GENERAL')
  })

  it('con pagos.ver agrega el precio; sin él no (llega en null)', () => {
    expect(etiquetaOpcionTipo(tipo(), true)).toBe(`PROFESIONALES Y PUBLICO EN GENERAL · CON KIT · ${soles(140)}`)
    expect(etiquetaOpcionTipo(tipo({ precio: null }), true)).toBe('PROFESIONALES Y PUBLICO EN GENERAL · CON KIT')
    expect(etiquetaOpcionTipo(tipo(), false)).toBe('PROFESIONALES Y PUBLICO EN GENERAL · CON KIT')
  })

  it('marca los tipos inactivos y los virtuales cuya etiqueta no lo dice', () => {
    expect(etiquetaOpcionTipo(tipo({ activo: false }), false)).toBe('PROFESIONALES Y PUBLICO EN GENERAL · CON KIT · inactivo')
    expect(etiquetaOpcionTipo(tipo({ etiqueta: 'CON KIT', modalidad: 'VIRTUAL' }), false)).toBe('PROFESIONALES Y PUBLICO EN GENERAL · CON KIT · Virtual')
    // «VIRTUAL» ya está en la etiqueta: no se repite
    expect(etiquetaOpcionTipo(GENERAL_VIRTUAL, false)).toBe('PROFESIONALES Y PUBLICO EN GENERAL · VIRTUAL')
  })

  it('encuentra la categoría y el tipo elegido', () => {
    expect(categoriaDelTipo(CATEGORIAS, 9)?.id).toBe(4)
    expect(categoriaDelTipo(CATEGORIAS, 8)?.id).toBe(3)
    expect(categoriaDelTipo(CATEGORIAS, 999)).toBeNull()
    expect(categoriaDelTipo(CATEGORIAS, null)).toBeNull()
    expect(tipoElegido(CATEGORIAS, 11)?.codigo).toBe('general_virtual')
    expect(tipoElegido(CATEGORIAS, null)).toBeNull()
    expect(tipoElegido(CATEGORIAS, 999)).toBeNull()
  })
})

describe('cambiar tipo: descuento tras el cambio (igual que el backend)', () => {
  it('es el precio de lista del tipo nuevo menos lo pagado, sin bajar de 0', () => {
    expect(descuentoTrasCambio(detalle(), { precio: 120 })).toBe(0)
    expect(descuentoTrasCambio(detalle(), { precio: 140 })).toBe(20)
    expect(descuentoTrasCambio(detalle(), { precio: 100 })).toBe(0)
  })

  it('redondea a centavos', () => {
    expect(descuentoTrasCambio(detalle({ pago: { ...detalle().pago, monto: 66.67 } }), { precio: 100 })).toBe(33.33)
  })

  it('una cortesía nunca tiene descuento', () => {
    expect(descuentoTrasCambio(detalle({ pago: { ...detalle().pago, monto: 0, modalidad: 'cortesia' } }), { precio: 140 })).toBe(0)
  })

  it('sin pagos.ver (importes en null) no se puede calcular', () => {
    expect(descuentoTrasCambio(detalle({ pago: { ...detalle().pago, monto: null } }), { precio: 140 })).toBeNull()
    expect(descuentoTrasCambio(detalle(), { precio: null })).toBeNull()
  })
})

describe('cambiar tipo: avisos antes de guardar', () => {
  const textos = (d: InscripcionDetalle, nuevo: TipoInscripcion | null, conPagos = true) => avisosDelCambio(d, nuevo, conPagos).map((aviso) => aviso.texto)

  it('sin elección o con el mismo tipo, nada', () => {
    expect(avisosDelCambio(detalle(), null, true)).toEqual([])
    expect(avisosDelCambio(detalle(), tipo(), true)).toEqual([])
  })

  it('pasar de «público general» (120 con descuento) a docentes (120): solo cambia el descuento', () => {
    expect(textos(detalle(), DOCENTES)).toEqual([`El descuento pasa de ${soles(20)} a ${soles(0)} (se calcula contra el precio del tipo elegido).`])
  })

  it('avisa si lo pagado no coincide con el precio del tipo ni con su precio institucional', () => {
    const [aviso] = avisosDelCambio(detalle(), tipo({ id: 12, precio: 200, precioInstitucional: 180 }), true)
    expect(aviso).toEqual({ tono: 'warn', texto: `Pagó ${soles(120)} y el tipo elegido cuesta ${soles(200)} (${soles(180)} con correo institucional). El monto pagado no se modifica.` })
  })

  it('lo pagado igual al precio institucional del tipo es lo normal: sin aviso de monto', () => {
    const avisos = avisosDelCambio(detalle(), tipo({ id: 12, precio: 140, precioInstitucional: 120 }), true)
    expect(avisos.some((aviso) => aviso.texto.startsWith('Pagó'))).toBe(false)
  })

  it('no menciona precios sin pagos.ver ni en una cortesía', () => {
    expect(textos(detalle({ pago: { ...detalle().pago, monto: null, descuento: null } }), tipo({ id: 12, precio: null, precioInstitucional: null }), false)).toEqual([])
    expect(textos(detalle({ pago: { ...detalle().pago, monto: 0, descuento: 0, modalidad: 'cortesia' } }), tipo({ id: 12, precio: 200 }))).toEqual([])
  })

  it('pasar a virtual libera el aforo de sus ponencias; pasar a presencial puede no tener cupo', () => {
    expect(textos(detalle(), GENERAL_VIRTUAL, false).join(' ')).toContain('pasarán a virtual y liberarán su lugar en el aforo')
    const virtual = detalle({ tipoInscripcion: { ...tipo(GENERAL_VIRTUAL), categoria: { id: 3, codigo: 'P', nombre: 'P', esEstudiantil: false } } })
    const [aviso] = avisosDelCambio(virtual, tipo(), false)
    expect(aviso?.tono).toBe('warn')
    expect(aviso?.texto).toContain('ocuparán aforo presencial')
    expect(aviso?.texto).toContain('no se podrá guardar')
  })

  it('una inscripción aprobada avisa que su credencial se actualiza sola pero no se envía', () => {
    const aprobada = detalle({ estado: { id: 3, codigo: 'APROBADO', nombre: 'Aprobado' } })
    expect(textos(aprobada, DOCENTES).some((texto) => texto.includes('No se envía ningún correo'))).toBe(true)
    expect(textos(detalle(), DOCENTES).some((texto) => texto.includes('No se envía ningún correo'))).toBe(false)
  })

  it('un tipo sin modalidad se lee presencial (backend anterior)', () => {
    const sinModalidad = tipo({ id: 12, modalidad: undefined })
    expect(avisosDelCambio(detalle(), sinModalidad, false)).toEqual([])
  })
})

describe('cambiar tipo: mensaje al terminar', () => {
  const resultado = (cambios: Record<string, unknown> = {}) => ({
    tipoInscripcion: { ...DOCENTES, categoria: { id: 4, codigo: 'D', nombre: 'D', esEstudiantil: false } },
    estado: { id: 2, codigo: 'PENDIENTE', nombre: 'Pendiente' },
    ...cambios,
  }) as Pick<InscripcionDetalle, 'tipoInscripcion' | 'estado' | 'ponenciasActualizadas'>

  it('dice el tipo nuevo', () => {
    expect(mensajeTrasCambio(resultado())).toBe('Tipo actualizado a «Docente, egresados y administrativos de la Facultad Ingeniería UNDC · CON KIT».')
    expect(mensajeTrasCambio(resultado({ tipoInscripcion: null }))).toBe('Tipo actualizado a «sin tipo».')
  })

  it('cuenta las ponencias actualizadas y recuerda reenviar la credencial de una aprobada', () => {
    expect(mensajeTrasCambio(resultado({ ponenciasActualizadas: 1 }))).toContain('Se actualizó 1 inscripción a ponencias especializadas.')
    expect(mensajeTrasCambio(resultado({ ponenciasActualizadas: 3 }))).toContain('Se actualizaron 3 inscripciones a ponencias especializadas.')
    expect(mensajeTrasCambio(resultado({ ponenciasActualizadas: 0 }))).not.toContain('ponencias')
    expect(mensajeTrasCambio(resultado({ estado: { id: 3, codigo: 'APROBADO', nombre: 'Aprobado' } }))).toContain('reenvíala')
  })
})

describe('cambiar tipo: la fila del listado sigue al detalle', () => {
  it('lleva el código de la categoría, no su nombre', () => {
    const fila = tipoDeFila(detalle({ tipoInscripcion: { ...DOCENTES, categoria: { id: 4, codigo: 'DOCENTES', nombre: DOCENTES.nombre, esEstudiantil: false } } }))
    expect(fila).toEqual({ id: 9, nombre: DOCENTES.nombre, etiqueta: 'CON KIT', categoria: 'DOCENTES', modalidad: 'PRESENCIAL' })
  })

  it('sin tipo (cortesía) es null', () => {
    expect(tipoDeFila(detalle({ tipoInscripcion: null }))).toBeNull()
  })
})
