<script setup lang="ts">
import type { ConteosSituacion, FiltroSituacionSeguimiento } from '~/types/api'

/**
 * Filtro de situación con contadores («Todos 39 · Pagaron 23 …»): se ve cuántos hay de cada cosa antes de
 * elegir, y una opción vacía se atenúa. Lo usan el listado del panel y la vista del docente.
 */
const props = defineProps<{ conteos: ConteosSituacion }>()
const valor = defineModel<'' | FiltroSituacionSeguimiento>({ required: true })

const OPCIONES: ReadonlyArray<{ codigo: '' | FiltroSituacionSeguimiento, nombre: string, clave: keyof ConteosSituacion, punto: string }> = [
  { codigo: '', nombre: 'Todos', clave: 'todos', punto: 'bg-slate-400' },
  { codigo: 'NO_PAGADO', nombre: 'No pagaron', clave: 'NO_PAGADO', punto: 'bg-rose-400' },
  { codigo: 'PAGADO', nombre: 'Pagaron', clave: 'PAGADO', punto: 'bg-emerald-400' },
  { codigo: 'EN_REVISION', nombre: 'En revisión', clave: 'EN_REVISION', punto: 'bg-amber-400' },
  { codigo: 'RECHAZADO', nombre: 'Rechazados', clave: 'RECHAZADO', punto: 'bg-red-500' },
  { codigo: 'SIN_INSCRIPCION', nombre: 'Sin inscripción', clave: 'SIN_INSCRIPCION', punto: 'bg-slate-500' },
]

const opciones = computed(() => OPCIONES.map((opcion) => ({ ...opcion, cantidad: props.conteos[opcion.clave] ?? 0 })))
</script>

<template>
  <div role="group" aria-label="Filtrar por situación" class="flex flex-wrap gap-2">
    <button
      v-for="opcion in opciones"
      :key="opcion.codigo"
      type="button"
      :aria-pressed="valor === opcion.codigo"
      class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 transition ring-inset"
      :class="valor === opcion.codigo
        ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50'
        : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
      @click="valor = opcion.codigo"
    >
      <span class="size-2 rounded-full" :class="opcion.punto" aria-hidden="true" />
      <span :class="opcion.cantidad === 0 && valor !== opcion.codigo ? 'opacity-60' : ''">{{ opcion.nombre }}</span>
      <span class="rounded-full bg-white/10 px-1.5 text-xs text-slate-200 tabular-nums">{{ opcion.cantidad }}</span>
    </button>
  </div>
</template>
