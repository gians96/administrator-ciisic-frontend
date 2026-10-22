<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { fechaDia, numero, soles } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import {
  agruparPorDia,
  duracionTexto,
  enlaceInscripciones,
  etiquetaModalidad,
  presenciales,
  rangoHorario,
  textoCupo,
  tonoCupo,
  type PonenciaEspecializada,
} from '~/utils/ponenciasEspecializadas'

definePageMeta({ permiso: ['especializadas.ver', 'especializadas.gestionar'] })
useHead({ title: 'Ponencias especializadas · Panel CIISIC' })

const { api } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()
const { accesoLibre, guardar: guardarAcceso } = useAccesoPonencias()

const ponencias = ref<PonenciaEspecializada[]>([])
const cargando = ref(false)
const formAbierto = ref(false)
const editando = ref<PonenciaEspecializada | null>(null)

const puedeGestionar = computed(() => auth.puede('especializadas.gestionar'))
const puedeVerInscritos = computed(() => auth.puede('especializadas.ver'))
const puedeAsistencia = computed(() => auth.puede('especializadas.asistencia'))

const dias = computed(() => agruparPorDia(ponencias.value))
const totales = computed(() => ({
  ponencias: ponencias.value.length,
  inscritos: ponencias.value.reduce((suma, p) => suma + p.inscritos, 0),
  virtuales: ponencias.value.reduce((suma, p) => suma + (p.inscritosVirtuales ?? 0), 0),
  asistentes: ponencias.value.reduce((suma, p) => suma + p.asistentes, 0),
  llenas: ponencias.value.filter((p) => p.cupo !== null && presenciales(p) >= p.cupo).length,
}))

/** Respuestas que llegan tarde (de otro evento) se descartan. */
let consulta = 0

async function cargar() {
  const turno = ++consulta
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    ponencias.value = []
    cargando.value = false
    return
  }
  cargando.value = true
  try {
    const respuesta = await api<Respuesta<PonenciaEspecializada[]>>(`events/${eventoId}/specialized-talks`)
    if (turno === consulta) ponencias.value = respuesta.data
  } catch (error) {
    if (turno === consulta) toast.error(mensajeError(error))
  } finally {
    if (turno === consulta) cargando.value = false
  }
}
watch(() => eventos.seleccionadoId, () => {
  ponencias.value = []
  cargar()
}, { immediate: true })

function abrir(ponencia: PonenciaEspecializada | null) {
  editando.value = ponencia
  formAbierto.value = true
}

async function alGuardar() {
  formAbierto.value = false
  await cargar()
}

async function eliminar(ponencia: PonenciaEspecializada) {
  const ok = await confirmar({
    titulo: 'Eliminar ponencia',
    mensaje: `¿Eliminar «${ponencia.tema}»? Solo es posible si no tiene inscritos vigentes; si los tiene, despublícala.`,
    textoConfirmar: 'Eliminar',
    peligro: true,
  })
  if (!ok) return
  try {
    await api(`specialized-talks/${ponencia.id}`, { method: 'DELETE' })
    toast.exito('Ponencia eliminada.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function publicar(ponencia: PonenciaEspecializada) {
  try {
    await api(`specialized-talks/${ponencia.id}`, { method: 'PUT', body: { publicada: !ponencia.publicada } })
    toast.exito(ponencia.publicada ? 'Ponencia despublicada.' : 'Ponencia publicada.')
    await cargar()
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
        <h1 class="mt-1 text-3xl font-extrabold">Ponencias especializadas</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Programa con ambiente, horario, duración, cupo y ponente. Las publicadas aparecen en la landing y se pueden reservar allí; las simultáneas no se pueden reservar juntas.
        </p>
      </div>
      <AppButton v-if="puedeGestionar && eventos.seleccionadoId" icon="heroicons:plus" @click="abrir(null)">Nueva ponencia</AppButton>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AppStat etiqueta="Ponencias" :valor="numero(totales.ponencias)" icon="heroicons:presentation-chart-bar" />
        <AppStat etiqueta="Inscritos vigentes" :valor="numero(totales.inscritos)" :detalle="totales.virtuales ? `${numero(totales.virtuales)} virtuales (sin aforo)` : undefined" icon="heroicons:clipboard-document-check" tono="info" />
        <AppStat etiqueta="Asistieron" :valor="numero(totales.asistentes)" icon="heroicons:check-circle" tono="ok" />
        <AppStat etiqueta="Con cupo lleno" :valor="numero(totales.llenas)" detalle="Aforo presencial" icon="heroicons:no-symbol" tono="warn" />
      </div>

      <AccesoPonenciasCard :acceso-libre="accesoLibre" :puede-cambiar="puedeGestionar" :guardar="guardarAcceso" />

      <div v-if="cargando && !ponencias.length" class="card py-14 text-center text-sm text-slate-400">Cargando ponencias…</div>
      <section v-else-if="!ponencias.length" class="card">
        <AppEmpty titulo="Aún no hay ponencias" descripcion="Crea la primera con «Nueva ponencia»." icon="heroicons:presentation-chart-bar" />
      </section>

      <section v-for="dia in dias" :key="dia.fecha" class="card overflow-hidden" :aria-labelledby="`dia-${dia.fecha}`">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
          <h2 :id="`dia-${dia.fecha}`" class="font-display text-lg font-semibold text-white">{{ fechaDia(dia.fecha) }}</h2>
          <p class="text-xs text-slate-400">{{ dia.ponencias.length }} ponencias</p>
        </div>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Horario</th>
                <th>Tema y ponente</th>
                <th>Ambiente</th>
                <th>Precio</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ponencia in dia.ponencias" :key="ponencia.id">
                <td class="whitespace-nowrap tabular-nums">
                  {{ rangoHorario(ponencia.horaInicio, ponencia.horaFin) }}
                  <p class="text-xs text-slate-500">{{ duracionTexto(ponencia.duracionMin) }}</p>
                </td>
                <td class="max-w-md">
                  <p class="font-medium text-white">{{ ponencia.tema }}</p>
                  <p class="text-xs text-slate-400">
                    {{ ponencia.ponente.nombre }}
                    <AppBadge v-if="ponencia.ponente.externo" tono="brand" class="ml-1">Externo</AppBadge>
                  </p>
                </td>
                <td class="whitespace-nowrap">
                  {{ ponencia.ambiente }}
                  <p><AppBadge :tono="ponencia.modalidad === 'VIRTUAL' ? 'info' : 'neutral'">{{ etiquetaModalidad(ponencia.modalidad) }}</AppBadge></p>
                </td>
                <td class="whitespace-nowrap">
                  <AppBadge v-if="ponencia.esGratuita" tono="ok">Gratuita</AppBadge>
                  <span v-else class="font-semibold text-white tabular-nums">{{ soles(ponencia.precio) }}</span>
                </td>
                <td class="whitespace-nowrap">
                  <AppBadge :tono="tonoCupo(ponencia)" :title="ponencia.cupo === null ? 'Sin límite de cupo' : `Quedan ${ponencia.cuposDisponibles} cupos presenciales; los virtuales no tienen límite`">
                    {{ textoCupo(ponencia) }}
                  </AppBadge>
                  <p class="mt-0.5 text-xs text-slate-500">{{ ponencia.asistentes }} asistieron</p>
                </td>
                <td>
                  <AppBadge :tono="ponencia.publicada ? 'ok' : 'warn'">{{ ponencia.publicada ? 'Publicada' : 'Sin publicar' }}</AppBadge>
                </td>
                <td class="text-right whitespace-nowrap">
                  <AppButton v-if="puedeVerInscritos" size="sm" variant="ghost" icon="heroicons:clipboard-document-list" :to="enlaceInscripciones(ponencia.id)">Inscritos</AppButton>
                  <AppButton v-if="puedeAsistencia" size="sm" variant="ghost" icon="heroicons:identification" :to="`/ponencias-especializadas/asistencia?ponencia=${ponencia.id}`">Puerta</AppButton>
                  <template v-if="puedeGestionar">
                    <AppButton size="sm" variant="ghost" :icon="ponencia.publicada ? 'heroicons:eye-slash' : 'heroicons:eye'" :aria-label="ponencia.publicada ? 'Despublicar' : 'Publicar'" :title="ponencia.publicada ? 'Despublicar' : 'Publicar'" @click="publicar(ponencia)" />
                    <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrir(ponencia)">Editar</AppButton>
                    <AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar ponencia" @click="eliminar(ponencia)" />
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <PonenciaForm :abierto="formAbierto" :evento-id="eventos.seleccionadoId" :ponencia="editando" @cerrar="formAbierto = false" @guardada="alGuardar" />
  </div>
</template>
