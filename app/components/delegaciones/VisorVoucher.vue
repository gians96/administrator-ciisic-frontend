<script setup lang="ts">
import type { PagoDelegacion } from '~/types/api'
import { mensajeError } from '~/utils/errores'
import { fechaDia, soles } from '~/utils/formato'
import { ETIQUETA_ESTADO_PAGO, medioDePago, TONO_ESTADO_PAGO, tipoDeVoucher, vecinosDeVoucher, type TipoVoucher } from '~/utils/delegaciones'

/**
 * Visor del voucher de una delegación sobre el detalle (no abre otra pestaña): imagen o PDF, con Anterior y
 * Siguiente para recorrer los vouchers y, con `inscripciones.validar`, Verificar y Rechazar sin cerrarlo.
 */
const props = defineProps<{ abierto: boolean, delegacionId: number, pagos: PagoDelegacion[], pagoId: number | null, puedeValidar: boolean }>()
const emit = defineEmits<{ cerrar: [], cambiar: [id: number], verificar: [pago: PagoDelegacion], rechazar: [pago: PagoDelegacion] }>()

const { leerArchivo } = useApi()

const pago = computed(() => props.pagos.find((p) => p.id === props.pagoId) ?? null)
const vecinos = computed(() => vecinosDeVoucher(props.pagos, props.pagoId))

const url = ref<string | null>(null)
const tipo = ref<TipoVoucher>('otro')
const cargando = ref(false)
const error = ref<string | null>(null)
// Una petición vieja (se pasó al siguiente voucher antes de que llegara) no pisa a la nueva
let turno = 0

function soltarArchivo() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
}

async function cargar() {
  const mio = ++turno
  soltarArchivo()
  error.value = null
  if (!props.abierto || props.pagoId === null) {
    cargando.value = false
    return
  }
  cargando.value = true
  try {
    const archivo = await leerArchivo(`delegations/${props.delegacionId}/payments/${props.pagoId}/voucher`)
    if (mio !== turno) return
    tipo.value = tipoDeVoucher(archivo.type)
    url.value = URL.createObjectURL(archivo)
  } catch (e) {
    if (mio === turno) error.value = mensajeError(e)
  } finally {
    if (mio === turno) cargando.value = false
  }
}

// Solo cambia al abrir o al pasar a otro voucher: verificar o rechazar no vuelve a pedir el archivo
watch(() => [props.abierto, props.delegacionId, props.pagoId] as const, () => { void cargar() }, { immediate: true })

// Si el voucher ya no está en la lista (se eliminó o se cambió de delegación), el visor se cierra
watch(pago, (actual) => {
  if (props.abierto && !actual) emit('cerrar')
})

onBeforeUnmount(() => {
  turno++
  soltarArchivo()
})
</script>

<template>
  <AppModal
    :abierto="abierto"
    :titulo="pago ? `Voucher ${pago.numeroOperacion}` : 'Voucher'"
    :descripcion="pago ? `${medioDePago(pago)} · ${soles(pago.monto)} · ${fechaDia(pago.fechaPago)}` : ''"
    ancho="lg"
    @cerrar="emit('cerrar')"
  >
    <div v-if="pago" class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <AppBadge :tono="TONO_ESTADO_PAGO[pago.estado]">{{ ETIQUETA_ESTADO_PAGO[pago.estado] }}</AppBadge>
        <span class="text-xs text-slate-400">Voucher {{ vecinos.indice + 1 }} de {{ pagos.length }}</span>
      </div>
      <p v-if="pago.motivoRechazo" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{{ pago.motivoRechazo }}</p>

      <div class="flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-navy-950" aria-live="polite">
        <p v-if="cargando" class="py-12 text-sm text-slate-400">Cargando voucher…</p>
        <div v-else-if="error" class="space-y-3 px-4 py-10 text-center">
          <p class="text-sm text-red-300">{{ error }}</p>
          <AppButton size="sm" variant="secondary" icon="heroicons:arrow-path" @click="cargar">Reintentar</AppButton>
        </div>
        <template v-else-if="url">
          <img v-if="tipo === 'imagen'" :src="url" :alt="`Voucher ${pago.numeroOperacion}`" class="max-h-[50dvh] w-auto max-w-full object-contain">
          <template v-else-if="tipo === 'pdf'">
            <iframe :src="url" :title="`Voucher ${pago.numeroOperacion} (PDF)`" class="hidden h-[50dvh] w-full sm:block" />
            <p class="px-4 py-10 text-center text-sm text-slate-400 sm:hidden">Los PDF no se ven dentro de la página en el celular: ábrelo en otra pestaña.</p>
          </template>
          <p v-else class="px-4 py-10 text-center text-sm text-slate-400">Este tipo de archivo no se puede mostrar aquí: ábrelo en otra pestaña.</p>
        </template>
      </div>
      <a v-if="url" :href="url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-brand-300 hover:text-brand-200">
        Abrir en otra pestaña <Icon name="heroicons:arrow-top-right-on-square" class="size-4" aria-hidden="true" />
      </a>
    </div>

    <template #acciones>
      <div v-if="pago" class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <AppButton variant="secondary" icon="heroicons:chevron-left" :disabled="!vecinos.anterior" aria-label="Voucher anterior" @click="vecinos.anterior && emit('cambiar', vecinos.anterior.id)">Anterior</AppButton>
          <AppButton variant="secondary" icon="heroicons:chevron-right" :disabled="!vecinos.siguiente" aria-label="Voucher siguiente" @click="vecinos.siguiente && emit('cambiar', vecinos.siguiente.id)">Siguiente</AppButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <template v-if="puedeValidar">
            <AppButton v-if="pago.estado !== 'VERIFICADO'" variant="success" @click="emit('verificar', pago)">Verificar</AppButton>
            <AppButton v-if="pago.estado !== 'RECHAZADO'" variant="danger" @click="emit('rechazar', pago)">Rechazar</AppButton>
          </template>
          <AppButton variant="secondary" @click="emit('cerrar')">Cerrar</AppButton>
        </div>
      </div>
    </template>
  </AppModal>
</template>
