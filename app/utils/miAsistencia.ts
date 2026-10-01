import type { ActividadPortal, AsistenciaEventoPortal } from '~/utils/portal'

/**
 * «Mi asistencia» del portal (backend-ciisic spec 014, `GET /me/attendances`): por cada evento con la
 * inscripción aprobada, sus actividades (ya ordenadas por fecha y hora) y si asistió.
 */

const ZONA = 'America/Lima'

export interface DiaDeActividades {
  /** `YYYY-MM-DD`. */
  fecha: string
  actividades: ActividadPortal[]
}

/** Agrupa las actividades por día conservando el orden en que llegan. */
export function actividadesPorDia(actividades: readonly ActividadPortal[]): DiaDeActividades[] {
  const dias: DiaDeActividades[] = []
  for (const actividad of actividades) {
    const ultimo = dias.at(-1)
    if (ultimo?.fecha === actividad.fecha) ultimo.actividades.push(actividad)
    else dias.push({ fecha: actividad.fecha, actividades: [actividad] })
  }
  return dias
}

/** Porcentaje entero de actividades asistidas (0 si el evento aún no tiene actividades). */
export function porcentajeAsistencia(evento: Pick<AsistenciaEventoPortal, 'asistidas' | 'totalActividades'>): number {
  if (!(evento.totalActividades > 0)) return 0
  return Math.min(100, Math.max(0, Math.round((evento.asistidas / evento.totalActividades) * 100)))
}

/** «1 de 3 actividades» / «1 de 1 actividad». */
export function resumenAsistencia(evento: Pick<AsistenciaEventoPortal, 'asistidas' | 'totalActividades'>): string {
  return `${evento.asistidas} de ${evento.totalActividades} ${evento.totalActividades === 1 ? 'actividad' : 'actividades'}`
}

/** «09:00 – 10:30» (horas de Lima tal como las envía el backend). */
export function horarioActividad(actividad: Pick<ActividadPortal, 'horaInicio' | 'horaFin'>): string {
  return [actividad.horaInicio, actividad.horaFin].filter(Boolean).join(' – ')
}

/** Encabezado del día: «lunes, 26 de octubre». */
export function diaDeActividad(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number)
  if (!anio || !mes || !dia) return fecha
  return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, mes - 1, dia, 12)))
}

/** Hora de Lima (`09:05`) de la marca de asistencia; sin valor o inválido, `null`. */
export function horaDeRegistro(instante: string | null | undefined): string | null {
  if (!instante) return null
  const fecha = new Date(instante)
  if (Number.isNaN(fecha.getTime())) return null
  return new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fecha)
}
