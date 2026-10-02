<script setup lang="ts">
import type { Categoria, InscripcionDetalle, InscripcionFila, Meta, Respuesta } from '~/types/api'
import { ESTADOS, fechaDia, fechaHoraLima, modalidadPago, nombreCompleto, soles } from '~/utils/formato'
import { aParametros, filtrosDesdeQuery, type FiltrosInscripcion } from '~/utils/filtros'
import { mensajeError } from '~/utils/errores'
import { descripcionInscripciones, placeholderBusqueda } from '~/utils/inscripciones'

definePageMeta({ permiso: 'inscripciones.ver' })
useHead({ title: 'Inscripciones · Panel CIISIC' })

const { api, urlArchivo } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const filtros = reactive<FiltrosInscripcion>(filtrosDesdeQuery(route.query))
const filas = ref<InscripcionFila[]>([])
const meta = ref<Meta | null>(null)
const categorias = ref<Categoria[]>([])
const cargando = ref(false)
const seleccionada = ref<number | null>(null)
const busqueda = ref(filtros.q)

/** Sin `pagos.ver` el monto y los datos de pago llegan en `null`: se ocultan sus columnas. */
const conPagos = computed(() => auth.puede('pagos.ver'))

const tipos = computed(() => categorias.value
  .filter((categoria) => !filtros.categoria || categoria.codigo === filtros.categoria)
  .flatMap((categoria) => categoria.tipos.map((tipo) => ({ ...tipo, categoria: categoria.nombre }))))

const exportarUrl = computed(() => {
  if (!eventos.seleccionadoId || !auth.puede('inscripciones.exportar')) return null
  const params = new URLSearchParams(aParametros(filtros, false)).toString()
  return urlArchivo(`events/${eventos.seleccionadoId}/inscriptions/export${params ? `?${params}` : ''}`)
})

/** Respuestas que llegan tarde (otro evento u otros filtros) se descartan. */
let consultaFilas = 0
let consultaCategorias = 0

async function cargar() {
  const consulta = ++consultaFilas
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    filas.value = []
    meta.value = null
    cargando.value = false
    return
  }
  cargando.value = true
  try {
    const respuesta = await api<Respuesta<InscripcionFila[]>>(`events/${eventoId}/inscriptions`, { query: { ...aParametros(filtros), pageSize: 20 } })
    if (consulta !== consultaFilas) return
    filas.value = respuesta.data
    meta.value = respuesta.meta ?? null
  } catch (error) {
    if (consulta === consultaFilas) toast.error(mensajeError(error))
  } finally {
    if (consulta === consultaFilas) cargando.value = false
  }
}

async function cargarCategorias() {
  const consulta = ++consultaCategorias
  const eventoId = eventos.seleccionadoId
  categorias.value = []
  if (!eventoId) return
  try {
    const lista = (await api<Respuesta<Categoria[]>>(`events/${eventoId}/registration-categories`)).data
    if (consulta === consultaCategorias) categorias.value = lista
  } catch {
    // Sin categorías solo se pierden esos filtros
  }
}

function sincronizarUrl() {
  router.replace({ query: aParametros(filtros) })
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

watch(() => [filtros.estado, filtros.categoria, filtros.tipoInscripcionId, filtros.esEstudianteUndc], () => aplicar())

watch(() => eventos.seleccionadoId, (id, anterior) => {
  // Las filas del evento anterior no quedan a la vista bajo el nuevo (ni sin evento)
  filas.value = []
  meta.value = null
  if (id && anterior) {
    Object.assign(filtros, { categoria: '', tipoInscripcionId: '', page: 1 })
    sincronizarUrl()
  }
  cargarCategorias()
  cargar()
}, { immediate: true })

/** Eliminada desde el detalle (solo el Owner): se cierra y se recarga la página actual. */
function alEliminar() {
  seleccionada.value = null
  cargar()
}

function alActualizar(detalle: InscripcionDetalle) {
  const fila = filas.value.find((item) => item.id === detalle.id)
  if (fila) {
    fila.estado = detalle.estado
    fila.revisadoEn = detalle.revision.revisadoEn
  }
}

function limpiar() {
  busqueda.value = ''
  Object.assign(filtros, { estado: '', categoria: '', tipoInscripcionId: '', esEstudianteUndc: '', q: '', page: 1 })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Inscripciones</h1>
        <p class="mt-1 text-sm text-slate-400">{{ descripcionInscripciones(auth.puede) }}</p>
      </div>
      <a
        v-if="exportarUrl"
        :href="exportarUrl"
        class="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/15 ring-inset transition hover:bg-white/10"
      >
        <Icon name="heroicons:arrow-down-tray" class="size-4" aria-hidden="true" /> Exportar CSV
      </a>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <section class="card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1.4fr_1fr_auto]">
          <div class="relative">
            <label for="buscar" class="sr-only">Buscar</label>
            <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="buscar" v-model="busqueda" type="search" class="field-control pl-9" :placeholder="placeholderBusqueda(conPagos)">
          </div>
          <div>
            <label for="f-estado" class="sr-only">Estado</label>
            <select id="f-estado" v-model="filtros.estado" class="field-control">
              <option value="">Todos los estados</option>
              <option v-for="estado in ESTADOS" :key="estado.codigo" :value="estado.codigo">{{ estado.nombre }}</option>
            </select>
          </div>
          <div>
            <label for="f-categoria" class="sr-only">Categoría</label>
            <select id="f-categoria" v-model="filtros.categoria" class="field-control" @change="filtros.tipoInscripcionId = ''">
              <option value="">Todas las categorías</option>
              <option v-for="categoria in categorias" :key="categoria.id" :value="categoria.codigo">{{ categoria.nombre }}</option>
            </select>
          </div>
          <div>
            <label for="f-tipo" class="sr-only">Tipo de inscripción</label>
            <select id="f-tipo" v-model="filtros.tipoInscripcionId" class="field-control">
              <option value="">Todos los tipos</option>
              <option v-for="tipo in tipos" :key="tipo.id" :value="String(tipo.id)">{{ tipo.nombre }} {{ tipo.etiqueta ? `· ${tipo.etiqueta}` : '' }}</option>
            </select>
          </div>
          <div>
            <label for="f-undc" class="sr-only">Verificación UNDC</label>
            <select id="f-undc" v-model="filtros.esEstudianteUndc" class="field-control">
              <option value="">UNDC y externos</option>
              <option value="true">Solo UNDC verificados</option>
              <option value="false">No verificados</option>
            </select>
          </div>
          <AppButton variant="ghost" icon="heroicons:x-mark" @click="limpiar">Limpiar</AppButton>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>Participante</th>
                <th>Tipo</th>
                <template v-if="conPagos">
                  <th class="text-right">Monto</th>
                  <th>Pago</th>
                </template>
                <th>Estado</th>
                <th>Registrada</th>
                <th><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filas" :key="fila.id" class="cursor-pointer" @click="seleccionada = fila.id">
                <td class="text-slate-400 tabular-nums">{{ fila.id }}</td>
                <td>
                  <p class="font-medium text-white">{{ nombreCompleto(fila.participante) }}</p>
                  <p class="text-xs text-slate-400">
                    {{ fila.participante.tipoDocumento.toUpperCase() }} {{ fila.participante.numeroDocumento }} · {{ fila.participante.correo }}
                    <span v-if="fila.esCorreoVerificado" class="inline-flex align-middle text-emerald-300" title="Correo verificado con Google">
                      <Icon name="heroicons:check-badge" class="size-3.5" aria-hidden="true" /><span class="sr-only">Correo verificado con Google</span>
                    </span>
                  </p>
                </td>
                <td>
                  <p class="text-white">{{ fila.tipoInscripcion?.nombre ?? '—' }}</p>
                  <div class="mt-0.5 flex flex-wrap gap-1">
                    <AppBadge v-if="fila.tipoInscripcion?.etiqueta" tono="neutral">{{ fila.tipoInscripcion.etiqueta }}</AppBadge>
                    <AppBadge v-if="fila.esEstudianteUndc" tono="brand">UNDC</AppBadge>
                  </div>
                </td>
                <template v-if="conPagos">
                  <td class="text-right font-semibold text-white tabular-nums">{{ soles(fila.monto) }}</td>
                  <td>
                    <p>{{ modalidadPago(fila.modalidadPago) }}</p>
                    <p class="font-mono text-xs whitespace-nowrap text-slate-400">{{ fila.numeroOperacion ?? '—' }} · {{ fechaDia(fila.fechaPago) }}</p>
                  </td>
                </template>
                <td><AppBadge :estado="fila.estado.codigo">{{ fila.estado.nombre }}</AppBadge></td>
                <td class="text-xs whitespace-nowrap text-slate-400">{{ fechaHoraLima(fila.creadoEn) }}</td>
                <td class="text-right">
                  <AppButton size="sm" variant="secondary" icon="heroicons:eye" @click.stop="seleccionada = fila.id">
                    {{ auth.puede('inscripciones.validar') ? 'Revisar' : 'Ver' }}
                  </AppButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="cargando && !filas.length" class="py-14 text-center text-sm text-slate-400">Cargando inscripciones…</div>
        <AppEmpty v-else-if="!filas.length" titulo="No hay inscripciones con estos filtros" icon="heroicons:clipboard-document-list" />
        <AppPagination :meta="meta" @cambiar="aplicar" />
      </section>
    </template>

    <InscripcionDetalle :inscripcion-id="seleccionada" @cerrar="seleccionada = null" @actualizada="alActualizar" @eliminada="alEliminar" />
  </div>
</template>
