<script setup lang="ts">
withDefaults(defineProps<{ titulo: string, descripcion?: string, icon?: string }>(), { descripcion: undefined, icon: 'heroicons:inbox' })
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <span class="inline-flex size-12 items-center justify-center rounded-2xl bg-white/5 text-brand-300 ring-1 ring-white/10">
      <Icon :name="icon" class="size-6" aria-hidden="true" />
    </span>
    <p class="font-display text-lg font-semibold text-white">{{ titulo }}</p>
    <p v-if="descripcion" class="max-w-md text-sm text-slate-400">{{ descripcion }}</p>
    <slot />
  </div>
</template>
