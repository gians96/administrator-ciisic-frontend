<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { fechaHoraLima, nombreCompleto, numero } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import { esNoDisponible } from '~/utils/portal'
import {
  alternarSeleccion,
  esSeleccionable,
  etiquetaModo,
  FILTROS_RESUMEN_VACIOS,
  filtrosResumenDesdeQuery,
  hayFiltrosResumen,
  MAXIMO_POR_ENVIO,
  parametrosResumen,
  rutaDescargaResumen,
  SITUACIONES_CONGRESO,
  situacionDeResumen,
  textoPuede,
  type FiltrosResumen,
  type MetaResumen,
  type ModoComunicado,
  type PersonaResumen,
} from '~/utils/ponenciasEspecializadas'

definePageMeta({ permiso: 'especializadas.ver' })
useHead({ title: 'Resumen de ponencias especializadas · Panel CIISIC' })

type RespuestaResumen = Omit<Respuesta<PersonaResumen[]>, 'meta'> & { meta?: MetaResumen }

const { api, descargar } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { accesoLibre } = useAccesoPonencias()

const filtros = reactive<FiltrosResumen>(filtrosResumenDesdeQuery(route.query))
const filas = ref<PersonaResumen[]>([])
const meta = ref<MetaResumen | null>(null)
const cargando = ref(false)
const noDisponible = ref(false)
const busqueda = ref(filtros.q)
const descargando = ref(false)
const seleccionando = ref(false)
/** Personas elegidas (también de otras páginas), por `asistenteId`. */
const seleccion = ref<Record<number, PersonaResumen>>({})
const modo = ref<ModoComunicado | null>(null)
const personasDelModal = ref<PersonaResumen[]>([])

const puedeInscribir = computed(() => auth.puede('especializadas.inscribir'))
const conFiltros = computed(() => hayFiltrosResumen(filtros))
const resumen = computed(() => meta.value?.resumen ?? null)
const libre = computed(() => meta.value?.accesoLibre ?? accesoLibre.value)
const seleccionables = computed(() => filas.value.filter(esSeleccionable))
const elegidas = computed(() => Object.values(seleccion.value))
const todasDePagina = computed(() => seleccionables.value.length > 0 && seleccionables.value.every((p) => seleccion.value[p.asistenteId]))
const excedeTope = computed(() => elegidas.value.length > MAXIMO_POR_ENVIO)

/** Respuestas que llegan tarde (otro evento u otros filtros) se descartan. */
let consulta = 0

async function cargar() {
  const turno = ++consulta
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    filas.value = []
    meta.value = null
    cargando.value = false
    return
  }
  cargando.value = true
  try {
    const respuesta = await api<RespuestaResumen>(`events/${eventoId}/specialized-talk-attendees`, { query: { ...parametrosResumen(filtros), pageSize: 20 } })
    if (turno !== consulta) return
    noDisponible.value = false
    filas.value = respuesta.data
    meta.value = respuesta.meta ?? null
  } catch (error) {
    if (turno !== consulta) return
    if (esNoDisponible(error)) {
      noDisponible.value = true
      filas.value = []
      meta.value = null
    } else {
      toast.error(mensajeError(error))
    }
  } finally {
    if (turno === consulta) cargando.value = false
  }
}

function sincronizarUrl() {
  router.replace({ query: parametrosResumen(filtros) })
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

watch(() => [filtros.situacion, filtros.puede, filtros.validacion, filtros.modo, filtros.aviso], () => aplicar())

watch(() => eventos.seleccionadoId, (id, anterior) => {
  filas.value = []
  meta.value = null
  seleccion.value = {}
  if (id && anterior) {
    filtros.page = 1
    sincronizarUrl()
  }
  cargar()
}, { immediate: true })

function limpiar() {
  busqueda.value = ''
  Object.assign(filtros, FILTROS_RESUMEN_VACIOS)
}

/** Los botones de situación alternan el filtro: volver a tocar el activo lo quita. */
function elegirSituacion(valor: string) {
  filtros.situacion = filtros.situacion === valor ? '' : valor
}

function alternar(persona: PersonaResumen, marcada: boolean) {
  seleccion.value = alternarSeleccion(seleccion.value, [persona], marcada)
}

function alternarPagina(marcada: boolean) {
  seleccion.value = alternarSeleccion(seleccion.value, seleccionables.value, marcada)
}

/** Elige a quienes hoy no pueden asistir según los filtros puestos (hasta el tope de un envío). */
async function seleccionarNoPueden() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || seleccionando.value) return
  seleccionando.value = true
  try {
    const respuesta = await api<RespuestaResumen>(`events/${eventoId}/specialized-talk-attendees`, {
      query: { ...parametrosResumen({ ...filtros, puede: 'no' }, false), pageSize: MAXIMO_POR_ENVIO },
    })
    const siguiente: Record<number, PersonaResumen> = {}
    for (const persona of respuesta.data) siguiente[persona.asistenteId] = persona
    seleccion.value = siguiente
    const total = respuesta.meta?.total ?? respuesta.data.length
    if (!respuesta.data.length) toast.info('Nadie con estos filtros está sin poder asistir.')
    else if (total > respuesta.data.length) toast.info(`Se eligieron las primeras ${numero(respuesta.data.length)} de ${numero(total)}. Al terminar, vuelve a elegir para seguir con el resto.`)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    seleccionando.value = false
  }
}

function abrir(nuevo: ModoComunicado) {
  if (!elegidas.value.length) return
  personasDelModal.value = elegidas.value.slice(0, MAXIMO_POR_ENVIO)
  modo.value = nuevo
}

async function alHecho() {
  seleccion.value = {}
  await cargar()
}

async function bajar() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId) return
  descargando.value = true
  try {
    await descargar(rutaDescargaResumen(eventoId, filtros), 'Resumen ponencias especializadas.xlsx')
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Resumen de ponencias especializadas</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Una fila por persona, sin importar a cuántas ponencias se inscribió: aquí ves si hoy está inscrita al congreso con el pago aprobado y por tanto quién puede estar inscrito y quién no.
          A quien no puede lo cancelas y le avisas por correo desde aquí.
        </p>
      </div>
      <AppButton variant="secondary" icon="heroicons:arrow-down-tray" :loading="descargando" :disabled="!eventos.seleccionadoId || noDisponible" @click="bajar">Descargar Excel</AppButton>
    </div>

    <AvisoAccesoLibre :activo="libre" />

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <section v-else-if="noDisponible" class="card">
      <AppEmpty titulo="Esta pantalla aún no está disponible" descripcion="El servidor todavía no tiene el resumen por persona. Se activa cuando se despliega la versión nueva del backend." icon="heroicons:clock" />
    </section>

    <template v-else>
      <section v-if="resumen" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Totales del evento">
        <AppStat etiqueta="Personas" :valor="numero(resumen.personas)" :detalle="`${numero(resumen.inscripciones)} inscripciones vigentes`" icon="heroicons:users" />
        <AppStat etiqueta="Pueden asistir" :valor="numero(resumen.pueden)" :detalle="libre ? 'Acceso libre: todas' : 'Congreso con pago aprobado'" icon="heroicons:check-badge" tono="ok" />
        <AppStat etiqueta="No pueden" :valor="numero(resumen.noPueden)" :detalle="libre ? 'Con acceso libre, nadie' : 'Sin pago aprobado al congreso'" icon="heroicons:no-symbol" tono="error" />
        <AppStat etiqueta="Sin validar" :valor="numero(resumen.sinValidar)" detalle="Entraron antes de la validación" icon="heroicons:shield-exclamation" tono="warn" />
        <AppStat etiqueta="Avisadas" :valor="numero(resumen.avisadas)" detalle="Ya recibieron el comunicado" icon="heroicons:envelope" tono="info" />
      </section>

      <section class="card p-4">
        <div v-if="resumen" class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Situación en el congreso">
          <button
            v-for="situacion in SITUACIONES_CONGRESO"
            :key="situacion.valor"
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 ring-inset transition"
            :class="filtros.situacion === situacion.valor ? 'bg-brand-500/15 text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
            :aria-pressed="filtros.situacion === situacion.valor"
            @click="elegirSituacion(situacion.valor)"
          >
            {{ situacion.etiqueta }}
            <strong class="tabular-nums" :class="situacion.tono === 'ok' ? 'text-emerald-300' : situacion.tono === 'warn' ? 'text-amber-300' : 'text-red-300'">{{ numero(resumen.porSituacion[situacion.valor] ?? 0) }}</strong>
          </button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="relative md:col-span-2">
            <label for="rs-buscar" class="sr-only">Buscar</label>
            <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="rs-buscar" v-model="busqueda" type="search" class="field-control pl-9" placeholder="Documento, nombres, correo o celular">
          </div>
          <div>
            <label for="rs-puede" class="sr-only">Puede asistir</label>
            <select id="rs-puede" v-model="filtros.puede" class="field-control">
              <option value="">Pueden y no pueden</option>
              <option value="si">Solo los que pueden</option>
              <option value="no">Solo los que no pueden</option>
            </select>
          </div>
          <div>
            <label for="rs-validacion" class="sr-only">Validación con el congreso</label>
            <select id="rs-validacion" v-model="filtros.validacion" class="field-control">
              <option value="">Validadas y sin validar</option>
              <option value="si">Validadas</option>
              <option value="no">Sin validar</option>
            </select>
          </div>
          <div>
            <label for="rs-modo" class="sr-only">Modo en el congreso</label>
            <select id="rs-modo" v-model="filtros.modo" class="field-control">
              <option value="">Presencial y virtual</option>
              <option value="PRESENCIAL">Congreso presencial</option>
              <option value="VIRTUAL">Congreso virtual</option>
            </select>
          </div>
          <div>
            <label for="rs-aviso" class="sr-only">Comunicado</label>
            <select id="rs-aviso" v-model="filtros.aviso" class="field-control">
              <option value="">Avisadas y sin avisar</option>
              <option value="si">Ya recibieron el comunicado</option>
              <option value="no">Aún sin comunicado</option>
            </select>
          </div>
          <div>
            <AppButton variant="ghost" icon="heroicons:x-mark" :disabled="!conFiltros" @click="limpiar">Limpiar filtros</AppButton>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm text-slate-400" aria-live="polite">
          <span v-if="meta"><strong class="text-white tabular-nums">{{ numero(meta.total) }}</strong> {{ meta.total === 1 ? 'persona' : 'personas' }}<template v-if="conFiltros"> con estos filtros</template></span>
          <span v-else />
          <div v-if="puedeInscribir && !libre" class="flex flex-wrap items-center gap-2">
            <template v-if="elegidas.length">
              <span class="text-slate-300"><strong class="text-white tabular-nums">{{ elegidas.length }}</strong> elegidas</span>
              <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" @click="seleccion = {}">Quitar</AppButton>
              <AppButton size="sm" variant="secondary" icon="heroicons:paper-airplane" @click="abrir('avisar')">Solo avisar</AppButton>
              <AppButton size="sm" variant="danger" icon="heroicons:x-circle" @click="abrir('cancelar')">Cancelar y avisar</AppButton>
            </template>
            <AppButton v-else size="sm" variant="secondary" icon="heroicons:check-circle" :loading="seleccionando" :disabled="!resumen?.noPueden" @click="seleccionarNoPueden">
              Elegir a todos los que no pueden
            </AppButton>
          </div>
        </div>
        <p v-if="excedeTope" class="border-b border-white/10 bg-amber-400/10 px-5 py-2 text-xs text-amber-100">
          Cada envío admite hasta {{ MAXIMO_POR_ENVIO }} personas: se usarán las primeras {{ MAXIMO_POR_ENVIO }} de las elegidas. Repite con el resto al terminar.
        </p>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th v-if="puedeInscribir && !libre" class="w-10">
                  <label class="sr-only" for="rs-todas">Elegir a quienes no pueden en esta página</label>
                  <input
                    id="rs-todas"
                    type="checkbox"
                    class="size-4 accent-brand-500"
                    :checked="todasDePagina"
                    :disabled="!seleccionables.length"
                    @change="alternarPagina(($event.target as HTMLInputElement).checked)"
                  >
                </th>
                <th>Persona</th>
                <th>Ponencias</th>
                <th>En el congreso</th>
                <th>¿Puede?</th>
                <th>Validación</th>
                <th>Comunicado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filas" :key="fila.asistenteId">
                <td v-if="puedeInscribir && !libre">
                  <label class="sr-only" :for="`rs-${fila.asistenteId}`">Elegir a {{ nombreCompleto(fila.asistente) }}</label>
                  <input
                    :id="`rs-${fila.asistenteId}`"
                    type="checkbox"
                    class="size-4 accent-brand-500 disabled:opacity-30"
                    :checked="Boolean(seleccion[fila.asistenteId])"
                    :disabled="!esSeleccionable(fila)"
                    :title="esSeleccionable(fila) ? undefined : 'Puede asistir: no se cancela ni se le avisa'"
                    @change="alternar(fila, ($event.target as HTMLInputElement).checked)"
                  >
                </td>
                <td class="min-w-44">
                  <p class="font-medium text-white">{{ nombreCompleto(fila.asistente) }}</p>
                  <p class="font-mono text-xs text-slate-400">{{ fila.asistente.tipoDocumento.toUpperCase() }} {{ fila.asistente.numeroDocumento }}</p>
                  <p v-if="fila.asistente.correo || fila.asistente.celular" class="text-xs text-slate-500">{{ [fila.asistente.correo, fila.asistente.celular].filter(Boolean).join(' · ') }}</p>
                  <p v-else class="text-xs text-amber-300">Sin correo ni celular</p>
                </td>
                <td class="whitespace-nowrap">
                  <p class="text-white tabular-nums">{{ fila.ponencias }}</p>
                  <NuxtLink v-if="fila.ponencias" :to="{ path: '/ponencias-especializadas/inscripciones', query: { q: fila.asistente.numeroDocumento, estado: 'INSCRITO' } }" class="text-xs text-brand-300 underline-offset-2 hover:underline">Ver inscripciones</NuxtLink>
                  <p v-if="fila.asistencias" class="text-xs text-emerald-300">{{ fila.asistencias }} con asistencia</p>
                </td>
                <td class="min-w-48">
                  <AppBadge :tono="situacionDeResumen(fila.situacion).tono" :title="situacionDeResumen(fila.situacion).detalle">{{ situacionDeResumen(fila.situacion).etiqueta }}</AppBadge>
                  <template v-if="fila.congreso">
                    <p class="mt-0.5 max-w-52 truncate text-xs text-slate-400" :title="[fila.congreso.tipo, fila.congreso.categoria].filter(Boolean).join(' · ')">
                      {{ etiquetaModo(fila.congreso.modo) }}<template v-if="fila.congreso.tipo"> · {{ fila.congreso.tipo }}</template>
                    </p>
                  </template>
                </td>
                <td class="whitespace-nowrap"><AppBadge :tono="fila.puede ? 'ok' : 'error'">{{ textoPuede(fila) }}</AppBadge></td>
                <td class="whitespace-nowrap">
                  <AppBadge :tono="fila.validada ? 'ok' : 'warn'" :title="fila.validada ? 'Se comprobó su inscripción aprobada al registrarse.' : 'Se inscribió sin comprobar su inscripción al congreso.'">{{ fila.validada ? 'Validada' : 'Sin validar' }}</AppBadge>
                </td>
                <td class="whitespace-nowrap">
                  <span v-if="fila.avisadoEn" class="text-xs text-slate-300">{{ fechaHoraLima(fila.avisadoEn) }}</span>
                  <span v-else class="text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="cargando && !filas.length" class="py-14 text-center text-sm text-slate-400">Cargando resumen…</div>
        <AppEmpty
          v-else-if="!filas.length"
          :titulo="conFiltros ? 'No hay personas con estos filtros' : 'Aún no hay personas inscritas a ponencias'"
          icon="heroicons:users"
        />
        <AppPagination :meta="meta" @cambiar="aplicar" />
      </section>
    </template>

    <ResumenComunicado
      v-if="modo"
      :abierto="Boolean(modo)"
      :modo="modo"
      :personas="personasDelModal"
      :evento="eventos.seleccionado?.nombre ?? null"
      @cerrar="modo = null"
      @hecho="alHecho"
    />
  </div>
</template>
