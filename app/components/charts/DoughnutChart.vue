<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = withDefaults(defineProps<{
  etiquetas: string[]
  valores: number[]
  colores: string[]
  alto?: number
  descripcion: string
}>(), { alto: 240 })

const datos = computed(() => ({
  labels: props.etiquetas,
  datasets: [{ data: props.valores, backgroundColor: props.colores, borderColor: '#06294f', borderWidth: 2 }],
}))

const opciones = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: { position: 'right' as const, labels: { color: '#cbd5e1', boxWidth: 12, padding: 12 } },
    tooltip: { backgroundColor: '#06294f', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  },
}
</script>

<template>
  <div :style="{ height: `${alto}px` }" role="img" :aria-label="descripcion">
    <Doughnut :data="datos" :options="opciones" />
  </div>
</template>
