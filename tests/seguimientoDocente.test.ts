import { describe, expect, it } from 'vitest'
import type { AlumnoDocente } from '~/types/api'
import { FILTROS_DOCENTE_VACIOS, claveDeSeccion, conteosDocente, filtrarAlumnosDocente, textoParaBuscar } from '~/utils/seguimientoDocente'

const alumno = (codigo: string, nombre: string, situacion: AlumnoDocente['situacion'], ciclo = 'I', seccion = 'A'): AlumnoDocente =>
  ({ nombre, codigo, ciclo, seccion, turno: 'M', celular: null, situacion })

const ALUMNOS = [
  alumno('2621010001', 'ÁLVAREZ PÉREZ ANA', 'PAGADO'),
  alumno('2621010002', 'BRAVO LUNA CARLOS', 'EN_REVISION'),
  alumno('2621010003', 'CÁRDENAS RÍOS DIEGO', 'SIN_INSCRIPCION', 'II', 'B'),
  alumno('2621010004', 'DÍAZ SOTO ELENA', 'RECHAZADO', 'II', 'B'),
]
const ids = (lista: AlumnoDocente[]) => lista.map((a) => a.codigo.slice(-1))

describe('vista del docente: filtros', () => {
  it('sin filtros trae a todos', () => {
    expect(filtrarAlumnosDocente(ALUMNOS, FILTROS_DOCENTE_VACIOS)).toHaveLength(4)
  })

  it('filtra por sección (ciclo y sección juntos)', () => {
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, seccion: claveDeSeccion('II', 'B') }))).toEqual(['3', '4'])
    expect(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, seccion: claveDeSeccion('III', 'A') })).toEqual([])
  })

  it('«No pagaron» incluye todo lo que no es «Pagó»', () => {
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, situacion: 'NO_PAGADO' }))).toEqual(['2', '3', '4'])
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, situacion: 'PAGADO' }))).toEqual(['1'])
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, situacion: 'EN_REVISION' }))).toEqual(['2'])
  })

  it('la búsqueda ignora acentos y mayúsculas, pide todas las palabras y mira nombre y código', () => {
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, q: 'alvarez ana' }))).toEqual(['1'])
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, q: 'rios' }))).toEqual(['3'])
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, q: '2621010004' }))).toEqual(['4'])
    expect(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, q: 'alvarez diego' })).toEqual([])
  })

  it('combina los filtros', () => {
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { seccion: claveDeSeccion('II', 'B'), situacion: 'NO_PAGADO', q: 'diaz' }))).toEqual(['4'])
  })

  it('normaliza el texto para buscar', () => {
    expect(textoParaBuscar('  MUÑOZ   Cárdenas ')).toBe('munoz cardenas')
    expect(textoParaBuscar(null)).toBe('')
  })
})

describe('vista del docente: conteos', () => {
  it('cuenta cada situación y los que no pagaron', () => {
    expect(conteosDocente(ALUMNOS)).toEqual({ todos: 4, noPagado: 3, porSituacion: { PAGADO: 1, EN_REVISION: 1, RECHAZADO: 1, SIN_INSCRIPCION: 1 } })
    expect(conteosDocente([])).toEqual({ todos: 0, noPagado: 0, porSituacion: { PAGADO: 0, EN_REVISION: 0, RECHAZADO: 0, SIN_INSCRIPCION: 0 } })
  })
})
