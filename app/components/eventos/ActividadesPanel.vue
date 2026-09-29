<script setup lang="ts">
import type { Actividad, Respuesta } from '~/types/api'
import { fechaDia, numero } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'

const props = defineProps<{ eventoId: number }>()
const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()

const actividades = ref<Actividad[]>([])
const cargando = ref(false)
const modal = ref(false)
const editando = ref<Actividad | null>(null)
const guardando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive({ nombre: '', fecha: '', horaInicio: '09:00', horaFin: '12:00' })

async function cargar() {
  cargando.value = true
  try {
    actividades.value = (await api<Respuesta<Actividad[]>>(`events/${props.eventoId}/activities`)).data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}
watch(() => props.eventoId, cargar, { immediate: true })

function abrir(actividad?: Actividad) {
  editando.value = actividad ?? null
  errores.value = {}
  Object.assign(form, actividad
    ? { nombre: actividad.nombre, fecha: actividad.fecha, horaInicio: actividad.horaInicio, horaFin: actividad.horaFin }
    : { nombre: '', fecha: '', horaInicio: '09:00', horaFin: '12:00' })
  modal.value = true
}

async function guardar() {
  guardando.value = true
  errores.value = {}
  try {
    if (editando.value) await api(`activities/${editando.value.id}`, { method: 'PUT', body: { ...form } })
    else await api(`events/${props.eventoId}/activities`, { method: 'POST', body: { ...form } })
    toast.exito('Actividad guardada.')
    modal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function eliminar(actividad: Actividad) {
  const ok = await confirmar({ titulo: 'Eliminar actividad', mensaje: `¿Eliminar «${actividad.nombre}»? Solo es posible si no tiene asistencias.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    await api(`activities/${actividad.id}`, { method: 'DELETE' })
    toast.exito('Actividad eliminada.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-slate-400">Las actividades (inauguración, ponencias por día, talleres, clausura) sirven para registrar asistencia. El horario se interpreta en hora de Lima.</p>
      <AppButton icon="heroicons:plus" @click="abrir()">Nueva actividad</AppButton>
    </div>
    <section class="card overflow-hidden">
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Actividad</th><th>Fecha</th><th>Horario</th><th class="text-right">Asistencias</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="actividad in actividades" :key="actividad.id">
              <td class="font-medium text-white">{{ actividad.nombre }}</td>
              <td class="whitespace-nowrap">{{ fechaDia(actividad.fecha) }}</td>
              <td class="whitespace-nowrap tabular-nums">{{ actividad.horaInicio }} – {{ actividad.horaFin }}</td>
              <td class="text-right tabular-nums">{{ numero(actividad.totalAsistencias) }}</td>
              <td class="text-right whitespace-nowrap">
                <AppButton size="sm" variant="ghost" icon="heroicons:qr-code" :to="`/asistencia?actividad=${actividad.id}`">Registrar</AppButton>
                <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrir(actividad)">Editar</AppButton>
                <AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar actividad" @click="eliminar(actividad)" />
              </td>
            </tr>
            <tr v-if="!cargando && !actividades.length"><td colspan="5" class="py-8 text-center text-slate-400">Sin actividades.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal :abierto="modal" :titulo="editando ? 'Editar actividad' : 'Nueva actividad'" ancho="sm" @cerrar="modal = false">
      <form id="form-actividad" class="grid gap-4 sm:grid-cols-2" @submit.prevent="guardar">
        <AppField label="Nombre" for="act-nombre" required :error="errores.nombre" class="sm:col-span-2">
          <input id="act-nombre" v-model="form.nombre" class="field-control" maxlength="150">
        </AppField>
        <AppField label="Fecha" for="act-fecha" required :error="errores.fecha" class="sm:col-span-2">
          <input id="act-fecha" v-model="form.fecha" type="date" class="field-control">
        </AppField>
        <AppField label="Hora de inicio" for="act-inicio" required :error="errores.horaInicio">
          <input id="act-inicio" v-model="form.horaInicio" type="time" class="field-control">
        </AppField>
        <AppField label="Hora de fin" for="act-fin" required :error="errores.horaFin ?? errores.body">
          <input id="act-fin" v-model="form.horaFin" type="time" class="field-control">
        </AppField>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-actividad" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
