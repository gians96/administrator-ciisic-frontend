<script setup lang="ts">
import { PX_POR_CM, etiquetaHoja, formatoCm, paginarFotochecks, type AsistenteFotocheck, type ConfigFotocheck, type Rejilla } from '~/utils/fotochecks'

/**
 * Vista previa de impresión (spec 030): las hojas apiladas tal como saldrán, con la misma `FotochecksHoja` y las mismas
 * medidas en cm que la impresión. Solo monta las hojas visibles (`IntersectionObserver`), así que 100 hojas pesan como 3.
 * Las guías (margen y lugar de cada fotocheck) son solo de pantalla. No es el archivo final: lo confirma la vista previa
 * del propio navegador al imprimir.
 */
const props = withDefaults(defineProps<{
  personas: readonly AsistenteFotocheck[]
  rejilla: Rejilla
  config: ConfigFotocheck
  evento: { corto: string, nombre: string }
  /** Aviso cuando lo que se ve es una muestra (todavía no hay nadie elegido). */
  muestra?: string | null
  /** Alto del área desplazable. */
  alto?: string
}>(), { muestra: null, alto: '70dvh' })

const ZOOMS = [
  { id: 'AJUSTAR', etiqueta: 'Ajustar' },
  { id: '1', etiqueta: '100 %' },
  { id: '1.5', etiqueta: '150 %' },
] as const
type Zoom = (typeof ZOOMS)[number]['id']

const zoom = ref<Zoom>('AJUSTAR')
const guias = ref(true)
const lista = ref<HTMLElement | null>(null)
/** Ancho útil del área desplazable, en px (sin el relleno ni la barra). */
const anchoLista = ref(0)

const hojas = computed(() => {
  const reparto = paginarFotochecks(props.personas, props.rejilla.porHoja)
  return reparto.length ? reparto : [[]]
})
const anchoHojaPx = computed(() => props.rejilla.hojaAncho * PX_POR_CM)
const altoHojaPx = computed(() => props.rejilla.hojaAlto * PX_POR_CM)
const escala = computed(() => {
  if (zoom.value !== 'AJUSTAR') return Number(zoom.value)
  return anchoLista.value > 0 ? Math.min(1.5, anchoLista.value / anchoHojaPx.value) : 0.4
})

// ─── Solo se montan las hojas que se ven (y las cercanas) ───

const montadas = ref<ReadonlySet<number>>(new Set([0]))
const actual = ref(0)
const visibilidad = new Map<number, number>()
let observadorMontaje: IntersectionObserver | null = null
let observadorActual: IntersectionObserver | null = null
let observadorTamano: ResizeObserver | null = null

const indiceDe = (elemento: Element) => Number((elemento as HTMLElement).dataset.hoja)

function desconectar() {
  observadorMontaje?.disconnect()
  observadorActual?.disconnect()
}

function observar() {
  desconectar()
  visibilidad.clear()
  const raiz = lista.value
  if (!raiz || typeof IntersectionObserver === 'undefined') return
  observadorMontaje = new IntersectionObserver((entradas) => {
    const siguiente = new Set(montadas.value)
    for (const entrada of entradas) {
      if (entrada.isIntersecting) siguiente.add(indiceDe(entrada.target))
      else siguiente.delete(indiceDe(entrada.target))
    }
    montadas.value = siguiente
  }, { root: raiz, rootMargin: '500px 0px' })
  observadorActual = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) visibilidad.set(indiceDe(entrada.target), entrada.isIntersecting ? entrada.intersectionRatio : 0)
    let mejor = -1
    let razon = 0
    for (const [indice, visible] of visibilidad) {
      if (visible > razon) {
        razon = visible
        mejor = indice
      }
    }
    if (mejor >= 0) actual.value = mejor
  }, { root: raiz, threshold: [0, 0.25, 0.5, 0.75, 1] })
  raiz.querySelectorAll('[data-hoja]').forEach((elemento) => {
    observadorMontaje?.observe(elemento)
    observadorActual?.observe(elemento)
  })
}

onMounted(() => {
  if (lista.value && typeof ResizeObserver !== 'undefined') {
    observadorTamano = new ResizeObserver(([entrada]) => {
      if (entrada) anchoLista.value = entrada.contentRect.width
    })
    observadorTamano.observe(lista.value)
  }
  observar()
})

onBeforeUnmount(() => {
  desconectar()
  observadorTamano?.disconnect()
})

watch(() => hojas.value.length, async (cantidad) => {
  await nextTick()
  if (actual.value >= cantidad) actual.value = 0
  observar()
})

function irA(indice: number) {
  const destino = Math.min(Math.max(0, indice), hojas.value.length - 1)
  const hoja = lista.value?.querySelector<HTMLElement>(`[data-hoja="${destino}"]`)
  if (hoja && lista.value) lista.value.scrollTo({ top: hoja.offsetTop - 16, behavior: 'smooth' })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div class="flex items-center gap-2">
        <AppButton size="sm" variant="secondary" icon="heroicons:chevron-up" :disabled="actual <= 0" aria-label="Hoja anterior" @click="irA(actual - 1)" />
        <AppButton size="sm" variant="secondary" icon="heroicons:chevron-down" :disabled="actual >= hojas.length - 1" aria-label="Hoja siguiente" @click="irA(actual + 1)" />
        <p class="text-sm font-semibold text-white" aria-live="polite">Hoja {{ actual + 1 }} de {{ hojas.length }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex overflow-hidden rounded-lg ring-1 ring-white/15 ring-inset" role="group" aria-label="Zoom de la vista previa">
          <button
            v-for="opcion in ZOOMS"
            :key="opcion.id"
            type="button"
            class="px-2.5 py-1 text-xs font-medium transition"
            :class="zoom === opcion.id ? 'bg-brand-500/20 text-white' : 'text-slate-300 hover:bg-white/5'"
            :aria-pressed="zoom === opcion.id"
            @click="zoom = opcion.id"
          >
            {{ opcion.etiqueta }}
          </button>
        </div>
        <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
          <input v-model="guias" type="checkbox" class="size-3.5 accent-brand-500"> Guías
        </label>
        <slot name="acciones" />
      </div>
    </div>

    <p class="text-xs text-slate-400">
      {{ etiquetaHoja(config, rejilla) }} · fotocheck de {{ formatoCm(config.ancho) }} × {{ formatoCm(config.alto) }} cm
      <template v-if="guias && rejilla.porHoja > 0"> · <span class="text-blue-300">azul</span>: margen · <span class="text-pink-300">rosa</span>: lugar de cada fotocheck (las guías no se imprimen)</template>
    </p>

    <p v-if="muestra" class="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/30 ring-inset">{{ muestra }}</p>

    <AppEmpty
      v-if="rejilla.porHoja < 1"
      titulo="El fotocheck no cabe en la hoja"
      descripcion="Con ese margen y esa separación no entra ni uno. Reduce el tamaño del fotocheck o el margen, o elige una hoja más grande."
      icon="heroicons:exclamation-triangle"
    />
    <div
      v-else
      ref="lista"
      class="vp__lista"
      :style="{ height: alto }"
      tabindex="0"
      role="region"
      aria-label="Vista previa de las hojas de impresión"
    >
      <div
        v-for="(hoja, indice) in hojas"
        :key="indice"
        class="vp__hoja"
        :data-hoja="indice"
        :style="{ width: `${anchoHojaPx * escala}px`, height: `${altoHojaPx * escala}px` }"
      >
        <div v-if="montadas.has(indice)" class="vp__escala" :style="{ transform: `scale(${escala})` }">
          <FotochecksHoja :personas="hoja" :rejilla="rejilla" :config="config" :evento="evento" :guias="guias" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vp__lista {
  position: relative;
  overflow: auto;
  padding: 1rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 0.75rem;
  background: rgb(2 12 27 / 0.7);
}

/* Papel: su tamaño ya es el escalado; lo de adentro se recorta para no agrandar el área desplazable */
.vp__hoja {
  position: relative;
  margin: 0 auto 1rem;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.5);
}

.vp__hoja:last-child {
  margin-bottom: 0;
}

.vp__escala {
  transform-origin: 0 0;
}
</style>
