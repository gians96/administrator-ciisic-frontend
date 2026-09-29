<script setup lang="ts">
defineProps<{ tabs: Array<{ id: string, label: string, icon?: string }> }>()
const activo = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex gap-1 overflow-x-auto border-b border-white/10" role="tablist">
    <button
      v-for="tab in tabs"
      :id="`tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="activo === tab.id"
      class="-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition"
      :class="activo === tab.id ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      @click="activo = tab.id"
    >
      <Icon v-if="tab.icon" :name="tab.icon" class="size-4" aria-hidden="true" />
      {{ tab.label }}
    </button>
  </div>
</template>
