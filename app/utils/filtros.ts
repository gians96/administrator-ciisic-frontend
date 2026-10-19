import { MODALIDADES_ASISTENCIA } from '~/utils/modalidad'

/** Filtros del listado de inscripciones y su serialización a query string. */
export interface FiltrosInscripcion {
  estado: string
  categoria: string
  /** Modalidad de asistencia del tipo (`PRESENCIAL` | `VIRTUAL`, spec 018 del backend); no la modalidad de pago. */
  modalidad: string
  tipoInscripcionId: string
  esEstudianteUndc: string
  q: string
  page: number
}

export const FILTROS_VACIOS: FiltrosInscripcion = { estado: '', categoria: '', modalidad: '', tipoInscripcionId: '', esEstudianteUndc: '', q: '', page: 1 }

/** Lee los filtros desde la query de la ruta (valores inválidos se ignoran). */
export function filtrosDesdeQuery(query: Record<string, unknown>): FiltrosInscripcion {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '')
  const page = Number(texto(query.page))
  const modalidad = texto(query.modalidad).toUpperCase()
  return {
    estado: texto(query.estado).toUpperCase(),
    categoria: texto(query.categoria).toUpperCase(),
    modalidad: (MODALIDADES_ASISTENCIA as readonly string[]).includes(modalidad) ? modalidad : '',
    tipoInscripcionId: /^\d+$/.test(texto(query.tipoInscripcionId)) ? texto(query.tipoInscripcionId) : '',
    esEstudianteUndc: ['true', 'false'].includes(texto(query.esEstudianteUndc)) ? texto(query.esEstudianteUndc) : '',
    q: texto(query.q).slice(0, 100),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

/** Parámetros no vacíos para la API o la URL. */
export function aParametros(filtros: FiltrosInscripcion, incluirPagina = true): Record<string, string> {
  const params: Record<string, string> = {}
  for (const clave of ['estado', 'categoria', 'modalidad', 'tipoInscripcionId', 'esEstudianteUndc', 'q'] as const) {
    const valor = filtros[clave].trim()
    if (valor) params[clave] = valor
  }
  if (incluirPagina && filtros.page > 1) params.page = String(filtros.page)
  return params
}
