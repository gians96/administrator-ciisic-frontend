<script setup lang="ts">
/**
 * Modal accesible basado en <dialog> nativo (atrapa el foco y cierra con Esc).
 * `lado="derecha"` lo convierte en un panel lateral (drawer).
 */
const props = withDefaults(defineProps<{
  abierto: boolean
  titulo: string
  descripcion?: string
  ancho?: 'sm' | 'md' | 'lg' | 'xl'
  lado?: 'centro' | 'derecha'
}>(), { descripcion: undefined, ancho: 'md', lado: 'centro' })

const emit = defineEmits<{ cerrar: [] }>()
const dialogo = ref<HTMLDialogElement | null>(null)

const ANCHOS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

watch(() => props.abierto, (abierto) => {
  const el = dialogo.value
  if (!el) return
  if (abierto && !el.open) el.showModal()
  if (!abierto && el.open) el.close()
}, { flush: 'post' })

onMounted(() => {
  if (props.abierto) dialogo.value?.showModal()
})

function alClicFondo(evento: MouseEvent) {
  if (evento.target === dialogo.value) emit('cerrar')
}
</script>

<template>
  <dialog
    ref="dialogo"
    :aria-label="titulo"
    class="m-0 max-h-none max-w-none bg-transparent p-0 text-slate-300 backdrop:bg-navy-950/75 backdrop:backdrop-blur-sm"
    :class="lado === 'derecha' ? 'ml-auto h-dvh w-full' : 'h-dvh w-full'"
    @cancel.prevent="emit('cerrar')"
    @click="alClicFondo"
  >
    <div
      v-if="abierto"
      class="flex h-full w-full"
      :class="lado === 'derecha' ? 'justify-end' : 'items-center justify-center p-4'"
      @click.self="emit('cerrar')"
    >
      <section
        class="flex w-full flex-col border border-white/10 bg-navy-850 shadow-2xl shadow-black/40"
        :class="[ANCHOS[ancho], lado === 'derecha' ? 'h-full' : 'max-h-[90dvh] rounded-2xl']"
      >
        <header class="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 class="text-xl font-bold">{{ titulo }}</h2>
            <p v-if="descripcion" class="mt-0.5 text-sm text-slate-400">{{ descripcion }}</p>
          </div>
          <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar" @click="emit('cerrar')">
            <Icon name="heroicons:x-mark" class="size-5" />
          </button>
        </header>
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <slot />
        </div>
        <footer v-if="$slots.acciones" class="flex flex-wrap justify-end gap-2 border-t border-white/10 px-6 py-4">
          <slot name="acciones" />
        </footer>
      </section>
    </div>
  </dialog>
</template>
