<script setup lang="ts">
import type { MensajeContacto, Meta, Respuesta } from '~/types/api'
import { fechaHoraLima } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'

definePageMeta({ permiso: 'mensajes.ver' })
useHead({ title: 'Mensajes · Panel CIISIC' })

const { api } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()

const mensajes = ref<MensajeContacto[]>([])
const meta = ref<Meta | null>(null)
const filtro = ref<'' | 'false' | 'true'>('false')
const abierto = ref<MensajeContacto | null>(null)

async function cargar(pagina = 1) {
  if (!eventos.seleccionadoId) return
  try {
    const r = await api<Respuesta<MensajeContacto[]>>(`events/${eventos.seleccionadoId}/contact-messages`, { query: { page: pagina, ...(filtro.value ? { leido: filtro.value } : {}) } })
    mensajes.value = r.data
    meta.value = r.meta ?? null
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
watch([() => eventos.seleccionadoId, filtro], () => cargar(), { immediate: true })

async function abrir(mensaje: MensajeContacto) {
  abierto.value = mensaje
  if (!mensaje.leido) {
    try {
      await api(`contact-messages/${mensaje.id}`, { method: 'PATCH', body: { leido: true } })
      mensaje.leido = true
    } catch { /* se reintenta al volver a abrir */ }
  }
}

async function eliminar(mensaje: MensajeContacto) {
  const ok = await confirmar({ titulo: 'Eliminar mensaje', mensaje: `¿Eliminar el mensaje de ${mensaje.nombres}?`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    await api(`contact-messages/${mensaje.id}`, { method: 'DELETE' })
    abierto.value = null
    await cargar(meta.value?.page ?? 1)
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Mensajes de contacto</h1>
      </div>
      <div>
        <label for="f-leido" class="sr-only">Filtro</label>
        <select id="f-leido" v-model="filtro" class="field-control">
          <option value="false">No leídos</option>
          <option value="true">Leídos</option>
          <option value="">Todos</option>
        </select>
      </div>
    </div>

    <section class="card divide-y divide-white/5 overflow-hidden">
      <button
        v-for="mensaje in mensajes"
        :key="mensaje.id"
        type="button"
        class="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
        @click="abrir(mensaje)"
      >
        <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="mensaje.leido ? 'bg-transparent' : 'bg-brand-400'" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-medium text-white" :class="mensaje.leido ? '' : 'font-semibold'">{{ mensaje.asunto }}</p>
            <p class="text-xs whitespace-nowrap text-slate-500">{{ fechaHoraLima(mensaje.creadoEn) }}</p>
          </div>
          <p class="text-sm text-slate-400">{{ mensaje.nombres }} {{ mensaje.apellidos }} · {{ mensaje.correo }}</p>
          <p class="mt-1 line-clamp-1 text-sm text-slate-500">{{ mensaje.mensaje }}</p>
        </div>
      </button>
      <AppEmpty v-if="!mensajes.length" titulo="Sin mensajes" icon="heroicons:envelope" />
    </section>
    <AppPagination :meta="meta" @cambiar="cargar" />

    <AppModal :abierto="abierto !== null" :titulo="abierto?.asunto ?? ''" :descripcion="abierto ? `${abierto.nombres} ${abierto.apellidos} · ${abierto.correo}` : undefined" @cerrar="abierto = null">
      <p class="text-xs text-slate-500">{{ fechaHoraLima(abierto?.creadoEn) }}</p>
      <p class="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-200">{{ abierto?.mensaje }}</p>
      <template #acciones>
        <AppButton v-if="auth.puede('mensajes.eliminar')" variant="danger" icon="heroicons:trash" @click="abierto && eliminar(abierto)">Eliminar</AppButton>
        <a v-if="abierto" :href="`mailto:${abierto.correo}?subject=${encodeURIComponent(`Re: ${abierto.asunto}`)}`" class="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-brand-300">
          <Icon name="heroicons:envelope" class="size-4" aria-hidden="true" /> Responder
        </a>
      </template>
    </AppModal>
  </div>
</template>
