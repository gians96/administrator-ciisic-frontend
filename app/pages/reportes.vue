<script setup lang="ts">
import type { AlumnoSeguimiento, AsesorRef, Meta, Respuesta, ResumenSeguimiento } from '~/types/api'
import { fechaDia, fechaHoraLima, numero, soles } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import {
  FILTROS_REPORTE_VACIOS,
  OPCIONES_SITUACION,
  aParametrosReporte,
  etiquetaSeccion,
  filtrosActivos,
  filtrosReporteDesdeQuery,
  filtrosVigentes,
  nombreDeRespaldo,
  nombreSituacion,
  porcentaje,
  resumenDeFiltros,
  rutaDeDescarga,
  seccionesDelCiclo,
  tonoSituacion,
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
const route = useRoute()
const router = useRouter()

const filtros = reactive<FiltrosReporte>(filtrosReporteDesdeQuery(route.query))
const vista = ref<string>(filtros.situacion || filtros.q || filtros.page > 1 ? 'alumnos' : 'secciones')
const busqueda = ref(filtros.q)

const resumen = ref<ResumenSeguimiento | null>(null)
const alumnos = ref<AlumnoSeguimiento[]>([])
const meta = ref<Meta | null>(null)
const cargandoResumen = ref(false)
/** Mensaje si no se pudo leer el resumen y no hay datos previos que mostrar. */
const errorCarga = ref<string | null>(null)
const cargandoAlumnos = ref(false)
const descargando = ref<string | null>(null)
const importando = ref(false)
/** El listado de alumnos quedó viejo mientras se miraba otra pestaña: se vuelve a pedir al volver. */
let alumnosVencidos = true

/** Sin `pagos.ver` el backend envía montos, fechas de pago y recaudado en `null`: se ocultan esas columnas. */
const conPagos = computed(() => resumen.value?.conPago ?? auth.puede('pagos.ver'))
const puedeExportar = computed(() => auth.puede('reportes.exportar'))
const puedeCargar = computed(() => auth.puede('reportes.gestionar'))
const hayPadron = computed(() => resumen.value?.hayPadron ?? false)
const opciones = computed(() => resumen.value?.opciones ?? null)
const secciones = computed(() => seccionesDelCiclo(opciones.value, filtros.ciclo))
const hayFiltros = computed(() => filtrosActivos(filtros) > 0)
const asesorElegido = computed(() => opciones.value?.asesores.find((asesor) => String(asesor.id) === filtros.asesorId) ?? null)

const PESTANAS = computed(() => [
  { id: 'secciones', label: 'Por ciclo y sección', icon: 'heroicons:squares-2x2' },
  { id: 'asesores', label: 'Por asesor', icon: 'heroicons:user-group' },
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

function sincronizarUrl() {
  router.replace({ query: aParametrosReporte(filtros) })
}

/** Vuelve a pedir lo que se está viendo; el resumen siempre, los alumnos solo si su pestaña está abierta. */
async function actualizar(conResumen = true) {
  const pedidos: Array<Promise<void>> = []
  if (conResumen) pedidos.push(cargarResumen())
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

watch(vista, (nueva) => {
  if (nueva === 'alumnos' && (alumnosVencidos || !meta.value)) cargarAlumnos()
})

watch(() => eventos.seleccionadoId, (id, anterior) => {
  resumen.value = null
  errorCarga.value = null
  alumnos.value = []
  meta.value = null
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

/** Lleva al listado de alumnos de una fila de las tablas. */
function verAlumnos(cambios: Partial<FiltrosReporte>) {
  Object.assign(filtros, { situacion: '', q: '', ...cambios })
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

function alImportar() {
  Object.assign(filtros, FILTROS_REPORTE_VACIOS)
  busqueda.value = ''
  alumnosVencidos = true
  sincronizarUrl()
  actualizar()
}

const ayuda = computed(() => {
  const partes = ['Pagó = inscripción aprobada.', 'En revisión = voucher enviado que aún no se valida.']
  if (resumen.value?.semestre) partes.unshift(`Semestre ${resumen.value.semestre}.`)
  return partes.join(' ')
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Reportes</h1>
        <p class="mt-1 text-sm text-slate-400">
          Seguimiento de estudiantes por asesor, calculado con las inscripciones de este momento.
          <span v-if="resumen">Actualizado: {{ fechaHoraLima(resumen.generadoEn) }}</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton variant="secondary" icon="heroicons:arrow-path" :loading="cargandoResumen" @click="actualizar()">Actualizar</AppButton>
        <template v-if="puedeExportar && hayPadron">
          <AppButton variant="secondary" icon="heroicons:table-cells" :loading="descargando === 'general:xlsx'" :disabled="descargando !== null" @click="bajar('xlsx')">
            Excel
          </AppButton>
          <AppButton variant="secondary" icon="heroicons:document-text" :loading="descargando === 'general:pdf'" :disabled="descargando !== null" @click="bajar('pdf')">
            PDF
          </AppButton>
        </template>
        <AppButton v-if="puedeCargar" icon="heroicons:arrow-up-tray" @click="importando = true">
          {{ hayPadron ? 'Actualizar padrón' : 'Cargar padrón' }}
        </AppButton>
      </div>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <section v-if="resumen && !hayPadron" class="card">
        <AppEmpty
          titulo="Aún no hay padrón de estudiantes"
          descripcion="Los reportes comparan a los estudiantes de la facultad con sus inscripciones. Carga el Excel de la facultad (hojas «ESTUDIANTES …» y «RESUMEN») para empezar."
          icon="heroicons:academic-cap"
        >
          <AppButton v-if="puedeCargar" icon="heroicons:arrow-up-tray" @click="importando = true">Cargar padrón</AppButton>
          <p v-else class="text-sm text-slate-400">Pide a un Owner o a un Administrador del sistema que cargue el padrón.</p>
        </AppEmpty>
      </section>

      <section v-else-if="!resumen && errorCarga" class="card">
        <AppEmpty titulo="No se pudieron cargar los reportes" :descripcion="errorCarga" icon="heroicons:exclamation-triangle">
          <AppButton variant="secondary" icon="heroicons:arrow-path" :loading="cargandoResumen" @click="actualizar()">Reintentar</AppButton>
        </AppEmpty>
      </section>

      <div v-else-if="!resumen" class="card py-14 text-center text-sm text-slate-400" role="status">Cargando reportes…</div>

      <template v-else>
        <section class="card p-4">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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
                <option v-for="turno in opciones?.turnos" :key="turno" :value="turno">Turno {{ turno }}</option>
              </select>
            </div>
            <AppButton variant="ghost" icon="heroicons:x-mark" :disabled="!hayFiltros" @click="limpiar">Limpiar</AppButton>
          </div>
          <p class="mt-3 text-xs text-slate-400">{{ ayuda }}</p>
        </section>

        <div class="grid gap-4 sm:grid-cols-2" :class="conPagos ? 'xl:grid-cols-6' : 'xl:grid-cols-5'">
          <AppStat
            etiqueta="Alumnos"
            :valor="numero(resumen.totales.alumnos)"
            icon="heroicons:academic-cap"
            :detalle="resumen.alumnosSinAsesor ? `${numero(resumen.alumnosSinAsesor)} sin asesor` : resumenDeFiltros(filtros, opciones) || 'Todo el padrón'"
          />
          <AppStat etiqueta="Pagaron" :valor="numero(resumen.totales.pagaron)" icon="heroicons:check-badge" tono="ok" :detalle="`${porcentaje(resumen.totales.avance)} de avance`" />
          <AppStat etiqueta="En revisión" :valor="numero(resumen.totales.enRevision)" icon="heroicons:clock" tono="warn" detalle="Voucher sin validar" />
          <AppStat etiqueta="Rechazados" :valor="numero(resumen.totales.rechazados)" icon="heroicons:x-circle" tono="error" detalle="Rechazados o cancelados" />
          <AppStat etiqueta="Sin inscripción" :valor="numero(resumen.totales.sinInscripcion)" icon="heroicons:user-minus" tono="info" detalle="Aún no se inscriben" />
          <AppStat v-if="conPagos" etiqueta="Recaudado" :valor="soles(resumen.totales.recaudado)" icon="heroicons:banknotes" tono="brand" detalle="Solo inscripciones aprobadas" />
        </div>

        <section class="card p-5" aria-label="Avance general">
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-bold">Avance</h2>
            <p class="text-sm text-slate-400">{{ numero(resumen.totales.pagaron) }} de {{ numero(resumen.totales.alumnos) }} alumnos pagaron</p>
          </div>
          <BarraAvance :contadores="resumen.totales" class="h-3!" />
          <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
            <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-emerald-400" /> Pagó</li>
            <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-amber-400" /> En revisión</li>
            <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-red-400" /> Rechazado</li>
            <li class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-slate-600" /> Sin inscripción</li>
          </ul>
        </section>

        <AppTabs v-model="vista" :tabs="PESTANAS" />

        <!-- Por ciclo y sección -->
        <section v-if="vista === 'secciones'" id="panel-secciones" role="tabpanel" aria-labelledby="tab-secciones" class="card overflow-hidden">
          <div class="overflow-x-auto">
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
                    <p v-if="fila.turnos.length" class="text-xs text-slate-400">Turno {{ fila.turnos.join(', ') }}</p>
                  </td>
                  <td class="min-w-56 text-xs">
                    <p v-for="asesor in fila.asesores" :key="asesor.id" class="text-slate-300">{{ asesor.nombre }}</p>
                    <p v-if="!fila.asesores.length" class="text-amber-300">Sin asesor</p>
                  </td>
                  <CeldasContadores :contadores="fila" :con-pago="conPagos" />
                  <td class="text-right">
                    <AppButton size="sm" variant="secondary" icon="heroicons:eye" @click="verAlumnos({ ciclo: fila.ciclo, seccion: fila.seccion })">Alumnos</AppButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <AppEmpty v-if="!resumen.porSeccion.length" titulo="No hay secciones con estos filtros" icon="heroicons:squares-2x2" />
        </section>

        <!-- Por asesor -->
        <section v-else-if="vista === 'asesores'" id="panel-asesores" role="tabpanel" aria-labelledby="tab-asesores" class="card overflow-hidden">
          <div class="overflow-x-auto">
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
                  <td class="min-w-56 font-semibold text-white">{{ fila.nombre }}</td>
                  <td class="min-w-40 text-xs text-slate-300">{{ fila.secciones.map((s) => etiquetaSeccion(s.ciclo, s.seccion)).join(', ') }}</td>
                  <CeldasContadores :contadores="fila" :con-pago="conPagos" />
                  <td class="text-right whitespace-nowrap">
                    <div class="flex justify-end gap-2">
                      <AppButton size="sm" variant="secondary" icon="heroicons:eye" @click="verAlumnos({ asesorId: String(fila.id) })">Alumnos</AppButton>
                      <template v-if="puedeExportar">
                        <AppButton
                          size="sm"
                          variant="secondary"
                          icon="heroicons:table-cells"
                          :loading="descargando === `${fila.id}:xlsx`"
                          :disabled="descargando !== null"
                          :aria-label="`Descargar el Excel de ${fila.nombre}`"
                          @click="bajar('xlsx', { id: fila.id, nombre: fila.nombre })"
                        >
                          Excel
                        </AppButton>
                        <AppButton
                          size="sm"
                          variant="secondary"
                          icon="heroicons:document-text"
                          :loading="descargando === `${fila.id}:pdf`"
                          :disabled="descargando !== null"
                          :aria-label="`Descargar el PDF de ${fila.nombre}`"
                          @click="bajar('pdf', { id: fila.id, nombre: fila.nombre })"
                        >
                          PDF
                        </AppButton>
                      </template>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <AppEmpty v-if="!resumen.porAsesor.length" titulo="No hay asesores con estos filtros" icon="heroicons:user-group" />
          <p class="border-t border-white/10 px-4 py-3 text-xs text-slate-400">
            Un alumno cuenta una vez por cada uno de sus asesores. «Excel» y «PDF» descargan el reporte completo del docente (todas sus secciones), sin importar los filtros.
          </p>
        </section>

        <!-- Alumnos -->
        <section v-else id="panel-alumnos" role="tabpanel" aria-labelledby="tab-alumnos" class="space-y-4">
          <div class="card p-4">
            <div class="grid gap-3 md:grid-cols-[2fr_1fr]">
              <div class="relative">
                <label for="buscar" class="sr-only">Buscar alumno</label>
                <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input id="buscar" v-model="busqueda" type="search" class="field-control pl-9" placeholder="Buscar por nombre, código, DNI o correo">
              </div>
              <div>
                <label for="f-situacion" class="sr-only">Situación</label>
                <select id="f-situacion" v-model="filtros.situacion" class="field-control">
                  <option value="">Todas las situaciones</option>
                  <option v-for="opcion in OPCIONES_SITUACION" :key="opcion.codigo" :value="opcion.codigo">{{ opcion.nombre }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="card overflow-hidden">
            <div class="relative overflow-x-auto">
              <table class="table-base">
                <thead>
                  <tr>
                    <th>Sección</th>
                    <th>Alumno</th>
                    <th>Contacto</th>
                    <th>Asesores</th>
                    <th>Situación</th>
                    <th v-if="conPagos" class="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="alumno in alumnos" :key="alumno.id">
                    <td class="whitespace-nowrap">
                      <p class="font-semibold text-white">{{ etiquetaSeccion(alumno.ciclo, alumno.seccion) }}</p>
                      <p v-if="alumno.turno" class="text-xs text-slate-400">Turno {{ alumno.turno }}</p>
                    </td>
                    <td class="min-w-56">
                      <p class="font-medium text-white">{{ alumno.nombre }}</p>
                      <p class="text-xs text-slate-400 tabular-nums">{{ alumno.codigo }} · DNI {{ alumno.documento }}</p>
                    </td>
                    <td class="text-xs">
                      <p class="text-slate-200 tabular-nums">{{ alumno.celular ?? '—' }}</p>
                      <p class="text-slate-400">{{ alumno.correo ?? '—' }}</p>
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
            <div v-if="cargandoAlumnos && !alumnos.length" class="py-14 text-center text-sm text-slate-400" role="status">Cargando alumnos…</div>
            <AppEmpty v-else-if="!alumnos.length" titulo="No hay alumnos con estos filtros" icon="heroicons:academic-cap" />
            <AppPagination :meta="meta" @cambiar="cambiarPagina" />
          </div>
        </section>
      </template>
    </template>

    <PadronImportar :abierto="importando" :evento-id="eventos.seleccionadoId" :hay-padron="hayPadron" @cerrar="importando = false" @importado="alImportar" />
  </div>
</template>
