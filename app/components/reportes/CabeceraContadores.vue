<script setup lang="ts">
/** Columnas de contadores que repiten las tablas del resumen (se usa dentro de un `<tr>` de cabecera). */
defineProps<{ conPago: boolean }>()
</script>

<template>
  <th class="text-right">Alumnos</th>
  <th class="text-right">Pagaron</th>
  <th class="text-right">En revisión</th>
  <th class="text-right">Rechazados</th>
  <th class="text-right">Sin inscripción</th>
  <th class="min-w-36">Avance</th>
  <th v-if="conPago" class="text-right">Recaudado</th>
</template>
