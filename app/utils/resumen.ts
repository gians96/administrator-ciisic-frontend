import type { ModalidadAsistencia, ResumenEvento, ResumenModalidad, ResumenSemana } from '~/types/api'
import { esVirtual, etiquetaModalidad, MODALIDADES_ASISTENCIA, modalidadDe } from '~/utils/modalidad'

export interface ConteosDeportes {
  /** Integraciones que respondieron con su resumen. */
  sincronizadas: number
  equiposAprobados: number
  equiposTotales: number
  participantes: number
}

/**
 * Conteos de deportes de la Semana Sistémica (suma de las integraciones que respondieron). Es lo que
 * ve una cuenta sin `pagos.ver`, que recibe los montos en `null`.
 */
export function conteosDeportes(semana: Pick<ResumenSemana, 'deportes'> | null | undefined): ConteosDeportes {
  const conteos: ConteosDeportes = { sincronizadas: 0, equiposAprobados: 0, equiposTotales: 0, participantes: 0 }
  for (const item of semana?.deportes ?? []) {
    if (!item.ok || !item.resumen) continue
    conteos.sincronizadas += 1
    conteos.equiposAprobados += item.resumen.teams?.approved ?? 0
    conteos.equiposTotales += item.resumen.teams?.total ?? 0
    conteos.participantes += item.resumen.participants?.total ?? 0
  }
  return conteos
}

export interface FilaModalidad {
  modalidad: ModalidadAsistencia
  nombre: string
  inscripciones: number
  aprobadas: number
  /** `null` sin `pagos.ver`. */
  montoAprobado: number | null
}

/**
 * Filas del bloque «Presencial / Virtual» del Resumen (`totales.porModalidad`, spec 018 del backend):
 * siempre las dos, en ese orden, con ceros si falta alguna; una modalidad desconocida cuenta como
 * presencial. Sin el dato (backend anterior) o vacío, ninguna fila: el bloque no se muestra. Los montos
 * quedan en `null` cuando el backend los envía así (sin `pagos.ver`).
 */
export function filasPorModalidad(porModalidad: readonly ResumenModalidad[] | null | undefined): FilaModalidad[] {
  if (!Array.isArray(porModalidad) || !porModalidad.length) return []
  const sinMontos = porModalidad.every((item) => item.montoAprobado === null || item.montoAprobado === undefined)
  return MODALIDADES_ASISTENCIA.map((modalidad) => {
    const items = porModalidad.filter((item) => modalidadDe(item.modalidad) === modalidad)
    const suma = (campo: 'inscripciones' | 'aprobadas' | 'montoAprobado') => items.reduce((total, item) => total + (Number(item[campo]) || 0), 0)
    return {
      modalidad,
      nombre: etiquetaModalidad(modalidad),
      inscripciones: suma('inscripciones'),
      aprobadas: suma('aprobadas'),
      montoAprobado: sinMontos ? null : suma('montoAprobado'),
    }
  })
}

/**
 * Filas que el Resumen muestra: las de `filasPorModalidad`, pero solo cuando la modalidad virtual ya se usa
 * en el evento (algún tipo de `porTipo` es virtual, o ya hay inscripciones virtuales). El backend con la
 * spec 018 envía siempre las dos filas; sin tipos virtuales, «Virtual: 0 / 0 / S/ 0» sería ruido para quien
 * aún no usa la modalidad. Sin el dato (backend anterior) o sin virtuales, ninguna fila.
 */
export function filasModalidadVisibles(resumen: { totales: Pick<ResumenEvento['totales'], 'porModalidad'>, porTipo: ReadonlyArray<{ modalidad?: unknown }> } | null | undefined): FilaModalidad[] {
  const filas = filasPorModalidad(resumen?.totales.porModalidad)
  const hayVirtual = filas.some((fila) => fila.modalidad === 'VIRTUAL' && fila.inscripciones > 0)
    || (resumen?.porTipo ?? []).some((tipo) => esVirtual(tipo))
  return hayVirtual ? filas : []
}
