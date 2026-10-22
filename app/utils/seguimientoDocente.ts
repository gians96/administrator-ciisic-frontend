import type { AlumnoCiclo, FiltroSituacionSeguimiento, SituacionSeguimiento } from '~/types/api'

/**
 * Filtros de las vistas públicas del docente (spec 017) y del ciclo (spec 018). Un docente atiende como mucho
 * unas decenas de estudiantes y un ciclo, un centenar o poco más, así que el backend envía todos y la búsqueda y
 * los filtros se hacen aquí, sin más consultas. Sirven a ambas vistas: solo usan lo que las dos tienen en común.
 */

export interface FiltrosDocente {
  /** `''` = todos los ciclos; si no, el ciclo («VI»). */
  ciclo: string
  /** `''` = todas; si no, `<ciclo>|<sección>` (ver `claveDeSeccion`). */
  seccion: string
  situacion: '' | FiltroSituacionSeguimiento
  q: string
}

export const FILTROS_DOCENTE_VACIOS: Readonly<FiltrosDocente> = Object.freeze({ ciclo: '', seccion: '', situacion: '', q: '' })

export const claveDeSeccion = (ciclo: string, seccion: string): string => `${ciclo}|${seccion}`

/** Texto sin acentos ni mayúsculas y con espacios simples, para buscar. */
export function textoParaBuscar(valor: unknown): string {
  return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Estudiantes que cumplen la sección, la situación (`NO_PAGADO` = todo menos «Pagó») y la búsqueda (todas las palabras). */
export function filtrarAlumnosDocente<T extends AlumnoCiclo>(alumnos: readonly T[], filtros: FiltrosDocente): T[] {
  const palabras = textoParaBuscar(filtros.q).split(' ').filter(Boolean)
  return alumnos.filter((alumno) => {
    if (filtros.ciclo && alumno.ciclo !== filtros.ciclo) return false
    if (filtros.seccion && claveDeSeccion(alumno.ciclo, alumno.seccion) !== filtros.seccion) return false
    if (filtros.situacion === 'NO_PAGADO' && alumno.situacion === 'PAGADO') return false
    if (filtros.situacion && filtros.situacion !== 'NO_PAGADO' && alumno.situacion !== filtros.situacion) return false
    if (!palabras.length) return true
    const texto = textoParaBuscar(`${alumno.nombre} ${alumno.codigo}`)
    return palabras.every((palabra) => texto.includes(palabra))
  })
}

/** Los ciclos de la lista, con su cantidad de estudiantes, en el orden en que llegan (el servidor ya los ordena). */
export function ciclosDe(alumnos: readonly AlumnoCiclo[]): Array<{ ciclo: string, alumnos: number }> {
  const cuenta = new Map<string, number>()
  for (const alumno of alumnos) cuenta.set(alumno.ciclo, (cuenta.get(alumno.ciclo) ?? 0) + 1)
  return [...cuenta].map(([ciclo, cantidad]) => ({ ciclo, alumnos: cantidad }))
}

export interface ConteosDocente {
  todos: number
  noPagado: number
  porSituacion: Record<SituacionSeguimiento, number>
}

/** Cuántos estudiantes hay en cada situación (para los contadores de los filtros). */
export function conteosDocente(alumnos: readonly AlumnoCiclo[]): ConteosDocente {
  const porSituacion: Record<SituacionSeguimiento, number> = { PAGADO: 0, EN_REVISION: 0, RECHAZADO: 0, SIN_INSCRIPCION: 0 }
  for (const alumno of alumnos) porSituacion[alumno.situacion] += 1
  return { todos: alumnos.length, noPagado: alumnos.length - porSituacion.PAGADO, porSituacion }
}
