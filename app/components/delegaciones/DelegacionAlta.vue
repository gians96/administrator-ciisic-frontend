<script setup lang="ts">
import type { DelegacionDetalle, ModalidadAsistencia, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { numero, soles } from '~/utils/formato'
import {
  ETIQUETA_MODALIDAD, estimarGrupo, filaVacia, filasParaEnviar, normalizarDni, type FilaEditable, type TarifaDelegaciones,
} from '~/utils/delegaciones'

const props = defineProps<{ abierto: boolean, eventoId: number, tarifa: TarifaDelegaciones }>()
const emit = defineEmits<{ cerrar: [], creada: [DelegacionDetalle] }>()

const { api } = useApi()
const { buscar } = useDni()
const toast = useToast()

const form = reactive({
  nombre: '',
  institucion: '',
  modalidad: 'PRESENCIAL' as ModalidadAsistencia,
  tipoDocumento: 'dni' as 'dni' | 'ce',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  correo: '',
  celular: '',
  esIntegrante: false,
})
const filas = ref<FilaEditable[]>([filaVacia()])
const errores = ref<Record<string, string>>({})
const guardando = ref(false)
const buscandoDelegado = ref(false)
const avisoDelegado = ref('')

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  Object.assign(form, { nombre: '', institucion: '', modalidad: 'PRESENCIAL', tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', esIntegrante: false })
  filas.value = [filaVacia()]
  errores.value = {}
  avisoDelegado.value = ''
})

/** Con 8 dígitos y sin nombres escritos, completa al delegado desde la consulta DNI. */
async function alEscribirDocumento() {
  form.numeroDocumento = form.numeroDocumento.replace(/\s+/g, '')
  if (form.tipoDocumento !== 'dni' || !/^\d{8}$/.test(form.numeroDocumento) || buscandoDelegado.value) return
  if (form.nombres.trim() || form.apellidos.trim()) return
  const numeroConsultado = form.numeroDocumento
  buscandoDelegado.value = true
  avisoDelegado.value = ''
  const { persona, mensaje } = await buscar(numeroConsultado)
  buscandoDelegado.value = false
  if (form.numeroDocumento !== numeroConsultado) return
  if (persona) Object.assign(form, persona)
  else avisoDelegado.value = mensaje
}

/** Al salir del campo, un DNI de 7 dígitos (Excel perdió el cero) se completa y se consulta. */
function alSalirDelDocumento() {
  if (form.tipoDocumento === 'dni') form.numeroDocumento = normalizarDni(form.numeroDocumento)
  void alEscribirDocumento()
}

const integrantes = computed(() => filasParaEnviar(filas.value))
const cantidad = computed(() => integrantes.value.length + (form.esIntegrante ? 1 : 0))
const estimado = computed(() => estimarGrupo(form.modalidad, cantidad.value, props.tarifa))
const virtualDisponible = computed(() => props.tarifa.virtual !== null)

/** Errores del backend sin el prefijo de la sección (`representante.correo` → `correo`). */
const erroresDelegado = computed(() => Object.fromEntries(Object.entries(errores.value).filter(([campo]) => campo.startsWith('representante.')).map(([campo, texto]) => [campo.replace('representante.', ''), texto])))
const erroresFilas = computed(() => Object.fromEntries(Object.entries(errores.value).filter(([campo]) => campo.startsWith('participantes['))))

async function guardar() {
  guardando.value = true
  errores.value = {}
  try {
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`events/${props.eventoId}/delegations`, {
      method: 'POST',
      body: {
        nombre: form.nombre.trim(),
        institucion: form.institucion.trim() || null,
        modalidad: form.modalidad,
        representante: {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          tipoDocumento: form.tipoDocumento,
          numeroDocumento: (form.tipoDocumento === 'dni' ? normalizarDni(form.numeroDocumento) : form.numeroDocumento.trim()).toUpperCase(),
          correo: form.correo.trim().toLowerCase(),
          celular: form.celular.trim(),
          esIntegrante: form.esIntegrante,
        },
        participantes: integrantes.value,
      },
    })
    toast.exito('Delegación creada. Copia su link para enviárselo al delegado.')
    emit('creada', respuesta.data)
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal :abierto="abierto" titulo="Nueva delegación" descripcion="Registra al delegado y, si ya los tienes, a sus integrantes. Se genera un link para que el delegado complete o amplíe su grupo." ancho="xl" @cerrar="emit('cerrar')">
    <form id="form-delegacion-alta" class="space-y-6" @submit.prevent="guardar">
      <section class="space-y-3">
        <h3 class="kicker">Delegado</h3>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AppField label="Documento del delegado" for="alta-doc" required :error="erroresDelegado.numeroDocumento" :hint="buscandoDelegado ? 'Consultando el DNI…' : avisoDelegado">
            <div class="flex gap-1">
              <select v-model="form.tipoDocumento" class="field-control w-20" aria-label="Tipo de documento">
                <option value="dni">DNI</option>
                <option value="ce">CE</option>
              </select>
              <input id="alta-doc" v-model="form.numeroDocumento" class="field-control min-w-0" maxlength="12" inputmode="numeric" placeholder="Número" @input="alEscribirDocumento" @blur="alSalirDelDocumento">
            </div>
          </AppField>
          <AppField label="Nombres" for="alta-nombres" required :error="erroresDelegado.nombres">
            <input id="alta-nombres" v-model="form.nombres" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Apellidos" for="alta-apellidos" required :error="erroresDelegado.apellidos">
            <input id="alta-apellidos" v-model="form.apellidos" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Correo" for="alta-correo" required :error="erroresDelegado.correo">
            <input id="alta-correo" v-model="form.correo" type="email" class="field-control" maxlength="191">
          </AppField>
          <AppField label="Celular" for="alta-celular" required :error="erroresDelegado.celular">
            <input id="alta-celular" v-model="form.celular" class="field-control" maxlength="15" inputmode="tel">
          </AppField>
          <label class="flex items-end gap-2 pb-2 text-sm text-slate-200">
            <input v-model="form.esIntegrante" type="checkbox" class="size-4 rounded">
            El delegado también asiste (cuenta como integrante)
          </label>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="kicker">Delegación</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <AppField label="Nombre de la delegación" for="alta-nombre" required :error="errores.nombre">
            <input id="alta-nombre" v-model="form.nombre" class="field-control" maxlength="150" placeholder="Escuela de Ingeniería de Sistemas">
          </AppField>
          <AppField label="Institución" for="alta-institucion" :error="errores.institucion">
            <input id="alta-institucion" v-model="form.institucion" class="field-control" maxlength="191" placeholder="Universidad Nacional de Huancavelica">
          </AppField>
        </div>
        <fieldset>
          <legend class="field-label">Cómo asiste</legend>
          <div class="mt-1 flex flex-wrap gap-3">
            <label v-for="modalidad in (['PRESENCIAL', 'VIRTUAL'] as const)" :key="modalidad" class="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm" :class="modalidad === 'VIRTUAL' && !virtualDisponible ? 'opacity-50' : 'cursor-pointer'">
              <input v-model="form.modalidad" type="radio" name="alta-modalidad" :value="modalidad" :disabled="modalidad === 'VIRTUAL' && !virtualDisponible">
              {{ ETIQUETA_MODALIDAD[modalidad] }}
              <span class="text-xs text-slate-400">
                {{ modalidad === 'PRESENCIAL' ? `${soles(tarifa.precioEstandar)} · ${soles(tarifa.precioPromocional)} desde ${tarifa.minIntegrantes}` : (tarifa.virtual ? `${soles(tarifa.virtual.precio)} todos` : 'sin tipo') }}
              </span>
            </label>
          </div>
          <p v-if="!virtualDisponible" class="field-hint">La modalidad virtual no se ofrece: actívala con «Editar tarifa» en esta pestaña (o crea el tipo <span class="font-mono">delegacion_virtual</span> en Tipos de inscripción).</p>
        </fieldset>
      </section>

      <section class="space-y-3">
        <h3 class="kicker">Integrantes <span class="font-normal normal-case text-slate-400">(opcional: se pueden agregar después)</span></h3>
        <FilasIntegrantes v-model="filas" :errores="erroresFilas" :desfase="form.esIntegrante ? 1 : 0" />
      </section>

      <p class="rounded-xl px-4 py-3 text-sm" :class="estimado.faltan === null && form.modalidad === 'PRESENCIAL' && cantidad ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-slate-300'" aria-live="polite">
        <span class="font-semibold text-white">{{ numero(cantidad) }}</span> integrante(s) ×
        <span class="font-semibold text-white">{{ soles(estimado.precioUnitario) }}</span> =
        <span class="text-lg font-bold text-white">{{ soles(estimado.total) }}</span>
        <template v-if="estimado.faltan !== null"> · faltan {{ estimado.faltan }} para {{ soles(tarifa.precioPromocional) }} por persona.</template>
        <template v-else-if="form.modalidad === 'PRESENCIAL' && cantidad"> · tarifa promocional aplicada.</template>
        <span class="block text-xs text-slate-400">Estimado: el servidor calcula el monto definitivo.</span>
      </p>
      <p v-if="errores.body" class="text-sm text-red-300">{{ errores.body }}</p>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" form="form-delegacion-alta" :loading="guardando">Crear delegación</AppButton>
    </template>
  </AppModal>
</template>
