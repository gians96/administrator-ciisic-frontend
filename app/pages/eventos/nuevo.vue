<script setup lang="ts">
import type { Evento, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'

definePageMeta({ permiso: 'eventos.configurar' })
useHead({ title: 'Nuevo evento · Panel CIISIC' })

const { api } = useApi()
const store = useEventoStore()
const toast = useToast()
const enviando = ref(false)
const errores = ref<Record<string, string>>({})

onMounted(() => store.cargar())

async function guardar(datos: Record<string, unknown>) {
  enviando.value = true
  errores.value = {}
  try {
    const creado = (await api<Respuesta<Evento>>('events', { method: 'POST', body: datos })).data
    toast.exito('Evento creado.')
    await store.cargar(true)
    store.seleccionar(creado.id)
    await navigateTo(`/eventos/${creado.id}?tab=tipos`)
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink to="/eventos" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <Icon name="heroicons:arrow-left" class="size-4" aria-hidden="true" /> Eventos
      </NuxtLink>
      <h1 class="mt-2 text-3xl font-extrabold">Nuevo evento</h1>
    </div>
    <section class="card p-6">
      <EventoForm :eventos-para-copiar="store.eventos" :enviando="enviando" :errores="errores" @guardar="guardar" />
    </section>
  </div>
</template>
