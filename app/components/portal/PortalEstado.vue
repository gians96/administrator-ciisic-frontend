<script setup lang="ts">
import { MENSAJE_PRONTO_DISPONIBLE } from '~/utils/portal'

/**
 * Estados comunes de las páginas del portal: cargando, error con «Reintentar» y «pronto disponible»
 * (la sección aún no existe en el backend: `esNoDisponible`).
 */
withDefaults(defineProps<{
  estado: 'cargando' | 'error' | 'no-disponible'
  texto?: string | null
  icon?: string
}>(), { texto: null, icon: 'heroicons:sparkles' })

defineEmits<{ reintentar: [] }>()
</script>

<template>
  <div v-if="estado === 'cargando'" class="card flex items-center gap-3 p-6 text-sm text-slate-300" role="status">
    <Icon name="heroicons:arrow-path" class="size-5 animate-spin" aria-hidden="true" /> {{ texto ?? 'Cargando…' }}
  </div>

  <div v-else-if="estado === 'error'" class="card p-6" role="alert">
    <p class="text-sm text-red-200">{{ texto ?? 'No se pudo cargar esta sección.' }}</p>
    <AppButton class="mt-4" variant="secondary" size="sm" icon="heroicons:arrow-path" @click="$emit('reintentar')">Reintentar</AppButton>
  </div>

  <div v-else class="card">
    <AppEmpty :icon="icon" titulo="Pronto disponible" :descripcion="texto ?? MENSAJE_PRONTO_DISPONIBLE">
      <slot />
    </AppEmpty>
  </div>
</template>
