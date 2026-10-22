<script setup lang="ts">
import type { CodigoPlan } from '~/types/api'
import { correoFueraDeDominio, ETIQUETA_PLAN, filaVacia, normalizarDni, parsearParticipantesDelegacion, type FilaEditable } from '~/utils/delegaciones'

const filas = defineModel<FilaEditable[]>({ required: true })
const props = withDefaults(defineProps<{
  /** Planes que admiten integrantes (los activos de la delegación). Con uno solo no se pide elegir. */
  planes: ReadonlyArray<CodigoPlan>
  /** Dominio de la delegación: el staff puede inscribir otros correos, pero se le avisa. */
  dominio?: string | null
  /** Errores del backend por campo, p. ej. `participantes[0].correo`. */
  errores?: Record<string, string>
  /** Filas que el backend antepone a la lista (el delegado, si es integrante): desplaza los índices de los errores. */
  desfase?: number
}>(), { dominio: null, errores: () => ({}), desfase: 0 })

const { buscar } = useDni()
const toast = useToast()

const planUnico = computed<CodigoPlan | ''>(() => (props.planes.length === 1 ? (props.planes[0] ?? '') : ''))
const pedirPlan = computed(() => props.planes.length > 1)

// Una fila sin plan toma el único activo; si los planes cambian y el elegido ya no sirve, se limpia
watch(() => props.planes, (planes) => {
  for (const fila of filas.value) {
    if (fila.plan && !planes.includes(fila.plan)) fila.plan = planUnico.value
    else if (!fila.plan && planUnico.value) fila.plan = planUnico.value
  }
}, { immediate: true })

function agregar() {
  filas.value = [...filas.value, filaVacia(planUnico.value)]
}

function quitar(clave: number) {
  const resto = filas.value.filter((fila) => fila.clave !== clave)
  filas.value = resto.length ? resto : [filaVacia(planUnico.value)]
}

function errorDe(indice: number, campo: string): string | undefined {
  return props.errores[`participantes[${indice + props.desfase}].${campo}`]
}

/** Con 8 dígitos y sin nombres escritos, completa nombres y apellidos desde la consulta DNI. */
async function alEscribirDocumento(fila: FilaEditable) {
  fila.numeroDocumento = fila.numeroDocumento.replace(/\s+/g, '')
  if (fila.tipoDocumento !== 'dni' || !/^\d{8}$/.test(fila.numeroDocumento) || fila.buscando) return
  if (fila.nombres.trim() || fila.apellidos.trim()) return
  const numero = fila.numeroDocumento
  fila.buscando = true
  fila.aviso = ''
  const { persona, mensaje } = await buscar(numero)
  fila.buscando = false
  // Si cambió el número mientras buscaba, se descarta
  if (fila.numeroDocumento !== numero) return
  if (persona) Object.assign(fila, persona)
  else fila.aviso = mensaje
}

/** Al salir del campo, un DNI de 7 dígitos (Excel perdió el cero) se completa y se consulta. */
function alSalirDelDocumento(fila: FilaEditable) {
  if (fila.tipoDocumento === 'dni') fila.numeroDocumento = normalizarDni(fila.numeroDocumento)
  void alEscribirDocumento(fila)
}

const textoMasivo = ref('')
/** Plan de las filas que se pegan en lista (el texto no lo trae). */
const planMasivo = ref<CodigoPlan | ''>('')
const vistaPrevia = computed(() => parsearParticipantesDelegacion(textoMasivo.value))

function agregarLista() {
  const { filas: nuevas, errores } = vistaPrevia.value
  if (errores.length) {
    toast.error(errores[0] ?? 'Revisa la lista pegada.')
    return
  }
  if (!nuevas.length) {
    toast.error('Pega al menos una línea con documento, nombres y correo.')
    return
  }
  const plan = planUnico.value || planMasivo.value
  if (pedirPlan.value && !plan) {
    toast.error('Elige el plan de las personas que pegaste.')
    return
  }
  const conDatos = filas.value.filter((fila) => fila.numeroDocumento || fila.nombres || fila.correo)
  filas.value = [...conDatos, ...nuevas.map((fila) => ({ ...filaVacia(plan), ...fila, plan }))]
  textoMasivo.value = ''
  toast.exito(`${nuevas.length} integrante(s) agregado(s) a la lista.`)
}
</script>

<template>
  <div class="space-y-3">
    <ul class="space-y-3">
      <li v-for="(fila, indice) in filas" :key="fila.clave" class="rounded-xl bg-white/5 p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Integrante {{ indice + 1 }}</p>
          <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" :aria-label="`Quitar el integrante ${indice + 1}`" @click="quitar(fila.clave)">
            <Icon name="heroicons:x-mark" class="size-4" aria-hidden="true" />
          </button>
        </div>
        <div class="mt-2 grid gap-3 md:grid-cols-2" :class="pedirPlan ? 'xl:grid-cols-6' : 'xl:grid-cols-5'">
          <AppField label="Documento" :for="`fila-doc-${fila.clave}`" :error="errorDe(indice, 'numeroDocumento')" :hint="fila.buscando ? 'Consultando el DNI…' : fila.aviso">
            <div class="flex gap-1">
              <select v-model="fila.tipoDocumento" class="field-control w-20" aria-label="Tipo de documento">
                <option value="dni">DNI</option>
                <option value="ce">CE</option>
              </select>
              <input :id="`fila-doc-${fila.clave}`" v-model="fila.numeroDocumento" class="field-control min-w-0" maxlength="12" inputmode="numeric" placeholder="Número" @input="alEscribirDocumento(fila)" @blur="alSalirDelDocumento(fila)">
            </div>
          </AppField>
          <AppField label="Nombres" :for="`fila-nom-${fila.clave}`" :error="errorDe(indice, 'nombres')">
            <input :id="`fila-nom-${fila.clave}`" v-model="fila.nombres" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Apellidos" :for="`fila-ape-${fila.clave}`" :error="errorDe(indice, 'apellidos')">
            <input :id="`fila-ape-${fila.clave}`" v-model="fila.apellidos" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Correo" :for="`fila-cor-${fila.clave}`" :error="errorDe(indice, 'correo')" :hint="correoFueraDeDominio(fila.correo, dominio) ? `Fuera de @${dominio}: el staff puede inscribirlo igual.` : undefined">
            <input :id="`fila-cor-${fila.clave}`" v-model="fila.correo" type="email" class="field-control" maxlength="191">
          </AppField>
          <AppField label="Celular" :for="`fila-cel-${fila.clave}`" :error="errorDe(indice, 'celular')">
            <input :id="`fila-cel-${fila.clave}`" v-model="fila.celular" class="field-control" maxlength="15" inputmode="tel">
          </AppField>
          <AppField v-if="pedirPlan" label="Plan" :for="`fila-plan-${fila.clave}`" required :error="errorDe(indice, 'plan')">
            <select :id="`fila-plan-${fila.clave}`" v-model="fila.plan" class="field-control">
              <option value="" disabled>Elige…</option>
              <option v-for="plan in planes" :key="plan" :value="plan">{{ ETIQUETA_PLAN[plan] }}</option>
            </select>
          </AppField>
        </div>
      </li>
    </ul>

    <div class="flex flex-wrap items-center gap-2">
      <AppButton size="sm" variant="secondary" icon="heroicons:user-plus" @click="agregar">Agregar integrante</AppButton>
    </div>

    <details class="rounded-xl bg-white/5 p-4">
      <summary class="cursor-pointer text-sm font-semibold text-slate-200">Pegar una lista (Excel o texto)</summary>
      <p class="mt-2 text-xs text-slate-400">
        Una persona por línea: <span class="font-mono">DNI, Nombres, Apellidos, Correo, Celular</span>.
        También acepta <span class="font-mono">DNI, Nombres completos, Correo</span>. Separa con coma, punto y coma o tabulador.
      </p>
      <div v-if="pedirPlan" class="mt-2 max-w-xs">
        <AppField label="Plan de estas personas" for="masivo-plan" required hint="Se aplica a todas las filas pegadas; luego puedes cambiarlo en cada una.">
          <select id="masivo-plan" v-model="planMasivo" class="field-control">
            <option value="" disabled>Elige…</option>
            <option v-for="plan in planes" :key="plan" :value="plan">{{ ETIQUETA_PLAN[plan] }}</option>
          </select>
        </AppField>
      </div>
      <textarea v-model="textoMasivo" rows="5" class="field-control mt-2 font-mono text-xs" placeholder="70123456, Ana, Pérez, ana@example.com, 987654321" aria-label="Lista de integrantes" />
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-slate-400">{{ vistaPrevia.filas.length }} fila(s) válida(s)</p>
        <AppButton type="button" size="sm" icon="heroicons:arrow-down-tray" @click="agregarLista">Agregar a la lista</AppButton>
      </div>
      <ul v-if="vistaPrevia.errores.length" class="mt-2 list-disc pl-5 text-xs text-amber-300">
        <li v-for="error in vistaPrevia.errores" :key="error">{{ error }}</li>
      </ul>
    </details>
  </div>
</template>
