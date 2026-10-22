<script setup lang="ts">
import type { ContadoresSeguimiento, SituacionSeguimiento } from '~/types/api'
import { nombreSituacion, partesDeBarra, porcentaje } from '~/utils/reportes'

/** Barra apilada con la situación de los alumnos (pagó, en revisión, rechazado, sin inscripción). */
const props = defineProps<{ contadores: Pick<ContadoresSeguimiento, 'alumnos' | 'pagaron' | 'enRevision' | 'rechazados' | 'sinInscripcion' | 'avance'> }>()

const COLORES: Readonly<Record<SituacionSeguimiento, string>> = {
  PAGADO: 'bg-emerald-400',
  EN_REVISION: 'bg-amber-400',
  RECHAZADO: 'bg-red-400',
  SIN_INSCRIPCION: 'bg-slate-600',
}

const partes = computed(() => partesDeBarra(props.contadores))
const descripcion = computed(() => `${porcentaje(props.contadores.avance)} pagó. ${partes.value.map((parte) => `${nombreSituacion(parte.codigo)}: ${parte.cantidad}`).join(', ')}`)
</script>

<template>
  <div class="flex h-2 w-full min-w-24 overflow-hidden rounded-full bg-white/10" role="img" :aria-label="descripcion">
    <span
      v-for="parte in partes"
      :key="parte.codigo"
      class="h-full"
      :class="COLORES[parte.codigo]"
      :style="{ width: `${parte.porcentaje}%` }"
      :title="`${nombreSituacion(parte.codigo)}: ${parte.cantidad}`"
    />
  </div>
</template>
