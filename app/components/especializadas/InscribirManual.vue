<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { aErrorApi } from '~/utils/errores'
import { fechaDia } from '~/utils/formato'
import {
  CONSULTA_INICIAL,
  mensajeConsultaDni,
  normalizarDocumento,
  personaDeConsulta,
  puedeConsultarDni,
  TIPOS_DOCUMENTO,
  type ConsultaDni,
} from '~/utils/participantes'
import {
  agruparPorDia,
  cuerpoPersona,
  errorDePuerta,
  formularioPersona,
  PROCEDENCIAS,
  rangoHorario,
  textoCupo,
  validarPersona,
  type InscripcionPonencia,
  type PonenciaEspecializada,
} from '~/utils/ponenciasEspecializadas'

/**
 * Inscripción manual a una ponencia (`POST /specialized-talks/:id/registrations`,
 * `especializadas.inscribir`). Solo el documento es obligatorio: con DNI los nombres salen de la
 * consulta oficial al guardar («Consultar DNI» los muestra antes, si la cuenta puede consultar).
 * El staff puede inscribir en ponencias que se cruzan; el cupo se respeta.
 */
const props = defineProps<{ abierto: boolean, ponencias: PonenciaEspecializada[], ponenciaId?: number | null }>()
const emit = defineEmits<{ cerrar: [], inscrito: [inscripcion: InscripcionPonencia] }>()

const { api } = useApi()
const auth = useAuthStore()
const id = useId()

const form = reactive(formularioPersona())
const ponenciaElegida = ref<number | null>(null)
const consulta = ref<ConsultaDni>({ ...CONSULTA_INICIAL })
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const pideNombres = ref(false)
const guardando = ref(false)

const puedeConsultar = computed(() => auth.puede('consultas_dni.gestionar'))
const esDni = computed(() => form.tipoDocumento === 'dni')
const consultaVigente = computed(() => esDni.value && consulta.value.numero === form.numeroDocumento)
const nombresDeConsulta = computed(() => consultaVigente.value && consulta.value.estado === 'ENCONTRADO')
const obligatorios = computed(() => form.tipoDocumento === 'ce' || pideNombres.value || (consultaVigente.value && consulta.value.estado === 'FALLO'))

const CAMPOS = ['numeroDocumento', 'nombres', 'apellidos', 'correo', 'celular'] as const
const idCampo = (campo: string) => `${id}-${campo}`

/** Respuestas de una consulta anterior (otro número, o el modal cerrado) se descartan. */
let turnoConsulta = 0

const grupos = computed(() => agruparPorDia(props.ponencias))
const elegida = computed(() => props.ponencias.find((p) => p.id === ponenciaElegida.value) ?? null)

function reiniciar() {
  turnoConsulta++
  Object.assign(form, formularioPersona())
  consulta.value = { ...CONSULTA_INICIAL }
  errores.value = {}
  errorGeneral.value = ''
  pideNombres.value = false
  ponenciaElegida.value = props.ponenciaId ?? null
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
  if (consulta.value.estado !== 'INICIAL' && (tipo !== 'dni' || consulta.value.numero !== limpio)) {
    turnoConsulta++
    if (consulta.value.estado === 'ENCONTRADO') Object.assign(form, { nombres: '', apellidos: '' })
    consulta.value = { ...CONSULTA_INICIAL }
    pideNombres.value = false
  }
})

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
    consulta.value = { estado: 'ENCONTRADO', numero, mensaje: 'Nombres obtenidos de la consulta DNI.' }
  } catch (error) {
    if (turno === turnoConsulta) consulta.value = { estado: 'FALLO', numero, mensaje: mensajeConsultaDni(error) }
  }
}

function enfocarPrimerError() {
  const campo = CAMPOS.find((nombre) => errores.value[nombre])
  if (campo) nextTick(() => document.getElementById(idCampo(campo))?.focus())
}

async function guardar() {
  if (guardando.value) return
  errorGeneral.value = ''
  if (!ponenciaElegida.value) {
    errorGeneral.value = 'Elige la ponencia a la que se inscribe.'
    return
  }
  errores.value = validarPersona(form, { nombresObligatorios: obligatorios.value })
  if (Object.keys(errores.value).length) return enfocarPrimerError()
  guardando.value = true
  try {
    const respuesta = await api<Respuesta<InscripcionPonencia>>(`specialized-talks/${ponenciaElegida.value}/registrations`, { method: 'POST', body: cuerpoPersona(form) })
    emit('inscrito', respuesta.data)
  } catch (error) {
    const fallo = errorDePuerta(error)
    pideNombres.value = fallo.pideNombres
    errores.value = fallo.pideNombres ? { nombres: fallo.campos.nombres ?? 'Ingresa los nombres.', apellidos: fallo.campos.apellidos ?? 'Ingresa los apellidos.' } : (aErrorApi(error).fields ?? {})
    errorGeneral.value = fallo.pideNombres ? fallo.titulo + '. ' + fallo.detalle : fallo.detalle
    enfocarPrimerError()
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="abierto"
    titulo="Inscribir manualmente"
    descripcion="Basta con el documento: con DNI, los nombres se obtienen de la consulta oficial."
    ancho="lg"
    @cerrar="emit('cerrar')"
  >
    <form :id="`${id}-form`" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="guardar">
      <AppField label="Ponencia" :for="idCampo('ponencia')" required class="sm:col-span-2">
        <select :id="idCampo('ponencia')" v-model="ponenciaElegida" class="field-control">
          <option :value="null" disabled>Elige la ponencia</option>
          <optgroup v-for="dia in grupos" :key="dia.fecha" :label="fechaDia(dia.fecha)">
            <option v-for="p in dia.ponencias" :key="p.id" :value="p.id">
              {{ rangoHorario(p.horaInicio, p.horaFin) }} · {{ p.ambiente }} · {{ p.tema }}
            </option>
          </optgroup>
        </select>
        <p v-if="elegida" class="mt-1 text-xs text-slate-400">
          Inscritos: {{ textoCupo(elegida) }}<template v-if="elegida.cuposDisponibles !== null"> · quedan {{ elegida.cuposDisponibles }}</template>
        </p>
      </AppField>

      <div class="grid gap-4 sm:col-span-2 sm:grid-cols-[11rem_1fr]">
        <AppField label="Tipo de documento" :for="idCampo('tipo')" required>
          <select :id="idCampo('tipo')" v-model="form.tipoDocumento" class="field-control">
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
            <AppButton v-if="esDni && puedeConsultar" variant="secondary" icon="heroicons:magnifying-glass" :loading="consulta.estado === 'CONSULTANDO'" :disabled="!puedeConsultarDni(form)" @click="consultarDni">
              Consultar DNI
            </AppButton>
          </div>
          <p class="text-xs" :class="[consulta.mensaje ? 'mt-1' : '', consulta.estado === 'ENCONTRADO' ? 'text-emerald-300' : consulta.estado === 'FALLO' ? 'text-amber-300' : 'text-slate-400']" role="status">
            {{ consulta.mensaje }}
          </p>
        </AppField>
      </div>

      <AppField label="Nombres" :for="idCampo('nombres')" :required="obligatorios" :error="errores.nombres">
        <input :id="idCampo('nombres')" v-model="form.nombres" class="field-control" :class="{ 'opacity-75': nombresDeConsulta }" :readonly="nombresDeConsulta" maxlength="120" autocomplete="off" :aria-invalid="errores.nombres ? true : undefined">
      </AppField>
      <AppField label="Apellidos" :for="idCampo('apellidos')" :required="obligatorios" :error="errores.apellidos">
        <input :id="idCampo('apellidos')" v-model="form.apellidos" class="field-control" :class="{ 'opacity-75': nombresDeConsulta }" :readonly="nombresDeConsulta" maxlength="120" autocomplete="off" :aria-invalid="errores.apellidos ? true : undefined">
      </AppField>
      <p class="-mt-2 text-xs text-slate-400 sm:col-span-2">
        <template v-if="!esDni">Escríbelos como figuran en el carné de extranjería.</template>
        <template v-else-if="nombresDeConsulta">Son los del DNI: al guardar se usan los de la consulta.</template>
        <template v-else-if="obligatorios">La consulta no encontró el DNI: escríbelos como figuran en el documento.</template>
        <template v-else>Si los dejas vacíos, se completan con la consulta DNI al guardar.</template>
      </p>

      <AppField label="Correo (opcional)" :for="idCampo('correo')" :error="errores.correo">
        <input :id="idCampo('correo')" v-model="form.correo" type="email" class="field-control" maxlength="191" autocomplete="off" :aria-invalid="errores.correo ? true : undefined">
      </AppField>
      <AppField label="Celular (opcional)" :for="idCampo('celular')" :error="errores.celular">
        <input :id="idCampo('celular')" v-model="form.celular" type="tel" inputmode="tel" class="field-control" maxlength="20" placeholder="987654321" autocomplete="off" :aria-invalid="errores.celular ? true : undefined">
      </AppField>
      <AppField label="Procedencia (opcional)" :for="idCampo('procedencia')" class="sm:col-span-2">
        <select :id="idCampo('procedencia')" v-model="form.procedencia" class="field-control">
          <option value="">Sin dato</option>
          <option v-for="p in PROCEDENCIAS" :key="p.valor" :value="p.valor">{{ p.etiqueta }}</option>
        </select>
      </AppField>

      <div v-if="errorGeneral" class="flex gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/25 ring-inset sm:col-span-2" role="alert">
        <Icon name="heroicons:exclamation-circle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ errorGeneral }}
      </div>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" :form="`${id}-form`" icon="heroicons:user-plus" :loading="guardando">Inscribir</AppButton>
    </template>
  </AppModal>
</template>
