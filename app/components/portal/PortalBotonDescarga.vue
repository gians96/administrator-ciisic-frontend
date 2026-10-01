<script setup lang="ts">
import { esperaParaReintentarDescarga } from '~/utils/descargas'
import { aErrorApi } from '~/utils/errores'

/**
 * Botón de descarga de un archivo del portal (la credencial PDF, `GET /me/inscriptions/:id/credential`,
 * o un certificado). Baja el archivo con `usePortal().descargar` y no con un enlace directo: un error se
 * muestra con su mensaje en lugar de dejar a la persona en una página con el JSON del backend. Si el
 * backend está ocupado generando PDF (`503 PDF_BUSY`) reintenta una vez a los 3 s y, si sigue ocupado,
 * avisa que pruebe en unos segundos. Un 401 (la sesión de 12 h venció) ya lleva al login.
 */
const props = withDefaults(defineProps<{
  /** Ruta del portal (`inscriptions/12/credential`). */
  ruta: string
  /** Nombre del archivo si el backend no envía uno. */
  respaldo: string
  texto?: string
  variante?: 'primary' | 'secondary'
  /** Ocupa todo el ancho. */
  ancho?: boolean
}>(), { texto: 'Descargar', variante: 'primary', ancho: false })

const { descargar } = usePortal()
const toast = useToast()
const descargando = ref(false)
let montado = true

onBeforeUnmount(() => { montado = false })

async function alPulsar() {
  if (descargando.value) return
  descargando.value = true
  try {
    for (let intento = 0; ; intento++) {
      try {
        await descargar(props.ruta, props.respaldo)
        return
      } catch (error) {
        const e = aErrorApi(error)
        // La sesión venció o ya no es del portal: usePortal ya llevó a donde corresponde
        if (e.status === 401 || e.code === 'FORBIDDEN_PROFILE') return
        const espera = esperaParaReintentarDescarga(e.code, intento)
        if (espera === null || !montado) {
          if (e.code === 'PDF_BUSY') toast.info(e.message)
          else toast.error(e.message)
          return
        }
        await new Promise((resolver) => setTimeout(resolver, espera))
        if (!montado) return
      }
    }
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <AppButton
    :variant="variante"
    icon="heroicons:arrow-down-tray"
    :loading="descargando"
    :class="ancho ? 'w-full' : ''"
    @click="alPulsar"
  >
    {{ descargando ? 'Descargando…' : texto }}
  </AppButton>
</template>
