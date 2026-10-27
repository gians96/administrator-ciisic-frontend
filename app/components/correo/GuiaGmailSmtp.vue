<script setup lang="ts">
import {
  NOTA_SEGURIDAD_GMAIL,
  PASOS_GUIA_GMAIL,
  PROBLEMAS_GUIA_GMAIL,
  textoAvanceGuia,
} from '~/utils/guiaGmail'

/**
 * Manual lateral para enviar los correos con Gmail por SMTP (spec 031): los pasos en la cuenta de Google y
 * en el panel, con una lista para ir marcando y los problemas más comunes. El contenido está en `utils/guiaGmail.ts`.
 */
withDefaults(defineProps<{
  abierto: boolean
  /** Si se ofrece «Agregar credencial de Gmail» (no con un backend anterior a la spec 041). */
  puedeAgregar?: boolean
  /** Si muestra «Agregar credencial de Gmail» (no cuando se abre sobre el formulario: lo reiniciaría). */
  ofrecerAgregar?: boolean
}>(), { puedeAgregar: true, ofrecerAgregar: true })

const emit = defineEmits<{ cerrar: [], agregar: [] }>()

/** Pasos que la persona fue marcando como hechos; solo mientras la página está abierta. */
const hechos = ref<number[]>([])

function alternar(indice: number) {
  hechos.value = hechos.value.includes(indice) ? hechos.value.filter((otro) => otro !== indice) : [...hechos.value, indice]
}

const avance = computed(() => Math.round((hechos.value.length / PASOS_GUIA_GMAIL.length) * 100))
</script>

<template>
  <AppModal
    :abierto="abierto"
    titulo="Guía: enviar correos con Gmail"
    descripcion="Cómo activar la contraseña de aplicación de Google y conectarla al panel."
    lado="derecha"
    ancho="md"
    @cerrar="emit('cerrar')"
  >
    <div class="space-y-6">
      <div>
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>Tu avance</span>
          <span class="tabular-nums" aria-live="polite">{{ textoAvanceGuia(hechos.length) }}</span>
        </div>
        <div
          class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Avance de la guía"
          :aria-valuenow="avance"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="h-full rounded-full bg-brand-400 transition-all" :style="{ width: `${avance}%` }" />
        </div>
      </div>

      <ol class="space-y-5">
        <li v-for="(paso, indice) in PASOS_GUIA_GMAIL" :key="paso.titulo" class="flex gap-3">
          <button
            type="button"
            role="checkbox"
            :aria-checked="hechos.includes(indice)"
            :aria-label="`Marcar como hecho el paso ${indice + 1}: ${paso.titulo}`"
            class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-brand-400"
            :class="hechos.includes(indice) ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/40' : 'bg-white/5 text-slate-300 ring-white/20 hover:bg-white/10'"
            @click="alternar(indice)"
          >
            <Icon v-if="hechos.includes(indice)" name="heroicons:check" class="size-4" aria-hidden="true" />
            <span v-else>{{ indice + 1 }}</span>
          </button>
          <div class="min-w-0 flex-1 space-y-2">
            <h3 class="font-semibold text-slate-100" :class="hechos.includes(indice) ? 'text-slate-400' : ''">{{ paso.titulo }}</h3>
            <p class="text-sm text-slate-300">{{ paso.texto }}</p>
            <ul v-if="paso.detalles?.length" class="list-disc space-y-1 pl-4 text-sm text-slate-400 marker:text-slate-600">
              <li v-for="detalle in paso.detalles" :key="detalle">{{ detalle }}</li>
            </ul>
            <a
              v-if="paso.enlace"
              :href="paso.enlace.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-300 ring-1 ring-white/15 ring-inset transition hover:bg-white/10 hover:text-white"
            >
              {{ paso.enlace.texto }}
              <Icon name="heroicons:arrow-top-right-on-square" class="size-3.5" aria-hidden="true" />
              <span class="sr-only">(se abre en otra pestaña)</span>
            </a>
          </div>
        </li>
      </ol>

      <p class="flex gap-2 rounded-xl bg-brand-500/5 px-4 py-3 text-sm text-slate-300 ring-1 ring-brand-400/25 ring-inset">
        <Icon name="heroicons:lock-closed" class="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden="true" />
        {{ NOTA_SEGURIDAD_GMAIL }}
      </p>

      <section aria-labelledby="problemas-gmail">
        <h3 id="problemas-gmail" class="mb-2 font-semibold text-slate-100">Problemas frecuentes</h3>
        <div class="divide-y divide-white/10 rounded-xl ring-1 ring-white/10 ring-inset">
          <details v-for="problema in PROBLEMAS_GUIA_GMAIL" :key="problema.problema" class="group px-4 py-3">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
              {{ problema.problema }}
              <Icon name="heroicons:chevron-down" class="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p class="mt-2 text-sm text-slate-400">{{ problema.solucion }}</p>
          </details>
        </div>
      </section>
    </div>

    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cerrar</AppButton>
      <AppButton
        v-if="ofrecerAgregar"
        icon="heroicons:plus"
        :disabled="!puedeAgregar"
        :title="puedeAgregar ? undefined : 'Gmail necesita el backend con la spec 041; despliégalo primero.'"
        @click="emit('agregar')"
      >
        Agregar credencial de Gmail
      </AppButton>
    </template>
  </AppModal>
</template>
