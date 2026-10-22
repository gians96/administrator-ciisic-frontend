import type { FiltroSituacionSeguimiento, OpcionesSeguimiento, SituacionSeguimiento } from '~/types/api'

/**
 * Seguimiento de estudiantes por asesor (spec 016 del panel; backend 025). Lógica pura de la pantalla
 * Reportes: situaciones, filtros ↔ URL ↔ parámetros de la API y textos.
 */

export type TonoSituacion = 'ok' | 'warn' | 'error' | 'neutral'

/** Pagó = inscripción aprobada. En revisión = voucher enviado que aún no se valida. Rechazado incluye lo cancelado. */
export const SITUACIONES: ReadonlyArray<{ codigo: SituacionSeguimiento, nombre: string, tono: TonoSituacion }> = [
  { codigo: 'PAGADO', nombre: 'Pagó', tono: 'ok' },
  { codigo: 'EN_REVISION', nombre: 'En revisión', tono: 'warn' },
  { codigo: 'RECHAZADO', nombre: 'Rechazado', tono: 'error' },
  { codigo: 'SIN_INSCRIPCION', nombre: 'Sin inscripción', tono: 'neutral' },
]

/** Opciones del filtro «Situación»: «No pagaron» agrupa todo lo que no es «Pagó». */
export const OPCIONES_SITUACION: ReadonlyArray<{ codigo: FiltroSituacionSeguimiento, nombre: string }> = [
  { codigo: 'NO_PAGADO', nombre: 'No pagaron' },
  ...SITUACIONES.map(({ codigo, nombre }) => ({ codigo, nombre })),
]

export function nombreSituacion(codigo: SituacionSeguimiento): string {
  return SITUACIONES.find((situacion) => situacion.codigo === codigo)?.nombre ?? codigo
}

export function tonoSituacion(codigo: SituacionSeguimiento): TonoSituacion {
  return SITUACIONES.find((situacion) => situacion.codigo === codigo)?.tono ?? 'neutral'
}

function esFiltroSituacion(valor: string): valor is FiltroSituacionSeguimiento {
  return OPCIONES_SITUACION.some((opcion) => opcion.codigo === valor)
}

// ─── Filtros ───

export interface FiltrosReporte {
  asesorId: string
  ciclo: string
  seccion: string
  turno: string
  situacion: '' | FiltroSituacionSeguimiento
  q: string
  page: number
}

export const FILTROS_REPORTE_VACIOS: Readonly<FiltrosReporte> = Object.freeze({ asesorId: '', ciclo: '', seccion: '', turno: '', situacion: '', q: '', page: 1 })

function primero(valor: unknown): string {
  const dato = Array.isArray(valor) ? valor[0] : valor
  return typeof dato === 'string' ? dato.trim() : ''
}

/** Filtros desde la URL (`?asesorId=7&ciclo=VI`): lo que no es válido se descarta, nunca llega a la API. */
export function filtrosReporteDesdeQuery(query: Record<string, unknown>): FiltrosReporte {
  const situacion = primero(query.situacion).toUpperCase()
  const pagina = Number(primero(query.page))
  return {
    asesorId: /^\d{1,9}$/.test(primero(query.asesorId)) ? primero(query.asesorId) : '',
    ciclo: primero(query.ciclo).toUpperCase().slice(0, 10),
    seccion: primero(query.seccion).toUpperCase().slice(0, 10),
    turno: primero(query.turno).toUpperCase().slice(0, 5),
    situacion: esFiltroSituacion(situacion) ? situacion : '',
    q: primero(query.q).slice(0, 100),
    page: Number.isSafeInteger(pagina) && pagina >= 1 ? pagina : 1,
  }
}

interface OpcionesParametros {
  /** Incluye `page` (el listado); las descargas no paginan. */
  pagina?: boolean
  /** Solo lo que delimita el grupo (asesor, ciclo, sección, turno): lo que usa el resumen. */
  soloAlcance?: boolean
}

/** Parámetros de la API: solo los filtros con valor (la página 1 no se envía). */
export function aParametrosReporte(filtros: FiltrosReporte, { pagina = true, soloAlcance = false }: OpcionesParametros = {}): Record<string, string> {
  const parametros: Record<string, string> = {}
  if (filtros.asesorId) parametros.asesorId = filtros.asesorId
  if (filtros.ciclo) parametros.ciclo = filtros.ciclo
  if (filtros.seccion) parametros.seccion = filtros.seccion
  if (filtros.turno) parametros.turno = filtros.turno
  if (!soloAlcance) {
    if (filtros.situacion) parametros.situacion = filtros.situacion
    if (filtros.q) parametros.q = filtros.q
    if (pagina && filtros.page > 1) parametros.page = String(filtros.page)
  }
  return parametros
}

/** Cuántos filtros hay puestos (sin contar la página). */
export function filtrosActivos(filtros: FiltrosReporte): number {
  return [filtros.asesorId, filtros.ciclo, filtros.seccion, filtros.turno, filtros.situacion, filtros.q].filter(Boolean).length
}

/** Quita los filtros que ya no existen en el padrón (p. ej. tras cargar uno nuevo). */
export function filtrosVigentes(filtros: FiltrosReporte, opciones: OpcionesSeguimiento): FiltrosReporte {
  return {
    ...filtros,
    asesorId: filtros.asesorId && !opciones.asesores.some((asesor) => String(asesor.id) === filtros.asesorId) ? '' : filtros.asesorId,
    ciclo: filtros.ciclo && !opciones.ciclos.includes(filtros.ciclo) ? '' : filtros.ciclo,
    seccion: filtros.seccion && !opciones.secciones.some((s) => s.seccion === filtros.seccion && (!filtros.ciclo || s.ciclo === filtros.ciclo)) ? '' : filtros.seccion,
    turno: filtros.turno && !opciones.turnos.includes(filtros.turno) ? '' : filtros.turno,
  }
}

/** Secciones que se pueden elegir: las del ciclo elegido o, sin ciclo, todas (sin repetir). */
export function seccionesDelCiclo(opciones: OpcionesSeguimiento | null | undefined, ciclo: string): string[] {
  const secciones = (opciones?.secciones ?? []).filter((s) => !ciclo || s.ciclo === ciclo).map((s) => s.seccion)
  return [...new Set(secciones)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
}

// ─── Textos ───

export function etiquetaSeccion(ciclo: string, seccion: string): string {
  return `${ciclo}-${seccion}`
}

const formatoPorcentaje = new Intl.NumberFormat('es-PE', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 1 })

/** `0.2719` → «27,2 %». */
export function porcentaje(avance: number): string {
  return formatoPorcentaje.format(Number.isFinite(avance) ? avance : 0)
}

/** Color del avance: verde desde dos tercios, ámbar desde un tercio y rojo por debajo. Sin alumnos, neutro. */
export function tonoAvance(avance: number, alumnos: number): TonoSituacion {
  if (alumnos <= 0) return 'neutral'
  if (avance >= 2 / 3) return 'ok'
  if (avance >= 1 / 3) return 'warn'
  return 'error'
}

/** Partes de la barra de avance, en porcentaje del total y sin partes vacías. */
export function partesDeBarra(c: { alumnos: number, pagaron: number, enRevision: number, rechazados: number, sinInscripcion: number }): Array<{ codigo: SituacionSeguimiento, porcentaje: number, cantidad: number }> {
  if (c.alumnos <= 0) return []
  const cantidades: Record<SituacionSeguimiento, number> = { PAGADO: c.pagaron, EN_REVISION: c.enRevision, RECHAZADO: c.rechazados, SIN_INSCRIPCION: c.sinInscripcion }
  return SITUACIONES.map(({ codigo }) => ({ codigo, cantidad: cantidades[codigo], porcentaje: (cantidades[codigo] / c.alumnos) * 100 })).filter((parte) => parte.cantidad > 0)
}

// ─── Descargas ───

export type FormatoReporte = 'xlsx' | 'pdf'

/** Ruta del BFF de la descarga con los filtros puestos (todos menos la página). */
export function rutaDeDescarga(eventoId: number, formato: FormatoReporte, filtros: FiltrosReporte): string {
  const parametros = new URLSearchParams({ formato, ...aParametrosReporte(filtros, { pagina: false }) })
  return `events/${eventoId}/advisory/export?${parametros.toString()}`
}

/** Nombre del archivo si el servidor no envía uno. */
export function nombreDeRespaldo(formato: FormatoReporte, asesor?: string | null): string {
  return `${asesor?.trim() || 'Seguimiento por asesor'}.${formato}`
}

/** Filtros puestos, redactados para mostrarlos («Ciclo VI · Sección A»); vacío si no hay ninguno. */
export function resumenDeFiltros(filtros: FiltrosReporte, opciones: OpcionesSeguimiento | null | undefined): string {
  const asesor = opciones?.asesores.find((a) => String(a.id) === filtros.asesorId)
  return [
    asesor ? asesor.nombre : filtros.asesorId ? 'Asesor' : '',
    filtros.ciclo ? `Ciclo ${filtros.ciclo}` : '',
    filtros.seccion ? `Sección ${filtros.seccion}` : '',
    filtros.turno ? `Turno ${filtros.turno}` : '',
    filtros.situacion ? (OPCIONES_SITUACION.find((o) => o.codigo === filtros.situacion)?.nombre ?? '') : '',
    filtros.q ? `«${filtros.q}»` : '',
  ].filter(Boolean).join(' · ')
}

const TURNOS: Readonly<Record<string, string>> = { M: 'Mañana', T: 'Tarde', N: 'Noche' }

/** `M` → «Mañana», `T` → «Tarde», `N` → «Noche»; otro valor se muestra tal cual y vacío es «—». */
export function etiquetaTurno(turno: string | null | undefined): string {
  const valor = (turno ?? '').trim().toUpperCase()
  return valor ? (TURNOS[valor] ?? valor) : '—'
}
