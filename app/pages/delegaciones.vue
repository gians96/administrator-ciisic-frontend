<script setup lang="ts">
definePageMeta({ permiso: 'delegaciones.ver' })
useHead({ title: 'Delegaciones · Panel CIISIC' })
const eventos = useEventoStore()
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Delegaciones</h1>
      <p class="mt-1 text-sm text-slate-400">Grupos que inscriben a sus integrantes con planes y precios propios, y el estado de sus pagos.</p>
    </div>
    <DelegacionesPanel v-if="eventos.seleccionadoId" :key="eventos.seleccionadoId" :evento-id="eventos.seleccionadoId" />
    <AppEmpty v-else-if="eventos.cargado" titulo="Selecciona o crea un evento" icon="heroicons:calendar-days" />
  </div>
</template>
