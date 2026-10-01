<script setup lang="ts">
import type { Actividad, Respuesta } from '~/types/api'
import { actividadParaEscaner, ESTADO_ESCANER, estadoEscanerInicial, idDeConsulta, type EstadoEscaner } from '~/utils/asistencia'
import { mensajeError } from '~/utils/errores'
import { fechaDia } from '~/utils/formato'

/**
 * Actividad del escáner (barra del layout `escaner`): una de las del evento de la barra superior. Al
 * cargarlas elige la del enlace (`/escanear?evento=&actividad=`, desde Asistencia), la que ya estaba
 * elegida o la que está en curso (o la próxima de hoy). Comparte la elección con la página
 * `/escanear` por `useState` (`ESTADO_ESCANER`).
 */
const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()
const id = useId()
const estado = useState<EstadoEscaner>(ESTADO_ESCANER, estadoEscanerInicial)

/** Enlace desde Asistencia (`?evento=&actividad=`): se usan una sola vez. */
let eventoPedido = idDeConsulta(route.query.evento)
let actividadPedida = idDeConsulta(route.query.actividad)

/** Las respuestas de un evento anterior que llegan tarde se descartan. */
let consulta = 0

async function cargar() {
  const actual = ++consulta
  const eventoId = eventos.seleccionadoId
  // Al volver al escáner con el mismo evento se conserva la actividad elegida
  const anterior = estado.value.eventoId === eventoId ? estado.value.actividadId : null
  // Nada del evento anterior queda a la vista ni se puede marcar en él
  estado.value = { eventoId, actividades: [], actividadId: null, cargando: Boolean(eventoId) }
  if (!eventoId) return
  try {
    const lista = (await api<Respuesta<Actividad[]>>(`events/${eventoId}/activities`)).data
    if (actual !== consulta) return
    const elegida = actividadParaEscaner(lista, { pedida: actividadPedida, anterior })
    if (elegida.ajena) toast.info('La actividad del enlace no es de este evento: se eligió otra del evento de la barra superior.')
    actividadPedida = null
    estado.value = { eventoId, actividades: lista, actividadId: elegida.id, cargando: false }
  } catch (error) {
    if (actual !== consulta) return
    estado.value = { ...estado.value, cargando: false }
    toast.error(mensajeError(error))
  }
}

// Si el enlace trae el evento y la cuenta lo tiene, se trabaja sobre él (antes de cargar actividades)
watch(() => eventos.cargado, (cargado) => {
  if (!cargado || !eventoPedido) return
  if (eventos.eventos.some((evento) => evento.id === eventoPedido)) eventos.seleccionar(eventoPedido)
  eventoPedido = null
}, { immediate: true })
watch(() => eventos.seleccionadoId, cargar, { immediate: true })
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <label :for="id" class="sr-only">Actividad</label>
    <Icon name="heroicons:clock" class="hidden size-5 shrink-0 text-brand-300 sm:block" aria-hidden="true" />
    <select
      :id="id"
      v-model.number="estado.actividadId"
      class="field-control min-w-0 py-2 font-medium"
      :disabled="estado.cargando || !estado.actividades.length"
    >
      <option v-if="estado.cargando" :value="null">Cargando actividades…</option>
      <option v-else-if="!estado.actividades.length" :value="null">Sin actividades</option>
      <option v-for="actividad in estado.actividades" :key="actividad.id" :value="actividad.id">
        {{ actividad.nombre }} · {{ fechaDia(actividad.fecha) }} {{ actividad.horaInicio }}–{{ actividad.horaFin }}
      </option>
    </select>
  </div>
</template>
