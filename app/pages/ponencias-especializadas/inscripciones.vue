<script setup lang="ts">
import type { Meta, Respuesta } from '~/types/api'
import { fechaDia, fechaHoraLima, nombreCompleto, numero } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import {
  agruparPorDia,
  etiquetaMotivoCancelacion,
  etiquetaModalidad,
  etiquetaOrigen,
  etiquetaProcedencia,
  FILTROS_PONENCIA_VACIOS,
  filtrosPonenciaDesdeQuery,
  hayFiltros,
  MODALIDADES,
  parametrosPonencia,
  PROCEDENCIAS,
  rangoHorario,
  type FiltrosInscripcionesPonencia,
  type InscripcionPonencia,
  type PonenciaEspecializada,
} from '~/utils/ponenciasEspecializadas'

definePageMeta({ permiso: 'especializadas.ver' })
useHead({ title: 'Inscripciones a ponencias · Panel CIISIC' })

type MetaConAsistentes = Meta & { asistieron?: number }

const { api } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { confirmar } = useConfirm()

const filtros = reactive<FiltrosInscripcionesPonencia>(filtrosPonenciaDesdeQuery(route.query))
const filas = ref<InscripcionPonencia[]>([])
const meta = ref<MetaConAsistentes | null>(null)
const ponencias = ref<PonenciaEspecializada[]>([])
const cargando = ref(false)
const busqueda = ref(filtros.q)
const inscribirAbierto = ref(false)
const editando = ref<InscripcionPonencia | null>(null)
const procesando = ref<number | null>(null)

const puedeInscribir = computed(() => auth.puede('especializadas.inscribir'))
const puedeAsistencia = computed(() => auth.puede('especializadas.asistencia'))
const dias = computed(() => agruparPorDia(ponencias.value).map((d) => d.fecha))
const conFiltros = computed(() => hayFiltros(filtros))
/** Las ponencias que se ofrecen en el filtro: las del día elegido, si lo hay. */
const ponenciasDelFiltro = computed(() => agruparPorDia(ponencias.value).flatMap((d) => (!filtros.fecha || d.fecha === filtros.fecha ? d.ponencias : [])))

/** Respuestas que llegan tarde (otro evento u otros filtros) se descartan. */
let consultaFilas = 0
let consultaPonencias = 0

async function cargar() {
  const turno = ++consultaFilas
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    filas.value = []
    meta.value = null
    cargando.value = false
    return
  }
  cargando.value = true
  try {
    const respuesta = await api<Respuesta<InscripcionPonencia[]>>(`events/${eventoId}/specialized-talk-registrations`, { query: { ...parametrosPonencia(filtros), pageSize: 20 } })
    if (turno !== consultaFilas) return
    filas.value = respuesta.data
    meta.value = respuesta.meta ?? null
  } catch (error) {
    if (turno === consultaFilas) toast.error(mensajeError(error))
  } finally {
    if (turno === consultaFilas) cargando.value = false
  }
}

async function cargarPonencias() {
  const turno = ++consultaPonencias
  const eventoId = eventos.seleccionadoId
  ponencias.value = []
  if (!eventoId) return
  try {
    const lista = (await api<Respuesta<PonenciaEspecializada[]>>(`events/${eventoId}/specialized-talks`)).data
    if (turno === consultaPonencias) ponencias.value = lista
  } catch {
    // Sin la lista solo se pierde el filtro por ponencia y la inscripción manual
  }
}

function sincronizarUrl() {
  router.replace({ query: parametrosPonencia(filtros) })
}

function aplicar(pagina = 1) {
  filtros.page = pagina
  sincronizarUrl()
  cargar()
}

let temporizador: ReturnType<typeof setTimeout> | undefined
watch(busqueda, (valor) => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    filtros.q = valor.trim()
    aplicar()
  }, 350)
})

watch(() => [filtros.ponenciaId, filtros.fecha, filtros.modalidad, filtros.estado, filtros.asistencia, filtros.procedencia, filtros.origen], () => aplicar())

watch(() => eventos.seleccionadoId, (id, anterior) => {
  filas.value = []
  meta.value = null
  if (id && anterior) {
    Object.assign(filtros, { ponenciaId: '', fecha: '', page: 1 })
    sincronizarUrl()
  }
  cargarPonencias()
  cargar()
}, { immediate: true })

function limpiar() {
  busqueda.value = ''
  Object.assign(filtros, FILTROS_PONENCIA_VACIOS)
}

/** Al elegir otro día, la ponencia elegida deja de valer si es de otro día. */
function alCambiarDia() {
  const elegida = ponencias.value.find((p) => String(p.id) === filtros.ponenciaId)
  if (elegida && filtros.fecha && elegida.fecha !== filtros.fecha) filtros.ponenciaId = ''
}

async function recargarTodo() {
  await Promise.all([cargar(), cargarPonencias()])
}

async function alInscribir(inscripcion: InscripcionPonencia) {
  inscribirAbierto.value = false
  toast.exito(`Inscrito: ${nombreCompleto(inscripcion.asistente)} en «${inscripcion.ponencia.tema}».`)
  await recargarTodo()
}

async function alCorregir() {
  editando.value = null
  await cargar()
}

async function cambiarEstado(fila: InscripcionPonencia, estado: 'INSCRITO' | 'CANCELADO') {
  if (estado === 'CANCELADO') {
    const ok = await confirmar({
      titulo: 'Cancelar inscripción',
      mensaje: `¿Cancelar la inscripción de ${nombreCompleto(fila.asistente)} en «${fila.ponencia.tema}»? Se libera su cupo y puede reactivarse.`,
      textoConfirmar: 'Cancelar inscripción',
      peligro: true,
    })
    if (!ok) return
  }
  procesando.value = fila.id
  try {
    await api(`specialized-talk-registrations/${fila.id}`, { method: 'PATCH', body: { estado } })
    toast.exito(estado === 'CANCELADO' ? 'Inscripción cancelada.' : 'Inscripción reactivada.')
    await recargarTodo()
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    procesando.value = null
  }
}

async function anularAsistencia(fila: InscripcionPonencia) {
  const ok = await confirmar({
    titulo: 'Anular asistencia',
    mensaje: `¿Anular la asistencia de ${nombreCompleto(fila.asistente)} en «${fila.ponencia.tema}»? La inscripción sigue vigente.`,
    textoConfirmar: 'Anular asistencia',
    peligro: true,
  })
  if (!ok) return
  procesando.value = fila.id
  try {
    await api(`specialized-talk-registrations/${fila.id}/attendance`, { method: 'DELETE' })
    toast.exito('Asistencia anulada.')
    await recargarTodo()
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    procesando.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Inscripciones a ponencias</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Quienes se inscribieron desde la landing, a mano o en puerta. Cada persona se identifica por su documento; correo y celular son opcionales.
        </p>
      </div>
      <AppButton v-if="puedeInscribir && eventos.seleccionadoId" icon="heroicons:user-plus" :disabled="!ponencias.length" @click="inscribirAbierto = true">Inscribir manualmente</AppButton>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <section class="card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="relative md:col-span-2">
            <label for="pe-buscar" class="sr-only">Buscar</label>
            <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="pe-buscar" v-model="busqueda" type="search" class="field-control pl-9" placeholder="Documento, nombres, correo o celular">
          </div>
          <div>
            <label for="pe-dia" class="sr-only">Día</label>
            <select id="pe-dia" v-model="filtros.fecha" class="field-control" @change="alCambiarDia">
              <option value="">Todos los días</option>
              <option v-for="dia in dias" :key="dia" :value="dia">{{ fechaDia(dia) }}</option>
            </select>
          </div>
          <div>
            <label for="pe-ponencia" class="sr-only">Ponencia</label>
            <select id="pe-ponencia" v-model="filtros.ponenciaId" class="field-control">
              <option value="">Todas las ponencias</option>
              <option v-for="p in ponenciasDelFiltro" :key="p.id" :value="String(p.id)">{{ p.ambiente }} · {{ p.tema.length > 60 ? `${p.tema.slice(0, 60)}…` : p.tema }}</option>
            </select>
          </div>
          <div>
            <label for="pe-estado" class="sr-only">Estado</label>
            <select id="pe-estado" v-model="filtros.estado" class="field-control">
              <option value="">Inscritas y canceladas</option>
              <option value="INSCRITO">Inscritas</option>
              <option value="CANCELADO">Canceladas</option>
            </select>
          </div>
          <div>
            <label for="pe-asistencia" class="sr-only">Asistencia</label>
            <select id="pe-asistencia" v-model="filtros.asistencia" class="field-control">
              <option value="">Asistieron o no</option>
              <option value="si">Asistieron</option>
              <option value="no">Aún no asisten</option>
            </select>
          </div>
          <div>
            <label for="pe-procedencia" class="sr-only">Procedencia</label>
            <select id="pe-procedencia" v-model="filtros.procedencia" class="field-control">
              <option value="">Internos y externos</option>
              <option v-for="p in PROCEDENCIAS" :key="p.valor" :value="p.valor">{{ p.etiqueta }}</option>
              <option value="SIN_DATO">Sin dato</option>
            </select>
          </div>
          <div>
            <label for="pe-modalidad" class="sr-only">Modalidad</label>
            <select id="pe-modalidad" v-model="filtros.modalidad" class="field-control">
              <option value="">Presencial y virtual</option>
              <option v-for="m in MODALIDADES" :key="m.valor" :value="m.valor">{{ m.etiqueta }}</option>
            </select>
          </div>
          <div class="flex gap-3">
            <div class="min-w-0 flex-1">
              <label for="pe-origen" class="sr-only">Origen</label>
              <select id="pe-origen" v-model="filtros.origen" class="field-control">
                <option value="">Cualquier origen</option>
                <option value="LANDING">Landing</option>
                <option value="STAFF">Staff</option>
                <option value="PUERTA">En puerta</option>
              </select>
            </div>
            <AppButton variant="ghost" icon="heroicons:x-mark" :disabled="!conFiltros" @click="limpiar">Limpiar</AppButton>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div v-if="meta" class="flex flex-wrap gap-x-6 gap-y-1 border-b border-white/10 px-5 py-3 text-sm text-slate-400" aria-live="polite">
          <span><strong class="text-white tabular-nums">{{ numero(meta.total) }}</strong> inscripciones</span>
          <span><strong class="text-emerald-300 tabular-nums">{{ numero(meta.asistieron ?? 0) }}</strong> con asistencia</span>
        </div>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Ponencia</th>
                <th>Procedencia</th>
                <th>Inscripción</th>
                <th>Asistencia</th>
                <th><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filas" :key="fila.id" :class="{ 'opacity-60': fila.estado === 'CANCELADO' }">
                <td class="min-w-44">
                  <p class="font-medium text-white">{{ nombreCompleto(fila.asistente) }}</p>
                  <p class="font-mono text-xs text-slate-400">{{ fila.asistente.tipoDocumento.toUpperCase() }} {{ fila.asistente.numeroDocumento }}</p>
                  <p v-if="fila.asistente.correo || fila.asistente.celular" class="text-xs text-slate-500">{{ [fila.asistente.correo, fila.asistente.celular].filter(Boolean).join(' · ') }}</p>
                </td>
                <td class="max-w-xs">
                  <p class="text-white">{{ fila.ponencia.tema }}</p>
                  <p class="text-xs whitespace-nowrap text-slate-400">
                    {{ fechaDia(fila.ponencia.fecha) }} · {{ rangoHorario(fila.ponencia.horaInicio, fila.ponencia.horaFin) }} · {{ fila.ponencia.ambiente }}
                    <AppBadge v-if="fila.ponencia.modalidad === 'VIRTUAL'" tono="info" class="ml-1">{{ etiquetaModalidad(fila.ponencia.modalidad) }}</AppBadge>
                  </p>
                </td>
                <td><AppBadge :tono="fila.asistente.procedencia === 'INTERNO' ? 'brand' : 'neutral'">{{ etiquetaProcedencia(fila.asistente.procedencia) }}</AppBadge></td>
                <td>
                  <AppBadge :tono="fila.estado === 'INSCRITO' ? 'ok' : 'error'" :title="fila.estado === 'CANCELADO' ? etiquetaMotivoCancelacion(fila.motivoCancelacion) : undefined">
                    {{ fila.estado === 'INSCRITO' ? 'Inscrita' : 'Cancelada' }}
                  </AppBadge>
                  <p class="mt-0.5 text-xs whitespace-nowrap text-slate-500">{{ etiquetaOrigen(fila.origen) }} · {{ fechaHoraLima(fila.creadoEn) }}</p>
                  <p v-if="fila.estado === 'CANCELADO'" class="text-xs text-slate-500">{{ etiquetaMotivoCancelacion(fila.motivoCancelacion) }}</p>
                </td>
                <td>
                  <template v-if="fila.asistioEn">
                    <AppBadge tono="ok">Asistió</AppBadge>
                    <AppBadge v-if="fila.esFueraDeHorario" tono="warn" class="ml-1">Fuera de horario</AppBadge>
                    <p class="mt-0.5 text-xs whitespace-nowrap text-slate-500">{{ fechaHoraLima(fila.asistioEn) }}</p>
                  </template>
                  <span v-else class="text-slate-500">—</span>
                </td>
                <td class="text-right whitespace-nowrap">
                  <AppButton v-if="puedeInscribir" size="sm" variant="ghost" icon="heroicons:pencil-square" aria-label="Corregir datos de la persona" title="Corregir datos" @click="editando = fila" />
                  <AppButton v-if="puedeAsistencia && fila.asistioEn" size="sm" variant="ghost" icon="heroicons:arrow-uturn-left" :loading="procesando === fila.id" @click="anularAsistencia(fila)">Anular asistencia</AppButton>
                  <template v-if="puedeInscribir">
                    <AppButton v-if="fila.estado === 'INSCRITO' && !fila.asistioEn" size="sm" variant="ghost" icon="heroicons:x-circle" :loading="procesando === fila.id" @click="cambiarEstado(fila, 'CANCELADO')">Cancelar</AppButton>
                    <AppButton v-else-if="fila.estado === 'CANCELADO'" size="sm" variant="secondary" icon="heroicons:arrow-path" :loading="procesando === fila.id" @click="cambiarEstado(fila, 'INSCRITO')">Reactivar</AppButton>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="cargando && !filas.length" class="py-14 text-center text-sm text-slate-400">Cargando inscripciones…</div>
        <AppEmpty v-else-if="!filas.length" :titulo="conFiltros ? 'No hay inscripciones con estos filtros' : 'Aún no hay inscripciones'" icon="heroicons:clipboard-document-list" />
        <AppPagination :meta="meta" @cambiar="aplicar" />
      </section>
    </template>

    <InscribirManual :abierto="inscribirAbierto" :ponencias="ponencias" :ponencia-id="filtros.ponenciaId ? Number(filtros.ponenciaId) : null" @cerrar="inscribirAbierto = false" @inscrito="alInscribir" />
    <EditarAsistente :inscripcion="editando" @cerrar="editando = null" @guardada="alCorregir" />
  </div>
</template>
