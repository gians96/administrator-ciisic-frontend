import { describe, expect, it } from 'vitest'
import type { AlumnoCiclo, AlumnoDocente } from '~/types/api'
import { FILTROS_DOCENTE_VACIOS, ciclosDe, claveDeSeccion, conteosDocente, filtrarAlumnosDocente, seccionesDelAlumnoDocente, textoParaBuscar } from '~/utils/seguimientoDocente'

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

  it('filtra por ciclo y lo combina con la sección', () => {
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, ciclo: 'I' }))).toEqual(['1', '2'])
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, ciclo: 'II' }))).toEqual(['3', '4'])
    expect(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, ciclo: 'II', seccion: claveDeSeccion('I', 'A') })).toEqual([])
    expect(filtrarAlumnosDocente(ALUMNOS, { ...FILTROS_DOCENTE_VACIOS, ciclo: 'X' })).toEqual([])
  })

  it('lista los ciclos del docente con su cantidad de estudiantes', () => {
    expect(ciclosDe(ALUMNOS)).toEqual([{ ciclo: 'I', alumnos: 2 }, { ciclo: 'II', alumnos: 2 }])
    expect(ciclosDe([])).toEqual([])
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
    expect(ids(filtrarAlumnosDocente(ALUMNOS, { ciclo: 'II', seccion: claveDeSeccion('II', 'B'), situacion: 'NO_PAGADO', q: 'diaz' }))).toEqual(['4'])
  })

  it('normaliza el texto para buscar', () => {
    expect(textoParaBuscar('  MUÑOZ   Cárdenas ')).toBe('munoz cardenas')
    expect(textoParaBuscar(null)).toBe('')
  })
})

describe('vista del ciclo: los mismos filtros sin celular', () => {
  const delCiclo = ALUMNOS.map(({ celular: _celular, ...resto }): AlumnoCiclo => resto)

  it('filtra y cuenta a los estudiantes que no traen celular', () => {
    expect(filtrarAlumnosDocente(delCiclo, { ...FILTROS_DOCENTE_VACIOS, seccion: claveDeSeccion('II', 'B'), situacion: 'NO_PAGADO' }).map((a) => a.codigo.slice(-1))).toEqual(['3', '4'])
    expect(conteosDocente(delCiclo).noPagado).toBe(3)
  })

  it('devuelve el mismo tipo que recibe (no agrega el celular)', () => {
    const [primero] = filtrarAlumnosDocente(delCiclo, FILTROS_DOCENTE_VACIOS)
    expect('celular' in primero).toBe(false)
  })
})

describe('vista del docente: conteos', () => {
  it('cuenta cada situación y los que no pagaron', () => {
    expect(conteosDocente(ALUMNOS)).toEqual({ todos: 4, noPagado: 3, porSituacion: { PAGADO: 1, EN_REVISION: 1, RECHAZADO: 1, SIN_INSCRIPCION: 1 } })
    expect(conteosDocente([])).toEqual({ todos: 0, noPagado: 0, porSituacion: { PAGADO: 0, EN_REVISION: 0, RECHAZADO: 0, SIN_INSCRIPCION: 0 } })
  })
})

describe('vista del docente: alumnos que cursan en más de una sección (spec 024)', () => {
  // El 1 cursa en I-A y también en II-B; el 3 solo en II-B
  const conVarias: AlumnoDocente[] = [
    { ...alumno('2621010001', 'ÁLVAREZ PÉREZ ANA', 'PAGADO'), secciones: ['I-A', 'II-B'] },
    alumno('2621010002', 'BRAVO LUNA CARLOS', 'EN_REVISION'),
    { ...alumno('2621010003', 'CÁRDENAS RÍOS DIEGO', 'SIN_INSCRIPCION', 'II', 'B'), secciones: ['II-B'] },
  ]

  it('lee las secciones de las etiquetas y, sin ellas (backend anterior), usa la que muestra el alumno', () => {
    expect(seccionesDelAlumnoDocente(conVarias[0])).toEqual([{ ciclo: 'I', seccion: 'A' }, { ciclo: 'II', seccion: 'B' }])
    expect(seccionesDelAlumnoDocente(conVarias[1])).toEqual([{ ciclo: 'I', seccion: 'A' }])
    expect(seccionesDelAlumnoDocente({ ciclo: 'VI', seccion: 'A1', secciones: [] })).toEqual([{ ciclo: 'VI', seccion: 'A1' }])
  })

  it('filtra por ciclo y por sección en cualquiera de las secciones del alumno', () => {
    expect(ids(filtrarAlumnosDocente(conVarias, { ...FILTROS_DOCENTE_VACIOS, ciclo: 'II' }))).toEqual(['1', '3'])
    expect(ids(filtrarAlumnosDocente(conVarias, { ...FILTROS_DOCENTE_VACIOS, seccion: claveDeSeccion('I', 'A') }))).toEqual(['1', '2'])
    expect(ids(filtrarAlumnosDocente(conVarias, { ...FILTROS_DOCENTE_VACIOS, ciclo: 'II', seccion: claveDeSeccion('II', 'B') }))).toEqual(['1', '3'])
  })

  it('cuenta al alumno en cada ciclo en que cursa, en orden académico y una vez por ciclo', () => {
    expect(ciclosDe(conVarias)).toEqual([{ ciclo: 'I', alumnos: 2 }, { ciclo: 'II', alumnos: 2 }])
    const repetidor: AlumnoDocente[] = [{ ...alumno('2621010009', 'EL REPETIDOR', 'PAGADO', 'VI', 'A1'), secciones: ['VI-A1', 'VI-A2', 'II-A'] }]
    expect(ciclosDe(repetidor)).toEqual([{ ciclo: 'II', alumnos: 1 }, { ciclo: 'VI', alumnos: 1 }])
  })
})

describe('vista del docente: filtro por curso (spec 025)', () => {
  const curso = (id: number, nombre: string) => ({ id, codigo: `ISES${id}`, nombre, ciclo: 'VI', seccion: 'A1', turno: 'M' })
  const conCursos: AlumnoDocente[] = [
    { ...alumno('2621010001', 'ÁLVAREZ PÉREZ ANA', 'PAGADO'), cursos: [curso(1, 'REDES'), curso(2, 'DATOS')] },
    { ...alumno('2621010002', 'BRAVO LUNA CARLOS', 'EN_REVISION'), cursos: [curso(2, 'DATOS')] },
    alumno('2621010003', 'CÁRDENAS RÍOS DIEGO', 'SIN_INSCRIPCION'),
  ]

  it('deja a los matriculados en ese curso; sin curso elegido, a todos', () => {
    expect(ids(filtrarAlumnosDocente(conCursos, { ...FILTROS_DOCENTE_VACIOS, cursoId: '1' }))).toEqual(['1'])
    expect(ids(filtrarAlumnosDocente(conCursos, { ...FILTROS_DOCENTE_VACIOS, cursoId: '2' }))).toEqual(['1', '2'])
    expect(ids(filtrarAlumnosDocente(conCursos, { ...FILTROS_DOCENTE_VACIOS, cursoId: '' }))).toEqual(['1', '2', '3'])
    expect(filtrarAlumnosDocente(conCursos, { ...FILTROS_DOCENTE_VACIOS, cursoId: '99' })).toEqual([])
  })

  it('se combina con la situación y la búsqueda', () => {
    expect(ids(filtrarAlumnosDocente(conCursos, { ...FILTROS_DOCENTE_VACIOS, cursoId: '2', situacion: 'NO_PAGADO' }))).toEqual(['2'])
    expect(ids(filtrarAlumnosDocente(conCursos, { ...FILTROS_DOCENTE_VACIOS, cursoId: '2', q: 'alvarez' }))).toEqual(['1'])
  })
})
