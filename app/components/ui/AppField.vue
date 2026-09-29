<script setup lang="ts">
defineProps<{
  label: string
  for?: string
  hint?: string
  error?: string | null
  required?: boolean
}>()
</script>

<template>
  <div>
    <label :for="$props.for" class="field-label">
      {{ label }}<span v-if="required" class="ml-0.5 text-brand-400" aria-hidden="true">*</span>
    </label>
    <slot />
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>
