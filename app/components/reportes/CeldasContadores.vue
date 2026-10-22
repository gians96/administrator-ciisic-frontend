<script setup lang="ts">
import type { ContadoresSeguimiento } from '~/types/api'
import { numero, soles } from '~/utils/formato'
import { porcentaje, tonoAvance } from '~/utils/reportes'

/** Celdas de contadores de una fila (se usa dentro de un `<tr>`; pares de `CabeceraContadores`). */
const props = defineProps<{ contadores: ContadoresSeguimiento, conPago: boolean }>()

const COLOR_AVANCE = { ok: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300', neutral: 'text-slate-400' } as const
const tono = computed(() => COLOR_AVANCE[tonoAvance(props.contadores.avance, props.contadores.alumnos)])
</script>

<template>
  <td class="text-right font-semibold text-white tabular-nums">{{ numero(contadores.alumnos) }}</td>
  <td class="text-right text-emerald-300 tabular-nums">{{ numero(contadores.pagaron) }}</td>
  <td class="text-right tabular-nums" :class="contadores.enRevision ? 'text-amber-300' : 'text-slate-500'">{{ numero(contadores.enRevision) }}</td>
  <td class="text-right tabular-nums" :class="contadores.rechazados ? 'text-red-300' : 'text-slate-500'">{{ numero(contadores.rechazados) }}</td>
  <td class="text-right text-slate-300 tabular-nums">{{ numero(contadores.sinInscripcion) }}</td>
  <td>
    <p class="text-xs font-semibold tabular-nums" :class="tono">{{ porcentaje(contadores.avance) }}</p>
    <BarraAvance :contadores="contadores" class="mt-1" />
  </td>
  <td v-if="conPago" class="text-right font-medium text-white tabular-nums">{{ soles(contadores.recaudado) }}</td>
</template>
