<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  icon?: string
  to?: string
}>(), { variant: 'primary', size: 'md', type: 'button', loading: false, disabled: false, icon: undefined, to: undefined })

const VARIANTES = {
  primary: 'bg-brand-500 text-navy-900 hover:bg-brand-300 font-semibold shadow-[var(--shadow-glow)]',
  secondary: 'bg-white/5 text-white ring-1 ring-inset ring-white/15 hover:bg-white/10',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-400/30 hover:bg-red-500/25',
  success: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/25',
}

const clases = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
  props.size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
  VARIANTES[props.variant],
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="clases">
    <Icon v-if="icon" :name="icon" class="size-4 shrink-0" aria-hidden="true" />
    <slot />
  </NuxtLink>
  <button v-else :type="type" :class="clases" :disabled="disabled || loading" :aria-busy="loading">
    <Icon v-if="loading" name="heroicons:arrow-path" class="size-4 shrink-0 animate-spin" aria-hidden="true" />
    <Icon v-else-if="icon" :name="icon" class="size-4 shrink-0" aria-hidden="true" />
    <slot />
  </button>
</template>
