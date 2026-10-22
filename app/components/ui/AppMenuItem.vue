<script setup lang="ts">
/** Acción de un `AppMenu`. */
withDefaults(defineProps<{ icon?: string, peligro?: boolean, disabled?: boolean }>(), { icon: undefined, peligro: false, disabled: false })
</script>

<template>
  <button
    type="button"
    role="menuitem"
    :disabled="disabled"
    class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-white/5 focus-visible:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    :class="peligro ? 'text-red-300' : 'text-slate-200'"
  >
    <Icon v-if="icon" :name="icon" class="size-4 shrink-0" aria-hidden="true" />
    <slot />
  </button>
</template>
