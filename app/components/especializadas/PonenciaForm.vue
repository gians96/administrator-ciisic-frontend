<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import {
  cuerpoPonencia,
  duracionTexto,
  formularioPonencia,
  horaFinDesde,
  MODALIDADES,
  validarPonencia,
  type PonenciaEspecializada,
} from '~/utils/ponenciasEspecializadas'

/**
 * Crear o editar una ponencia especializada (`POST /events/:eventId/specialized-talks`, `PUT
 * /specialized-talks/:id`, `especializadas.gestionar`). La hora de fin se calcula con la duración.
 */
const props = defineProps<{ abierto: boolean, eventoId: number | null, ponencia: PonenciaEspecializada | null }>()
const emit = defineEmits<{ cerrar: [], guardada: [] }>()

const { api } = useApi()
const toast = useToast()
const id = useId()

const form = reactive(formularioPonencia())
const errores = ref<Record<string, string>>({})
const guardando = ref(false)

const idCampo = (campo: string) => `${id}-${campo.replace('.', '-')}`
const horaFin = computed(() => horaFinDesde(form.horaInicio, Number(form.duracionMin)))

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  Object.assign(form, formularioPonencia(props.ponencia))
  errores.value = {}
}, { immediate: true })

function enfocarPrimerError() {
  const campo = Object.keys(errores.value)[0]
  if (campo) nextTick(() => document.getElementById(idCampo(campo))?.focus())
}

async function guardar() {
  if (guardando.value) return
  errores.value = validarPonencia(form)
  if (Object.keys(errores.value).length) return enfocarPrimerError()
  if (!props.ponencia && !props.eventoId) return
  guardando.value = true
  try {
    const cuerpo = cuerpoPonencia(form)
    if (props.ponencia) await api<Respuesta<PonenciaEspecializada>>(`specialized-talks/${props.ponencia.id}`, { method: 'PUT', body: cuerpo })
    else await api<Respuesta<PonenciaEspecializada>>(`events/${props.eventoId}/specialized-talks`, { method: 'POST', body: cuerpo })
    toast.exito('Ponencia guardada.')
    emit('guardada')
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
    enfocarPrimerError()
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="abierto"
    :titulo="ponencia ? 'Editar ponencia' : 'Nueva ponencia'"
    descripcion="Programa de las ponencias especializadas. El horario se interpreta en hora de Lima."
    ancho="lg"
    @cerrar="emit('cerrar')"
  >
    <form :id="`${id}-form`" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="guardar">
      <AppField label="Tema" :for="idCampo('tema')" required :error="errores.tema" class="sm:col-span-2">
        <input :id="idCampo('tema')" v-model="form.tema" class="field-control" maxlength="300" autocomplete="off" :aria-invalid="errores.tema ? true : undefined">
      </AppField>

      <AppField label="Fecha" :for="idCampo('fecha')" required :error="errores.fecha">
        <input :id="idCampo('fecha')" v-model="form.fecha" type="date" class="field-control" :aria-invalid="errores.fecha ? true : undefined">
      </AppField>
      <AppField label="Modalidad" :for="idCampo('modalidad')">
        <select :id="idCampo('modalidad')" v-model="form.modalidad" class="field-control">
          <option v-for="m in MODALIDADES" :key="m.valor" :value="m.valor">{{ m.etiqueta }}</option>
        </select>
      </AppField>

      <AppField label="Hora de inicio" :for="idCampo('horaInicio')" required :error="errores.horaInicio">
        <input :id="idCampo('horaInicio')" v-model="form.horaInicio" type="time" class="field-control" :aria-invalid="errores.horaInicio ? true : undefined">
      </AppField>
      <AppField
        label="Duración (minutos)"
        :for="idCampo('duracionMin')"
        required
        :error="errores.duracionMin ?? errores.horaFin ?? errores.body"
        :hint="horaFin ? `Termina a las ${horaFin} · ${duracionTexto(Number(form.duracionMin))}` : undefined"
      >
        <input :id="idCampo('duracionMin')" v-model="form.duracionMin" inputmode="numeric" class="field-control" maxlength="4" :aria-invalid="errores.duracionMin ? true : undefined">
      </AppField>

      <AppField
        :label="form.modalidad === 'VIRTUAL' ? 'Plataforma o ambiente' : 'Ambiente'"
        :for="idCampo('ambiente')"
        required
        :error="errores.ambiente"
        hint="Dos ponencias presenciales no pueden usar el mismo ambiente a la misma hora."
      >
        <input :id="idCampo('ambiente')" v-model="form.ambiente" class="field-control" maxlength="120" placeholder="Laboratorio 1" autocomplete="off" :aria-invalid="errores.ambiente ? true : undefined">
      </AppField>
      <AppField label="Cupo" :for="idCampo('cupo')" :error="errores.cupo" hint="Aforo del ambiente. Vacío = sin límite (laboratorios 20, aulas 40).">
        <input :id="idCampo('cupo')" v-model="form.cupo" inputmode="numeric" class="field-control" maxlength="4" placeholder="Sin límite" :aria-invalid="errores.cupo ? true : undefined">
      </AppField>

      <div class="sm:col-span-2">
        <AppSwitch v-model="form.esGratuita" label="Gratuita" descripcion="Las ponencias de pago no se pueden reservar desde la landing: el cobro aún no está disponible." />
      </div>
      <AppField v-if="!form.esGratuita" label="Precio (S/)" :for="idCampo('precio')" required :error="errores.precio">
        <input :id="idCampo('precio')" v-model="form.precio" inputmode="decimal" class="field-control" maxlength="8" placeholder="20.00" :aria-invalid="errores.precio ? true : undefined">
      </AppField>

      <fieldset class="grid gap-4 rounded-2xl border border-white/10 p-4 sm:col-span-2 sm:grid-cols-2">
        <legend class="px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">Ponente</legend>
        <AppField label="Nombre" :for="idCampo('ponente.nombre')" required :error="errores['ponente.nombre']" class="sm:col-span-2">
          <input :id="idCampo('ponente.nombre')" v-model="form.ponenteNombre" class="field-control" maxlength="200" autocomplete="off" :aria-invalid="errores['ponente.nombre'] ? true : undefined">
        </AppField>
        <AppField label="Perfil (opcional)" :for="idCampo('ponente.bio')" :error="errores['ponente.bio']" class="sm:col-span-2">
          <textarea :id="idCampo('ponente.bio')" v-model="form.ponenteBio" rows="4" maxlength="5000" class="field-control" />
        </AppField>
        <AppField
          label="Foto (opcional)"
          :for="idCampo('ponente.foto')"
          :error="errores['ponente.foto']"
          hint="Ruta del sitio (/images/ponentes/…) o URL https."
        >
          <input :id="idCampo('ponente.foto')" v-model="form.ponenteFoto" class="field-control" maxlength="255" placeholder="/images/ponentes/2026/…" autocomplete="off" :aria-invalid="errores['ponente.foto'] ? true : undefined">
        </AppField>
        <div class="flex items-end pb-1">
          <AppSwitch v-model="form.ponenteExterno" label="Ponente externo" descripcion="No pertenece a la comunidad UNDC." class="w-full" />
        </div>
      </fieldset>

      <AppField label="Orden" :for="idCampo('orden')" :error="errores.orden" hint="Desempata ponencias del mismo horario.">
        <input :id="idCampo('orden')" v-model="form.orden" inputmode="numeric" class="field-control" maxlength="4" :aria-invalid="errores.orden ? true : undefined">
      </AppField>
      <div class="flex items-end pb-1">
        <AppSwitch v-model="form.publicada" label="Publicada" descripcion="Visible e inscribible desde la landing." class="w-full" />
      </div>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" :form="`${id}-form`" :loading="guardando">Guardar</AppButton>
    </template>
  </AppModal>
</template>
