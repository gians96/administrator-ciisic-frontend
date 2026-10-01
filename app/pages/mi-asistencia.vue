<script setup lang="ts">
import { aErrorApi } from '~/utils/errores'
import { actividadesPorDia, diaDeActividad, horaDeRegistro, horarioActividad, porcentajeAsistencia, resumenAsistencia } from '~/utils/miAsistencia'
import { esNoDisponible, type AsistenciaEventoPortal } from '~/utils/portal'

/**
 * Asistencia del inscrito (`GET /me/attendances`, spec 014): por cada evento con la inscripción
 * aprobada, sus actividades y en cuáles se registró. Con un backend anterior: «pronto disponible».
 */
definePageMeta({ layout: 'participante', perfil: 'participante' })
useHead({ title: 'Mi asistencia · CIISIC' })

const { portal } = usePortal()
const eventos = ref<AsistenciaEventoPortal[]>([])
const estado = ref<'cargando' | 'listo' | 'no-disponible' | 'error'>('cargando')
const error = ref<string | null>(null)

async function cargar() {
  estado.value = 'cargando'
  error.value = null
  try {
    const { data } = await portal<{ data: AsistenciaEventoPortal[] }>('attendances')
    eventos.value = Array.isArray(data) ? data : []
    estado.value = 'listo'
  } catch (e) {
    if (esNoDisponible(e)) {
      estado.value = 'no-disponible'
      return
    }
    if (aErrorApi(e).status === 401) return
    error.value = aErrorApi(e).message
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">Portal del inscrito</p>
      <h1 class="mt-1 text-3xl font-extrabold">Mi asistencia</h1>
      <p class="mt-2 text-sm text-slate-400">
        Las actividades de cada evento en el que tu inscripción está aprobada y en cuáles registraste tu asistencia.
      </p>
    </div>

    <PortalEstado v-if="estado === 'cargando'" estado="cargando" texto="Cargando tu asistencia…" />
    <PortalEstado v-else-if="estado === 'error'" estado="error" :texto="error" @reintentar="cargar" />
    <PortalEstado
      v-else-if="estado === 'no-disponible'"
      estado="no-disponible"
      icon="heroicons:calendar-days"
      texto="Pronto podrás ver aquí las actividades a las que asististe."
    />

    <div v-else-if="!eventos.length" class="card">
      <AppEmpty
        icon="heroicons:calendar-days"
        titulo="Aún no hay asistencia que mostrar"
        descripcion="Aquí verás las actividades de cada evento cuando tu inscripción esté aprobada. Tu asistencia se registra al escanear tu fotocheck en el ingreso."
      >
        <AppButton variant="secondary" size="sm" icon="heroicons:identification" to="/mi-fotocheck">Ver mi fotocheck</AppButton>
      </AppEmpty>
    </div>

    <article v-for="item in eventos" v-else :key="item.evento.id" class="card overflow-hidden">
      <div class="border-b border-white/10 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="kicker">{{ item.evento.nombreCorto }}</p>
            <h2 class="mt-1 text-xl font-bold">{{ item.evento.nombre }}</h2>
          </div>
          <div class="shrink-0 text-right">
            <p class="font-display text-3xl font-extrabold text-white tabular-nums">
              {{ item.asistidas }}<span class="text-lg text-slate-500">/{{ item.totalActividades }}</span>
            </p>
            <p class="text-xs text-slate-400">asistidas</p>
          </div>
        </div>
        <div
          class="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          :aria-valuenow="porcentajeAsistencia(item)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Asististe a ${resumenAsistencia(item)}`"
        >
          <div class="h-full rounded-full bg-brand-500 transition-[width]" :style="{ width: `${porcentajeAsistencia(item)}%` }" />
        </div>
      </div>

      <p v-if="!item.actividades.length" class="p-5 text-sm text-slate-400 sm:p-6">El evento aún no tiene actividades programadas.</p>

      <div v-else class="space-y-5 p-5 sm:p-6">
        <section v-for="dia in actividadesPorDia(item.actividades)" :key="dia.fecha">
          <h3 class="text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ diaDeActividad(dia.fecha) }}</h3>
          <ul class="mt-2 divide-y divide-white/5">
            <li v-for="actividad in dia.actividades" :key="actividad.id" class="flex items-start gap-3 py-2.5">
              <span
                v-if="actividad.asistio"
                class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
              >
                <Icon name="heroicons:check-20-solid" class="size-4" aria-hidden="true" />
                <span class="sr-only">Asististe:</span>
              </span>
              <span v-else class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-500 ring-1 ring-white/10">
                <span aria-hidden="true">—</span>
                <span class="sr-only">Sin registro:</span>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium" :class="actividad.asistio ? 'text-white' : 'text-slate-300'">{{ actividad.nombre }}</p>
                <p class="text-xs text-slate-400">
                  <span class="whitespace-nowrap">{{ horarioActividad(actividad) }}</span>
                  <template v-if="actividad.asistio && horaDeRegistro(actividad.registradoEn)">
                    · <span class="whitespace-nowrap">registrada a las {{ horaDeRegistro(actividad.registradoEn) }}</span>
                  </template>
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </article>
  </div>
</template>
