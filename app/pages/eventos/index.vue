<script setup lang="ts">
import { fechaDia, numero } from '~/utils/formato'

definePageMeta({ permiso: 'eventos.configurar' })
useHead({ title: 'Eventos · Panel CIISIC' })

const store = useEventoStore()
const TONO_ESTADO = { BORRADOR: 'neutral', PUBLICADO: 'ok', FINALIZADO: 'info', ARCHIVADO: 'neutral' } as const

onMounted(() => store.cargar(true))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Eventos</h1>
        <p class="mt-1 text-sm text-slate-400">Cada edición del congreso (u otro evento) tiene sus propios tipos de inscripción, datos de pago y actividades.</p>
      </div>
      <AppButton icon="heroicons:plus" to="/eventos/nuevo">Nuevo evento</AppButton>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="evento in store.eventos"
        :key="evento.id"
        :to="`/eventos/${evento.id}`"
        class="card group flex flex-col gap-4 p-5 transition hover:border-brand-400/40 hover:shadow-[var(--shadow-glow)]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-xs text-slate-500">{{ evento.codigo }}</p>
            <h2 class="mt-1 text-xl font-bold group-hover:text-brand-200">{{ evento.nombreCorto }}</h2>
          </div>
          <Icon v-if="evento.esPrincipal" name="heroicons:star-solid" class="size-5 shrink-0 text-amber-300" aria-label="Evento principal" />
        </div>
        <p class="line-clamp-2 text-sm text-slate-400">{{ evento.nombre }}</p>
        <div class="mt-auto flex flex-wrap items-center gap-2 text-xs">
          <AppBadge :tono="TONO_ESTADO[evento.estado]">{{ evento.estado.charAt(0) + evento.estado.slice(1).toLowerCase() }}</AppBadge>
          <AppBadge :tono="evento.inscripcionesAbiertas ? 'brand' : 'neutral'">{{ evento.inscripcionesAbiertas ? 'Inscripciones abiertas' : 'Inscripciones cerradas' }}</AppBadge>
          <span class="text-slate-400">{{ fechaDia(evento.fechaInicio) }} – {{ fechaDia(evento.fechaFin) }}</span>
          <span class="ml-auto text-slate-300">{{ numero(evento.totalInscripciones) }} inscripciones</span>
        </div>
      </NuxtLink>
    </div>

    <AppEmpty v-if="store.cargado && !store.eventos.length" titulo="Aún no hay eventos" icon="heroicons:calendar-days" />
  </div>
</template>
