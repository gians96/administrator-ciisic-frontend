<script setup lang="ts">
import { QrcodeStream, type BarcodeFormat, type DetectedBarcode, type EmittedError } from 'vue-qrcode-reader'
import { mensajeErrorCamara, mensajeProblemaCamara, problemaCamara } from '~/utils/asistencia'
import { lecturasNuevas } from '~/utils/lecturaQr'
import { usarZxingDelPanel } from '~/utils/zxingDelPanel'

/**
 * Cámara del escáner con `vue-qrcode-reader`: cámara trasera, solo QR y el wasm de ZXing servido por el
 * propio panel (`public/zxing-wasm/`, configurado una sola vez con `usarZxingDelPanel`), nunca desde un
 * CDN. Emite el texto de cada QR que aparece (con dos a la vista, los dos, y avisa «muestra uno a la
 * vez»); la librería no repite uno mientras siga a la vista y la página ignora además la misma lectura
 * en 3 s. `pausada` detiene la lectura (un resultado que espera al operador); al reanudar vuelve a leer
 * lo que esté a la vista, también el mismo QR. Si no hay cámara (sin permiso, sin HTTPS, navegador sin
 * soporte) explica el motivo y ofrece los otros modos. Usarla dentro de `<ClientOnly>`.
 */
usarZxingDelPanel()

const props = withDefaults(defineProps<{ pausada?: boolean }>(), { pausada: false })
const emit = defineEmits<{ lectura: [texto: string], cambiarModo: [modo: 'lector' | 'documento'] }>()

const RESTRICCIONES: MediaTrackConstraints = { facingMode: 'environment' }
const FORMATOS: BarcodeFormat[] = ['qr_code']

const problema = problemaCamara({
  seguro: window.isSecureContext === true,
  conGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
})
const error = ref<string | null>(problema ? mensajeProblemaCamara(problema) : null)
const encendida = ref(false)
/** Cambia para volver a pedir la cámara («Reintentar»). */
const intento = ref(0)
const conLinterna = ref(false)
const linterna = ref(false)

/** Textos de la última detección emitida (la librería solo vuelve a emitir si aparece uno nuevo). */
let anteriores: string[] = []

function alDetectar(codigos: DetectedBarcode[]) {
  const textos = codigos.map((codigo) => codigo.rawValue)
  const nuevos = lecturasNuevas(textos, anteriores)
  anteriores = textos
  avisarSiHayVarios(textos)
  for (const texto of nuevos) emit('lectura', texto)
}

// Al pausar, la librería apaga la cámara y al reanudar lee desde cero: también el QR que ya estaba
watch(() => props.pausada, () => { anteriores = [] })

/** Hay más de un QR a la vista: se avisa mientras sigan (el aviso se apaga solo poco después). */
const varios = ref(false)
let apagarAviso: ReturnType<typeof setTimeout> | null = null

function avisarSiHayVarios(textos: readonly string[]) {
  if (new Set(textos.filter(Boolean)).size < 2) return
  varios.value = true
  if (apagarAviso) clearTimeout(apagarAviso)
  apagarAviso = setTimeout(() => { varios.value = false }, 1500)
}

onBeforeUnmount(() => {
  if (apagarAviso) clearTimeout(apagarAviso)
})

/** En pausa se sigue viendo el último cuadro: no es «Abriendo la cámara…». */
function alApagar() {
  if (!props.pausada) encendida.value = false
}

function alEncender(capacidades: Partial<MediaTrackCapabilities>) {
  encendida.value = true
  error.value = null
  conLinterna.value = Boolean((capacidades as { torch?: boolean }).torch)
}

function alFallar(causa: EmittedError) {
  encendida.value = false
  linterna.value = false
  error.value = mensajeErrorCamara(causa)
}

function reintentar() {
  error.value = null
  encendida.value = false
  linterna.value = false
  anteriores = []
  intento.value++
}

/** Contorno del QR que se está leyendo (se llama en cada cuadro con algún QR a la vista). */
function dibujar(codigos: DetectedBarcode[], contexto: CanvasRenderingContext2D) {
  avisarSiHayVarios(codigos.map((codigo) => codigo.rawValue))
  contexto.strokeStyle = '#00d9e8'
  contexto.lineWidth = 4
  for (const { cornerPoints } of codigos) {
    const [primero, ...resto] = cornerPoints
    if (!primero) continue
    contexto.beginPath()
    contexto.moveTo(primero.x, primero.y)
    for (const punto of resto) contexto.lineTo(punto.x, punto.y)
    contexto.closePath()
    contexto.stroke()
  }
}
</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-2xl bg-black">
    <QrcodeStream
      v-if="!problema && !error"
      :key="intento"
      :constraints="RESTRICCIONES"
      :formats="FORMATOS"
      :track="dibujar"
      :torch="linterna"
      :paused="pausada"
      @detect="alDetectar"
      @camera-on="alEncender"
      @camera-off="alApagar"
      @error="alFallar"
    />

    <!-- Visor -->
    <div v-if="encendida && !error" class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div class="aspect-square w-3/5 max-w-72 rounded-3xl border-4 border-brand-400/80 shadow-[0_0_0_100vmax_rgb(2_12_27/0.4)]" />
    </div>

    <p
      v-if="varios && encendida && !error"
      class="absolute inset-x-3 top-3 flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-center text-sm font-semibold text-navy-950 shadow-lg"
      role="status"
    >
      <Icon name="heroicons:exclamation-triangle" class="size-5 shrink-0" aria-hidden="true" />
      Hay varios QR a la vista: muestra uno a la vez.
    </p>

    <div v-if="!encendida && !error" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-300" role="status">
      <Icon name="heroicons:arrow-path" class="size-8 animate-spin text-brand-300" aria-hidden="true" />
      Abriendo la cámara… Si el navegador lo pide, permite usarla.
    </div>

    <div v-if="error" class="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center" role="alert">
      <Icon name="heroicons:video-camera-slash" class="size-10 shrink-0 text-amber-300" aria-hidden="true" />
      <p class="max-w-md text-sm text-slate-200">{{ error }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <AppButton v-if="!problema" size="sm" icon="heroicons:arrow-path" @click="reintentar">Reintentar</AppButton>
        <AppButton size="sm" variant="secondary" icon="heroicons:qr-code" @click="emit('cambiarModo', 'lector')">Usar lector USB</AppButton>
        <AppButton size="sm" variant="secondary" icon="heroicons:identification" @click="emit('cambiarModo', 'documento')">Registrar con el DNI</AppButton>
      </div>
    </div>

    <button
      v-if="encendida && conLinterna && !error"
      type="button"
      class="absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-full bg-navy-950/80 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-navy-900"
      :aria-pressed="linterna"
      @click="linterna = !linterna"
    >
      <Icon name="heroicons:light-bulb" class="size-4" :class="linterna ? 'text-amber-300' : ''" aria-hidden="true" />
      Linterna
    </button>
  </div>
</template>
