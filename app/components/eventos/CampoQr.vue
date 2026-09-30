<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { mensajeError } from '~/utils/errores'
import { errorImagenQr, QR_ACEPTA, rutaQr, urlQrExterna } from '~/utils/qr'

const props = defineProps<{ id: string, nombre?: string }>()
/** Imagen subida (`qrArchivo`) y URL anterior (`qrUrl`) de la billetera. */
const archivo = defineModel<string | null | undefined>('archivo')
const url = defineModel<string | null | undefined>('url')

const { api, urlArchivo } = useApi()
const entrada = ref<HTMLInputElement | null>(null)
const arrastrando = ref(false)
const subiendo = ref(false)
const error = ref('')

const vistaPrevia = computed(() => (archivo.value ? urlArchivo(rutaQr(archivo.value)) : urlQrExterna(url.value)))
const tieneQr = computed(() => Boolean(archivo.value || url.value?.trim()))
const descripcion = computed(() => `${props.id}-ayuda`)

function elegir() {
  if (!subiendo.value) entrada.value?.click()
}

async function subir(file?: File | null) {
  if (!file || subiendo.value) return
  error.value = errorImagenQr(file) ?? ''
  if (error.value) return
  const cuerpo = new FormData()
  cuerpo.append('file', file)
  subiendo.value = true
  try {
    const respuesta = await api<Respuesta<{ archivo: string }>>('payment-qr', { method: 'POST', body: cuerpo })
    archivo.value = respuesta.data.archivo
    url.value = null
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    subiendo.value = false
    if (entrada.value) entrada.value.value = ''
  }
}

function alSoltar(evento: DragEvent) {
  arrastrando.value = false
  void subir(evento.dataTransfer?.files?.[0])
}

// Al pasar sobre los hijos del área también se dispara `dragleave`: solo cuenta si sale del todo
function alSalir(evento: DragEvent) {
  const destino = evento.relatedTarget as Node | null
  if (!destino || !(evento.currentTarget as HTMLElement).contains(destino)) arrastrando.value = false
}

function quitar() {
  archivo.value = null
  url.value = null
  error.value = ''
}
</script>

<template>
  <div>
    <input :id="id" ref="entrada" type="file" :accept="QR_ACEPTA" class="sr-only" tabindex="-1" :aria-describedby="descripcion" @change="subir(($event.target as HTMLInputElement).files?.[0])">
    <div
      class="rounded-xl border-2 border-dashed transition"
      :class="arrastrando ? 'border-brand-400 bg-brand-500/10' : 'border-navy-500 bg-navy-900/60'"
      @dragenter.prevent="arrastrando = true"
      @dragover.prevent="arrastrando = true"
      @dragleave.prevent="alSalir"
      @drop.prevent="alSoltar"
    >
      <div v-if="tieneQr" class="flex items-center gap-3 p-2">
        <img v-if="vistaPrevia" :src="vistaPrevia" :alt="`QR de ${nombre || 'la billetera'}`" class="size-20 shrink-0 rounded-lg bg-white object-contain p-1">
        <div v-else class="flex size-20 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400">
          <Icon name="heroicons:qr-code" class="size-8" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs text-slate-300" :title="archivo ? undefined : url ?? undefined">
            {{ archivo ? 'Imagen subida' : url }}
          </p>
          <p v-if="!archivo" class="text-xs text-slate-500">Súbela aquí para guardarla en el servidor.</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <AppButton size="sm" variant="secondary" icon="heroicons:arrow-up-tray" :loading="subiendo" @click="elegir">Cambiar</AppButton>
            <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" :disabled="subiendo" @click="quitar">Quitar</AppButton>
          </div>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="flex w-full flex-col items-center justify-center gap-1 rounded-xl px-3 py-4 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        :aria-describedby="descripcion"
        :aria-busy="subiendo"
        @click="elegir"
      >
        <Icon :name="subiendo ? 'heroicons:arrow-path' : 'heroicons:qr-code'" class="size-6 text-brand-300" :class="{ 'animate-spin': subiendo }" aria-hidden="true" />
        <span class="text-sm font-medium text-white">{{ subiendo ? 'Subiendo…' : arrastrando ? 'Suelta la imagen aquí' : 'Arrastra el QR o haz clic para elegirlo' }}</span>
      </button>
    </div>
    <p :id="descripcion" :class="error ? 'field-error' : 'field-hint'" :role="error ? 'alert' : undefined">{{ error || 'PNG, JPG o WebP · máx. 2 MB' }}</p>
  </div>
</template>
