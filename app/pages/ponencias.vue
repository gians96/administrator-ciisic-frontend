<script setup lang="ts">
import type { Meta, Ponencia, Respuesta } from '~/types/api'
import { fechaHoraLima, tamanoArchivo } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'

useHead({ title: 'Ponencias · Panel CIISIC' })

const { api, urlArchivo } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const ponencias = ref<Ponencia[]>([])
const meta = ref<Meta | null>(null)
const cargando = ref(false)

async function cargar(pagina = 1) {
  if (!eventos.seleccionadoId) return
  cargando.value = true
  try {
    const r = await api<Respuesta<Ponencia[]>>(`events/${eventos.seleccionadoId}/papers`, { query: { page: pagina } })
    ponencias.value = r.data
    meta.value = r.meta ?? null
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}
watch(() => eventos.seleccionadoId, () => cargar(), { immediate: true })

const autor = (a: { firstName: string, lastName: string, university: string }) => `${a.firstName} ${a.lastName} (${a.university})`
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Ponencias</h1>
      <p class="mt-1 text-sm text-slate-400">Trabajos enviados desde el formulario «Call for Papers» de la landing.</p>
    </div>
    <section class="card overflow-hidden">
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Título</th><th>Autores</th><th>Archivo</th><th>Enviado</th><th><span class="sr-only">Descargar</span></th></tr></thead>
          <tbody>
            <tr v-for="ponencia in ponencias" :key="ponencia.id">
              <td class="max-w-md">
                <p class="font-medium text-white">{{ ponencia.titulo }}</p>
                <p class="font-mono text-xs text-slate-500">{{ ponencia.id }}</p>
              </td>
              <td class="text-sm">
                <p class="text-slate-200">{{ autor(ponencia.autorPrincipal) }}</p>
                <p v-for="(coautor, i) in ponencia.coautores" :key="i" class="text-xs text-slate-400">{{ autor(coautor) }}</p>
              </td>
              <td class="text-sm">{{ ponencia.archivoOriginal }}<p class="text-xs text-slate-500">{{ tamanoArchivo(ponencia.tamanoBytes) }}</p></td>
              <td class="text-sm whitespace-nowrap">{{ fechaHoraLima(ponencia.creadoEn) }}</td>
              <td class="text-right">
                <a :href="urlArchivo(`papers/${ponencia.id}/file`)" class="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white ring-1 ring-white/15 ring-inset hover:bg-white/10">
                  <Icon name="heroicons:arrow-down-tray" class="size-4" aria-hidden="true" /> PDF
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppEmpty v-if="!cargando && !ponencias.length" titulo="Aún no hay ponencias" icon="heroicons:document-text" />
      <AppPagination :meta="meta" @cambiar="cargar" />
    </section>
  </div>
</template>
