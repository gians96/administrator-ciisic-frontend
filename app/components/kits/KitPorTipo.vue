<script setup lang="ts">
import { numero } from '~/utils/formato'
import { esFilaDeDelegacion, nombreFilaTipo, porcentajeKits, type FilaTipoKits } from '~/utils/kitsTablero'

/**
 * Cifras de cada tipo de inscripción con kit; los planes de una delegación salen con su insignia. Elegir un tipo con id
 * filtra la lista de personas por él (la cortesía sin tipo no tiene id: no se puede elegir).
 */
defineProps<{ filas: readonly FilaTipoKits[], tipoActivo: number | null, puedeElegir: boolean }>()
const emit = defineEmits<{ elegir: [tipoId: number | null] }>()
</script>

<template>
  <section class="card overflow-hidden" aria-labelledby="kits-por-tipo">
    <header class="border-b border-white/10 px-6 py-4">
      <h2 id="kits-por-tipo" class="text-lg font-bold">Por tipo y delegación</h2>
      <p class="text-xs text-slate-400">
        {{ puedeElegir ? 'Toca un tipo para ver solo sus inscripciones en la lista.' : 'Aprobados con kit, entregados y pendientes de cada tipo.' }}
      </p>
    </header>
    <div class="relative overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th>Tipo</th>
            <th class="text-right">A entregar</th>
            <th class="text-right">Entregados</th>
            <th class="text-right">Pendientes</th>
            <th class="min-w-36">Avance</th>
            <th class="text-right">Pago por aprobar</th>
            <th class="text-right">A revisar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fila in filas" :key="fila.tipoInscripcionId ?? 'sin-tipo'">
            <td>
              <button
                v-if="puedeElegir && fila.tipoInscripcionId !== null"
                type="button"
                class="text-left text-white transition hover:text-brand-300 focus-visible:text-brand-300"
                :aria-pressed="tipoActivo === fila.tipoInscripcionId"
                @click="emit('elegir', tipoActivo === fila.tipoInscripcionId ? null : fila.tipoInscripcionId)"
              >
                <span :class="tipoActivo === fila.tipoInscripcionId ? 'text-brand-300 underline decoration-brand-400/60 underline-offset-4' : ''">{{ nombreFilaTipo(fila) }}</span>
              </button>
              <span v-else class="text-white">{{ nombreFilaTipo(fila) }}</span>
              <AppBadge v-if="esFilaDeDelegacion(fila)" tono="info" class="ml-2">Delegación</AppBadge>
              <p v-if="fila.categoria && esFilaDeDelegacion(fila)" class="text-xs text-slate-400">{{ fila.categoria.nombre }}</p>
            </td>
            <td class="text-right tabular-nums">{{ numero(fila.conKit) }}</td>
            <td class="text-right text-emerald-300 tabular-nums">{{ numero(fila.entregados) }}</td>
            <td class="text-right tabular-nums" :class="fila.pendientes > 0 ? 'font-semibold text-amber-300' : 'text-slate-400'">{{ numero(fila.pendientes) }}</td>
            <td>
              <div class="flex items-center gap-2">
                <div
                  class="h-2 w-full min-w-20 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  :aria-valuenow="porcentajeKits(fila.entregados, fila.conKit)"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="`Avance de ${nombreFilaTipo(fila)}`"
                >
                  <div class="h-full rounded-full bg-emerald-400" :style="{ width: `${porcentajeKits(fila.entregados, fila.conKit)}%` }" />
                </div>
                <span class="w-10 text-right text-xs text-slate-400 tabular-nums">{{ porcentajeKits(fila.entregados, fila.conKit) }} %</span>
              </div>
            </td>
            <td class="text-right tabular-nums" :class="fila.porAprobar > 0 ? 'text-blue-300' : 'text-slate-500'">{{ numero(fila.porAprobar) }}</td>
            <td class="text-right tabular-nums" :class="fila.aRevisar > 0 ? 'font-semibold text-red-300' : 'text-slate-500'">{{ numero(fila.aRevisar) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppEmpty v-if="!filas.length" titulo="Este evento no tiene inscripciones con kit" icon="heroicons:gift" descripcion="Cuando haya inscripciones aprobadas en un tipo con «Incluye kit», aparecen aquí." />
  </section>
</template>
