<script setup lang="ts">
/**
 * Botón «Continuar con Google» (Google Identity Services, ventana emergente). Pide al servidor del
 * panel el client ID y un nonce de un solo uso; si Google no está configurado en Sistema, no se
 * muestra. Tras cada intento hay que llamar a `reiniciar()` para obtener un nonce nuevo.
 */
const emit = defineEmits<{ credencial: [credential: string] }>()

const contenedor = ref<HTMLElement | null>(null)
const disponible = ref(false)
const SCRIPT_GIS = 'https://accounts.google.com/gsi/client'
let cargaScript: Promise<void> | null = null

function cargarScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  cargaScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_GIS
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      cargaScript = null
      reject(new Error('No se pudo cargar Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return cargaScript
}

async function reiniciar() {
  const { clientId, nonce } = await $fetch<{ clientId: string | null, nonce: string | null }>('/api/auth/google')
  if (!clientId || !nonce) {
    disponible.value = false
    return
  }
  await cargarScript()
  const gis = window.google?.accounts?.id
  if (!gis) return
  gis.initialize({
    client_id: clientId,
    nonce,
    auto_select: false,
    ux_mode: 'popup',
    callback: (respuesta) => emit('credencial', respuesta.credential),
  })
  disponible.value = true
  await nextTick()
  if (!contenedor.value) return
  contenedor.value.innerHTML = ''
  gis.renderButton(contenedor.value, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    locale: 'es',
    width: Math.min(Math.max(contenedor.value.clientWidth, 240), 400),
  })
}

onMounted(() => {
  reiniciar().catch(() => {
    disponible.value = false
  })
})

onBeforeUnmount(() => {
  window.google?.accounts?.id?.cancel()
})

defineExpose({ reiniciar })
</script>

<template>
  <div v-show="disponible">
    <slot name="antes" />
    <div ref="contenedor" class="flex min-h-11 w-full justify-center" />
    <slot name="despues" />
  </div>
</template>
