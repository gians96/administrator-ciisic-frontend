<script setup lang="ts">
/** Acceso desde el Programa a «Enviar el enlace de inscripción» (spec 029): quién ya lo recibió se ve en esa pantalla. */
</script>

<template>
  <section class="card flex flex-wrap items-center justify-between gap-4 p-5" aria-labelledby="envio-enlace-titulo">
    <div class="flex min-w-0 items-start gap-3">
      <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-400/20">
        <Icon name="heroicons:paper-airplane" class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <h2 id="envio-enlace-titulo" class="text-base font-bold text-white">Invitar a los inscritos presenciales</h2>
        <p class="mt-0.5 max-w-2xl text-sm text-slate-400">
          Envía un mismo mensaje, que tú editas, con el enlace para inscribirse a las ponencias. Queda marcado a quién ya se le envió para elegir después solo a quien falta.
        </p>
      </div>
    </div>
    <AppButton to="/ponencias-especializadas/enviar-enlace" icon="heroicons:envelope">Enviar el enlace</AppButton>
  </section>
</template>
