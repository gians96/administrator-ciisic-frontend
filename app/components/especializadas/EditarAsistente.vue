<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { nombreCompleto } from '~/utils/formato'
import {
  cuerpoCorreccion,
  etiquetaProcedencia,
  PROCEDENCIAS,
  validarPersona,
  type FormPersona,
  type InscripcionPonencia,
} from '~/utils/ponenciasEspecializadas'

/**
 * Corrige los datos de la persona de una inscripción (`PATCH /specialized-talk-registrations/:id`,
 * `especializadas.inscribir`). Los datos son de la persona, no de la ponencia: valen para todas sus
 * inscripciones. Vacío en correo, celular o procedencia los borra.
 */
const props = defineProps<{ inscripcion: InscripcionPonencia | null }>()
const emit = defineEmits<{ cerrar: [], guardada: [inscripcion: InscripcionPonencia] }>()

const { api } = useApi()
const toast = useToast()
const id = useId()

const form = reactive<FormPersona>({ tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', procedencia: '' })
const errores = ref<Record<string, string>>({})
const guardando = ref(false)

const idCampo = (campo: string) => `${id}-${campo}`

watch(() => props.inscripcion, (inscripcion) => {
  if (!inscripcion) return
  const a = inscripcion.asistente
  Object.assign(form, {
    tipoDocumento: a.tipoDocumento === 'ce' ? 'ce' : 'dni',
    numeroDocumento: a.numeroDocumento,
    nombres: a.nombres,
    apellidos: a.apellidos,
    correo: a.correo ?? '',
    celular: a.celular ?? '',
    procedencia: a.procedencia ?? '',
  })
  errores.value = {}
}, { immediate: true })

async function guardar() {
  if (!props.inscripcion || guardando.value) return
  errores.value = validarPersona(form, { nombresObligatorios: true })
  if (Object.keys(errores.value).length) return
  guardando.value = true
  try {
    const respuesta = await api<Respuesta<InscripcionPonencia>>(`specialized-talk-registrations/${props.inscripcion.id}`, { method: 'PATCH', body: cuerpoCorreccion(form) })
    toast.exito('Datos actualizados.')
    emit('guardada', respuesta.data)
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal
    :abierto="inscripcion !== null"
    titulo="Corregir datos"
    :descripcion="inscripcion ? `${inscripcion.asistente.tipoDocumento.toUpperCase()} ${inscripcion.asistente.numeroDocumento} · ${nombreCompleto(inscripcion.asistente)}` : undefined"
    ancho="md"
    @cerrar="emit('cerrar')"
  >
    <form :id="`${id}-form`" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="guardar">
      <AppField label="Nombres" :for="idCampo('nombres')" required :error="errores.nombres">
        <input :id="idCampo('nombres')" v-model="form.nombres" class="field-control" maxlength="120" autocomplete="off">
      </AppField>
      <AppField label="Apellidos" :for="idCampo('apellidos')" required :error="errores.apellidos">
        <input :id="idCampo('apellidos')" v-model="form.apellidos" class="field-control" maxlength="120" autocomplete="off">
      </AppField>
      <AppField label="Correo" :for="idCampo('correo')" :error="errores.correo" hint="Vacío lo borra.">
        <input :id="idCampo('correo')" v-model="form.correo" type="email" class="field-control" maxlength="191" autocomplete="off">
      </AppField>
      <AppField label="Celular" :for="idCampo('celular')" :error="errores.celular" hint="Vacío lo borra.">
        <input :id="idCampo('celular')" v-model="form.celular" type="tel" inputmode="tel" class="field-control" maxlength="20" autocomplete="off">
      </AppField>
      <AppField label="Procedencia" :for="idCampo('procedencia')" class="sm:col-span-2">
        <select :id="idCampo('procedencia')" v-model="form.procedencia" class="field-control">
          <option value="">{{ etiquetaProcedencia(null) }}</option>
          <option v-for="p in PROCEDENCIAS" :key="p.valor" :value="p.valor">{{ p.etiqueta }}</option>
        </select>
      </AppField>
    </form>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" :form="`${id}-form`" :loading="guardando">Guardar</AppButton>
    </template>
  </AppModal>
</template>
