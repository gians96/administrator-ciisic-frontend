<script setup lang="ts">
import type { InscripcionFila, Meta, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { aParametros, FILTROS_VACIOS } from '~/utils/filtros'
import { fechaDia, fechaHoraLima, nombreCompleto, numero } from '~/utils/formato'
import { kitDe } from '~/utils/kit'
import {
  AVISO_BACKEND_SIN_FILTRO_KIT,
  AVISO_TABLERO_NO_DISPONIBLE,
  consultaDeVista,
  diaInicialDeEntregas,
  diasConEntregas,
  horaEnLimaKits,
  horasDelDia,
  hoyEnLimaKits,
  indicadoresKits,
  listaSinFiltrarPorKit,
  nombreEntregador,
  nombreFilaTipo,
  notaDeVista,
  porcentajeKits,
  tableroKitsDe,
  TITULO_VISTA,
  totalDelDia,
  VISTA_INICIAL,
  type TableroKits,
  type VistaKits,
} from '~/utils/kitsTablero'

/**
 * Entrega de kits (spec 035; backend 045): qué incluye el kit, cuántos corresponden, a quién le falta recibirlo y a quién ya se le
 * entregó. Las cifras vienen de `GET events/:id/kits/dashboard` (`asistencia.ver`, solo cifras); la lista de personas es la de
 * Inscripciones filtrada por `?kit=` y pide `inscripciones.ver`. El registro de la entrega es el de la spec 037 (escáner, Asistencia y
 * detalle): aquí también se entrega o se deshace desde la lista con `asistencia.marcar`. Se actualiza sola mientras la pestaña está a la
 * vista (en la puerta varias cuentas entregan a la vez).
 */
definePageMeta({ permiso: 'asistencia.ver' })
useHead({ title: 'Entrega de kits · Panel CIISIC' })

const INTERVALO_ACTUALIZACION_MS = 30_000

const { api, urlArchivo } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const { cambiar, enCurso } = useEntregaKit()

const tablero = ref<TableroKits | null>(null)
const cargandoTablero = ref(false)
const tableroNoDisponible = ref(false)
const actualizadoEn = ref<Date | null>(null)
const dia = ref<string | null>(null)

const vista = ref<VistaKits>(VISTA_INICIAL)
const tipoId = ref<number | null>(null)
const busqueda = ref('')
const pagina = ref(1)
const filas = ref<InscripcionFila[]>([])
const meta = ref<Meta | null>(null)
const cargandoLista = ref(false)
const listaSinFiltro = ref(false)
const seleccionada = ref<number | null>(null)

/** Ver a las personas pide `inscripciones.ver`; sin él solo se ven las cifras. */
const verLista = computed(() => auth.puede('inscripciones.ver'))
/** Entregar y deshacer lo hace quien marca asistencia (spec 037 del backend). */
const marcaKit = computed(() => auth.puede('asistencia.marcar'))
const conExportar = computed(() => auth.puede('inscripciones.exportar'))

const totales = computed(() => tablero.value?.totales ?? null)
const indicadores = computed(() => (totales.value ? indicadoresKits(totales.value) : []))
const avance = computed(() => (totales.value ? porcentajeKits(totales.value.entregados, totales.value.conKit) : 0))
const diasConEntrega = computed(() => diasConEntregas(tablero.value?.entregas ?? []))
const horas = computed(() => (dia.value ? horasDelDia(tablero.value?.entregas ?? [], dia.value) : { etiquetas: [], valores: [] }))
const entregadosHoy = computed(() => totalDelDia(tablero.value?.entregas ?? [], hoyEnLimaKits()))
const nota = computed(() => notaDeVista(vista.value, totales.value))
const nombreTipoElegido = computed(() => {
  if (tipoId.value === null) return ''
  const fila = tablero.value?.porTipo.find((item) => item.tipoInscripcionId === tipoId.value)
  return fila ? nombreFilaTipo(fila) : `Tipo #${tipoId.value}`
})

/** Lo que se pide al listado de inscripciones (y al CSV) para la vista, el tipo y la búsqueda de ahora. */
const parametrosLista = computed(() => {
  const consulta = consultaDeVista(vista.value)
  return aParametros({ ...FILTROS_VACIOS, kit: consulta.kit, estado: consulta.estado, tipoInscripcionId: tipoId.value === null ? '' : String(tipoId.value), q: busqueda.value.trim() }, false)
})

const exportarUrl = computed(() => {
  if (!eventos.seleccionadoId || !conExportar.value) return null
  const params = new URLSearchParams(parametrosLista.value).toString()
  return urlArchivo(`events/${eventos.seleccionadoId}/inscriptions/export${params ? `?${params}` : ''}`)
})

/** Respuestas que llegan tarde (otro evento u otros filtros) se descartan. */
let consultaTablero = 0
let consultaLista = 0

async function cargarTablero() {
  const actual = ++consultaTablero
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    tablero.value = null
    cargandoTablero.value = false
    return
  }
  cargandoTablero.value = true
  try {
    const datos = tableroKitsDe((await api<Respuesta<unknown>>(`events/${eventoId}/kits/dashboard`)).data)
    if (actual !== consultaTablero) return
    tableroNoDisponible.value = datos === null
    tablero.value = datos
    actualizadoEn.value = new Date()
    if (datos && (!dia.value || !diasConEntregas(datos.entregas).includes(dia.value))) dia.value = diaInicialDeEntregas(datos.entregas, hoyEnLimaKits())
  } catch (error) {
    if (actual !== consultaTablero) return
    const e = aErrorApi(error)
    // Un backend anterior a la spec 045 no tiene la ruta (un 404 que no es del evento)
    if (e.status === 404 && e.code !== 'EVENT_NOT_FOUND') {
      tableroNoDisponible.value = true
      tablero.value = null
    } else {
      toast.error(mensajeError(error))
    }
  } finally {
    if (actual === consultaTablero) cargandoTablero.value = false
  }
}

async function cargarLista() {
  const actual = ++consultaLista
  const eventoId = eventos.seleccionadoId
  if (!eventoId || !verLista.value || tableroNoDisponible.value) {
    filas.value = []
    meta.value = null
    cargandoLista.value = false
    return
  }
  cargandoLista.value = true
  try {
    const respuesta = await api<Respuesta<InscripcionFila[]>>(`events/${eventoId}/inscriptions`, { query: { ...parametrosLista.value, page: pagina.value, pageSize: 20 } })
    if (actual !== consultaLista) return
    filas.value = respuesta.data
    meta.value = respuesta.meta ?? null
    listaSinFiltro.value = listaSinFiltrarPorKit(consultaDeVista(vista.value).kit, filas.value)
  } catch (error) {
    if (actual === consultaLista) toast.error(mensajeError(error))
  } finally {
    if (actual === consultaLista) cargandoLista.value = false
  }
}

/** Vuelve a leer las cifras y la lista (la entrega cambia por la puerta, por esta pantalla o por el detalle). */
async function actualizar() {
  await cargarTablero()
  await cargarLista()
}

function irALaLista() {
  nextTick(() => document.getElementById('lista-kits')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function elegirVista(elegida: VistaKits) {
  vista.value = elegida
  irALaLista()
}

function elegirTipo(id: number | null) {
  tipoId.value = id
  if (id !== null) irALaLista()
}

function cambiarPagina(numeroPagina: number) {
  pagina.value = numeroPagina
  cargarLista()
}

async function cambiarKit(fila: InscripcionFila, entregar: boolean) {
  const hayQueLeer = await cambiar(fila.id, nombreCompleto(fila.participante), entregar, kitDe(fila.kit))
  if (hayQueLeer) await actualizar()
}

function alEliminar() {
  seleccionada.value = null
  actualizar()
}

// Al cambiar de evento se parte de cero; los cambios que eso provoca en la vista, el tipo y la búsqueda no recargan por su cuenta
let reiniciando = false

watch(() => eventos.seleccionadoId, () => {
  reiniciando = true
  tablero.value = null
  tableroNoDisponible.value = false
  filas.value = []
  meta.value = null
  dia.value = null
  vista.value = VISTA_INICIAL
  tipoId.value = null
  busqueda.value = ''
  pagina.value = 1
  nextTick(() => { reiniciando = false })
  actualizar()
}, { immediate: true })

watch([vista, tipoId], () => {
  if (reiniciando) return
  pagina.value = 1
  cargarLista()
})

let temporizadorBusqueda: ReturnType<typeof setTimeout> | undefined
watch(busqueda, () => {
  if (reiniciando) return
  clearTimeout(temporizadorBusqueda)
  temporizadorBusqueda = setTimeout(() => {
    pagina.value = 1
    cargarLista()
  }, 350)
})

let temporizadorActualizacion: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  temporizadorActualizacion = setInterval(() => {
    if (document.visibilityState === 'visible' && !cargandoTablero.value && enCurso.value === null) actualizar()
  }, INTERVALO_ACTUALIZACION_MS)
})
onBeforeUnmount(() => {
  clearInterval(temporizadorActualizacion)
  clearTimeout(temporizadorBusqueda)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Entrega de kits</h1>
        <p class="mt-1 text-sm text-slate-400">Qué incluye el kit, quién ya lo recibió y a quién le falta.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="actualizadoEn" class="text-xs text-slate-400" role="status">Actualizado a las {{ horaEnLimaKits(actualizadoEn) }} · se actualiza solo</span>
        <AppButton variant="secondary" icon="heroicons:arrow-path" :loading="cargandoTablero" @click="actualizar">Actualizar</AppButton>
      </div>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <section v-else-if="tableroNoDisponible" class="card" role="status">
      <AppEmpty titulo="El tablero aún no está disponible" icon="heroicons:wrench-screwdriver" :descripcion="AVISO_TABLERO_NO_DISPONIBLE" />
    </section>

    <div v-else-if="!tablero" class="card py-14 text-center text-sm text-slate-400" role="status">Cargando el tablero de kits…</div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiReporte
          v-for="indicador in indicadores"
          :key="indicador.vista"
          :etiqueta="indicador.etiqueta"
          :valor="numero(indicador.valor)"
          :detalle="indicador.detalle"
          :icon="indicador.icon"
          :tono="indicador.tono"
          :clicable="verLista"
          :activo="verLista && vista === indicador.vista"
          @elegir="elegirVista(indicador.vista)"
        />
      </div>

      <section class="card p-5" aria-labelledby="kits-avance">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kits-avance" class="text-sm font-semibold text-white">Avance de la entrega</h2>
          <p class="text-sm text-slate-300 tabular-nums">
            {{ numero(totales?.entregados) }} de {{ numero(totales?.conKit) }} · <span class="font-semibold text-white">{{ avance }} %</span>
          </p>
        </div>
        <div
          class="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          :aria-valuenow="avance"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Avance de la entrega de kits: ${avance} %`"
        >
          <div class="h-full rounded-full bg-emerald-400 transition-[width] duration-500" :style="{ width: `${avance}%` }" />
        </div>
        <p class="mt-2 text-xs text-slate-400">Entregados hoy (hora de Lima): {{ numero(entregadosHoy) }}</p>
      </section>

      <div class="grid gap-6 xl:grid-cols-5">
        <KitContenido class="xl:col-span-2" />
        <section class="card p-6 xl:col-span-3" aria-labelledby="kits-ritmo">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="kits-ritmo" class="text-lg font-bold">Entregas por hora</h2>
              <p class="mb-4 text-xs text-slate-400">{{ dia ? `${fechaDia(dia)} · ${numero(totalDelDia(tablero.entregas, dia))} kits (hora de Lima)` : 'Aún no se entregó ningún kit' }}</p>
            </div>
            <div v-if="diasConEntrega.length > 1">
              <label for="kits-dia" class="sr-only">Día</label>
              <select id="kits-dia" v-model="dia" class="field-control">
                <option v-for="fecha in diasConEntrega" :key="fecha" :value="fecha">{{ fechaDia(fecha) }} · {{ numero(totalDelDia(tablero.entregas, fecha)) }}</option>
              </select>
            </div>
          </div>
          <BarChart
            v-if="horas.etiquetas.length"
            :etiquetas="horas.etiquetas"
            :series="[{ label: 'Kits entregados', data: horas.valores, color: '#34d399' }]"
            descripcion="Gráfico de barras de los kits entregados por hora"
          />
          <AppEmpty v-else titulo="Sin entregas todavía" icon="heroicons:chart-bar" />
        </section>
      </div>

      <KitPorTipo :filas="tablero.porTipo" :tipo-activo="tipoId" :puede-elegir="verLista" @elegir="elegirTipo" />

      <section v-if="tablero.porPersona.length" class="card overflow-hidden" aria-labelledby="kits-quien">
        <header class="border-b border-white/10 px-6 py-4">
          <h2 id="kits-quien" class="text-lg font-bold">Quién entrega</h2>
          <p class="text-xs text-slate-400">Kits entregados por cada cuenta del equipo.</p>
        </header>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr><th>Persona</th><th class="text-right">Kits</th><th>Última entrega</th></tr>
            </thead>
            <tbody>
              <tr v-for="persona in tablero.porPersona" :key="persona.id ?? 'eliminada'">
                <td class="text-white">{{ nombreEntregador(persona) }}</td>
                <td class="text-right tabular-nums">{{ numero(persona.total) }}</td>
                <td class="text-xs whitespace-nowrap text-slate-400">{{ fechaHoraLima(persona.ultimaEn) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="verLista" id="lista-kits" class="card scroll-mt-4 overflow-hidden" aria-labelledby="kits-lista">
        <header class="space-y-3 border-b border-white/10 px-6 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="kits-lista" class="text-lg font-bold">{{ TITULO_VISTA[vista] }}</h2>
              <p v-if="meta" class="text-xs text-slate-400">{{ numero(meta.total) }} {{ meta.total === 1 ? 'inscripción' : 'inscripciones' }}</p>
            </div>
            <a
              v-if="exportarUrl"
              :href="exportarUrl"
              class="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/15 ring-inset transition hover:bg-white/10"
            >
              <Icon name="heroicons:arrow-down-tray" class="size-4" aria-hidden="true" /> Exportar esta lista (CSV)
            </a>
          </div>
          <p v-if="nota" class="text-xs text-slate-400">{{ nota }}</p>
          <div class="flex flex-wrap items-center gap-3">
            <div class="relative min-w-60 flex-1">
              <label for="kits-buscar" class="sr-only">Buscar</label>
              <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input id="kits-buscar" v-model="busqueda" type="search" class="field-control pl-9" placeholder="DNI, nombres o correo">
            </div>
            <button
              v-if="tipoId !== null"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-semibold text-brand-200 ring-1 ring-brand-400/30 ring-inset transition hover:bg-brand-500/25"
              :aria-label="`Quitar el filtro de tipo: ${nombreTipoElegido}`"
              @click="elegirTipo(null)"
            >
              {{ nombreTipoElegido }}
              <Icon name="heroicons:x-mark" class="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <p v-if="listaSinFiltro" class="border-b border-amber-400/25 bg-amber-500/10 px-6 py-3 text-sm text-amber-200" role="alert">{{ AVISO_BACKEND_SIN_FILTRO_KIT }}</p>
        <KitLista
          :filas="filas"
          :meta="meta"
          :cargando="cargandoLista"
          :con-acciones="marcaKit"
          :en-curso="enCurso"
          @abrir="seleccionada = $event"
          @entregar="cambiarKit($event, true)"
          @deshacer="cambiarKit($event, false)"
          @pagina="cambiarPagina"
        />
      </section>
      <p v-else class="card p-5 text-sm text-slate-400">
        Estas son las cifras del evento. Para ver quién tiene el kit pendiente o entregado hace falta el permiso «Ver inscritos» (pídelo a un Owner o a un Administrador del sistema).
      </p>
    </template>

    <InscripcionDetalle :inscripcion-id="seleccionada" @cerrar="seleccionada = null" @actualizada="actualizar" @eliminada="alEliminar" />
  </div>
</template>
