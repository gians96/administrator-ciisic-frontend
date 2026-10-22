<script setup lang="ts">
import type { AlumnoCiclo, ConteosSituacion, ContadoresPublicos, VistaCiclo, VistaDocente } from '~/types/api'
import { guardarArchivo, leerCuerpoDeError, nombreDeArchivo } from '~/utils/descargas'
import { aErrorApi } from '~/utils/errores'
import { tipoDeSeguimiento, tokenDelHash, urlWhatsapp } from '~/utils/enlacesDocentes'
import { fechaHoraLima, numero } from '~/utils/formato'
import { etiquetaSeccion, etiquetaTurno, nombreSituacion, porcentaje, tonoSituacion } from '~/utils/reportes'
import {
  FILTROS_DOCENTE_VACIOS,
  claveDeSeccion,
  conteosDocente,
  filtrarAlumnosDocente,
  type FiltrosDocente,
} from '~/utils/seguimientoDocente'

/**
 * Vista pública del docente (spec 017; backend 026) y del ciclo (spec 018; backend 027): con su enlace, sin iniciar
 * sesión, se ve cómo van las inscripciones y pagos de los estudiantes del docente (`/seguimiento`) o de todo un
 * ciclo (`/seguimiento/ciclo`). El token va tras el `#` de la URL (el navegador no lo envía a ningún servidor) y se
 * pide por POST al BFF. No hay DNI, correo ni montos: solo lo necesario para dar seguimiento (y en el ciclo, tampoco
 * celular).
 */
definePageMeta({ layout: 'blank', publica: true, alias: ['/seguimiento/ciclo'] })

const tipo = tipoDeSeguimiento(useRoute().path)
const esCiclo = tipo === 'ciclo'

useHead({
  title: esCiclo ? 'Seguimiento del ciclo · CIISIC' : 'Seguimiento de tus estudiantes · CIISIC',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    // La URL lleva el acceso: ningún enlace saliente debe conocerla
    { name: 'referrer', content: 'no-referrer' },
  ],
})

type Estado = 'cargando' | 'listo' | 'enlace' | 'error'

const REFRESCO_MS = 60_000
/** Al volver a la pestaña solo se refresca si pasó más de este tiempo desde la última lectura. */
const REFRESCO_AL_VOLVER_MS = 30_000

const estado = ref<Estado>('cargando')
/** Un estudiante de cualquiera de las dos vistas: el celular solo llega en la del docente. */
type AlumnoVista = AlumnoCiclo & { celular?: string | null }
type SeccionVista = ContadoresPublicos & { ciclo: string, seccion: string, turnos: string[], asesores?: string[] }

const vista = ref<VistaDocente | VistaCiclo | null>(null)
const aviso = ref('')
const actualizando = ref(false)
const descargando = ref<'xlsx' | 'pdf' | null>(null)
const filtros = reactive<FiltrosDocente>({ ...FILTROS_DOCENTE_VACIOS })
const busqueda = ref('')

let token: string | null = null
let ultimaLectura = 0
let temporizador: ReturnType<typeof setInterval> | undefined
let retardoBusqueda: ReturnType<typeof setTimeout> | undefined

async function cargar(silencioso = false) {
  if (!token) {
    estado.value = 'enlace'
    return
  }
  actualizando.value = true
  try {
    const respuesta = await $fetch<{ data: VistaDocente | VistaCiclo }>('/api/publico/seguimiento', { method: 'POST', body: { token, tipo }, retry: 0 })
    vista.value = respuesta.data
    estado.value = 'listo'
    aviso.value = ''
    ultimaLectura = Date.now()
    // La sección elegida puede dejar de existir si cambió la designación del docente
    if (filtros.seccion && !respuesta.data.secciones.some((s) => claveDeSeccion(s.ciclo, s.seccion) === filtros.seccion)) filtros.seccion = ''
  } catch (error) {
    const e = aErrorApi(error)
    if (e.status === 404 || e.code === 'LINK_NOT_FOUND') {
      estado.value = 'enlace'
      vista.value = null
    } else if (vista.value) {
      // Ya hay datos a la vista: se conservan y se avisa que esta lectura falló
      aviso.value = silencioso ? 'No se pudo actualizar. Se muestran los últimos datos.' : e.message
    } else {
      estado.value = 'error'
      aviso.value = e.message
    }
  } finally {
    actualizando.value = false
  }
}

function leerEnlace() {
  token = tokenDelHash(window.location.hash)
  estado.value = token ? 'cargando' : 'enlace'
  vista.value = null
  Object.assign(filtros, FILTROS_DOCENTE_VACIOS)
  busqueda.value = ''
  if (token) cargar()
}

function alVolver() {
  if (document.visibilityState === 'visible' && vista.value && Date.now() - ultimaLectura > REFRESCO_AL_VOLVER_MS) cargar(true)
}

onMounted(() => {
  leerEnlace()
  temporizador = setInterval(() => { if (document.visibilityState === 'visible' && vista.value) cargar(true) }, REFRESCO_MS)
  document.addEventListener('visibilitychange', alVolver)
  window.addEventListener('hashchange', leerEnlace)
})
onBeforeUnmount(() => {
  clearInterval(temporizador)
  clearTimeout(retardoBusqueda)
  document.removeEventListener('visibilitychange', alVolver)
  window.removeEventListener('hashchange', leerEnlace)
})

watch(busqueda, (valor) => {
  clearTimeout(retardoBusqueda)
  retardoBusqueda = setTimeout(() => { filtros.q = valor }, 200)
})

const todosLosAlumnos = computed<AlumnoVista[]>(() => vista.value?.alumnos ?? [])
const secciones = computed<SeccionVista[]>(() => vista.value?.secciones ?? [])
/** Quién es: el nombre del docente o el ciclo. */
const quien = computed(() => (!vista.value ? '' : 'asesor' in vista.value ? vista.value.asesor.nombre : `Ciclo ${vista.value.ciclo}`))
const textoSecciones = computed(() => `${numero(secciones.value.length)} ${secciones.value.length === 1 ? 'sección' : 'secciones'}`)

// Los indicadores y los contadores siguen a la sección elegida; la situación y la búsqueda solo recortan la lista
const alumnosDeLaSeccion = computed(() => filtrarAlumnosDocente(todosLosAlumnos.value, { ...FILTROS_DOCENTE_VACIOS, seccion: filtros.seccion }))
const base = computed(() => conteosDocente(alumnosDeLaSeccion.value))
const avance = computed(() => (base.value.todos ? base.value.porSituacion.PAGADO / base.value.todos : 0))
const conteos = computed<ConteosSituacion>(() => ({ todos: base.value.todos, NO_PAGADO: base.value.noPagado, ...base.value.porSituacion }))
const visibles = computed(() => filtrarAlumnosDocente(todosLosAlumnos.value, filtros))
const hayFiltros = computed(() => Boolean(filtros.seccion || filtros.situacion || filtros.q))

const COLORES_BARRA = { PAGADO: 'bg-emerald-400', EN_REVISION: 'bg-amber-400', RECHAZADO: 'bg-red-400', SIN_INSCRIPCION: 'bg-slate-600' } as const
const partes = computed(() => (['PAGADO', 'EN_REVISION', 'RECHAZADO', 'SIN_INSCRIPCION'] as const)
  .map((codigo) => ({ codigo, cantidad: base.value.porSituacion[codigo], ancho: base.value.todos ? (base.value.porSituacion[codigo] / base.value.todos) * 100 : 0 }))
  .filter((parte) => parte.cantidad > 0))

function limpiar() {
  Object.assign(filtros, FILTROS_DOCENTE_VACIOS)
  busqueda.value = ''
}

async function bajar(formato: 'xlsx' | 'pdf') {
  if (!token || descargando.value) return
  descargando.value = formato
  try {
    const respuesta = await $fetch.raw<Blob>('/api/publico/seguimiento/export', { method: 'POST', body: { token, tipo, formato }, responseType: 'blob', retry: 0 })
    const archivo: unknown = respuesta._data
    if (!(archivo instanceof Blob)) throw new Error('Respuesta sin archivo')
    guardarArchivo(archivo, nombreDeArchivo(respuesta.headers.get('content-disposition'), `${esCiclo ? 'Seguimiento del ciclo' : 'Seguimiento'}.${formato}`))
  } catch (error) {
    await leerCuerpoDeError(error)
    aviso.value = aErrorApi(error).message
  } finally {
    descargando.value = null
  }
}
</script>

<template>
  <main class="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
    <!-- Enlace inválido -->
    <section v-if="estado === 'enlace'" class="card mx-auto mt-10 max-w-lg" role="alert">
      <AppEmpty
        titulo="Este enlace no es válido"
        descripcion="Puede estar incompleto o haber sido desactivado. Solicita uno nuevo a la organización del congreso."
        icon="heroicons:link-slash"
      />
    </section>

    <!-- Error al cargar -->
    <section v-else-if="estado === 'error'" class="card mx-auto mt-10 max-w-lg" role="alert">
      <AppEmpty titulo="No se pudo cargar el seguimiento" :descripcion="aviso" icon="heroicons:exclamation-triangle">
        <AppButton icon="heroicons:arrow-path" :loading="actualizando" @click="cargar()">Reintentar</AppButton>
      </AppEmpty>
    </section>

    <!-- Cargando -->
    <div v-else-if="estado === 'cargando' || !vista" class="space-y-6" role="status" aria-label="Cargando el seguimiento">
      <div class="h-24 animate-pulse rounded-2xl bg-white/5" />
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="n in 4" :key="n" class="h-20 animate-pulse rounded-2xl bg-white/5" />
      </div>
      <div class="h-64 animate-pulse rounded-2xl bg-white/5" />
    </div>

    <template v-else>
      <!-- Encabezado -->
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="kicker">{{ vista.evento.nombreCorto }}</p>
          <h1 class="mt-1 text-2xl leading-tight font-extrabold sm:text-3xl">{{ esCiclo ? 'Seguimiento del ciclo' : 'Seguimiento de tus estudiantes' }}</h1>
          <p class="mt-1.5 text-base font-medium text-white">{{ quien }}<span v-if="esCiclo" class="font-normal text-slate-300"> · {{ textoSecciones }}</span></p>
          <p class="mt-0.5 text-sm text-slate-400">
            <span v-if="vista.semestre">Semestre {{ vista.semestre }} · </span>Actualizado: {{ fechaHoraLima(vista.generadoEn) }}
            <span class="hidden sm:inline"> · se actualiza solo cada minuto</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="secondary" icon="heroicons:arrow-path" :loading="actualizando" @click="cargar()">Actualizar</AppButton>
          <AppMenu etiqueta="Descargar" icon="heroicons:arrow-down-tray" :loading="descargando !== null">
            <AppMenuItem icon="heroicons:table-cells" @click="bajar('xlsx')">Excel (.xlsx)</AppMenuItem>
            <AppMenuItem icon="heroicons:document-text" @click="bajar('pdf')">PDF</AppMenuItem>
          </AppMenu>
        </div>
      </header>

      <p v-if="aviso" class="mt-4 flex items-center gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset" role="alert">
        <Icon name="heroicons:exclamation-triangle" class="size-5 shrink-0" aria-hidden="true" /> {{ aviso }}
      </p>

      <!-- Avance -->
      <section class="card mt-6 p-5" aria-label="Avance de los pagos">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <p class="font-display text-4xl leading-none font-extrabold text-white tabular-nums sm:text-5xl">
            {{ porcentaje(avance) }}
            <span class="text-base font-semibold text-slate-400 sm:text-lg">pagó</span>
          </p>
          <p class="text-sm text-slate-300">
            <strong class="text-white tabular-nums">{{ numero(base.porSituacion.PAGADO) }}</strong> de <span class="tabular-nums">{{ numero(base.todos) }}</span> estudiantes
            <span v-if="filtros.seccion" class="text-slate-400">(sección elegida)</span>
          </p>
        </div>
        <div class="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-white/10" role="img" :aria-label="`${porcentaje(avance)} de los estudiantes pagó`">
          <span v-for="parte in partes" :key="parte.codigo" class="h-full" :class="COLORES_BARRA[parte.codigo]" :style="{ width: `${parte.ancho}%` }" :title="`${nombreSituacion(parte.codigo)}: ${parte.cantidad}`" />
        </div>
        <p class="mt-3 text-xs text-slate-400"><strong class="font-semibold text-slate-300">Pagó</strong> = inscripción aprobada. <strong class="font-semibold text-slate-300">En revisión</strong> = envió su voucher y aún no se valida.</p>
      </section>

      <!-- Filtros -->
      <section class="mt-4 space-y-3" aria-label="Filtros">
        <div v-if="esCiclo" role="group" aria-label="Secciones del ciclo" class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-slate-200">Secciones <span class="font-normal text-slate-400">(pulsa una para ver solo sus estudiantes)</span></h2>
            <button v-if="filtros.seccion" type="button" class="inline-flex items-center gap-1 text-sm text-brand-300 hover:text-brand-200" @click="filtros.seccion = ''">
              <Icon name="heroicons:x-mark" class="size-4" aria-hidden="true" /> Ver todo el ciclo
            </button>
          </div>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="seccion in secciones"
              :key="claveDeSeccion(seccion.ciclo, seccion.seccion)"
              type="button"
              :aria-pressed="filtros.seccion === claveDeSeccion(seccion.ciclo, seccion.seccion)"
              class="rounded-2xl p-3.5 text-left ring-1 transition ring-inset"
              :class="filtros.seccion === claveDeSeccion(seccion.ciclo, seccion.seccion) ? 'bg-brand-500/15 ring-brand-400/50' : 'bg-white/5 ring-white/10 hover:bg-white/10'"
              @click="filtros.seccion = filtros.seccion === claveDeSeccion(seccion.ciclo, seccion.seccion) ? '' : claveDeSeccion(seccion.ciclo, seccion.seccion)"
            >
              <span class="flex items-baseline justify-between gap-2">
                <span class="font-semibold text-white">{{ etiquetaSeccion(seccion.ciclo, seccion.seccion) }} <span v-if="seccion.turnos.length" class="text-xs font-normal text-slate-400">{{ seccion.turnos.map(etiquetaTurno).join(', ') }}</span></span>
                <span class="text-sm font-semibold text-white tabular-nums">{{ porcentaje(seccion.avance) }}</span>
              </span>
              <span class="mt-0.5 block text-xs text-slate-400">{{ seccion.asesores?.length ? seccion.asesores.join(' · ') : 'Sin asesor asignado' }}</span>
              <BarraAvance :contadores="seccion" class="mt-2.5" />
              <span class="mt-1.5 block text-xs text-slate-400"><strong class="font-semibold text-slate-200 tabular-nums">{{ numero(seccion.pagaron) }}</strong> de <span class="tabular-nums">{{ numero(seccion.alumnos) }}</span> pagaron</span>
            </button>
          </div>
        </div>
        <div v-else-if="vista.secciones.length > 1" role="group" aria-label="Filtrar por ciclo y sección" class="flex flex-wrap gap-2">
          <button
            type="button"
            :aria-pressed="filtros.seccion === ''"
            class="rounded-full px-3.5 py-1.5 text-sm ring-1 transition ring-inset"
            :class="filtros.seccion === '' ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
            @click="filtros.seccion = ''"
          >
            Todas las secciones
          </button>
          <button
            v-for="seccion in vista.secciones"
            :key="claveDeSeccion(seccion.ciclo, seccion.seccion)"
            type="button"
            :aria-pressed="filtros.seccion === claveDeSeccion(seccion.ciclo, seccion.seccion)"
            class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 transition ring-inset"
            :class="filtros.seccion === claveDeSeccion(seccion.ciclo, seccion.seccion) ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
            @click="filtros.seccion = claveDeSeccion(seccion.ciclo, seccion.seccion)"
          >
            {{ etiquetaSeccion(seccion.ciclo, seccion.seccion) }}
            <span v-if="seccion.turnos.length" class="text-xs text-slate-400">{{ etiquetaTurno(seccion.turnos[0]) }}</span>
            <span class="rounded-full bg-white/10 px-1.5 text-xs text-slate-200 tabular-nums">{{ seccion.alumnos }}</span>
          </button>
        </div>

        <FiltroSituacion v-model="filtros.situacion" :conteos="conteos" />

        <div class="relative">
          <label for="buscar" class="sr-only">Buscar estudiante</label>
          <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input id="buscar" v-model="busqueda" type="search" class="field-control pl-10" placeholder="Buscar por nombre o código">
        </div>
      </section>

      <!-- Lista -->
      <section class="mt-4" aria-label="Estudiantes" aria-live="polite">
        <div class="mb-2 flex items-center justify-between gap-3 text-sm text-slate-400">
          <p><strong class="text-white tabular-nums">{{ numero(visibles.length) }}</strong> de <span class="tabular-nums">{{ numero(todosLosAlumnos.length) }}</span> estudiantes</p>
          <button v-if="hayFiltros" type="button" class="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200" @click="limpiar">
            <Icon name="heroicons:x-mark" class="size-4" aria-hidden="true" /> Quitar filtros
          </button>
        </div>

        <AppEmpty v-if="!visibles.length" class="card" titulo="No hay estudiantes con estos filtros" descripcion="Prueba con otra sección o situación, o quita la búsqueda." icon="heroicons:magnifying-glass" />

        <template v-else>
          <!-- Escritorio -->
          <div class="card hidden overflow-hidden md:block">
            <table class="table-base">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Sección</th>
                  <th v-if="!esCiclo">Celular</th>
                  <th>Situación</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="alumno in visibles" :key="alumno.codigo">
                  <td>
                    <p class="font-medium text-white">{{ alumno.nombre }}</p>
                    <p class="text-xs text-slate-400 tabular-nums">{{ alumno.codigo }}</p>
                  </td>
                  <td class="whitespace-nowrap">
                    <p class="font-semibold text-white">{{ etiquetaSeccion(alumno.ciclo, alumno.seccion) }}</p>
                    <p class="text-xs text-slate-400">{{ etiquetaTurno(alumno.turno) }}</p>
                  </td>
                  <td v-if="!esCiclo" class="whitespace-nowrap">
                    <a v-if="urlWhatsapp(alumno.celular)" :href="urlWhatsapp(alumno.celular) ?? undefined" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200" :aria-label="`Escribir por WhatsApp a ${alumno.nombre}`">
                      <Icon name="heroicons:chat-bubble-left-ellipsis" class="size-4" aria-hidden="true" /> <span class="tabular-nums">{{ alumno.celular }}</span>
                    </a>
                    <span v-else class="text-slate-400 tabular-nums">{{ alumno.celular ?? '—' }}</span>
                  </td>
                  <td><AppBadge :tono="tonoSituacion(alumno.situacion)">{{ nombreSituacion(alumno.situacion) }}</AppBadge></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Móvil -->
          <ul class="space-y-2 md:hidden">
            <li v-for="alumno in visibles" :key="alumno.codigo" class="card flex items-start justify-between gap-3 p-4">
              <div class="min-w-0">
                <p class="font-medium text-white">{{ alumno.nombre }}</p>
                <p class="mt-0.5 text-xs text-slate-400"><span class="tabular-nums">{{ alumno.codigo }}</span> · {{ etiquetaSeccion(alumno.ciclo, alumno.seccion) }} · {{ etiquetaTurno(alumno.turno) }}</p>
                <a v-if="urlWhatsapp(alumno.celular)" :href="urlWhatsapp(alumno.celular) ?? undefined" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-300" :aria-label="`Escribir por WhatsApp a ${alumno.nombre}`">
                  <Icon name="heroicons:chat-bubble-left-ellipsis" class="size-4" aria-hidden="true" /> <span class="tabular-nums">{{ alumno.celular }}</span>
                </a>
              </div>
              <AppBadge :tono="tonoSituacion(alumno.situacion)">{{ nombreSituacion(alumno.situacion) }}</AppBadge>
            </li>
          </ul>
        </template>
      </section>

      <footer class="mt-8 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500">
        <p v-if="esCiclo">Información confidencial de los estudiantes del ciclo. Este enlace es de uso restringido: no lo compartas ni publiques la lista. Si crees que otra persona lo tiene, pide uno nuevo a la organización del congreso.</p>
        <p v-else>Información confidencial de tus estudiantes. Este enlace es personal: no lo compartas. Si crees que otra persona lo tiene, pide uno nuevo a la organización del congreso.</p>
      </footer>
    </template>
  </main>
</template>
