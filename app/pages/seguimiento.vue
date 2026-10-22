<script setup lang="ts">
import type { AlumnoCiclo, ConteosSituacion, ContadoresPublicos, VistaCiclo, VistaDocente } from '~/types/api'
import { guardarArchivo, leerCuerpoDeError, nombreDeArchivo } from '~/utils/descargas'
import { aErrorApi } from '~/utils/errores'
import { dniDelDocente, soloDigitosDni } from '~/utils/docentes'
import { tipoDeSeguimiento, tokenDelHash, urlWhatsapp } from '~/utils/enlacesDocentes'
import { fechaHoraLima, numero } from '~/utils/formato'
import { etiquetaSeccion, etiquetaTurno, nombreSituacion, porcentaje, tonoSituacion } from '~/utils/reportes'
import {
  FILTROS_DOCENTE_VACIOS,
  ciclosDe,
  claveDeSeccion,
  conteosDocente,
  filtrarAlumnosDocente,
  type FiltrosDocente,
} from '~/utils/seguimientoDocente'

/**
 * Vista pública del seguimiento: del docente con su enlace (spec 017; backend 026, `/seguimiento`), de todo un ciclo
 * (spec 018; backend 027, `/seguimiento/ciclo`) y del docente que entra con su DNI en la página común (spec 019;
 * backend 028, `/docentes`). Sin iniciar sesión. El token va tras el `#` de la URL (el navegador no lo envía a ningún
 * servidor); el DNI se escribe aquí y **solo vive en memoria** (ni en la URL ni en el almacenamiento del navegador).
 * Ambos se piden por POST al BFF. No hay DNI de estudiantes, correo ni montos: solo lo necesario para dar seguimiento
 * (y en el ciclo, tampoco celular).
 */
definePageMeta({ layout: 'blank', publica: true, alias: ['/seguimiento/ciclo', '/docentes'] })

const tipo = tipoDeSeguimiento(useRoute().path)
const esCiclo = tipo === 'ciclo'
const esDocumento = tipo === 'documento'

useHead({
  title: esCiclo ? 'Seguimiento del ciclo · CIISIC' : esDocumento ? 'Consulta de docentes · CIISIC' : 'Seguimiento de tus estudiantes · CIISIC',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    // La URL lleva el acceso: ningún enlace saliente debe conocerla
    { name: 'referrer', content: 'no-referrer' },
  ],
})

type Estado = 'identificar' | 'cargando' | 'listo' | 'enlace' | 'error'

const REFRESCO_MS = 60_000
/** Al volver a la pestaña solo se refresca si pasó más de este tiempo desde la última lectura. */
const REFRESCO_AL_VOLVER_MS = 30_000

const estado = ref<Estado>(esDocumento ? 'identificar' : 'cargando')
/** Un estudiante de cualquiera de las dos vistas: el celular solo llega en la del docente. */
type AlumnoVista = AlumnoCiclo & { celular?: string | null }
type SeccionVista = ContadoresPublicos & { ciclo: string, seccion: string, turnos: string[], asesores?: string[] }

const vista = ref<VistaDocente | VistaCiclo | null>(null)
const aviso = ref('')
const actualizando = ref(false)
const descargando = ref<'xlsx' | 'pdf' | null>(null)
const filtros = reactive<FiltrosDocente>({ ...FILTROS_DOCENTE_VACIOS })
const busqueda = ref('')

/** Entrada con el DNI: lo que se escribe, el aviso si no se encontró y el DNI ya enviado (solo en memoria). */
const dniEscrito = ref('')
const errorDni = ref('')
let documento: string | null = null
let token: string | null = null
let ultimaLectura = 0
let temporizador: ReturnType<typeof setInterval> | undefined
let retardoBusqueda: ReturnType<typeof setTimeout> | undefined

/** Lo que identifica a quien consulta, tal como lo espera el BFF. */
const credencial = () => (esDocumento ? { tipo, documento } : { tipo, token })
const hayCredencial = () => (esDocumento ? Boolean(documento) : Boolean(token))

/** Vuelve a la pantalla del DNI (o la deja lista): olvida el DNI, los datos y los filtros. */
function salir(mensaje = '') {
  documento = null
  vista.value = null
  aviso.value = ''
  estado.value = 'identificar'
  errorDni.value = mensaje
  Object.assign(filtros, FILTROS_DOCENTE_VACIOS)
  busqueda.value = ''
}

async function cargar(silencioso = false) {
  if (!hayCredencial()) {
    estado.value = esDocumento ? 'identificar' : 'enlace'
    return
  }
  actualizando.value = true
  try {
    const respuesta = await $fetch<{ data: VistaDocente | VistaCiclo }>('/api/publico/seguimiento', { method: 'POST', body: credencial(), retry: 0 })
    vista.value = respuesta.data
    estado.value = 'listo'
    aviso.value = ''
    ultimaLectura = Date.now()
    // El ciclo o la sección elegidos pueden dejar de existir si cambió la designación del docente
    if (filtros.ciclo && !respuesta.data.alumnos.some((a) => a.ciclo === filtros.ciclo)) filtros.ciclo = ''
    if (filtros.seccion && !respuesta.data.secciones.some((s) => claveDeSeccion(s.ciclo, s.seccion) === filtros.seccion)) filtros.seccion = ''
  } catch (error) {
    const e = aErrorApi(error)
    if (esDocumento && (e.status === 404 || e.code === 'ADVISOR_DOCUMENT_NOT_FOUND')) {
      // El DNI no es de ningún docente (o se lo quitaron mientras miraba): se vuelve a pedir
      salir('No encontramos un docente con ese DNI. Revisa el número o pide que lo registren.')
    } else if (esDocumento && e.status === 429 && !vista.value) {
      salir(e.message)
    } else if (e.status === 404 || e.code === 'LINK_NOT_FOUND') {
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

/** Entra con lo que escribió: un DNI de 8 dígitos (o 7). El DNI no se guarda más que en memoria y el campo se vacía. */
function identificar() {
  errorDni.value = ''
  const dni = dniDelDocente(dniEscrito.value)
  if (!dni) {
    errorDni.value = 'Escribe tu DNI de 8 dígitos.'
    return
  }
  documento = dni
  dniEscrito.value = ''
  estado.value = 'cargando'
  cargar()
}

function leerEnlace() {
  // Con el DNI no hay nada que leer de la URL: se espera a que lo escriba
  if (esDocumento) return
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
  documento = null
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

/** Ciclos del docente (solo se ofrece elegir uno si atiende a más de uno) y sus secciones, limitadas al ciclo elegido. */
const ciclos = computed(() => ciclosDe(todosLosAlumnos.value))
const mostrarCiclos = computed(() => !esCiclo && ciclos.value.length > 1)
const seccionesDelFiltro = computed(() => secciones.value.filter((s) => !filtros.ciclo || s.ciclo === filtros.ciclo))
watch(() => filtros.ciclo, (ciclo) => {
  // Al cambiar de ciclo, la sección elegida deja de valer si es de otro
  if (ciclo && filtros.seccion && !filtros.seccion.startsWith(`${ciclo}|`)) filtros.seccion = ''
})

// Los indicadores y los contadores siguen al ciclo y la sección elegidos; la situación y la búsqueda solo recortan la lista
const alumnosDeLaSeccion = computed(() => filtrarAlumnosDocente(todosLosAlumnos.value, { ...FILTROS_DOCENTE_VACIOS, ciclo: filtros.ciclo, seccion: filtros.seccion }))
const base = computed(() => conteosDocente(alumnosDeLaSeccion.value))
const avance = computed(() => (base.value.todos ? base.value.porSituacion.PAGADO / base.value.todos : 0))
const conteos = computed<ConteosSituacion>(() => ({ todos: base.value.todos, NO_PAGADO: base.value.noPagado, ...base.value.porSituacion }))
const visibles = computed(() => filtrarAlumnosDocente(todosLosAlumnos.value, filtros))
const hayFiltros = computed(() => Boolean(filtros.ciclo || filtros.seccion || filtros.situacion || filtros.q))

const COLORES_BARRA = { PAGADO: 'bg-emerald-400', EN_REVISION: 'bg-amber-400', RECHAZADO: 'bg-red-400', SIN_INSCRIPCION: 'bg-slate-600' } as const
const partes = computed(() => (['PAGADO', 'EN_REVISION', 'RECHAZADO', 'SIN_INSCRIPCION'] as const)
  .map((codigo) => ({ codigo, cantidad: base.value.porSituacion[codigo], ancho: base.value.todos ? (base.value.porSituacion[codigo] / base.value.todos) * 100 : 0 }))
  .filter((parte) => parte.cantidad > 0))

function limpiar() {
  Object.assign(filtros, FILTROS_DOCENTE_VACIOS)
  busqueda.value = ''
}

async function bajar(formato: 'xlsx' | 'pdf') {
  if (!hayCredencial() || descargando.value) return
  descargando.value = formato
  try {
    const respuesta = await $fetch.raw<Blob>('/api/publico/seguimiento/export', { method: 'POST', body: { ...credencial(), formato }, responseType: 'blob', retry: 0 })
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
    <!-- Entrada con el DNI (página común de los docentes) -->
    <section v-if="estado === 'identificar'" class="card mx-auto mt-6 max-w-md p-6 sm:mt-12 sm:p-8" aria-labelledby="titulo-dni">
      <p class="kicker">CIISIC</p>
      <h1 id="titulo-dni" class="mt-1 text-2xl leading-tight font-extrabold">Consulta de tus estudiantes</h1>
      <p class="mt-2 text-sm text-slate-300">Escribe tu DNI para ver cómo van las inscripciones y pagos de los estudiantes que tienes a cargo.</p>
      <form class="mt-5 space-y-4" novalidate @submit.prevent="identificar">
        <div>
          <label for="dni" class="field-label">DNI del docente</label>
          <input
            id="dni"
            v-model="dniEscrito"
            type="text"
            name="dni-docente"
            inputmode="numeric"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            maxlength="8"
            placeholder="12345678"
            class="field-control text-lg tracking-widest tabular-nums"
            :aria-invalid="errorDni ? 'true' : undefined"
            :aria-describedby="errorDni ? 'error-dni' : undefined"
            autofocus
            @input="dniEscrito = soloDigitosDni(dniEscrito)"
          >
          <p v-if="errorDni" id="error-dni" class="field-error" role="alert">{{ errorDni }}</p>
        </div>
        <AppButton type="submit" class="w-full justify-center" icon="heroicons:magnifying-glass" :disabled="dniEscrito.length < 7">Ver mis estudiantes</AppButton>
      </form>
      <p class="mt-5 text-xs leading-relaxed text-slate-400">Información confidencial de tus estudiantes. Tu DNI solo se usa para identificarte y no se guarda en este dispositivo. Si tu DNI no funciona, pide a la organización del congreso que lo registren.</p>
    </section>

    <!-- Enlace inválido -->
    <section v-else-if="estado === 'enlace'" class="card mx-auto mt-10 max-w-lg" role="alert">
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
          <AppButton v-if="esDocumento" variant="ghost" icon="heroicons:arrow-left-on-rectangle" @click="salir()">Salir</AppButton>
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
            <span v-if="filtros.ciclo || filtros.seccion" class="text-slate-400">({{ filtros.seccion ? 'sección elegida' : 'ciclo elegido' }})</span>
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
        <template v-else>
          <div v-if="mostrarCiclos" role="group" aria-label="Filtrar por ciclo" class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Ciclo</span>
            <button
              type="button"
              :aria-pressed="filtros.ciclo === ''"
              class="rounded-full px-3.5 py-1.5 text-sm ring-1 transition ring-inset"
              :class="filtros.ciclo === '' ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
              @click="filtros.ciclo = ''"
            >
              Todos
            </button>
            <button
              v-for="ciclo in ciclos"
              :key="ciclo.ciclo"
              type="button"
              :aria-pressed="filtros.ciclo === ciclo.ciclo"
              class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 transition ring-inset"
              :class="filtros.ciclo === ciclo.ciclo ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
              @click="filtros.ciclo = ciclo.ciclo"
            >
              {{ ciclo.ciclo }}
              <span class="rounded-full bg-white/10 px-1.5 text-xs text-slate-200 tabular-nums">{{ ciclo.alumnos }}</span>
            </button>
          </div>
          <div v-if="seccionesDelFiltro.length > 1" role="group" aria-label="Filtrar por sección" class="flex flex-wrap items-center gap-2">
            <span v-if="mostrarCiclos" class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Sección</span>
            <button
              type="button"
              :aria-pressed="filtros.seccion === ''"
              class="rounded-full px-3.5 py-1.5 text-sm ring-1 transition ring-inset"
              :class="filtros.seccion === '' ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
              @click="filtros.seccion = ''"
            >
              {{ filtros.ciclo ? 'Todas las del ciclo' : 'Todas las secciones' }}
            </button>
            <button
              v-for="seccion in seccionesDelFiltro"
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
        </template>

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
        <p v-else-if="esDocumento">Información confidencial de tus estudiantes. Tu DNI solo se usa para identificarte y no se guarda en este dispositivo: usa «Salir» al terminar si compartes el equipo.</p>
        <p v-else>Información confidencial de tus estudiantes. Este enlace es personal: no lo compartas. Si crees que otra persona lo tiene, pide uno nuevo a la organización del congreso.</p>
      </footer>
    </template>
  </main>
</template>
