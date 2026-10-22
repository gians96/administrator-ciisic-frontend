<script setup lang="ts">
/**
 * Indicador compacto del reporte. Con `clicable` es un botón (filtra la lista por ese dato) y no desborda: el
 * texto se trunca dentro de su tarjeta en lugar de salirse de la rejilla.
 */
const props = withDefaults(defineProps<{
  etiqueta: string
  valor: string | number
  detalle?: string
  icon: string
  tono?: 'brand' | 'ok' | 'warn' | 'error' | 'info' | 'neutral'
  clicable?: boolean
  activo?: boolean
}>(), { detalle: undefined, tono: 'brand', clicable: false, activo: false })

const emit = defineEmits<{ elegir: [] }>()

const TONOS = {
  brand: 'bg-brand-500/10 text-brand-300',
  ok: 'bg-emerald-500/10 text-emerald-300',
  warn: 'bg-amber-500/10 text-amber-300',
  error: 'bg-red-500/10 text-red-300',
  info: 'bg-blue-500/10 text-blue-300',
  neutral: 'bg-slate-500/15 text-slate-300',
}

const etiquetaAccesible = computed(() => `${props.etiqueta}: ${props.valor}${props.detalle ? `. ${props.detalle}` : ''}`)
</script>

<template>
  <component
    :is="clicable ? 'button' : 'div'"
    :type="clicable ? 'button' : undefined"
    class="card group relative flex min-w-0 items-center gap-3 p-4 text-left transition"
    :class="[clicable ? 'cursor-pointer hover:border-brand-400/40 hover:bg-navy-750' : '', activo ? 'border-brand-400/60 bg-navy-750 ring-1 ring-brand-400/40' : '']"
    :aria-pressed="clicable ? activo : undefined"
    :aria-label="clicable ? etiquetaAccesible : undefined"
    @click="clicable && emit('elegir')"
  >
    <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" :class="TONOS[tono]">
      <Icon :name="icon" class="size-5" aria-hidden="true" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="line-clamp-2 block text-[11px] leading-tight font-semibold tracking-wider text-slate-400 uppercase">{{ etiqueta }}</span>
      <span class="block truncate font-display text-2xl leading-tight font-bold text-white tabular-nums">{{ valor }}</span>
      <span v-if="detalle" class="line-clamp-2 block text-xs leading-snug text-slate-400">{{ detalle }}</span>
    </span>
    <Icon v-if="clicable" name="heroicons:arrow-right" class="absolute top-3 right-3 size-4 text-brand-300 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
  </component>
</template>
