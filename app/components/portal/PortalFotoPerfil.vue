<script setup lang="ts">
import { aErrorApi } from '~/utils/errores'
import {
  errorArchivoFoto,
  errorDimensionesFoto,
  errorFotoLista,
  FOTO_ACEPTA,
  FOTO_CALIDAD_JPEG,
  FOTO_TIPO_SALIDA,
  formularioFoto,
  MENSAJE_FOTO_ILEGIBLE,
  mensajeErrorFoto,
  NOTA_CONSENTIMIENTO_FOTO,
  recorteCuadrado,
  TEXTO_CONSENTIMIENTO_FOTO,
} from '~/utils/foto'
import { almacenDelNavegador, cambiarFotoGuardada, datosDeImagen } from '~/utils/fotocheck'
import { MENSAJE_PRONTO_DISPONIBLE, esNoDisponible } from '~/utils/portal'

/**
 * Foto opcional del fotocheck (`PUT|GET|DELETE /me/photo`, spec 014). La imagen elegida se recorta en
 * un cuadrado centrado y se reduce a 600 × 600 con canvas (`recorteCuadrado`), y se recodifica como
 * JPEG: así pierde los metadatos (EXIF, GPS) y la orientación, que el navegador ya aplicó al dibujarla.
 * Subirla exige la casilla de consentimiento (Ley 29733).
 */
interface FotoPerfil { tiene: boolean, actualizadaEn?: string | null }

const props = defineProps<{ foto: FotoPerfil }>()
const emit = defineEmits<{ cambio: [foto: FotoPerfil] }>()

const auth = useAuthStore()
const toast = useToast()
const { confirmar } = useConfirm()
const { portal, fotoEnDatos } = usePortal()

const idConsentimiento = useId()
const idAyuda = useId()
const selector = ref<HTMLInputElement | null>(null)

/** Foto guardada en el backend, en `data:`. */
const actual = ref<string | null>(null)
const cargandoActual = ref(false)
/** Foto recodificada lista para subir y su vista previa. */
const nueva = ref<{ blob: Blob, url: string } | null>(null)
const consentimiento = ref(false)
const preparando = ref(false)
const subiendo = ref(false)
const quitando = ref(false)
const error = ref<string | null>(null)
const ocupado = computed(() => preparando.value || subiendo.value || quitando.value)

/** Error con un mensaje para la persona (imagen muy pequeña, ilegible). */
class ErrorFotoLocal extends Error {}

async function cargarActual() {
  if (!props.foto.tiene) {
    actual.value = null
    return
  }
  cargandoActual.value = true
  try {
    actual.value = await fotoEnDatos()
  } catch {
    actual.value = null
  } finally {
    cargandoActual.value = false
  }
}

function descartarNueva() {
  if (nueva.value) URL.revokeObjectURL(nueva.value.url)
  nueva.value = null
  consentimiento.value = false
}

/** Abre la imagen, la recorta al centro, la reduce y la recodifica como JPEG. */
async function prepararFoto(archivo: File): Promise<Blob> {
  const url = URL.createObjectURL(archivo)
  try {
    const imagen = new Image()
    imagen.decoding = 'async'
    imagen.src = url
    try {
      await imagen.decode()
    } catch {
      throw new ErrorFotoLocal(MENSAJE_FOTO_ILEGIBLE)
    }
    // naturalWidth/naturalHeight ya vienen con la orientación EXIF aplicada (y drawImage la respeta)
    const pequena = errorDimensionesFoto(imagen.naturalWidth, imagen.naturalHeight)
    if (pequena) throw new ErrorFotoLocal(pequena)
    const recorte = recorteCuadrado(imagen.naturalWidth, imagen.naturalHeight)
    const lienzo = document.createElement('canvas')
    const contexto = lienzo.getContext('2d')
    if (!recorte || !contexto) throw new ErrorFotoLocal(MENSAJE_FOTO_ILEGIBLE)
    lienzo.width = recorte.salida
    lienzo.height = recorte.salida
    // JPEG no tiene transparencia: un PNG con fondo transparente queda sobre blanco y no sobre negro
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, recorte.salida, recorte.salida)
    contexto.imageSmoothingEnabled = true
    contexto.imageSmoothingQuality = 'high'
    contexto.drawImage(imagen, recorte.x, recorte.y, recorte.lado, recorte.lado, 0, 0, recorte.salida, recorte.salida)
    const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, FOTO_TIPO_SALIDA, FOTO_CALIDAD_JPEG))
    if (!blob) throw new ErrorFotoLocal(MENSAJE_FOTO_ILEGIBLE)
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

function elegirArchivo() {
  error.value = null
  selector.value?.click()
}

async function alElegir(evento: Event) {
  const campo = evento.target as HTMLInputElement
  const archivo = campo.files?.[0]
  // Permite volver a elegir el mismo archivo
  campo.value = ''
  if (!archivo) return
  error.value = errorArchivoFoto(archivo)
  if (error.value) return
  preparando.value = true
  try {
    const blob = await prepararFoto(archivo)
    const problema = errorFotoLista(blob)
    if (problema) {
      error.value = problema
      return
    }
    descartarNueva()
    nueva.value = { blob, url: URL.createObjectURL(blob) }
  } catch (e) {
    error.value = e instanceof ErrorFotoLocal ? e.message : MENSAJE_FOTO_ILEGIBLE
  } finally {
    preparando.value = false
  }
}

async function subir() {
  if (!nueva.value) return
  if (!consentimiento.value) {
    error.value = 'Marca la casilla para aceptar el uso de tu foto.'
    return
  }
  subiendo.value = true
  error.value = null
  try {
    const { blob } = nueva.value
    const respuesta = await portal<{ data: { foto: FotoPerfil } }>('photo', { method: 'PUT', body: formularioFoto(blob) })
    const datos = datosDeImagen(new Uint8Array(await blob.arrayBuffer()), blob.type)
    actual.value = datos
    cambiarFotoGuardada(almacenDelNavegador(), auth.participante?.id, datos)
    descartarNueva()
    emit('cambio', respuesta.data.foto)
    toast.exito('Guardamos tu foto. Ya aparece en tu fotocheck.')
  } catch (e) {
    if (aErrorApi(e).status === 401) return
    error.value = esNoDisponible(e) ? MENSAJE_PRONTO_DISPONIBLE : mensajeErrorFoto(e)
  } finally {
    subiendo.value = false
  }
}

async function quitar() {
  const confirmado = await confirmar({
    titulo: 'Quitar tu foto',
    mensaje: 'Tu fotocheck y tu credencial quedarán sin foto. Puedes subir otra cuando quieras.',
    textoConfirmar: 'Quitar foto',
    peligro: true,
  })
  if (!confirmado) return
  quitando.value = true
  error.value = null
  try {
    const respuesta = await portal<{ data: { foto: FotoPerfil } }>('photo', { method: 'DELETE' })
    actual.value = null
    cambiarFotoGuardada(almacenDelNavegador(), auth.participante?.id, null)
    emit('cambio', respuesta.data.foto)
    toast.exito('Quitamos tu foto.')
  } catch (e) {
    if (aErrorApi(e).status === 401) return
    error.value = esNoDisponible(e) ? MENSAJE_PRONTO_DISPONIBLE : mensajeErrorFoto(e)
  } finally {
    quitando.value = false
  }
}

onMounted(cargarActual)
onBeforeUnmount(descartarNueva)
</script>

<template>
  <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
    <div class="mx-auto flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-navy-900/80 ring-1 ring-white/10 sm:mx-0">
      <img v-if="nueva" :src="nueva.url" alt="Vista previa de tu nueva foto" class="size-full object-cover" width="160" height="160">
      <img v-else-if="actual" :src="actual" alt="Tu foto actual" class="size-full object-cover" width="160" height="160">
      <Icon v-else-if="cargandoActual || preparando" name="heroicons:arrow-path" class="size-6 animate-spin text-slate-400" aria-label="Cargando foto" />
      <span v-else class="flex flex-col items-center gap-1 text-xs text-slate-500">
        <Icon name="heroicons:user" class="size-10" aria-hidden="true" /> Sin foto
      </span>
    </div>

    <div class="min-w-0 flex-1 space-y-4">
      <template v-if="nueva">
        <p class="text-sm text-slate-200">Así se verá en tu fotocheck: recortada en cuadrado desde el centro.</p>
        <div class="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <label :for="idConsentimiento" class="flex items-start gap-3 text-sm text-slate-200">
            <input
              :id="idConsentimiento"
              v-model="consentimiento"
              type="checkbox"
              class="mt-0.5 size-4 shrink-0 accent-brand-500"
              :aria-describedby="idAyuda"
              :disabled="subiendo"
              required
            >
            <span>{{ TEXTO_CONSENTIMIENTO_FOTO }}</span>
          </label>
          <p :id="idAyuda" class="mt-2 pl-7 text-xs text-slate-400">{{ NOTA_CONSENTIMIENTO_FOTO }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton icon="heroicons:cloud-arrow-up" :loading="subiendo" :disabled="!consentimiento || quitando" @click="subir">Guardar foto</AppButton>
          <AppButton variant="secondary" icon="heroicons:photo" :disabled="ocupado" @click="elegirArchivo">Elegir otra</AppButton>
          <AppButton variant="ghost" :disabled="subiendo" @click="descartarNueva">Cancelar</AppButton>
        </div>
      </template>

      <template v-else>
        <p class="text-sm text-slate-300">
          Es opcional. Sale en tu fotocheck y en tu credencial, y ayuda al equipo a identificarte en el ingreso.
          Usa una foto de frente, con buena luz y sin lentes oscuros; se recorta en cuadrado desde el centro.
        </p>
        <div class="flex flex-wrap gap-2">
          <AppButton icon="heroicons:photo" :loading="preparando" :disabled="subiendo || quitando" @click="elegirArchivo">
            {{ foto.tiene ? 'Cambiar foto' : 'Subir foto' }}
          </AppButton>
          <AppButton v-if="foto.tiene" variant="danger" icon="heroicons:trash" :loading="quitando" :disabled="preparando" @click="quitar">Quitar foto</AppButton>
        </div>
      </template>

      <p v-if="error" class="text-sm text-red-300" role="alert">{{ error }}</p>
      <input ref="selector" type="file" :accept="FOTO_ACEPTA" class="sr-only" tabindex="-1" aria-hidden="true" @change="alElegir">
    </div>
  </div>
</template>
