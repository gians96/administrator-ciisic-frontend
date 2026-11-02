<script setup lang="ts">
import { CONTENIDO_KIT } from '~/utils/kitsTablero'
</script>

<template>
  <section class="card p-6" aria-labelledby="kit-contenido">
    <h2 id="kit-contenido" class="text-lg font-bold">Qué incluye el kit</h2>
    <p class="mb-4 text-xs text-slate-400">Lo que se entrega con los planes «Con kit» (el mismo detalle que ven los inscritos en Planes).</p>
    <ul class="grid gap-3 sm:grid-cols-2">
      <li v-for="item in CONTENIDO_KIT" :key="item.titulo" class="flex items-start gap-3 rounded-xl bg-white/5 p-3">
        <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
          <Icon :name="item.icon" class="size-5" aria-hidden="true" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-white">{{ item.titulo }}</span>
          <span class="block text-xs text-slate-400">{{ item.detalle }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>
