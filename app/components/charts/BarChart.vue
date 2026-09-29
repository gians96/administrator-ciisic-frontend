<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = withDefaults(defineProps<{
  etiquetas: string[]
  series: Array<{ label: string, data: number[], color: string }>
  apilado?: boolean
  alto?: number
  descripcion: string
}>(), { apilado: false, alto: 260 })

const datos = computed(() => ({
  labels: props.etiquetas,
  datasets: props.series.map((serie) => ({ label: serie.label, data: serie.data, backgroundColor: serie.color, borderRadius: 6, maxBarThickness: 36 })),
}))

const opciones = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: props.series.length > 1, labels: { color: '#cbd5e1', boxWidth: 12 } },
    tooltip: { backgroundColor: '#06294f', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  },
  scales: {
    x: { stacked: props.apilado, ticks: { color: '#94a3b8' }, grid: { display: false } },
    y: { stacked: props.apilado, beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: 'rgba(255,255,255,0.06)' } },
  },
}))
</script>

<template>
  <div :style="{ height: `${alto}px` }" role="img" :aria-label="descripcion">
    <Bar :data="datos" :options="opciones" />
  </div>
</template>
