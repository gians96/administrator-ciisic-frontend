<script setup lang="ts">
import { rangoFechas } from '~/utils/misInscripciones'
import { iniciales } from '~/utils/perfil'
import type { FotocheckPortal } from '~/utils/portal'

/**
 * Fotocheck virtual con aspecto de credencial: evento, foto (o iniciales), nombre, documento enmascarado,
 * tipo de inscripción, el QR (solo lleva el código de 10 caracteres) y el código en texto. La franja
 * animada y el reloj «en vivo» ayudan a distinguirlo de una captura de pantalla.
 */
const props = defineProps<{ fotocheck: FotocheckPortal, foto: string | null }>()

const nombre = computed(() => `${props.fotocheck.participante.nombres} ${props.fotocheck.participante.apellidos}`.trim())
const documento = computed(() => `${props.fotocheck.participante.tipoDocumento.toUpperCase()} ${props.fotocheck.participante.documentoEnmascarado}`.trim())
const fechas = computed(() => {
  const { fechaInicio, fechaFin, sede } = props.fotocheck.evento
  return [fechaInicio && fechaFin ? rangoFechas(fechaInicio, fechaFin) : '', sede ?? ''].filter(Boolean).join(' · ')
})
</script>

<template>
  <article class="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-linear-to-b from-navy-700 to-navy-850 shadow-[var(--shadow-glow)] ring-1 ring-brand-400/30" :aria-label="`Fotocheck de ${nombre}`">
    <div class="fotocheck-franja h-2" aria-hidden="true" />

    <header class="px-6 pt-5 text-center">
      <p class="kicker">{{ fotocheck.evento.nombreCorto }}</p>
      <p class="mt-1 text-sm leading-snug font-semibold text-white">{{ fotocheck.evento.nombre }}</p>
      <p v-if="fechas" class="mt-1 text-xs text-slate-400">{{ fechas }}</p>
    </header>

    <div class="mt-4 flex items-center gap-4 px-6 sm:mt-5">
      <img v-if="foto" :src="foto" alt="Tu foto" class="size-20 shrink-0 rounded-2xl object-cover ring-2 ring-brand-400/40" width="80" height="80">
      <span
        v-else
        class="inline-flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 font-display text-2xl font-extrabold text-brand-200 ring-1 ring-brand-400/30"
        aria-hidden="true"
      >{{ iniciales(fotocheck.participante.nombres, fotocheck.participante.apellidos) }}</span>
      <div class="min-w-0">
        <h2 class="text-xl leading-tight font-extrabold break-words">{{ nombre }}</h2>
        <p class="mt-1 font-mono text-sm text-slate-300">{{ documento }}</p>
        <p v-if="fotocheck.tipoInscripcion" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-200">
          {{ fotocheck.tipoInscripcion.nombre }}
          <AppBadge v-if="fotocheck.tipoInscripcion.etiqueta" tono="brand">{{ fotocheck.tipoInscripcion.etiqueta }}</AppBadge>
        </p>
      </div>
    </div>

    <div class="mx-6 mt-4 rounded-2xl bg-white p-3 sm:mt-5">
      <img
        :src="fotocheck.qr"
        :alt="`Código QR de tu credencial (${fotocheck.codigo})`"
        class="mx-auto aspect-square w-full max-w-72 [image-rendering:pixelated]"
        width="480"
        height="480"
      >
    </div>
    <p class="mt-3 text-center font-mono text-2xl font-bold tracking-[0.3em] break-all text-white select-all">{{ fotocheck.codigo }}</p>

    <footer class="mt-4 flex justify-center border-t border-white/10 px-6 py-3">
      <PortalRelojEnVivo />
    </footer>
  </article>
</template>

<style scoped>
.fotocheck-franja {
  background: linear-gradient(90deg, #00d9e8, #276187, #67e8f9, #00d9e8);
  background-size: 200% 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .fotocheck-franja {
    animation: fotocheck-franja 3s linear infinite;
  }
}

@keyframes fotocheck-franja {
  from {
    background-position: 0% 0;
  }

  to {
    background-position: 200% 0;
  }
}
</style>
