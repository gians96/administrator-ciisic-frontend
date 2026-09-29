<script setup lang="ts">
withDefaults(defineProps<{
  etiqueta: string
  valor: string | number
  detalle?: string
  icon?: string
  tono?: 'brand' | 'ok' | 'warn' | 'error' | 'info'
}>(), { detalle: undefined, icon: undefined, tono: 'brand' })

const TONOS = {
  brand: 'text-brand-300 bg-brand-500/10',
  ok: 'text-emerald-300 bg-emerald-500/10',
  warn: 'text-amber-300 bg-amber-500/10',
  error: 'text-red-300 bg-red-500/10',
  info: 'text-blue-300 bg-blue-500/10',
}
</script>

<template>
  <article class="card flex items-start gap-4 p-5">
    <span v-if="icon" class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl" :class="TONOS[tono]">
      <Icon :name="icon" class="size-6" aria-hidden="true" />
    </span>
    <div class="min-w-0">
      <p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">{{ etiqueta }}</p>
      <p class="mt-1 font-display text-2xl font-bold text-white tabular-nums">{{ valor }}</p>
      <p v-if="detalle" class="mt-0.5 text-xs text-slate-400">{{ detalle }}</p>
    </div>
  </article>
</template>
