<script setup lang="ts">
import type { Categoria, InscripcionDetalle, Respuesta } from '~/types/api'
import { avisosDelCambio, categoriaDelTipo, etiquetaOpcionTipo, mensajeTrasCambio, nombreDeTipo, tipoElegido } from '~/utils/cambioTipo'
import { mensajeError } from '~/utils/errores'
import { nombreCompleto } from '~/utils/formato'

/**
 * Cambiar el tipo (y con él la categoría) de una inscripción (spec 026 del panel; spec 035 del backend, solo Owner).
 * El monto pagado no cambia: el diálogo avisa si no coincide con el precio del tipo elegido y qué más se mueve
 * (descuento, ponencias pendientes, credencial). El servidor decide y vuelve a comprobar todo.
 */
const props = defineProps<{ abierto: boolean, detalle: InscripcionDetalle | null }>()
const emit = defineEmits<{ cerrar: [], cambiada: [detalle: InscripcionDetalle] }>()

const { api } = useApi()
const auth = useAuthStore()
const toast = useToast()

const categorias = ref<Categoria[]>([])
const cargando = ref(false)
const categoriaId = ref<number | null>(null)
const tipoId = ref<number | null>(null)
const motivo = ref('')
const guardando = ref(false)

/** Sin `pagos.ver` los precios llegan en `null`: no se muestran ni se comparan. */
const conPagos = computed(() => auth.puede('pagos.ver'))
const actual = computed(() => props.detalle?.tipoInscripcion ?? null)
const tiposDeLaCategoria = computed(() => categorias.value.find((categoria) => categoria.id === categoriaId.value)?.tipos ?? [])
const elegido = computed(() => tipoElegido(categorias.value, tipoId.value))
const avisos = computed(() => (props.detalle ? avisosDelCambio(props.detalle, elegido.value, conPagos.value) : []))
const puedeGuardar = computed(() => elegido.value !== null && elegido.value.id !== actual.value?.id && !guardando.value && !cargando.value)

/** Las respuestas que llegan tarde (se cerró o se abrió otra inscripción) se descartan. */
let consulta = 0

async function cargarCategorias(eventoId: number) {
  const propia = ++consulta
  cargando.value = true
  categorias.value = []
  try {
    const lista = (await api<Respuesta<Categoria[]>>(`events/${eventoId}/registration-categories`)).data
    if (propia !== consulta) return
    categorias.value = lista
    // Se parte del tipo actual: así se ve dónde está y se cambia solo lo que haga falta
    const categoria = categoriaDelTipo(lista, actual.value?.id)
    categoriaId.value = categoria?.id ?? null
    tipoId.value = categoria ? (actual.value?.id ?? null) : null
  } catch (error) {
    if (propia !== consulta) return
    toast.error(mensajeError(error))
    emit('cerrar')
  } finally {
    if (propia === consulta) cargando.value = false
  }
}

watch(() => [props.abierto, props.detalle?.id] as const, ([abierto, id]) => {
  if (!abierto || !id || !props.detalle) {
    consulta++
    return
  }
  motivo.value = ''
  categoriaId.value = null
  tipoId.value = null
  cargarCategorias(props.detalle.eventoId)
}, { immediate: true })

function alElegirCategoria() {
  const tipos = tiposDeLaCategoria.value
  // Una categoría con un solo tipo no obliga a elegir de nuevo
  tipoId.value = tipos.length === 1 ? (tipos[0]?.id ?? null) : null
}

async function guardar() {
  const detalle = props.detalle
  const nuevo = elegido.value
  if (!detalle || !nuevo || !puedeGuardar.value) return
  guardando.value = true
  try {
    const motivoLimpio = motivo.value.trim()
    const respuesta = await api<Respuesta<InscripcionDetalle>>(`inscriptions/${detalle.id}/type`, {
      method: 'PATCH',
      body: { tipoInscripcionId: nuevo.id, ...(motivoLimpio ? { motivo: motivoLimpio } : {}) },
    })
    emit('cambiada', respuesta.data)
    toast.exito(mensajeTrasCambio(respuesta.data))
  } catch (error) {
    // Un 403 (permiso retirado) ya hace que useApi relea el acceso y oculte el botón
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="abierto"
    titulo="Cambiar tipo de inscripción"
    :descripcion="detalle ? nombreCompleto(detalle.participante) : undefined"
    ancho="md"
    @cerrar="emit('cerrar')"
  >
    <div v-if="detalle" class="space-y-5">
      <div class="rounded-xl bg-white/5 p-4 text-sm">
        <p class="kicker">Ahora</p>
        <p class="mt-2 text-white">{{ actual ? nombreDeTipo(actual) : 'Sin tipo' }}</p>
        <p v-if="actual" class="mt-0.5 text-xs text-slate-400">{{ actual.categoria.nombre }}</p>
      </div>

      <div v-if="cargando" class="py-6 text-center text-sm text-slate-400">Cargando tipos…</div>

      <template v-else>
        <AppField label="Categoría" for="cambio-categoria" required>
          <select id="cambio-categoria" v-model="categoriaId" class="field-control" @change="alElegirCategoria">
            <option :value="null" disabled>Elige una categoría</option>
            <option v-for="categoria in categorias" :key="categoria.id" :value="categoria.id">{{ categoria.nombre }}</option>
          </select>
        </AppField>

        <AppField label="Tipo" for="cambio-tipo" required hint="También salen los tipos inactivos: es una corrección, no una inscripción nueva.">
          <select id="cambio-tipo" v-model="tipoId" class="field-control" :disabled="!categoriaId">
            <option :value="null" disabled>Elige un tipo</option>
            <option v-for="tipo in tiposDeLaCategoria" :key="tipo.id" :value="tipo.id">{{ etiquetaOpcionTipo(tipo, conPagos) }}</option>
          </select>
        </AppField>

        <ul v-if="avisos.length" class="space-y-2" aria-live="polite">
          <li
            v-for="aviso in avisos"
            :key="aviso.texto"
            class="rounded-xl px-4 py-3 text-sm ring-1 ring-inset"
            :class="aviso.tono === 'warn' ? 'bg-amber-500/10 text-amber-200 ring-amber-400/25' : 'bg-white/5 text-slate-300 ring-white/10'"
          >
            {{ aviso.texto }}
          </li>
        </ul>

        <AppField label="Motivo" for="cambio-motivo" hint="Opcional. Queda en el historial de la inscripción, con tu nombre y la fecha.">
          <textarea id="cambio-motivo" v-model="motivo" rows="2" maxlength="500" class="field-control" />
        </AppField>
      </template>
    </div>

    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton variant="primary" icon="heroicons:arrows-right-left" :disabled="!puedeGuardar" :loading="guardando" @click="guardar">Cambiar tipo</AppButton>
    </template>
  </AppModal>
</template>
