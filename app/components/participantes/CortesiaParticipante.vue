<script setup lang="ts">
import type { Categoria, InscripcionDetalle, ParticipanteRef, Respuesta } from '~/types/api'
import { nombreCompleto } from '~/utils/formato'
import {
  cuerpoCortesia,
  errorCortesia,
  formularioCortesia,
  gruposTiposCortesia,
  inscripcionEnEvento,
  resultadoCortesia,
  type ErrorCortesia,
  type GrupoTipos,
  type InscripcionDeParticipante,
} from '~/utils/participantes'

/**
 * Inscripción de cortesía en el evento elegido en la barra superior: aprobada, sin pago y revisada
 * por quien la crea (`POST /events/:eventId/courtesy-inscriptions`, `inscripciones.cortesia`, backend
 * spec 014). Con `participante: null` el modal está cerrado.
 */
const props = defineProps<{ participante: ParticipanteRef | null }>()
const emit = defineEmits<{
  cerrar: []
  inscrito: [participanteId: number]
}>()

const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const id = useId()

const form = reactive(formularioCortesia())
const grupos = ref<GrupoTipos[]>([])
const cargando = ref(false)
const sinTipos = ref(false)
const existente = ref<InscripcionDeParticipante | null>(null)
const error = ref<ErrorCortesia | null>(null)
const guardando = ref(false)

const evento = computed(() => eventos.seleccionado)

/** Respuestas de otra persona u otro evento que llegan tarde se descartan. */
let turno = 0

async function preparar() {
  const actual = ++turno
  Object.assign(form, formularioCortesia())
  error.value = null
  existente.value = null
  grupos.value = []
  sinTipos.value = false
  const participante = props.participante
  const elegido = evento.value
  if (!participante || !elegido) {
    cargando.value = false
    return
  }
  cargando.value = true
  const [categorias, detalle] = await Promise.allSettled([
    api<Respuesta<Categoria[]>>(`events/${elegido.id}/registration-categories`),
    api<Respuesta<{ inscripciones: InscripcionDeParticipante[] }>>(`participants/${participante.id}`),
  ])
  if (actual !== turno) return
  cargando.value = false
  if (categorias.status === 'fulfilled') grupos.value = gruposTiposCortesia(categorias.value.data)
  else sinTipos.value = true
  // Solo para avisar antes de intentarlo: el backend responde `ALREADY_REGISTERED` igual
  if (detalle.status === 'fulfilled') existente.value = inscripcionEnEvento(detalle.value.data.inscripciones, elegido.codigo)
}

watch([() => props.participante?.id, () => eventos.seleccionadoId], preparar, { immediate: true })

const ayudaTipo = computed(() => {
  if (cargando.value) return 'Cargando los tipos de inscripción del evento…'
  if (sinTipos.value) return 'No se pudieron cargar los tipos de este evento: puedes inscribir sin tipo.'
  return 'Opcional. Se admiten tipos inactivos, como «Ponente».'
})

async function inscribir() {
  const participante = props.participante
  const elegido = evento.value
  if (!participante || !elegido || guardando.value) return
  guardando.value = true
  error.value = null
  const pidioCredencial = form.enviarCredencial
  try {
    const respuesta = await api<Respuesta<InscripcionDetalle>>(`events/${elegido.id}/courtesy-inscriptions`, {
      method: 'POST',
      body: cuerpoCortesia(participante.id, form),
    })
    const resultado = resultadoCortesia(respuesta.data.credencialEnviada, pidioCredencial)
    if (resultado.tono === 'exito') toast.exito(resultado.mensaje)
    else toast.info(resultado.mensaje)
    emit('inscrito', participante.id)
  } catch (fallo) {
    error.value = errorCortesia(fallo, elegido.nombreCorto)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="participante !== null"
    titulo="Inscribir como cortesía"
    :descripcion="participante ? `${nombreCompleto(participante)} · ${participante.tipoDocumento.toUpperCase()} ${participante.numeroDocumento}` : undefined"
    @cerrar="emit('cerrar')"
  >
    <p v-if="!evento" class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
      Elige un evento en la barra superior para inscribir a esta persona.
    </p>
    <form v-else :id="`${id}-form`" class="space-y-4" @submit.prevent="inscribir">
      <div class="rounded-xl bg-white/5 px-4 py-3">
        <p class="text-xs text-slate-400">Evento</p>
        <p class="font-medium text-white">{{ evento.nombreCorto }}</p>
        <p class="mt-0.5 text-xs text-slate-400">Para inscribirla en otro evento, cámbialo en la barra superior.</p>
      </div>
      <p class="text-sm text-slate-300">
        Se crea una inscripción <strong class="text-white">aprobada y sin pago</strong> (monto S/ 0, modalidad cortesía), revisada por ti.
        Úsala para ponentes, organizadores e invitados.
      </p>
      <p v-if="existente" class="flex gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset" role="status">
        <Icon name="heroicons:exclamation-triangle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Ya tiene una inscripción en este evento ({{ existente.estado.nombre.toLowerCase() }}). Gestiónala en Inscripciones.</span>
      </p>
      <AppField
        label="Tipo de inscripción"
        :for="`${id}-tipo`"
        :error="error?.campo === 'tipoInscripcionId' ? error.mensaje : undefined"
        :hint="ayudaTipo"
      >
        <select :id="`${id}-tipo`" v-model="form.tipoInscripcionId" class="field-control" :disabled="cargando" :aria-invalid="error?.campo === 'tipoInscripcionId' ? true : undefined">
          <option :value="null">Sin tipo de inscripción</option>
          <optgroup v-for="grupo in grupos" :key="grupo.id" :label="grupo.categoria">
            <option v-for="tipo in grupo.tipos" :key="tipo.id" :value="tipo.id">{{ tipo.etiqueta }}</option>
          </optgroup>
        </select>
      </AppField>
      <AppSwitch
        v-model="form.enviarCredencial"
        label="Enviar credencial por correo"
        :descripcion="participante ? `Se envía a ${participante.correo} con el QR para marcar su asistencia. Si no, puedes enviarla después desde Inscripciones.` : undefined"
      />
      <p v-if="error && error.campo === null" class="flex gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/25 ring-inset" role="alert">
        <Icon name="heroicons:exclamation-circle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{{ error.mensaje }}</span>
      </p>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" :form="`${id}-form`" icon="heroicons:gift" :loading="guardando" :disabled="!evento || existente !== null">Inscribir</AppButton>
    </template>
  </AppModal>
</template>
