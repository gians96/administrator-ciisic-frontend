<script setup lang="ts">
import type { Integracion, Respuesta } from '~/types/api'
import { fechaHoraLima } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'

const props = defineProps<{ eventoId: number }>()
const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()

const integraciones = ref<Integracion[]>([])
const cargando = ref(false)
const modal = ref(false)
const editando = ref<Integracion | null>(null)
const guardando = ref(false)
const probando = ref<number | null>(null)
const errores = ref<Record<string, string>>({})
const form = reactive({ nombre: '', urlBase: '', token: '', activo: true })

async function cargar() {
  cargando.value = true
  try {
    integraciones.value = (await api<Respuesta<Integracion[]>>(`events/${props.eventoId}/integrations`)).data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}
watch(() => props.eventoId, cargar, { immediate: true })

function abrir(integracion?: Integracion) {
  editando.value = integracion ?? null
  errores.value = {}
  Object.assign(form, { nombre: integracion?.nombre ?? '', urlBase: integracion?.urlBase ?? '', token: '', activo: integracion?.activo ?? true })
  modal.value = true
}

async function guardar() {
  guardando.value = true
  errores.value = {}
  const body: Record<string, unknown> = { nombre: form.nombre.trim(), urlBase: form.urlBase.trim(), activo: form.activo }
  if (form.token.trim()) body.token = form.token.trim()
  try {
    if (editando.value) await api(`integrations/${editando.value.id}`, { method: 'PUT', body })
    else await api(`events/${props.eventoId}/integrations`, { method: 'POST', body: { ...body, tipo: 'DEPORTES_FI' } })
    toast.exito('Integración guardada.')
    modal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function probar(integracion: Integracion) {
  probando.value = integracion.id
  try {
    const r = await api<Respuesta<{ ok: boolean, eventoRemoto?: { name: string }, error?: string }>>(`integrations/${integracion.id}/test`, { method: 'POST' })
    if (r.data.ok) toast.exito(`Conexión correcta: ${r.data.eventoRemoto?.name ?? 'evento remoto'}.`)
    else toast.error(`Falló la conexión: ${r.data.error}`)
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    probando.value = null
  }
}

async function eliminar(integracion: Integracion) {
  const ok = await confirmar({ titulo: 'Eliminar integración', mensaje: `¿Eliminar «${integracion.nombre}»? El token guardado se descarta.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    await api(`integrations/${integracion.id}`, { method: 'DELETE' })
    toast.exito('Integración eliminada.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="max-w-2xl text-sm text-slate-400">
        <p>Conecta los eventos de <strong class="text-slate-200">deportes-fi</strong> que forman parte de la Semana Sistémica para ver lo recaudado en el resumen.</p>
        <p class="mt-1">En deportes-fi: Eventos → «Tokens API» → generar token. Pega aquí la URL de su API (p. ej. <span class="font-mono">https://api.deportes-fi.undc.edu.pe/api/v1</span>) y el token.</p>
      </div>
      <AppButton icon="heroicons:plus" @click="abrir()">Conectar evento deportivo</AppButton>
    </div>

    <AppEmpty v-if="!cargando && !integraciones.length" titulo="Sin integraciones" icon="heroicons:link" />

    <article v-for="integracion in integraciones" :key="integracion.id" class="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-semibold text-white">{{ integracion.nombre }}</p>
          <AppBadge :tono="integracion.activo ? 'ok' : 'neutral'">{{ integracion.activo ? 'Activa' : 'Inactiva' }}</AppBadge>
          <AppBadge v-if="integracion.ultimoEstado" :tono="integracion.ultimoEstado === 'OK' ? 'ok' : 'error'">{{ integracion.ultimoEstado === 'OK' ? 'Conectada' : 'Con error' }}</AppBadge>
        </div>
        <p class="mt-1 truncate font-mono text-xs text-slate-400">{{ integracion.urlBase }} · token {{ integracion.tokenEnmascarado }}</p>
        <p v-if="integracion.ultimoError" class="mt-1 text-xs text-red-300">{{ integracion.ultimoError }}</p>
        <p v-else-if="integracion.ultimaSincronizacionEn" class="mt-1 text-xs text-slate-500">Última sincronización: {{ fechaHoraLima(integracion.ultimaSincronizacionEn) }}</p>
      </div>
      <div class="flex gap-2">
        <AppButton size="sm" variant="secondary" icon="heroicons:signal" :loading="probando === integracion.id" @click="probar(integracion)">Probar</AppButton>
        <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrir(integracion)">Editar</AppButton>
        <AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar integración" @click="eliminar(integracion)" />
      </div>
    </article>

    <AppModal :abierto="modal" :titulo="editando ? 'Editar integración' : 'Conectar evento deportivo'" @cerrar="modal = false">
      <form id="form-integracion" class="space-y-4" @submit.prevent="guardar">
        <AppField label="Nombre" for="int-nombre" required :error="errores.nombre">
          <input id="int-nombre" v-model="form.nombre" class="field-control" maxlength="120" placeholder="Juegos Semana Sistémica 2026">
        </AppField>
        <AppField label="URL base de la API de deportes-fi" for="int-url" required :error="errores.urlBase" hint="Debe usar https (http solo para localhost en desarrollo).">
          <input id="int-url" v-model="form.urlBase" class="field-control font-mono" maxlength="255" placeholder="https://api.deportes-fi.undc.edu.pe/api/v1">
        </AppField>
        <AppField label="Token del evento" for="int-token" :required="!editando" :error="errores.token" :hint="editando ? 'Déjalo vacío para conservar el token actual.' : 'Se guarda cifrado; solo se mostrarán sus últimos 4 caracteres.'">
          <input id="int-token" v-model="form.token" type="password" autocomplete="off" class="field-control font-mono" placeholder="dfi_…">
        </AppField>
        <AppSwitch v-model="form.activo" label="Activa" descripcion="Solo las integraciones activas suman en el resumen." />
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-integracion" :loading="guardando" :disabled="!editando && !form.token.trim()">Guardar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
