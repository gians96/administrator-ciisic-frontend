<script setup lang="ts">
import type { RegistroLectura, TonoResultado } from '~/utils/asistencia'

/** Últimas lecturas del escáner (las 10 más recientes primero), con su resultado. */
defineProps<{ lecturas: readonly RegistroLectura[] }>()

const TONOS: Readonly<Record<TonoResultado, { punto: string, icono: string, texto: string }>> = {
  exito: { punto: 'text-emerald-300', icono: 'heroicons:check-circle', texto: 'Registrada' },
  alerta: { punto: 'text-amber-300', icono: 'heroicons:exclamation-triangle', texto: 'Aviso' },
  error: { punto: 'text-red-300', icono: 'heroicons:x-circle', texto: 'No registrada' },
}

const hora = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
</script>

<template>
  <section class="card flex min-h-0 flex-col overflow-hidden" aria-labelledby="lecturas-recientes">
    <h2 id="lecturas-recientes" class="border-b border-white/10 px-4 py-3 text-sm font-bold">Últimas lecturas</h2>
    <p v-if="!lecturas.length" class="px-4 py-6 text-center text-sm text-slate-400">Aún no hay lecturas en esta sesión.</p>
    <ol v-else class="min-h-0 divide-y divide-white/5 overflow-y-auto">
      <li v-for="lectura in lecturas" :key="lectura.id" class="flex items-start gap-3 px-4 py-2.5">
        <Icon :name="TONOS[lectura.tono].icono" class="mt-0.5 size-5 shrink-0" :class="TONOS[lectura.tono].punto" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-white">
            <span class="sr-only">{{ TONOS[lectura.tono].texto }}: </span>{{ lectura.titulo }}
          </p>
          <p class="truncate text-xs text-slate-400" :title="lectura.detalle">{{ lectura.detalle }}</p>
          <p v-if="lectura.actividad" class="truncate text-[0.7rem] text-slate-500">{{ lectura.actividad }}</p>
        </div>
        <time class="shrink-0 font-mono text-xs text-slate-400" :datetime="new Date(lectura.instante).toISOString()">{{ hora.format(lectura.instante) }}</time>
      </li>
    </ol>
  </section>
</template>
