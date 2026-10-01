<script setup lang="ts">
import type { ParticipanteRef, Respuesta } from '~/types/api'
import { aErrorApi } from '~/utils/errores'
import {
  CONSULTA_INICIAL,
  cuerpoNuevoParticipante,
  errorAlta,
  formularioNuevoParticipante,
  MAX_NOMBRE,
  mensajeConsultaDni,
  nombresDeConsulta,
  nombresObligatorios,
  normalizarDocumento,
  personaDeConsulta,
  puedeConsultarDni,
  TIPOS_DOCUMENTO,
  validarNuevoParticipante,
  type ConsultaDni,
} from '~/utils/participantes'

/**
 * Alta de una persona sin inscripción: ponentes, organizadores o quien se inscribe en persona
 * (`POST /participants`, `participantes.gestionar`, backend spec 014). Con DNI los nombres salen de
 * la consulta DNI (aquí con «Consultar DNI» si la cuenta tiene `consultas_dni.gestionar`, y siempre
 * en el backend al guardar); si la consulta falla, se escriben a mano.
 */
const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{
  cerrar: []
  creado: [participante: ParticipanteRef]
  /** `PARTICIPANT_EXISTS`: abrir el registro existente. */
  abrirExistente: [id: number]
}>()

const { api } = useApi()
const auth = useAuthStore()
const id = useId()

const form = reactive(formularioNuevoParticipante())
const consulta = ref<ConsultaDni>({ ...CONSULTA_INICIAL })
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const existenteId = ref<number | null>(null)
const guardando = ref(false)

const puedeConsultar = computed(() => auth.puede('consultas_dni.gestionar'))
const conConsulta = computed(() => nombresDeConsulta(form, consulta.value))
const obligatorios = computed(() => nombresObligatorios(form, consulta.value))
const esDni = computed(() => form.tipoDocumento === 'dni')

const CAMPOS = ['numeroDocumento', 'nombres', 'apellidos', 'correo', 'celular'] as const
const idCampo = (campo: (typeof CAMPOS)[number]) => `${id}-${campo}`

/** Respuestas de una consulta anterior (otro número, o el modal cerrado) se descartan. */
let turnoConsulta = 0

function reiniciar() {
  turnoConsulta++
  Object.assign(form, formularioNuevoParticipante())
  consulta.value = { ...CONSULTA_INICIAL }
  errores.value = {}
  errorGeneral.value = ''
  existenteId.value = null
}

watch(() => props.abierto, (abierto) => {
  if (abierto) reiniciar()
}, { immediate: true })

watch(() => [form.tipoDocumento, form.numeroDocumento] as const, ([tipo, numero]) => {
  const limpio = normalizarDocumento(tipo, numero)
  if (limpio !== numero) {
    form.numeroDocumento = limpio
    return
  }
  // Otro documento: los nombres de la consulta anterior ya no le corresponden
  if (consulta.value.estado !== 'INICIAL' && (tipo !== 'dni' || consulta.value.numero !== limpio)) {
    turnoConsulta++
    if (consulta.value.estado === 'ENCONTRADO') Object.assign(form, { nombres: '', apellidos: '' })
    consulta.value = { ...CONSULTA_INICIAL }
  }
})

function sinCampos(...campos: string[]) {
  errores.value = Object.fromEntries(Object.entries(errores.value).filter(([campo]) => !campos.includes(campo)))
}

async function consultarDni() {
  if (!puedeConsultarDni(form) || consulta.value.estado === 'CONSULTANDO') return
  const numero = form.numeroDocumento
  const turno = ++turnoConsulta
  consulta.value = { estado: 'CONSULTANDO', numero, mensaje: 'Consultando el DNI…' }
  try {
    const respuesta = await api<Respuesta<unknown>>(`document-lookup/dni/${numero}`)
    if (turno !== turnoConsulta) return
    const persona = personaDeConsulta(respuesta.data)
    if (!persona) {
      consulta.value = { estado: 'FALLO', numero, mensaje: 'La consulta no devolvió nombres. Escribe los nombres y apellidos.' }
      return
    }
    Object.assign(form, persona)
    sinCampos('nombres', 'apellidos')
    consulta.value = { estado: 'ENCONTRADO', numero, mensaje: 'Nombres obtenidos de la consulta DNI.' }
  } catch (error) {
    if (turno === turnoConsulta) consulta.value = { estado: 'FALLO', numero, mensaje: mensajeConsultaDni(error) }
  }
}

function abrirExistente() {
  if (existenteId.value) emit('abrirExistente', existenteId.value)
}

function enfocarPrimerError() {
  const campo = CAMPOS.find((nombre) => errores.value[nombre])
  if (campo) nextTick(() => document.getElementById(idCampo(campo))?.focus())
}

async function guardar() {
  if (guardando.value) return
  errorGeneral.value = ''
  existenteId.value = null
  errores.value = validarNuevoParticipante(form, { nombresObligatorios: obligatorios.value })
  if (Object.keys(errores.value).length) {
    enfocarPrimerError()
    return
  }
  guardando.value = true
  try {
    const respuesta = await api<Respuesta<ParticipanteRef>>('participants', { method: 'POST', body: cuerpoNuevoParticipante(form) })
    emit('creado', respuesta.data)
  } catch (error) {
    const fallo = errorAlta(error)
    errores.value = fallo.campos
    errorGeneral.value = fallo.mensaje
    existenteId.value = fallo.existenteId
    // La consulta del backend tampoco encontró el DNI: los nombres pasan a ser obligatorios
    if (aErrorApi(error).code === 'NAMES_REQUIRED' && esDni.value) {
      turnoConsulta++
      consulta.value = { estado: 'FALLO', numero: form.numeroDocumento, mensaje: '' }
    }
    enfocarPrimerError()
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="abierto"
    titulo="Nuevo participante"
    descripcion="Para ponentes, organizadores o quien se inscribe en persona. Queda registrado sin inscripción."
    @cerrar="emit('cerrar')"
  >
    <form :id="`${id}-form`" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="guardar">
      <div class="grid gap-4 sm:col-span-2 sm:grid-cols-[11rem_1fr]">
        <AppField label="Tipo de documento" :for="`${id}-tipo`" required>
          <select :id="`${id}-tipo`" v-model="form.tipoDocumento" class="field-control">
            <option v-for="tipo in TIPOS_DOCUMENTO" :key="tipo.valor" :value="tipo.valor">{{ tipo.etiqueta }}</option>
          </select>
        </AppField>
        <AppField label="Número de documento" :for="idCampo('numeroDocumento')" required :error="errores.numeroDocumento">
          <div class="flex gap-2">
            <input
              :id="idCampo('numeroDocumento')"
              v-model="form.numeroDocumento"
              class="field-control font-mono"
              :inputmode="esDni ? 'numeric' : 'text'"
              :placeholder="esDni ? '8 dígitos' : '9 a 12 letras o dígitos'"
              autocomplete="off"
              :aria-invalid="errores.numeroDocumento ? true : undefined"
            >
            <AppButton
              v-if="esDni && puedeConsultar"
              variant="secondary"
              icon="heroicons:magnifying-glass"
              :loading="consulta.estado === 'CONSULTANDO'"
              :disabled="!puedeConsultarDni(form)"
              @click="consultarDni"
            >
              Consultar DNI
            </AppButton>
          </div>
          <!-- Región viva siempre presente (vacía no ocupa espacio) para que se anuncie el resultado -->
          <p
            class="text-xs"
            :class="[
              consulta.mensaje ? 'mt-1' : '',
              consulta.estado === 'ENCONTRADO' ? 'text-emerald-300' : consulta.estado === 'FALLO' ? 'text-amber-300' : 'text-slate-400',
            ]"
            role="status"
          >
            {{ consulta.mensaje }}
          </p>
        </AppField>
      </div>

      <AppField label="Nombres" :for="idCampo('nombres')" :required="obligatorios" :error="errores.nombres">
        <input
          :id="idCampo('nombres')"
          v-model="form.nombres"
          class="field-control"
          :class="{ 'opacity-75': conConsulta }"
          :readonly="conConsulta"
          :maxlength="MAX_NOMBRE"
          autocomplete="off"
          :aria-invalid="errores.nombres ? true : undefined"
          :aria-describedby="`${id}-nombres-ayuda`"
        >
      </AppField>
      <AppField label="Apellidos" :for="idCampo('apellidos')" :required="obligatorios" :error="errores.apellidos">
        <input
          :id="idCampo('apellidos')"
          v-model="form.apellidos"
          class="field-control"
          :class="{ 'opacity-75': conConsulta }"
          :readonly="conConsulta"
          :maxlength="MAX_NOMBRE"
          autocomplete="off"
          :aria-invalid="errores.apellidos ? true : undefined"
          :aria-describedby="`${id}-nombres-ayuda`"
        >
      </AppField>
      <p :id="`${id}-nombres-ayuda`" class="-mt-2 text-xs text-slate-400 sm:col-span-2">
        <template v-if="!esDni">Escríbelos como figuran en el carné de extranjería.</template>
        <template v-else-if="conConsulta">Son los del DNI: al guardar se usan los de la consulta.</template>
        <template v-else-if="obligatorios">La consulta no encontró el DNI: escríbelos como figuran en el documento.</template>
        <template v-else>Si los dejas vacíos, se completan con la consulta DNI al guardar.</template>
      </p>

      <AppField
        label="Correo"
        :for="idCampo('correo')"
        required
        :error="errores.correo"
        hint="Con este correo entra a su portal de participante (con un código o con Google) y recibe su credencial y sus certificados."
        class="sm:col-span-2"
      >
        <input
          :id="idCampo('correo')"
          v-model="form.correo"
          type="email"
          class="field-control"
          autocomplete="off"
          maxlength="191"
          :aria-invalid="errores.correo ? true : undefined"
        >
      </AppField>
      <AppField label="Celular" :for="idCampo('celular')" :error="errores.celular" hint="Opcional: también puede completarlo en su portal.">
        <input
          :id="idCampo('celular')"
          v-model="form.celular"
          type="tel"
          inputmode="tel"
          class="field-control"
          autocomplete="off"
          maxlength="20"
          placeholder="987654321"
          :aria-invalid="errores.celular ? true : undefined"
        >
      </AppField>

      <div v-if="errorGeneral" class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/25 ring-inset sm:col-span-2" role="alert">
        <span class="flex gap-2">
          <Icon name="heroicons:exclamation-circle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {{ errorGeneral }}
        </span>
        <AppButton v-if="existenteId" size="sm" variant="secondary" icon="heroicons:arrow-top-right-on-square" @click="abrirExistente">
          Abrir su registro
        </AppButton>
      </div>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" :form="`${id}-form`" icon="heroicons:user-plus" :loading="guardando">Registrar</AppButton>
    </template>
  </AppModal>
</template>
