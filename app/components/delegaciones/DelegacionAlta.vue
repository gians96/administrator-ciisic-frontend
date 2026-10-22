<script setup lang="ts">
import type { CodigoPlan, DelegacionDetalle, PlanDelegacion, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { numero, soles } from '~/utils/formato'
import {
  cantidadesPorPlan, errorDeDominio, errorDeMinimo, estimarGrupo, ETIQUETA_PLAN, filaVacia, filasParaEnviar, MIN_INTEGRANTES_POR_DEFECTO,
  normalizarDni, normalizarDominio, PLANES, planesParaAlta, planesVacios, validarPlanes, type Cifra, type FilaEditable, type FormularioPlanes,
} from '~/utils/delegaciones'

const props = defineProps<{ abierto: boolean, eventoId: number }>()
const emit = defineEmits<{ cerrar: [], creada: [DelegacionDetalle] }>()

const { api } = useApi()
const { buscar } = useDni()
const toast = useToast()
const auth = useAuthStore()

/** Planes, precios, dominio y link individual los fija solo quien gestiona delegaciones (Owner y Administrador). */
const puedeConfigurar = computed(() => auth.puede('delegaciones.gestionar'))

const form = reactive({
  nombre: '',
  institucion: '',
  tipoDocumento: 'dni' as 'dni' | 'ce',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  correo: '',
  celular: '',
  esIntegrante: false,
  planDelegado: '' as CodigoPlan | '',
  dominio: '',
  inscripcionIndividual: false,
})
const planes = ref<FormularioPlanes>(planesVacios())
const minIntegrantes = ref<Cifra>(MIN_INTEGRANTES_POR_DEFECTO)
const filas = ref<FilaEditable[]>([filaVacia()])
const errores = ref<Record<string, string>>({})
const erroresConfig = ref<Record<string, string>>({})
const guardando = ref(false)
const buscandoDelegado = ref(false)
const avisoDelegado = ref('')

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  Object.assign(form, {
    nombre: '', institucion: '', tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '',
    esIntegrante: false, planDelegado: '', dominio: '', inscripcionIndividual: false,
  })
  planes.value = planesVacios()
  minIntegrantes.value = MIN_INTEGRANTES_POR_DEFECTO
  filas.value = [filaVacia()]
  errores.value = {}
  erroresConfig.value = {}
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

/** Planes que ya admiten integrantes: los activos con precio. Sin ellos (la Comisión no los fija) no hay integrantes que cargar. */
const planesActivos = computed<CodigoPlan[]>(() => (puedeConfigurar.value
  ? PLANES.filter(({ codigo }) => planes.value[codigo].activo && Number(planes.value[codigo].precio) > 0).map(({ codigo }) => codigo)
  : []))
const planUnico = computed<CodigoPlan | ''>(() => (planesActivos.value.length === 1 ? (planesActivos.value[0] ?? '') : ''))

const integrantes = computed(() => filasParaEnviar(filas.value))
const cantidad = computed(() => integrantes.value.length + (form.esIntegrante ? 1 : 0))

/** Los planes del formulario con la forma de los del servidor, solo para estimar el total en vivo. */
const planesParaEstimar = computed<PlanDelegacion[]>(() => PLANES.map(({ codigo }) => {
  const plan = planes.value[codigo]
  return {
    codigo,
    tipoInscripcionId: 0,
    etiqueta: ETIQUETA_PLAN[codigo],
    modalidad: codigo === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL',
    activo: plan.activo,
    precio: typeof plan.precio === 'number' ? plan.precio : 0,
    precioPromocional: typeof plan.precioPromocional === 'number' ? plan.precioPromocional : null,
    precioUnitario: null,
    integrantes: 0,
  }
}))
const estimado = computed(() => {
  if (!puedeConfigurar.value || !planesActivos.value.length || !cantidad.value) return null
  const cantidades = cantidadesPorPlan(filas.value, planUnico.value)
  if (form.esIntegrante) {
    const plan = form.planDelegado || planUnico.value
    if (plan) cantidades[plan] = (cantidades[plan] ?? 0) + 1
  }
  return estimarGrupo(planesParaEstimar.value.filter((plan) => plan.activo), cantidades, typeof minIntegrantes.value === 'number' ? minIntegrantes.value : MIN_INTEGRANTES_POR_DEFECTO)
})

/** Errores del backend sin el prefijo de la sección (`representante.correo` → `correo`). */
const erroresDelegado = computed(() => Object.fromEntries(Object.entries(errores.value).filter(([campo]) => campo.startsWith('representante.')).map(([campo, texto]) => [campo.replace('representante.', ''), texto])))
const erroresFilas = computed(() => Object.fromEntries(Object.entries(errores.value).filter(([campo]) => campo.startsWith('participantes['))))

/** Errores de la configuración (planes, mínimo y dominio) antes de enviar: los mismos límites que el backend. */
function validarConfiguracion(): Record<string, string> {
  if (!puedeConfigurar.value) return {}
  const resultado = validarPlanes(planes.value)
  const minimo = errorDeMinimo(minIntegrantes.value)
  if (minimo) resultado.minIntegrantes = minimo
  const dominio = errorDeDominio(form.dominio)
  if (dominio) resultado.dominioCorreo = dominio
  return resultado
}

async function guardar() {
  errores.value = {}
  erroresConfig.value = validarConfiguracion()
  if (Object.keys(erroresConfig.value).length) {
    toast.error('Revisa los planes y la configuración: hay campos por corregir.')
    return
  }
  guardando.value = true
  try {
    const dominio = normalizarDominio(form.dominio)
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`events/${props.eventoId}/delegations`, {
      method: 'POST',
      body: {
        nombre: form.nombre.trim(),
        institucion: form.institucion.trim() || null,
        representante: {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          tipoDocumento: form.tipoDocumento,
          numeroDocumento: (form.tipoDocumento === 'dni' ? normalizarDni(form.numeroDocumento) : form.numeroDocumento.trim()).toUpperCase(),
          correo: form.correo.trim().toLowerCase(),
          celular: form.celular.trim(),
          esIntegrante: form.esIntegrante,
          ...(form.esIntegrante && (form.planDelegado || planUnico.value) ? { plan: form.planDelegado || planUnico.value } : {}),
        },
        participantes: integrantes.value,
        ...(puedeConfigurar.value
          ? {
              planes: planesParaAlta(planes.value) ?? undefined,
              minIntegrantes: minIntegrantes.value,
              dominioCorreo: dominio || undefined,
              inscripcionIndividual: form.inscripcionIndividual || undefined,
            }
          : {}),
      },
    })
    toast.exito(puedeConfigurar.value ? 'Delegación creada. Copia su link para enviárselo al delegado.' : 'Delegación creada. Un Owner o Administrador debe configurar sus planes y precios.')
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
  <AppModal :abierto="abierto" titulo="Nueva delegación" descripcion="Registra al delegado y define los planes de la delegación. Se genera un link para que el delegado complete o amplíe su grupo." ancho="xl" @cerrar="emit('cerrar')">
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
          <AppField v-if="form.esIntegrante && planesActivos.length > 1" label="Plan del delegado" for="alta-plan-delegado" required :error="erroresDelegado.plan">
            <select id="alta-plan-delegado" v-model="form.planDelegado" class="field-control">
              <option value="" disabled>Elige…</option>
              <option v-for="plan in planesActivos" :key="plan" :value="plan">{{ ETIQUETA_PLAN[plan] }}</option>
            </select>
          </AppField>
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
      </section>

      <template v-if="puedeConfigurar">
        <section class="space-y-3">
          <h3 class="kicker">Planes y precios</h3>
          <p class="text-xs text-slate-400">Cada integrante elige uno de los planes activos. Lo que no actives no se ofrece; puedes cambiarlo después en el detalle.</p>
          <PlanesEditor v-model="planes" v-model:min-integrantes="minIntegrantes" :errores="erroresConfig" prefijo="alta" />
        </section>

        <section class="space-y-3">
          <h3 class="kicker">Correo y link individual</h3>
          <div class="grid gap-4 md:grid-cols-2">
            <AppField label="Dominio del correo" for="alta-dominio" :error="erroresConfig.dominioCorreo || errores.dominioCorreo" hint="Opcional. Con unac.edu.pe solo se aceptan correos @unac.edu.pe en los links; el staff puede inscribir otros.">
              <input id="alta-dominio" v-model="form.dominio" class="field-control" maxlength="100" placeholder="unac.edu.pe" autocomplete="off">
            </AppField>
            <div class="self-end pb-1">
              <AppSwitch v-model="form.inscripcionIndividual" label="Cada integrante se inscribe con su link" descripcion="Además del link del delegado, genera un link individual para compartir con el grupo." />
            </div>
          </div>
        </section>
      </template>
      <p v-else class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
        Los planes, precios, dominio del correo y link individual los configura un Owner o Administrador. Hasta entonces la delegación no admite integrantes.
      </p>

      <section v-if="planesActivos.length" class="space-y-3">
        <h3 class="kicker">Integrantes <span class="font-normal normal-case text-slate-400">(opcional: se pueden agregar después)</span></h3>
        <FilasIntegrantes v-model="filas" :planes="planesActivos" :dominio="normalizarDominio(form.dominio) || null" :errores="erroresFilas" :desfase="form.esIntegrante ? 1 : 0" />
      </section>

      <p v-if="estimado" class="rounded-xl px-4 py-3 text-sm" :class="estimado.faltan === null ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-slate-300'" aria-live="polite">
        <span class="font-semibold text-white">{{ numero(estimado.integrantes) }}</span> integrante(s) =
        <span class="text-lg font-bold text-white">{{ soles(estimado.total) }}</span>
        <template v-if="estimado.faltan !== null"> · faltan {{ estimado.faltan }} para el precio promocional.</template>
        <span class="block text-xs text-slate-400">Estimado: el servidor calcula el monto definitivo según el plan de cada integrante.</span>
      </p>
      <p v-if="errores.body" class="text-sm text-red-300">{{ errores.body }}</p>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" form="form-delegacion-alta" :loading="guardando">Crear delegación</AppButton>
    </template>
  </AppModal>
</template>
