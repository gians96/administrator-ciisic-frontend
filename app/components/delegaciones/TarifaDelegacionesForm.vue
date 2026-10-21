<script setup lang="ts">
import type { Respuesta, TarifaDelegacionesAdmin, TarifaDelegacionesGuardada } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { numero, soles } from '~/utils/formato'
import {
  MIN_INTEGRANTES_MAXIMO, cuerpoTarifa, formularioDeTarifa, textoTarifaGuardada, validarTarifa, type FormularioTarifa,
} from '~/utils/delegaciones'

const props = defineProps<{ abierto: boolean, eventoId: number, tarifa: TarifaDelegacionesAdmin }>()
const emit = defineEmits<{ cerrar: [], guardada: [TarifaDelegacionesGuardada] }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()

const form = reactive<FormularioTarifa>(formularioDeTarifa(props.tarifa))
const erroresServidor = ref<Record<string, string>>({})
const intentado = ref(false)
const guardando = ref(false)

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  Object.assign(form, formularioDeTarifa(props.tarifa))
  erroresServidor.value = {}
  intentado.value = false
})

/** Los errores locales aparecen al intentar guardar (no mientras se escribe); los del servidor, siempre. */
const erroresLocales = computed(() => validarTarifa(form))
const errores = computed<Record<string, string>>(() => ({ ...(intentado.value ? erroresLocales.value : {}), ...erroresServidor.value }))

const sinTipoVirtual = computed(() => props.tarifa.virtual === null)
const sinIntegrantes = computed(() => props.tarifa.delegaciones.sinIntegrantes)
const conIntegrantes = computed(() => props.tarifa.delegaciones.total - props.tarifa.delegaciones.sinIntegrantes)

/** Vista previa con lo escrito; si algo no es válido no se muestra para no confundir. */
const vista = computed(() => {
  const { minIntegrantes: minimo, precioEstandar: estandar, precioPromocional: promocional } = form
  if (typeof minimo !== 'number' || typeof estandar !== 'number' || typeof promocional !== 'number' || Object.keys(erroresLocales.value).some((campo) => campo !== 'precioVirtual')) return null
  const tope = Math.max(minimo - 1, 0)
  return {
    escala: minimo > 1 && promocional < estandar,
    rangoEstandar: tope <= 1 ? '1 integrante' : `1 a ${tope} integrantes`,
    estandar,
    promocional,
    minimo,
  }
})

async function guardar() {
  intentado.value = true
  erroresServidor.value = {}
  if (Object.keys(erroresLocales.value).length) {
    toast.error('Revisa los datos de la tarifa.')
    return
  }
  const cuerpo = cuerpoTarifa(form, props.tarifa)
  if (!cuerpo) {
    toast.info('No hay cambios que guardar.')
    emit('cerrar')
    return
  }
  if (cuerpo.aplicarAExistentes) {
    const ok = await confirmar({
      titulo: 'Aplicar a las delegaciones existentes',
      mensaje: `La nueva tarifa se copiará a ${numero(sinIntegrantes.value)} delegación(es) que aún no tienen integrantes ni vouchers. Las demás conservan la suya.`,
      textoConfirmar: 'Guardar y aplicar',
    })
    if (!ok) return
  }
  guardando.value = true
  try {
    const respuesta = await api<Respuesta<TarifaDelegacionesGuardada>>(`events/${props.eventoId}/delegations/tarifa`, { method: 'PUT', body: cuerpo })
    toast.exito(textoTarifaGuardada(respuesta.data.delegacionesActualizadas, cuerpo.aplicarAExistentes === true))
    emit('guardada', respuesta.data)
  } catch (error) {
    erroresServidor.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal :abierto="abierto" titulo="Tarifa de las delegaciones" descripcion="Precio por persona de cada modalidad. Rige para las delegaciones nuevas: cada una conserva la tarifa con la que se creó." ancho="lg" @cerrar="emit('cerrar')">
    <form id="form-tarifa-delegaciones" class="space-y-6" @submit.prevent="guardar">
      <section class="space-y-3">
        <h3 class="kicker">Presencial</h3>
        <div class="grid gap-4 md:grid-cols-3">
          <AppField label="Precio por persona (S/)" for="tarifa-estandar" required :error="errores.precioEstandar" hint="Hasta que el grupo llegue al mínimo.">
            <input id="tarifa-estandar" v-model.number="form.precioEstandar" type="number" min="0" step="0.01" inputmode="decimal" class="field-control">
          </AppField>
          <AppField label="Precio promocional (S/)" for="tarifa-promocional" required :error="errores.precioPromocional" hint="Desde el mínimo, para todo el grupo.">
            <input id="tarifa-promocional" v-model.number="form.precioPromocional" type="number" min="0" step="0.01" inputmode="decimal" class="field-control">
          </AppField>
          <AppField label="Mínimo de integrantes" for="tarifa-minimo" required :error="errores.minIntegrantes" :hint="`Entre 1 y ${MIN_INTEGRANTES_MAXIMO}.`">
            <input id="tarifa-minimo" v-model.number="form.minIntegrantes" type="number" min="1" :max="MIN_INTEGRANTES_MAXIMO" step="1" inputmode="numeric" class="field-control">
          </AppField>
        </div>
        <p v-if="vista" class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300" aria-live="polite">
          <template v-if="vista.escala">
            {{ vista.rangoEstandar }}: <strong class="text-white">{{ soles(vista.estandar) }}</strong> por persona ·
            {{ numero(vista.minimo) }} o más: <strong class="text-white">{{ soles(vista.promocional) }}</strong> por persona (para todo el grupo).
          </template>
          <template v-else>
            Todos pagan <strong class="text-white">{{ soles(vista.promocional) }}</strong> por persona, sin escala por tamaño.
          </template>
        </p>
      </section>

      <section class="space-y-3">
        <h3 class="kicker">Virtual</h3>
        <AppSwitch v-model="form.virtualActivo" label="Ofrecer la modalidad virtual" :descripcion="sinTipoVirtual ? 'El evento aún no tiene el tipo «delegacion_virtual»: se crea al guardar.' : 'Apagada, la landing no la ofrece ni se pueden registrar delegaciones virtuales nuevas; el precio se conserva.'" />
        <div class="max-w-xs">
          <AppField label="Precio por persona (S/)" for="tarifa-virtual" :required="form.virtualActivo" :error="errores.precioVirtual" hint="Tarifa única, sin escalas.">
            <input id="tarifa-virtual" v-model.number="form.precioVirtual" type="number" min="0" step="0.01" inputmode="decimal" class="field-control" :disabled="!form.virtualActivo">
          </AppField>
        </div>
      </section>

      <section class="space-y-2">
        <h3 class="kicker">Delegaciones ya creadas</h3>
        <label v-if="sinIntegrantes" class="flex items-start gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200">
          <input v-model="form.aplicarAExistentes" type="checkbox" class="mt-0.5 size-4 rounded">
          <span>
            Aplicar también a las <strong>{{ numero(sinIntegrantes) }}</strong> delegación(es) que aún no tienen integrantes ni vouchers.
            <span class="block text-xs text-slate-400">Si pactaste un precio distinto con alguna (convenio), déjalo sin marcar o edítalo después en su detalle.</span>
          </span>
        </label>
        <p v-else class="text-sm text-slate-400">No hay delegaciones sin integrantes ni vouchers a las que copiar la tarifa.</p>
        <p v-if="conIntegrantes" class="text-xs text-slate-400">
          {{ numero(conIntegrantes) }} delegación(es) ya tienen integrantes o vouchers y conservan su tarifa: cámbiala en <span class="text-slate-200">Gestionar → Tarifa de esta delegación</span>.
        </p>
      </section>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" form="form-tarifa-delegaciones" :loading="guardando">Guardar tarifa</AppButton>
    </template>
  </AppModal>
</template>
