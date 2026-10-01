import type { ResumenSemana } from '~/types/api'

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
