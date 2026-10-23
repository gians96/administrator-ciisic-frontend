import { describe, expect, it } from 'vitest'
import type { OpcionesSeguimiento } from '~/types/api'
import {
  FILTROS_REPORTE_VACIOS,
  OPCIONES_SITUACION,
  aParametrosReporte,
  filtrosActivos,
  filtrosReporteDesdeQuery,
  filtrosVigentes,
  nombreDeRespaldo,
  nombreSituacion,
  buscarCursos,
  etiquetaCurso,
  otrasSecciones,
  partesDeBarra,
  porcentaje,
  resumenDeFiltros,
  rutaDeDescarga,
  seccionesDelCiclo,
  tonoAvance,
  tonoSituacion,
} from '~/utils/reportes'
import { MENU, PERMISOS, conDependencias, esPermiso, menuPara } from '~/utils/permisos'
import { aErrorApi } from '~/utils/errores'

const OPCIONES: OpcionesSeguimiento = {
  ciclos: ['I', 'II', 'VI'],
  secciones: [
    { ciclo: 'I', seccion: 'A' },
    { ciclo: 'II', seccion: 'A' },
    { ciclo: 'II', seccion: 'B1' },
    { ciclo: 'VI', seccion: 'A2' },
    { ciclo: 'VI', seccion: 'A10' },
  ],
  turnos: ['M', 'T'],
  asesores: [{ id: 7, nombre: 'DRA. ANGOMA ASTUCURI MIRIAM' }, { id: 8, nombre: 'MG. CÁRDENAS LINO CÉSAR ANDY' }],
}

describe('reportes: situaciones', () => {
  it('nombra y colorea cada situación', () => {
    expect(nombreSituacion('PAGADO')).toBe('Pagó')
    expect(nombreSituacion('EN_REVISION')).toBe('En revisión')
    expect(tonoSituacion('PAGADO')).toBe('ok')
    expect(tonoSituacion('EN_REVISION')).toBe('warn')
    expect(tonoSituacion('RECHAZADO')).toBe('error')
    expect(tonoSituacion('SIN_INSCRIPCION')).toBe('neutral')
  })

  it('el filtro ofrece «No pagaron» además de las cuatro situaciones', () => {
    expect(OPCIONES_SITUACION.map((o) => o.codigo)).toEqual(['NO_PAGADO', 'PAGADO', 'EN_REVISION', 'RECHAZADO', 'SIN_INSCRIPCION'])
  })
})

describe('reportes: filtros', () => {
  it('lee la URL y descarta lo inválido', () => {
    expect(filtrosReporteDesdeQuery({ asesorId: '7', ciclo: 'vi', seccion: 'a2', turno: 't', situacion: 'no_pagado', q: ' ana ', page: '3' })).toEqual({
      asesorId: '7', cursoId: '', ciclo: 'VI', seccion: 'A2', turno: 'T', situacion: 'NO_PAGADO', q: 'ana', page: 3,
    })
    expect(filtrosReporteDesdeQuery({ asesorId: 'abc', situacion: 'PAGO', page: '-2' })).toEqual(FILTROS_REPORTE_VACIOS)
    expect(filtrosReporteDesdeQuery({ asesorId: ['8', '9'], page: '1.5' })).toMatchObject({ asesorId: '8', page: 1 })
    expect(filtrosReporteDesdeQuery({})).toEqual(FILTROS_REPORTE_VACIOS)
  })

  it('envía a la API solo lo que tiene valor y la página desde la 2', () => {
    expect(aParametrosReporte(FILTROS_REPORTE_VACIOS)).toEqual({})
    const filtros = { ...FILTROS_REPORTE_VACIOS, asesorId: '7', ciclo: 'VI', situacion: 'NO_PAGADO' as const, q: 'ana', page: 2 }
    expect(aParametrosReporte(filtros)).toEqual({ asesorId: '7', ciclo: 'VI', situacion: 'NO_PAGADO', q: 'ana', page: '2' })
    expect(aParametrosReporte(filtros, { pagina: false })).toEqual({ asesorId: '7', ciclo: 'VI', situacion: 'NO_PAGADO', q: 'ana' })
    // El resumen solo recibe lo que delimita el grupo
    expect(aParametrosReporte(filtros, { soloAlcance: true })).toEqual({ asesorId: '7', ciclo: 'VI' })
  })

  it('cuenta los filtros puestos sin contar la página', () => {
    expect(filtrosActivos(FILTROS_REPORTE_VACIOS)).toBe(0)
    expect(filtrosActivos({ ...FILTROS_REPORTE_VACIOS, ciclo: 'I', q: 'x', page: 4 })).toBe(2)
  })

  it('quita los filtros que ya no existen tras cargar otro padrón', () => {
    const vigentes = filtrosVigentes({ ...FILTROS_REPORTE_VACIOS, asesorId: '99', ciclo: 'X', seccion: 'Z', turno: 'N', situacion: 'PAGADO' }, OPCIONES)
    expect(vigentes).toEqual({ ...FILTROS_REPORTE_VACIOS, situacion: 'PAGADO' })
    const intactos = { ...FILTROS_REPORTE_VACIOS, asesorId: '7', ciclo: 'II', seccion: 'B1', turno: 'T' }
    expect(filtrosVigentes(intactos, OPCIONES)).toEqual(intactos)
    // Una sección que existe, pero no en el ciclo elegido, se descarta
    expect(filtrosVigentes({ ...FILTROS_REPORTE_VACIOS, ciclo: 'I', seccion: 'B1' }, OPCIONES).seccion).toBe('')
  })

  it('las secciones elegibles dependen del ciclo y se ordenan de forma natural', () => {
    expect(seccionesDelCiclo(OPCIONES, 'VI')).toEqual(['A2', 'A10'])
    expect(seccionesDelCiclo(OPCIONES, 'II')).toEqual(['A', 'B1'])
    expect(seccionesDelCiclo(OPCIONES, '')).toEqual(['A', 'A2', 'A10', 'B1'])
    expect(seccionesDelCiclo(null, '')).toEqual([])
  })

  it('redacta los filtros puestos con el nombre del asesor', () => {
    expect(resumenDeFiltros(FILTROS_REPORTE_VACIOS, OPCIONES)).toBe('')
    expect(resumenDeFiltros({ ...FILTROS_REPORTE_VACIOS, asesorId: '7', ciclo: 'I', situacion: 'NO_PAGADO', q: 'ana' }, OPCIONES))
      .toBe('DRA. ANGOMA ASTUCURI MIRIAM · Ciclo I · No pagaron · «ana»')
  })
})

describe('reportes: avance y descargas', () => {
  it('formatea el avance y lo colorea', () => {
    expect(porcentaje(0.2719)).toMatch(/^27[.,]2\s?%$/)
    expect(porcentaje(0)).toMatch(/^0\s?%$/)
    expect(porcentaje(Number.NaN)).toMatch(/^0\s?%$/)
    expect(tonoAvance(0.8, 10)).toBe('ok')
    expect(tonoAvance(0.4, 10)).toBe('warn')
    expect(tonoAvance(0.1, 10)).toBe('error')
    expect(tonoAvance(0, 0)).toBe('neutral')
  })

  it('arma la barra con las situaciones que tienen alumnos', () => {
    const partes = partesDeBarra({ alumnos: 10, pagaron: 5, enRevision: 0, rechazados: 1, sinInscripcion: 4 })
    expect(partes.map((p) => [p.codigo, p.cantidad, p.porcentaje])).toEqual([['PAGADO', 5, 50], ['RECHAZADO', 1, 10], ['SIN_INSCRIPCION', 4, 40]])
    expect(partesDeBarra({ alumnos: 0, pagaron: 0, enRevision: 0, rechazados: 0, sinInscripcion: 0 })).toEqual([])
  })

  it('la descarga lleva el formato y los filtros, pero no la página', () => {
    expect(rutaDeDescarga(2, 'xlsx', FILTROS_REPORTE_VACIOS)).toBe('events/2/advisory/export?formato=xlsx')
    expect(rutaDeDescarga(2, 'pdf', { ...FILTROS_REPORTE_VACIOS, asesorId: '7', situacion: 'NO_PAGADO', page: 3 })).toBe('events/2/advisory/export?formato=pdf&asesorId=7&situacion=NO_PAGADO')
    expect(nombreDeRespaldo('xlsx', ' DRA. ANGOMA ')).toBe('DRA. ANGOMA.xlsx')
    expect(nombreDeRespaldo('pdf')).toBe('Seguimiento por asesor.pdf')
  })
})

describe('reportes: permisos, menú y errores', () => {
  it('los permisos nuevos están en el catálogo y se implican', () => {
    for (const permiso of ['reportes.ver', 'reportes.exportar', 'reportes.gestionar']) expect(esPermiso(permiso)).toBe(true)
    expect(conDependencias(['reportes.exportar'])).toEqual(expect.arrayContaining(['inscripciones.ver', 'reportes.ver', 'reportes.exportar']))
    expect(PERMISOS).toHaveLength(40)
  })

  it('Reportes aparece en el menú de quien puede verlo', () => {
    const item = MENU.flatMap((seccion) => seccion.items).find((i) => i.to === '/reportes')
    expect(item?.permiso).toBe('reportes.ver')
    const con = (permisos: string[]) => menuPara({ alcance: 'EVENTO', permisos: permisos as never, eventoIds: [1], perfilParticipante: false }).flatMap((s) => s.items.map((i) => i.to))
    expect(con(['reportes.ver', 'inscripciones.ver'])).toContain('/reportes')
    expect(con(['inscripciones.ver'])).not.toContain('/reportes')
  })

  it('traduce los errores del backend', () => {
    const error = (code: string) => aErrorApi({ status: 409, data: { success: false, code, message: 'texto del servidor' } })
    expect(error('PADRON_NOT_LOADED').message).toMatch(/padrón/)
    expect(error('PADRON_SEMESTER_REQUIRED').message).toMatch(/AAAA-1/)
    expect(error('PADRON_COLUMNS_MISSING').message).toMatch(/DNI/)
    expect(error('ADVISOR_NOT_FOUND').message).toMatch(/asesor/)
  })
})

describe('reportes: alumnos en más de una sección (spec 024)', () => {
  it('«otrasSecciones» da las demás, además de la que ya se muestra, de la fila del panel y de la vista pública', () => {
    const fila = { secciones: [{ ciclo: 'VI', seccion: 'A1' }, { ciclo: 'II', seccion: 'B' }, { ciclo: 'IV', seccion: 'B' }] }
    expect(otrasSecciones(fila)).toEqual(['II-B', 'IV-B'])
    expect(otrasSecciones({ secciones: ['VI-A1', 'II-B'] })).toEqual(['II-B'])
  })

  it('cursar en una sola sección, o un backend sin la spec 033, no muestra nada', () => {
    expect(otrasSecciones({ secciones: [{ ciclo: 'I', seccion: 'A' }] })).toEqual([])
    expect(otrasSecciones({ secciones: [] })).toEqual([])
    expect(otrasSecciones({})).toEqual([])
  })
})

describe('reportes: cursos de SIVIRENO (spec 025)', () => {
  const opciones: OpcionesSeguimiento = {
    ciclos: ['II', 'VI'],
    secciones: [{ ciclo: 'II', seccion: 'B' }, { ciclo: 'VI', seccion: 'A1' }],
    turnos: ['M', 'T'],
    asesores: [{ id: 7, nombre: 'DRA. DAGA CHACA MARISOL' }],
    cursos: [
      { id: 1, codigo: 'ISES240601', nombre: 'DISEÑO DE REDES DE COMUNICACIONES', ciclo: 'VI', seccion: 'A1', turno: 'M', docente: { id: 7, nombre: 'DRA. DAGA CHACA MARISOL' } },
      { id: 2, codigo: 'ISES240201', nombre: 'ESTRUCTURA DE DATOS', ciclo: 'II', seccion: 'B', turno: 'T', docente: null },
    ],
  }

  it('el curso viaja en la URL, en los parámetros de la API (también en el alcance) y cuenta como filtro', () => {
    const filtros = filtrosReporteDesdeQuery({ cursoId: '2', ciclo: 'ii' })
    expect(filtros).toMatchObject({ cursoId: '2', ciclo: 'II' })
    expect(aParametrosReporte(filtros)).toEqual({ cursoId: '2', ciclo: 'II' })
    expect(aParametrosReporte(filtros, { soloAlcance: true })).toEqual({ cursoId: '2', ciclo: 'II' })
    expect(filtrosActivos(filtros)).toBe(2)
    expect(rutaDeDescarga(2, 'xlsx', { ...FILTROS_REPORTE_VACIOS, cursoId: '2' })).toBe('events/2/advisory/export?formato=xlsx&cursoId=2')
  })

  it('un curso inválido en la URL se descarta y uno que ya no existe en el padrón se quita', () => {
    expect(filtrosReporteDesdeQuery({ cursoId: 'abc' }).cursoId).toBe('')
    expect(filtrosReporteDesdeQuery({ cursoId: '1; DROP' }).cursoId).toBe('')
    expect(filtrosVigentes({ ...FILTROS_REPORTE_VACIOS, cursoId: '2' }, opciones).cursoId).toBe('2')
    expect(filtrosVigentes({ ...FILTROS_REPORTE_VACIOS, cursoId: '99' }, opciones).cursoId).toBe('')
    // Un backend anterior no trae cursos: el filtro no puede valer
    expect(filtrosVigentes({ ...FILTROS_REPORTE_VACIOS, cursoId: '2' }, { ...opciones, cursos: undefined }).cursoId).toBe('')
  })

  it('el curso se redacta con su ciclo y sección en los filtros puestos', () => {
    expect(etiquetaCurso(opciones.cursos![0])).toBe('DISEÑO DE REDES DE COMUNICACIONES (VI-A1)')
    expect(resumenDeFiltros({ ...FILTROS_REPORTE_VACIOS, cursoId: '2', turno: 'T' }, opciones)).toBe('ESTRUCTURA DE DATOS (II-B) · Turno T')
  })

  it('busca cursos por nombre, código, sección o docente, sin acentos ni mayúsculas y con todas las palabras', () => {
    const cursos = opciones.cursos!
    expect(buscarCursos(cursos, '').map((c) => c.id)).toEqual([1, 2])
    expect(buscarCursos(cursos, 'diseno redes').map((c) => c.id)).toEqual([1])
    expect(buscarCursos(cursos, 'ises240201').map((c) => c.id)).toEqual([2])
    expect(buscarCursos(cursos, 'vi-a1').map((c) => c.id)).toEqual([1])
    expect(buscarCursos(cursos, 'daga').map((c) => c.id)).toEqual([1])
    expect(buscarCursos(cursos, 'daga datos')).toEqual([])
  })
})
