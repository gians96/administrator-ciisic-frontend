<script setup lang="ts">
import { horaEnLima } from '~/utils/fotocheck'

/**
 * Indicador «en vivo» del fotocheck: un punto que late y la hora de Lima con segundos. Una captura de
 * pantalla queda con la hora congelada, así que el equipo del ingreso puede notar que no es el portal.
 */
const ahora = ref(new Date())
let reloj: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  reloj = setInterval(() => { ahora.value = new Date() }, 1000)
})
onBeforeUnmount(() => {
  if (reloj) clearInterval(reloj)
})
</script>

<template>
  <p class="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-200 uppercase">
    <span class="relative flex size-2.5" aria-hidden="true">
      <span class="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
      <span class="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
    </span>
    En vivo
    <time :datetime="ahora.toISOString()" class="font-mono text-sm tracking-normal text-white tabular-nums">{{ horaEnLima(ahora) }}</time>
  </p>
</template>
