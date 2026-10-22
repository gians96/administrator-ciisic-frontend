<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { nombreCompleto } from '~/utils/formato'
import {
  comunicadoPropuesto,
  conCorreo,
  cuerpoComunicado,
  listaDeNombres,
  resumenDeResultado,
  validarComunicado,
  type FormComunicado,
  type ModoComunicado,
  type PersonaResumen,
  type ResultadoComunicado,
} from '~/utils/ponenciasEspecializadas'

/**
 * Cancela la inscripción de quienes hoy no pueden asistir (con aviso por correo si se quiere) o solo les avisa.
 * El servidor vuelve a comprobar a cada persona: si su pago ya se aprobó o ya asistió, la omite y lo informa.
 */
const props = defineProps<{
  abierto: boolean
  modo: ModoComunicado
  personas: PersonaResumen[]
  evento: string | null
}>()
const emit = defineEmits<{ cerrar: [], hecho: [] }>()

const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const id = useId()

const form = reactive<FormComunicado>({ ...comunicadoPropuesto('cancelar', null), notificar: true })
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const entiendo = ref(false)
const enviando = ref(false)
const resultado = ref<ResultadoComunicado | null>(null)
const copiado = ref(false)

const cancelar = computed(() => props.modo === 'cancelar')
const conAviso = computed(() => !cancelar.value || form.notificar)
const conCorreoTotal = computed(() => props.personas.filter(conCorreo).length)
const sinCorreoTotal = computed(() => props.personas.length - conCorreoTotal.value)
const ponencias = computed(() => props.personas.reduce((suma, p) => suma + p.ponencias, 0))
const nombres = computed(() => listaDeNombres(props.personas.map((p) => nombreCompleto(p.asistente))))
const lineasResultado = computed(() => (resultado.value ? resumenDeResultado(props.modo, resultado.value) : []))

const titulo = computed(() => (cancelar.value ? 'Cancelar inscripciones y avisar' : 'Enviar comunicado'))
const textoEnviar = computed(() => {
  if (!cancelar.value) return 'Enviar comunicado'
  return form.notificar ? 'Cancelar y enviar comunicado' : 'Cancelar inscripciones'
})

/** Cada vez que se abre (la página lo monta al abrir), el texto vuelve a la propuesta y se pide de nuevo la confirmación. */
watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  Object.assign(form, comunicadoPropuesto(props.modo, props.evento), { notificar: true })
  errores.value = {}
  errorGeneral.value = ''
  entiendo.value = false
  resultado.value = null
  copiado.value = false
}, { immediate: true })

function restablecer() {
  Object.assign(form, comunicadoPropuesto(props.modo, props.evento))
  errores.value = {}
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(`${form.asunto.trim()}\n\n${form.mensaje.trim()}`)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2500)
  } catch {
    toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.')
  }
}

async function enviar() {
  const eventoId = eventos.seleccionadoId
  errorGeneral.value = ''
  errores.value = validarComunicado(form, props.modo)
  if (!eventoId || Object.keys(errores.value).length || !entiendo.value) return
  enviando.value = true
  try {
    const ruta = `events/${eventoId}/specialized-talk-attendees/${cancelar.value ? 'cancel' : 'notify'}`
    const respuesta = await api<Respuesta<ResultadoComunicado>>(ruta, {
      method: 'POST',
      body: cuerpoComunicado(props.modo, props.personas.map((p) => p.asistenteId), form),
    })
    resultado.value = respuesta.data
    emit('hecho')
  } catch (error) {
    const fallo = aErrorApi(error)
    errores.value = fallo.fields ?? {}
    errorGeneral.value = mensajeError(error)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="abierto"
    :titulo="resultado ? 'Listo' : titulo"
    :descripcion="resultado ? undefined : (cancelar ? 'Se cancela la inscripción a las ponencias de quienes no tienen su inscripción al congreso con el pago aprobado.' : 'Se avisa por correo, sin cancelar su inscripción, a quienes no tienen su inscripción al congreso con el pago aprobado.')"
    ancho="lg"
    @cerrar="emit('cerrar')"
  >
    <div v-if="resultado" class="space-y-3" aria-live="polite">
      <p
        v-for="linea in lineasResultado"
        :key="linea.texto"
        class="flex gap-2 rounded-xl px-4 py-3 text-sm ring-1 ring-inset"
        :class="linea.tono === 'ok' ? 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/25' : linea.tono === 'warn' ? 'bg-amber-400/10 text-amber-100 ring-amber-300/25' : 'bg-red-500/10 text-red-200 ring-red-400/25'"
      >
        <Icon :name="linea.tono === 'ok' ? 'heroicons:check-circle' : 'heroicons:exclamation-triangle'" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ linea.texto }}
      </p>
      <p v-if="!lineasResultado.length" class="text-sm text-slate-300">No hubo cambios.</p>
    </div>

    <form v-else :id="`${id}-form`" class="space-y-5" novalidate @submit.prevent="enviar">
      <section class="rounded-xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 ring-inset">
        <p class="font-semibold text-white">
          {{ personas.length }} {{ personas.length === 1 ? 'persona' : 'personas' }}
          <span class="font-normal text-slate-400">· {{ ponencias }} {{ ponencias === 1 ? 'inscripción vigente' : 'inscripciones vigentes' }}</span>
        </p>
        <p class="mt-1 text-slate-300">{{ nombres }}</p>
        <p v-if="conAviso" class="mt-2 text-xs text-slate-400">
          {{ conCorreoTotal }} de {{ personas.length }} {{ conCorreoTotal === 1 ? 'tiene' : 'tienen' }} correo registrado<template v-if="sinCorreoTotal">; a quien no tiene, avísale por otro medio (usa «Copiar texto»)</template>.
        </p>
      </section>

      <div v-if="cancelar" class="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-300/25 ring-inset">
        Se cancelan todas las inscripciones vigentes de estas personas. Quien ya asistió a una ponencia no se toca, y si alguien ya tiene su pago aprobado el sistema lo omite.
        Puedes reactivar una inscripción a la vez desde Inscripciones.
      </div>

      <AppSwitch v-if="cancelar" v-model="form.notificar" label="Enviar el comunicado por correo" descripcion="Si lo apagas, solo se cancela y no se escribe a nadie." />

      <template v-if="conAviso">
        <AppField label="Asunto" :for="`${id}-asunto`" required :error="errores.asunto">
          <input :id="`${id}-asunto`" v-model="form.asunto" class="field-control" maxlength="150" autocomplete="off" :aria-invalid="errores.asunto ? true : undefined">
        </AppField>
        <AppField
          label="Mensaje"
          :for="`${id}-mensaje`"
          required
          :error="errores.mensaje"
          hint="Las líneas en blanco separan párrafos. {nombre} se reemplaza por el primer nombre de cada persona. Sale con el nombre del evento y su correo de contacto."
        >
          <textarea :id="`${id}-mensaje`" v-model="form.mensaje" rows="11" class="field-control" maxlength="3000" :aria-invalid="errores.mensaje ? true : undefined" />
          <p class="mt-1 text-right text-xs text-slate-500 tabular-nums">{{ form.mensaje.length }} / 3000</p>
        </AppField>
        <div class="-mt-2 flex flex-wrap gap-2">
          <AppButton size="sm" variant="ghost" icon="heroicons:clipboard-document" @click="copiar">{{ copiado ? 'Copiado' : 'Copiar texto' }}</AppButton>
          <AppButton size="sm" variant="ghost" icon="heroicons:arrow-uturn-left" @click="restablecer">Restablecer texto</AppButton>
        </div>
      </template>

      <label class="flex items-start gap-3 text-sm text-slate-200">
        <input v-model="entiendo" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-brand-500">
        <span v-if="cancelar">Entiendo que se cancelarán las inscripciones de {{ personas.length === 1 ? 'esta persona' : `estas ${personas.length} personas` }}<template v-if="form.notificar"> y que el correo se envía de inmediato</template>.</span>
        <span v-else>Entiendo que el correo se envía de inmediato a {{ personas.length === 1 ? 'esta persona' : `estas ${personas.length} personas` }}.</span>
      </label>

      <div v-if="errorGeneral" class="flex gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/25 ring-inset" role="alert">
        <Icon name="heroicons:exclamation-circle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ errorGeneral }}
      </div>
    </form>

    <template #acciones>
      <template v-if="resultado">
        <AppButton @click="emit('cerrar')">Cerrar</AppButton>
      </template>
      <template v-else>
        <AppButton variant="secondary" @click="emit('cerrar')">Volver</AppButton>
        <AppButton type="submit" :form="`${id}-form`" :variant="cancelar ? 'danger' : 'primary'" :icon="cancelar ? 'heroicons:x-circle' : 'heroicons:paper-airplane'" :loading="enviando" :disabled="!entiendo">
          {{ textoEnviar }}
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>
