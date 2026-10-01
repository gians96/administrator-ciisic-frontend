<script setup lang="ts">
definePageMeta({ permiso: 'eventos.configurar' })
useHead({ title: 'Tipos de inscripción · Panel CIISIC' })
const eventos = useEventoStore()
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Tipos de inscripción</h1>
      <p class="mt-1 text-sm text-slate-400">Planes y precios que la landing ofrece para el evento seleccionado.</p>
    </div>
    <CategoriasTipos v-if="eventos.seleccionadoId" :evento-id="eventos.seleccionadoId" />
    <AppEmpty v-else-if="eventos.cargado" titulo="Selecciona o crea un evento" icon="heroicons:calendar-days" />
  </div>
</template>
