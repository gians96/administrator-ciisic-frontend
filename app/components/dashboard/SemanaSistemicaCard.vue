<script setup lang="ts">
import type { ResumenSemana } from '~/types/api'
import { numero, soles } from '~/utils/formato'
import { conteosDeportes } from '~/utils/resumen'

const props = defineProps<{ resumen: ResumenSemana | null, cargando: boolean, eventoId: number | null }>()

const auth = useAuthStore()
/** Sin `pagos.ver` los montos llegan en `null`: se muestran solo los conteos. */
const conPagos = computed(() => auth.puede('pagos.ver'))
const conteos = computed(() => conteosDeportes(props.resumen))

const TIPO_PARTICIPANTE: Record<string, string> = { STUDENT: 'Estudiantes', OTHER: 'Otros' }
</script>

<template>
  <section class="card overflow-hidden">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
      <div>
        <p class="kicker">Semana Sistémica</p>
        <h2 class="mt-1 text-xl font-bold">{{ conPagos ? 'Recaudación congreso + deportes' : 'Congreso + deportes' }}</h2>
      </div>
      <AppButton
        v-if="eventoId && auth.puede('eventos.configurar')"
        size="sm"
        variant="secondary"
        icon="heroicons:link"
        :to="`/eventos/${eventoId}?tab=integraciones`"
      >
        Integraciones
      </AppButton>
    </header>

    <div v-if="cargando" class="px-6 py-10 text-center text-sm text-slate-400">Cargando resumen…</div>

    <div v-else-if="resumen" class="space-y-6 px-6 py-5">
      <div v-if="conPagos" class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Congreso (aprobado)</p>
          <p class="mt-1 font-display text-2xl font-bold text-white tabular-nums">{{ soles(resumen.totales.recaudadoCongreso) }}</p>
          <p class="text-xs text-slate-400">{{ numero(resumen.congreso.inscripcionesAprobadas) }} inscripciones aprobadas</p>
        </div>
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Deportes (validado)</p>
          <p class="mt-1 font-display text-2xl font-bold text-white tabular-nums">{{ soles(resumen.totales.recaudadoDeportes) }}</p>
          <p class="text-xs text-slate-400">Pendiente: {{ soles(resumen.totales.pendienteDeportes) }}</p>
        </div>
        <div class="rounded-xl bg-brand-500/10 p-4 ring-1 ring-brand-400/25">
          <p class="text-xs text-brand-200">Total Semana Sistémica</p>
          <p class="mt-1 font-display text-2xl font-bold text-white tabular-nums">{{ soles(resumen.totales.recaudadoTotal) }}</p>
        </div>
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Congreso</p>
          <p class="mt-1 font-display text-2xl font-bold text-white tabular-nums">{{ numero(resumen.congreso.inscripcionesAprobadas) }}</p>
          <p class="text-xs text-slate-400">aprobadas de {{ numero(resumen.congreso.inscripcionesTotales) }} inscripciones</p>
        </div>
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Deportes</p>
          <p class="mt-1 font-display text-2xl font-bold text-white tabular-nums">{{ numero(conteos.equiposAprobados) }}</p>
          <p class="text-xs text-slate-400">equipos aprobados de {{ numero(conteos.equiposTotales) }} · {{ numero(conteos.participantes) }} participantes</p>
        </div>
      </div>

      <p v-if="!resumen.deportes.length" class="text-sm text-slate-400">
        No hay integraciones de deportes activas para este evento.
        <template v-if="auth.puede('eventos.configurar')">Genera un token por evento en deportes-fi y regístralo en Integraciones.</template>
      </p>

      <div v-for="item in resumen.deportes" :key="item.integracionId" class="rounded-xl border border-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p class="font-medium text-white">{{ item.nombre }}<span v-if="item.resumen" class="text-slate-400"> · {{ item.resumen.event.name }}</span></p>
          <AppBadge :tono="item.ok ? 'ok' : 'error'">{{ item.ok ? 'Sincronizado' : 'Error' }}</AppBadge>
        </div>
        <p v-if="!item.ok" class="px-4 pb-3 text-sm text-red-300">{{ item.error }}</p>
        <div v-else-if="item.resumen" class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Tipo</th>
                <th class="text-right">Equipos</th>
                <template v-if="conPagos">
                  <th class="text-right">Validado</th>
                  <th class="text-right">Pendiente</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disciplina in item.resumen.byDiscipline" :key="disciplina.disciplineId">
                <td class="text-white">{{ disciplina.name }}</td>
                <td>{{ TIPO_PARTICIPANTE[disciplina.participantType] ?? disciplina.participantType }}{{ disciplina.isPaid ? '' : ' · gratuita' }}</td>
                <td class="text-right tabular-nums">{{ disciplina.teams.approved }}/{{ disciplina.teams.total }}</td>
                <template v-if="conPagos">
                  <td class="text-right tabular-nums">{{ soles(disciplina.validatedAmount) }}</td>
                  <td class="text-right tabular-nums">{{ soles(disciplina.pendingAmount) }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
