<script setup lang="ts">
defineProps<{ label: string, descripcion?: string, disabled?: boolean }>()
const activo = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div>
      <label :for="id" class="text-sm font-medium text-slate-200">{{ label }}</label>
      <p v-if="descripcion" class="text-xs text-slate-400">{{ descripcion }}</p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="activo"
      :disabled="disabled"
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50"
      :class="activo ? 'bg-brand-500' : 'bg-navy-500'"
      @click="activo = !activo"
    >
      <span class="inline-block size-5 rounded-full bg-white shadow transition" :class="activo ? 'translate-x-5' : 'translate-x-0.5'" />
    </button>
  </div>
</template>
