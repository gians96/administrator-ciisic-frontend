<script setup lang="ts">
import type { CodigoEstado } from '~/types/api'
import { COLOR_ESTADO } from '~/utils/formato'

const props = withDefaults(defineProps<{
  estado?: CodigoEstado
  tono?: 'brand' | 'neutral' | 'ok' | 'warn' | 'error' | 'info'
}>(), { estado: undefined, tono: 'neutral' })

const TONOS = {
  brand: 'bg-brand-500/15 text-brand-200 ring-brand-400/30',
  neutral: 'bg-white/5 text-slate-300 ring-white/15',
  ok: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  warn: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
  error: 'bg-red-400/15 text-red-300 ring-red-400/30',
  info: 'bg-blue-400/15 text-blue-300 ring-blue-400/30',
}

const clase = computed(() => (props.estado ? COLOR_ESTADO[props.estado] : TONOS[props.tono]))
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset" :class="clase">
    <slot />
  </span>
</template>
