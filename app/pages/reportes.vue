<script setup lang="ts">
import type { AlumnoSeguimiento, AsesorRef, ConteosSituacion, EnlaceAsesor, Meta, Respuesta, ResumenSeguimiento } from '~/types/api'
import { estadoDelEnlace, haceCuanto, urlEnlaceDocente, urlWhatsapp } from '~/utils/enlacesDocentes'
import { fechaDia, fechaHoraLima, numero, soles } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import {
  FILTROS_REPORTE_VACIOS,
  aParametrosReporte,
  etiquetaSeccion,
  etiquetaTurno,
  filtrosActivos,
  filtrosReporteDesdeQuery,
  filtrosVigentes,
  nombreDeRespaldo,
  nombreSituacion,
  porcentaje,
  rutaDeDescarga,
  seccionesDelCiclo,
  tonoAvance,
  tonoSituacion,
  OPCIONES_SITUACION,
  type FiltrosReporte,
  type FormatoReporte,
} from '~/utils/reportes'

definePageMeta({ permiso: 'reportes.ver' })
useHead({ title: 'Reportes · Panel CIISIC' })

const TAMANO_PAGINA = 50

const { api, descargar } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const { copiar } = useCopiar()
const route = useRoute()
const router = useRouter()

const filtros = reactive<FiltrosReporte>(filtrosReporteDesdeQuery(route.query))
const vista = ref<string>(filtros.situacion || filtros.q || filtros.page > 1 ? 'alumnos' : 'secciones')
const busqueda = ref(filtros.q)

const resumen = ref<ResumenSeguimiento | null>(null)
const alumnos = ref<AlumnoSeguimiento[]>([])
const meta = ref<Meta | null>(null)
const enlaces = ref<EnlaceAsesor[]>([])
const cargandoResumen = ref(false)
const cargandoAlumnos = ref(false)
/** Mensaje si no se pudo leer el resumen y no hay datos previos que mostrar. */
const errorCarga = ref<string | null>(null)
const descargando = ref<string | null>(null)
const trabajandoEnlace = ref<number | null>(null)
const importando = ref(false)
const verEnlaces = ref(false)
const origen = ref('')
/** El listado de alumnos quedó viejo mientras se miraba otra pestaña: se vuelve a pedir al volver. */
let alumnosVencidos = true

onMounted(() => { origen.value = window.location.origin })

/** Sin `pagos.ver` el backend envía montos, fechas de pago y recaudado en `null`: se ocultan esas columnas. */
const conPagos = computed(() => resumen.value?.conPago ?? auth.puede('pagos.ver'))
const puedeExportar = computed(() => auth.puede('reportes.exportar'))
const puedeGestionar = computed(() => auth.puede('reportes.gestionar'))
const hayPadron = computed(() => resumen.value?.hayPadron ?? false)
const opciones = computed(() => resumen.value?.opciones ?? null)
const secciones = computed(() => seccionesDelCiclo(opciones.value, filtros.ciclo))
const hayFiltros = computed(() => filtrosActivos(filtros) > 0)
const asesorElegido = computed(() => opciones.value?.asesores.find((asesor) => String(asesor.id) === filtros.asesorId) ?? null)
const enlacePorAsesor = computed(() => new Map(enlaces.value.map((enlace) => [enlace.asesorId, enlace])))

/** Filtros puestos, como etiquetas que se pueden quitar de a una. */
const chips = computed(() => {
  const lista: Array<{ clave: keyof FiltrosReporte, texto: string }> = []
  if (filtros.asesorId) lista.push({ clave: 'asesorId', texto: asesorElegido.value?.nombre ?? 'Asesor' })
  if (filtros.ciclo) lista.push({ clave: 'ciclo', texto: `Ciclo ${filtros.ciclo}` })
  if (filtros.seccion) lista.push({ clave: 'seccion', texto: `Sección ${filtros.seccion}` })
  if (filtros.turno) lista.push({ clave: 'turno', texto: `Turno ${etiquetaTurno(filtros.turno)}` })
  if (filtros.situacion) lista.push({ clave: 'situacion', texto: OPCIONES_SITUACION.find((o) => o.codigo === filtros.situacion)?.nombre ?? filtros.situacion })
  if (filtros.q) lista.push({ clave: 'q', texto: `«${filtros.q}»` })
  return lista
})

const totales = computed(() => resumen.value?.totales ?? null)
const conteos = computed<ConteosSituacion>(() => ({
  todos: totales.value?.alumnos ?? 0,
  NO_PAGADO: totales.value?.noPagaron ?? 0,
  PAGADO: totales.value?.pagaron ?? 0,
  EN_REVISION: totales.value?.enRevision ?? 0,
  RECHAZADO: totales.value?.rechazados ?? 0,
  SIN_INSCRIPCION: totales.value?.sinInscripcion ?? 0,
}))

const COLOR_AVANCE = { ok: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300', neutral: 'text-slate-300' } as const
const colorAvance = computed(() => COLOR_AVANCE[tonoAvance(totales.value?.avance ?? 0, totales.value?.alumnos ?? 0)])

const PESTANAS = computed(() => [
  { id: 'secciones', label: `Por ciclo y sección${resumen.value ? ` (${resumen.value.porSeccion.length})` : ''}`, icon: 'heroicons:squares-2x2' },
  { id: 'asesores', label: `Por asesor${resumen.value ? ` (${resumen.value.porAsesor.length})` : ''}`, icon: 'heroicons:user-group' },
  { id: 'alumnos', label: `Alumnos${meta.value ? ` (${numero(meta.value.total)})` : ''}`, icon: 'heroicons:list-bullet' },
])

/** Respuestas que llegan tarde (otro evento u otros filtros) se descartan. */
let consultaResumen = 0
let consultaAlumnos = 0

async function cargarResumen() {
  const consulta = ++consultaResumen
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    resumen.value = null
    cargandoResumen.value = false
    return
  }
  cargandoResumen.value = true
  try {
    const respuesta = await api<Respuesta<ResumenSeguimiento>>(`events/${eventoId}/advisory/summary`, { query: aParametrosReporte(filtros, { soloAlcance: true }) })
    if (consulta !== consultaResumen) return
    resumen.value = respuesta.data
    errorCarga.value = null
    // Tras cargar otro padrón, un filtro de la URL puede apuntar a algo que ya no existe
    const vigentes = filtrosVigentes(filtros, respuesta.data.opciones)
    if (JSON.stringify(vigentes) !== JSON.stringify({ ...filtros })) Object.assign(filtros, vigentes)
  } catch (error) {
    if (consulta === consultaResumen) {
      errorCarga.value = mensajeError(error)
      toast.error(errorCarga.value)
    }
  } finally {
    if (consulta === consultaResumen) cargandoResumen.value = false
  }
}

async function cargarAlumnos() {
  const consulta = ++consultaAlumnos
  const eventoId = eventos.seleccionadoId
  alumnosVencidos = false
  if (!eventoId) {
    alumnos.value = []
    meta.value = null
    cargandoAlumnos.value = false
    return
  }
  cargandoAlumnos.value = true
  try {
    const respuesta = await api<Respuesta<AlumnoSeguimiento[]>>(`events/${eventoId}/advisory/students`, { query: { ...aParametrosReporte(filtros), pageSize: TAMANO_PAGINA } })
    if (consulta !== consultaAlumnos) return
    alumnos.value = respuesta.data
    meta.value = respuesta.meta ?? null
  } catch (error) {
    alumnosVencidos = true
    if (consulta === consultaAlumnos) toast.error(mensajeError(error))
  } finally {
    if (consulta === consultaAlumnos) cargandoAlumnos.value = false
  }
}

/** Los enlaces son credenciales: solo los lee quien gestiona el padrón. Si no se pueden leer, se ofrece crearlos. */
async function cargarEnlaces() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || !puedeGestionar.value || !hayPadron.value) {
    enlaces.value = []
    return
  }
  try {
    enlaces.value = (await api<Respuesta<EnlaceAsesor[]>>(`events/${eventoId}/advisory/links`)).data
  } catch {
    enlaces.value = []
  }
}

function sincronizarUrl() {
  router.replace({ query: aParametrosReporte(filtros) })
}

/** Vuelve a pedir lo que se está viendo; el resumen siempre, los alumnos solo si su pestaña está abierta. */
async function actualizar(conResumen = true) {
  const pedidos: Array<Promise<void>> = []
  if (conResumen) pedidos.push(cargarResumen().then(cargarEnlaces))
  if (vista.value === 'alumnos') pedidos.push(cargarAlumnos())
  else alumnosVencidos = true
  await Promise.all(pedidos)
}

watch(() => [filtros.asesorId, filtros.ciclo, filtros.seccion, filtros.turno], (nuevos, anteriores) => {
  // Al cambiar de ciclo, la sección elegida deja de valer si no existe en el ciclo nuevo
  if (nuevos[1] !== anteriores[1] && filtros.seccion && !secciones.value.includes(filtros.seccion)) filtros.seccion = ''
  filtros.page = 1
  sincronizarUrl()
  actualizar()
})

watch(() => filtros.situacion, () => {
  filtros.page = 1
  sincronizarUrl()
  actualizar(false)
})

let temporizador: ReturnType<typeof setTimeout> | undefined
watch(busqueda, (valor) => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    filtros.q = valor.trim()
    filtros.page = 1
    sincronizarUrl()
    actualizar(false)
  }, 350)
})
onBeforeUnmount(() => clearTimeout(temporizador))

watch(vista, (nueva) => {
  if (nueva === 'alumnos' && (alumnosVencidos || !meta.value)) cargarAlumnos()
})

watch(() => eventos.seleccionadoId, (id, anterior) => {
  resumen.value = null
  errorCarga.value = null
  alumnos.value = []
  meta.value = null
  enlaces.value = []
  alumnosVencidos = true
  if (id && anterior) {
    Object.assign(filtros, FILTROS_REPORTE_VACIOS)
    busqueda.value = ''
    sincronizarUrl()
  }
  actualizar()
}, { immediate: true })

function cambiarPagina(pagina: number) {
  filtros.page = pagina
  sincronizarUrl()
  cargarAlumnos()
}

function limpiar() {
  clearTimeout(temporizador)
  busqueda.value = ''
  Object.assign(filtros, FILTROS_REPORTE_VACIOS)
}

/** Quita un solo filtro (la etiqueta que se pulsó). */
function quitarFiltro(clave: keyof FiltrosReporte) {
  if (clave === 'q') busqueda.value = ''
  else (filtros as Record<string, unknown>)[clave] = ''
}

/** Lleva al listado de alumnos con los cambios de filtros pedidos; lo demás del alcance se conserva. */
function verAlumnos(cambios: Partial<FiltrosReporte>) {
  Object.assign(filtros, { q: '', ...cambios })
  busqueda.value = ''
  vista.value = 'alumnos'
}

async function bajar(formato: FormatoReporte, asesor?: AsesorRef) {
  const eventoId = eventos.seleccionadoId
  if (!eventoId) return
  descargando.value = `${asesor?.id ?? 'general'}:${formato}`
  try {
    // El reporte de un asesor es siempre el suyo completo; el general respeta los filtros puestos
    const aplicados: FiltrosReporte = asesor ? { ...FILTROS_REPORTE_VACIOS, asesorId: String(asesor.id) } : filtros
    await descargar(rutaDeDescarga(eventoId, formato, aplicados), nombreDeRespaldo(formato, asesor?.nombre ?? asesorElegido.value?.nombre))
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    descargando.value = null
  }
}

/** Copia el enlace del docente; si aún no tiene, lo crea primero (un solo clic). */
async function copiarEnlaceDe(asesor: { id: number, nombre: string }) {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || trabajandoEnlace.value !== null) return
  trabajandoEnlace.value = asesor.id
  try {
    let enlace = enlacePorAsesor.value.get(asesor.id)
    if (!enlace?.token) {
      enlaces.value = (await api<Respuesta<EnlaceAsesor[]>>(`events/${eventoId}/advisory/links`, { method: 'POST', body: { asesorIds: [asesor.id] } })).data
      enlace = enlacePorAsesor.value.get(asesor.id)
    }
    if (!enlace?.token) throw new Error('No se pudo crear el enlace')
    if (await copiar(urlEnlaceDocente(origen.value, enlace.token))) toast.exito(`Enlace de ${asesor.nombre} copiado.`)
    else toast.error('Tu navegador no permitió copiar. Abre «Enlaces de los docentes» y cópialo desde ahí.')
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    trabajandoEnlace.value = null
  }
}

function alImportar() {
  Object.assign(filtros, FILTROS_REPORTE_VACIOS)
  busqueda.value = ''
  alumnosVencidos = true
  sincronizarUrl()
  actualizar()
}

const sinEnlaces = computed(() => enlaces.value.filter((enlace) => !enlace.token).length)
</script>

<template>
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-extrabold">Reportes</h1>
          <AppBadge v-if="resumen?.semestre" tono="brand">Semestre {{ resumen.semestre }}</AppBadge>
        </div>
        <p class="mt-1 text-sm text-slate-400">
          Cómo van los estudiantes de cada asesor, con las inscripciones de este momento.
          <span v-if="resumen" class="whitespace-nowrap">Actualizado: {{ fechaHoraLima(resumen.generadoEn) }}</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AppButton variant="secondary" icon="heroicons:arrow-path" :loading="cargandoResumen" @click="actualizar()">Actualizar</AppButton>
        <AppMenu v-if="puedeExportar && hayPadron" etiqueta="Descargar" icon="heroicons:arrow-down-tray" :loading="descargando?.startsWith('general') ?? false">
          <AppMenuItem icon="heroicons:table-cells" :disabled="descargando !== null" @click="bajar('xlsx')">Excel (.xlsx)</AppMenuItem>
          <AppMenuItem icon="heroicons:document-text" :disabled="descargando !== null" @click="bajar('pdf')">PDF</AppMenuItem>
        </AppMenu>
        <AppMenu v-if="puedeGestionar" etiqueta="Padrón y enlaces" icon="heroicons:cog-6-tooth">
          <AppMenuItem v-if="hayPadron" icon="heroicons:link" @click="verEnlaces = true">
            Enlaces de los docentes
            <span v-if="sinEnlaces" class="ml-auto rounded-full bg-amber-400/20 px-1.5 text-xs text-amber-200 tabular-nums">{{ sinEnlaces }} sin enlace</span>
          </AppMenuItem>
          <AppMenuItem icon="heroicons:arrow-up-tray" @click="importando = true">{{ hayPadron ? 'Actualizar padrón' : 'Cargar padrón' }}</AppMenuItem>
        </AppMenu>
      </div>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <!-- Sin padrón -->
      <section v-if="resumen && !hayPadron" class="card">
        <AppEmpty
          titulo="Aún no hay padrón de estudiantes"
          descripcion="Los reportes comparan a los estudiantes de la facultad con sus inscripciones. Carga el Excel de la facultad (hojas «ESTUDIANTES …» y «RESUMEN») para empezar."
          icon="heroicons:academic-cap"
        >
          <AppButton v-if="puedeGestionar" icon="heroicons:arrow-up-tray" @click="importando = true">Cargar padrón</AppButton>
          <p v-else class="text-sm text-slate-400">Pide a un Owner o a un Administrador del sistema que cargue el padrón.</p>
        </AppEmpty>
      </section>

      <!-- Error al cargar -->
      <section v-else-if="!resumen && errorCarga" class="card">
        <AppEmpty titulo="No se pudieron cargar los reportes" :descripcion="errorCarga" icon="heroicons:exclamation-triangle">
          <AppButton variant="secondary" icon="heroicons:arrow-path" :loading="cargandoResumen" @click="actualizar()">Reintentar</AppButton>
        </AppEmpty>
      </section>

      <!-- Cargando: esqueleto con la forma de la pantalla -->
      <div v-else-if="!resumen" class="space-y-6" role="status" aria-label="Cargando reportes">
        <div class="h-24 animate-pulse rounded-2xl bg-white/5" />
        <div class="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2.2fr)]">
          <div class="h-44 animate-pulse rounded-2xl bg-white/5" />
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div v-for="n in 6" :key="n" class="h-20 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
        <div class="h-72 animate-pulse rounded-2xl bg-white/5" />
      </div>

      <template v-else>
        <!-- Filtros -->
        <section class="card p-4" aria-label="Filtros">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <label for="f-asesor" class="sr-only">Asesor</label>
              <select id="f-asesor" v-model="filtros.asesorId" class="field-control">
                <option value="">Todos los asesores</option>
                <option v-for="asesor in opciones?.asesores" :key="asesor.id" :value="String(asesor.id)">{{ asesor.nombre }}</option>
              </select>
            </div>
            <div>
              <label for="f-ciclo" class="sr-only">Ciclo</label>
              <select id="f-ciclo" v-model="filtros.ciclo" class="field-control">
                <option value="">Todos los ciclos</option>
                <option v-for="ciclo in opciones?.ciclos" :key="ciclo" :value="ciclo">Ciclo {{ ciclo }}</option>
              </select>
            </div>
            <div>
              <label for="f-seccion" class="sr-only">Sección</label>
              <select id="f-seccion" v-model="filtros.seccion" class="field-control">
                <option value="">Todas las secciones</option>
                <option v-for="seccion in secciones" :key="seccion" :value="seccion">Sección {{ seccion }}</option>
              </select>
            </div>
            <div>
              <label for="f-turno" class="sr-only">Turno</label>
              <select id="f-turno" v-model="filtros.turno" class="field-control">
                <option value="">Todos los turnos</option>
                <option v-for="turno in opciones?.turnos" :key="turno" :value="turno">Turno {{ etiquetaTurno(turno) }}</option>
              </select>
            </div>
          </div>
          <div v-if="hayFiltros" class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-xs text-slate-400">Filtros:</span>
            <button
              v-for="chip in chips"
              :key="chip.clave"
              type="button"
              class="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-100 ring-1 ring-brand-400/30 transition ring-inset hover:bg-brand-500/20"
              :aria-label="`Quitar el filtro ${chip.texto}`"
              @click="quitarFiltro(chip.clave)"
            >
              <span class="truncate">{{ chip.texto }}</span>
              <Icon name="heroicons:x-mark" class="size-3.5 shrink-0 opacity-70 group-hover:opacity-100" aria-hidden="true" />
            </button>
            <button type="button" class="ml-1 text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline" @click="limpiar">Quitar todos</button>
          </div>
        </section>

        <!-- Avance e indicadores -->
        <div v-if="totales" class="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2.2fr)]">
          <section class="card flex flex-col justify-between gap-4 p-5" aria-label="Avance de los pagos">
            <div>
              <p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Avance de pagos</p>
              <p class="mt-2 font-display text-5xl leading-none font-extrabold tabular-nums" :class="colorAvance">{{ porcentaje(totales.avance) }}</p>
              <p class="mt-2 text-sm text-slate-300">
                <strong class="text-white tabular-nums">{{ numero(totales.pagaron) }}</strong> de <span class="tabular-nums">{{ numero(totales.alumnos) }}</span> alumnos pagaron
              </p>
              <p v-if="resumen.alumnosSinAsesor" class="mt-1 text-xs text-amber-300">{{ numero(resumen.alumnosSinAsesor) }} sin asesor asignado</p>
            </div>
            <div>
              <BarraAvance :contadores="totales" class="h-3!" />
              <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-emerald-400" /> Pagó</li>
                <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-amber-400" /> En revisión</li>
                <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-red-400" /> Rechazado</li>
                <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-slate-600" /> Sin inscripción</li>
              </ul>
            </div>
          </section>

          <section class="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Alumnos por situación (pulsa uno para ver la lista)">
            <KpiReporte etiqueta="Alumnos" :valor="numero(totales.alumnos)" icon="heroicons:academic-cap" tono="brand" clicable :activo="vista === 'alumnos' && !filtros.situacion" :detalle="hayFiltros ? 'Con los filtros' : 'Todo el padrón'" @elegir="verAlumnos({ situacion: '' })" />
            <KpiReporte etiqueta="Pagaron" :valor="numero(totales.pagaron)" icon="heroicons:check-badge" tono="ok" clicable :activo="vista === 'alumnos' && filtros.situacion === 'PAGADO'" detalle="Inscripción aprobada" @elegir="verAlumnos({ situacion: 'PAGADO' })" />
            <KpiReporte etiqueta="En revisión" :valor="numero(totales.enRevision)" icon="heroicons:clock" tono="warn" clicable :activo="vista === 'alumnos' && filtros.situacion === 'EN_REVISION'" detalle="Voucher sin validar" @elegir="verAlumnos({ situacion: 'EN_REVISION' })" />
            <KpiReporte etiqueta="Rechazados" :valor="numero(totales.rechazados)" icon="heroicons:x-circle" tono="error" clicable :activo="vista === 'alumnos' && filtros.situacion === 'RECHAZADO'" detalle="Rechazados o cancelados" @elegir="verAlumnos({ situacion: 'RECHAZADO' })" />
            <KpiReporte etiqueta="Sin inscripción" :valor="numero(totales.sinInscripcion)" icon="heroicons:user-minus" tono="neutral" clicable :activo="vista === 'alumnos' && filtros.situacion === 'SIN_INSCRIPCION'" detalle="Aún no se inscriben" @elegir="verAlumnos({ situacion: 'SIN_INSCRIPCION' })" />
            <KpiReporte v-if="conPagos" etiqueta="Recaudado" :valor="soles(totales.recaudado)" icon="heroicons:banknotes" tono="info" detalle="Solo lo aprobado" />
          </section>
        </div>

        <AppTabs v-model="vista" :tabs="PESTANAS" />

        <!-- Por ciclo y sección -->
        <section v-if="vista === 'secciones'" id="panel-secciones" role="tabpanel" aria-labelledby="tab-secciones" class="card overflow-hidden">
          <div class="relative overflow-x-auto">
            <table class="table-base">
              <thead>
                <tr>
                  <th>Ciclo · sección</th>
                  <th>Asesores</th>
                  <CabeceraContadores :con-pago="conPagos" />
                  <th><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fila in resumen.porSeccion" :key="`${fila.ciclo}-${fila.seccion}`">
                  <td class="whitespace-nowrap">
                    <p class="font-semibold text-white">{{ etiquetaSeccion(fila.ciclo, fila.seccion) }}</p>
                    <p v-if="fila.turnos.length" class="text-xs text-slate-400">{{ fila.turnos.map(etiquetaTurno).join(', ') }}</p>
                  </td>
                  <td class="min-w-56 text-xs">
                    <p v-for="asesor in fila.asesores" :key="asesor.id" class="text-slate-300">{{ asesor.nombre }}</p>
                    <p v-if="!fila.asesores.length" class="text-amber-300">Sin asesor</p>
                  </td>
                  <CeldasContadores :contadores="fila" :con-pago="conPagos" />
                  <td class="text-right">
                    <AppButton size="sm" variant="secondary" icon="heroicons:eye" @click="verAlumnos({ ciclo: fila.ciclo, seccion: fila.seccion, situacion: '' })">Alumnos</AppButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <AppEmpty v-if="!resumen.porSeccion.length" titulo="No hay secciones con estos filtros" icon="heroicons:squares-2x2" />
        </section>

        <!-- Por asesor -->
        <section v-else-if="vista === 'asesores'" id="panel-asesores" role="tabpanel" aria-labelledby="tab-asesores" class="card overflow-hidden">
          <div class="relative overflow-x-auto">
            <table class="table-base">
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Ciclos y secciones</th>
                  <CabeceraContadores :con-pago="conPagos" />
                  <th><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fila in resumen.porAsesor" :key="fila.id">
                  <td class="min-w-56">
                    <p class="font-semibold text-white">{{ fila.nombre }}</p>
                    <p v-if="puedeGestionar && enlacePorAsesor.has(fila.id)" class="mt-0.5 text-xs text-slate-400">
                      <template v-if="estadoDelEnlace(enlacePorAsesor.get(fila.id)) === 'SIN_ENLACE'">Sin enlace para el docente</template>
                      <template v-else-if="estadoDelEnlace(enlacePorAsesor.get(fila.id)) === 'SIN_ABRIR'">Enlace creado · aún no lo abre</template>
                      <template v-else>Abrió su enlace {{ haceCuanto(enlacePorAsesor.get(fila.id)?.ultimoAcceso) }}</template>
                    </p>
                  </td>
                  <td class="min-w-40 text-xs text-slate-300">{{ fila.secciones.map((s) => etiquetaSeccion(s.ciclo, s.seccion)).join(', ') }}</td>
                  <CeldasContadores :contadores="fila" :con-pago="conPagos" />
                  <td class="text-right whitespace-nowrap">
                    <div class="flex justify-end gap-2">
                      <AppButton size="sm" variant="secondary" icon="heroicons:eye" @click="verAlumnos({ asesorId: String(fila.id), situacion: '' })">Alumnos</AppButton>
                      <AppButton
                        v-if="puedeGestionar"
                        size="sm"
                        variant="secondary"
                        icon="heroicons:link"
                        :loading="trabajandoEnlace === fila.id"
                        :disabled="trabajandoEnlace !== null"
                        :aria-label="`${enlacePorAsesor.get(fila.id)?.token ? 'Copiar' : 'Crear y copiar'} el enlace de ${fila.nombre}`"
                        @click="copiarEnlaceDe(fila)"
                      >
                        {{ enlacePorAsesor.get(fila.id)?.token ? 'Enlace' : 'Crear enlace' }}
                      </AppButton>
                      <AppMenu v-if="puedeExportar" etiqueta="Descargar" size="sm" :loading="descargando?.startsWith(`${fila.id}:`) ?? false" :aria-label="`Descargar el reporte de ${fila.nombre}`">
                        <AppMenuItem icon="heroicons:table-cells" :disabled="descargando !== null" @click="bajar('xlsx', { id: fila.id, nombre: fila.nombre })">Excel (.xlsx)</AppMenuItem>
                        <AppMenuItem icon="heroicons:document-text" :disabled="descargando !== null" @click="bajar('pdf', { id: fila.id, nombre: fila.nombre })">PDF</AppMenuItem>
                      </AppMenu>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <AppEmpty v-if="!resumen.porAsesor.length" titulo="No hay asesores con estos filtros" icon="heroicons:user-group" />
          <p class="border-t border-white/10 px-4 py-3 text-xs text-slate-400">
            Un alumno cuenta una vez por cada uno de sus asesores. La descarga de un docente es su reporte completo (todas sus secciones), sin importar los filtros.
            <template v-if="puedeGestionar"> «Enlace» copia el enlace personal del docente (lo crea si aún no tiene).</template>
          </p>
        </section>

        <!-- Alumnos -->
        <section v-else id="panel-alumnos" role="tabpanel" aria-labelledby="tab-alumnos" class="space-y-4">
          <div class="card space-y-3 p-4">
            <FiltroSituacion v-model="filtros.situacion" :conteos="conteos" />
            <div class="relative">
              <label for="buscar" class="sr-only">Buscar alumno</label>
              <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input id="buscar" v-model="busqueda" type="search" class="field-control pl-9" placeholder="Buscar por nombre, código, DNI o correo">
            </div>
          </div>

          <div class="relative" :class="cargandoAlumnos && alumnos.length ? 'opacity-60 transition-opacity' : ''" aria-live="polite">
            <!-- Cargando la primera página -->
            <div v-if="cargandoAlumnos && !alumnos.length" class="space-y-2" role="status" aria-label="Cargando alumnos">
              <div v-for="n in 6" :key="n" class="h-16 animate-pulse rounded-2xl bg-white/5" />
            </div>
            <AppEmpty v-else-if="!alumnos.length" class="card" titulo="No hay alumnos con estos filtros" descripcion="Prueba con otra situación o quita la búsqueda." icon="heroicons:academic-cap" />

            <template v-else>
              <!-- Escritorio -->
              <div class="card hidden overflow-hidden md:block">
                <div class="relative overflow-x-auto">
                  <table class="table-base">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Sección</th>
                        <th>Contacto</th>
                        <th>Asesores</th>
                        <th>Situación</th>
                        <th v-if="conPagos" class="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="alumno in alumnos" :key="alumno.id">
                        <td class="min-w-56">
                          <p class="font-medium text-white">{{ alumno.nombre }}</p>
                          <p class="text-xs text-slate-400 tabular-nums">{{ alumno.codigo }} · DNI {{ alumno.documento }}</p>
                        </td>
                        <td class="whitespace-nowrap">
                          <p class="font-semibold text-white">{{ etiquetaSeccion(alumno.ciclo, alumno.seccion) }}</p>
                          <p class="text-xs text-slate-400">{{ etiquetaTurno(alumno.turno) }}</p>
                        </td>
                        <td class="text-xs">
                          <a v-if="urlWhatsapp(alumno.celular)" :href="urlWhatsapp(alumno.celular) ?? undefined" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200" :aria-label="`Escribir por WhatsApp a ${alumno.nombre}`">
                            <Icon name="heroicons:chat-bubble-left-ellipsis" class="size-4" aria-hidden="true" /> <span class="tabular-nums">{{ alumno.celular }}</span>
                          </a>
                          <p v-else class="text-slate-300 tabular-nums">{{ alumno.celular ?? '—' }}</p>
                          <p class="mt-0.5 text-slate-400">{{ alumno.correo ?? '—' }}</p>
                        </td>
                        <td class="min-w-48 text-xs text-slate-300">
                          <p v-for="asesor in alumno.asesores" :key="asesor.id">{{ asesor.nombre }}</p>
                          <p v-if="!alumno.asesores.length" class="text-amber-300">Sin asesor</p>
                        </td>
                        <td><AppBadge :tono="tonoSituacion(alumno.situacion)">{{ nombreSituacion(alumno.situacion) }}</AppBadge></td>
                        <td v-if="conPagos" class="text-right">
                          <p class="font-medium text-white tabular-nums">{{ soles(alumno.monto) }}</p>
                          <p v-if="alumno.fechaPago" class="text-xs whitespace-nowrap text-slate-400">{{ fechaDia(alumno.fechaPago) }}</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <AppPagination :meta="meta" @cambiar="cambiarPagina" />
              </div>

              <!-- Móvil -->
              <div class="md:hidden">
                <ul class="space-y-2">
                  <li v-for="alumno in alumnos" :key="alumno.id" class="card p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="font-medium text-white">{{ alumno.nombre }}</p>
                        <p class="mt-0.5 text-xs text-slate-400"><span class="tabular-nums">{{ alumno.codigo }}</span> · {{ etiquetaSeccion(alumno.ciclo, alumno.seccion) }} · {{ etiquetaTurno(alumno.turno) }}</p>
                      </div>
                      <AppBadge :tono="tonoSituacion(alumno.situacion)">{{ nombreSituacion(alumno.situacion) }}</AppBadge>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <a v-if="urlWhatsapp(alumno.celular)" :href="urlWhatsapp(alumno.celular) ?? undefined" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-sm text-emerald-300" :aria-label="`Escribir por WhatsApp a ${alumno.nombre}`">
                        <Icon name="heroicons:chat-bubble-left-ellipsis" class="size-4" aria-hidden="true" /> <span class="tabular-nums">{{ alumno.celular }}</span>
                      </a>
                      <span v-else class="text-slate-400 tabular-nums">{{ alumno.celular ?? 'Sin celular' }}</span>
                      <span v-if="conPagos && alumno.monto !== null" class="font-medium text-white tabular-nums">{{ soles(alumno.monto) }}</span>
                    </div>
                    <p class="mt-2 text-xs text-slate-400">{{ alumno.asesores.map((a) => a.nombre).join(' · ') || 'Sin asesor' }}</p>
                  </li>
                </ul>
                <div class="card mt-2"><AppPagination :meta="meta" @cambiar="cambiarPagina" /></div>
              </div>
            </template>
          </div>
        </section>
      </template>
    </template>

    <PadronImportar :abierto="importando" :evento-id="eventos.seleccionadoId" :hay-padron="hayPadron" @cerrar="importando = false" @importado="alImportar" />
    <EnlacesDocentes
      :abierto="verEnlaces"
      :evento-id="eventos.seleccionadoId"
      :enlaces="enlaces"
      :evento-nombre="eventos.seleccionado?.nombreCorto"
      @cerrar="verEnlaces = false"
      @actualizado="enlaces = $event"
    />
  </div>
</template>
