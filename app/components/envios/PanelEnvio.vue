<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { mensajeError } from '~/utils/errores'
import { nombreCompleto, numero } from '~/utils/formato'
import { esNoDisponible } from '~/utils/portal'
import {
  alternarDestinatarios,
  enviarPorTandas,
  fechaDeEnvio,
  FILTROS_ENVIO_VACIOS,
  filtrosEnvioDesdeQuery,
  hayFiltrosEnvio,
  idsElegidos,
  parametrosEnvio,
  resumenDeEnvio,
  rutaEnvio,
  seleccionDeIds,
  TEXTOS_CANAL,
  tipoDelDestinatario,
  todasMarcadas,
  type CanalEnvio,
  type DestinatarioEnvio,
  type FiltrosEnvio,
  type LineaResultado,
  type MetaEnvio,
  type ProgresoEnvio,
  type ResultadoEnvio,
  type SeleccionEnvio,
} from '~/utils/enviosMasivos'

/**
 * Envío masivo a los inscritos (spec 029; backend 039; los virtuales, spec 033 y backend 043): lista a quienes están aprobados y son de la
 * modalidad del canal (presenciales; virtuales en el acceso virtual) con la marca de «ya se le envió», deja elegirlos (también a todos los
 * pendientes de una vez) y manda por tandas, de a 25, con avance. El servidor vuelve a comprobar a cada persona y reserva la marca antes
 * de enviar: si falla algo, lo que faltó sigue «sin enviar».
 */
const props = withDefaults(defineProps<{
  canal: CanalEnvio
  /** Permiso de enviar (ver la lista basta con el de la página). */
  puedeEnviar: boolean
  /** Lo que el canal agrega al cuerpo del envío (el asunto y el mensaje de las ponencias). */
  cuerpoExtra?: object
  /** Por qué todavía no se puede enviar (p. ej. el mensaje no es válido). */
  bloqueo?: string | null
  textoEnviar: string
  /** Qué recibe la persona, en una frase para la confirmación. */
  queRecibe: string
}>(), { cuerpoExtra: () => ({}), bloqueo: null })

const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const id = useId()

type RespuestaLista = Omit<Respuesta<DestinatarioEnvio[]>, 'meta'> & { meta?: MetaEnvio }

const textos = computed(() => TEXTOS_CANAL[props.canal])
const filtros = reactive<FiltrosEnvio>(filtrosEnvioDesdeQuery(route.query))
const filas = ref<DestinatarioEnvio[]>([])
const meta = ref<MetaEnvio | null>(null)
const cargando = ref(false)
const noDisponible = ref(false)
const busqueda = ref(filtros.q)
const eligiendo = ref(false)
const seleccion = ref<SeleccionEnvio>({})

const resumen = computed(() => meta.value?.resumen ?? null)
const elegidas = computed(() => idsElegidos(seleccion.value))
const conFiltros = computed(() => hayFiltrosEnvio(filtros))
const paginaCompleta = computed(() => todasMarcadas(seleccion.value, filas.value))

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
    const respuesta = await api<RespuestaLista>(rutaEnvio(eventoId, props.canal, 'lista'), { query: { ...parametrosEnvio(filtros), pageSize: 20 } })
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
  router.replace({ query: parametrosEnvio(filtros) })
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
watch(() => filtros.enviado, () => aplicar())

watch(() => eventos.seleccionadoId, (eventoId, anterior) => {
  filas.value = []
  meta.value = null
  seleccion.value = {}
  if (eventoId && anterior) {
    filtros.page = 1
    sincronizarUrl()
  }
  cargar()
}, { immediate: true })

onBeforeUnmount(() => clearTimeout(temporizador))

function limpiar() {
  busqueda.value = ''
  Object.assign(filtros, FILTROS_ENVIO_VACIOS)
}

function alternarFila(fila: DestinatarioEnvio, marcada: boolean) {
  seleccion.value = alternarDestinatarios(seleccion.value, [fila.id], marcada)
}

function alternarPagina(marcada: boolean) {
  seleccion.value = alternarDestinatarios(seleccion.value, filas.value.map(fila => fila.id), marcada)
}

/** Elige a todos los que aún no recibieron el envío (con la búsqueda puesta), sin importar la página. */
async function elegirPendientes() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || eligiendo.value) return
  eligiendo.value = true
  try {
    const respuesta = await api<Respuesta<number[]> & { meta?: { total: number } }>(rutaEnvio(eventoId, props.canal, 'ids'), {
      query: parametrosEnvio({ ...filtros, enviado: 'no' }, false),
    })
    seleccion.value = seleccionDeIds(respuesta.data)
    const total = respuesta.meta?.total ?? respuesta.data.length
    if (!respuesta.data.length) toast.info('No hay nadie pendiente con estos filtros.')
    else if (total > respuesta.data.length) toast.info(`Se eligieron las primeras ${numero(respuesta.data.length)} de ${numero(total)}. Al terminar, vuelve a elegir para seguir con el resto.`)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    eligiendo.value = false
  }
}

// ─── Envío ──────────────────────────────────────────────────────────────────

type Fase = 'confirmar' | 'enviando' | 'listo'
const abierto = ref(false)
const fase = ref<Fase>('confirmar')
const reenviar = ref(false)
const entiendo = ref(false)
const progreso = ref<ProgresoEnvio>({ hechas: 0, total: 0 })
const lineas = ref<LineaResultado[]>([])
let detenerPedido = false

function detener() {
  detenerPedido = true
}

const porcentaje = computed(() => (progreso.value.total ? Math.round((progreso.value.hechas / progreso.value.total) * 100) : 0))

function abrir() {
  if (!elegidas.value.length || props.bloqueo) return
  fase.value = 'confirmar'
  reenviar.value = false
  entiendo.value = false
  lineas.value = []
  abierto.value = true
}

function cerrar() {
  if (fase.value === 'enviando') return
  abierto.value = false
}

async function enviar() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || !entiendo.value || fase.value === 'enviando') return
  const ids = elegidas.value
  const pedirReenvio = reenviar.value
  fase.value = 'enviando'
  detenerPedido = false
  progreso.value = { hechas: 0, total: ids.length }
  const envio = await enviarPorTandas({
    ids,
    enviar: async (tanda) => {
      const respuesta = await api<Respuesta<ResultadoEnvio>>(rutaEnvio(eventoId, props.canal, 'enviar'), {
        method: 'POST',
        body: { ids: tanda, reenviar: pedirReenvio, ...props.cuerpoExtra },
      })
      return respuesta.data
    },
    alAvanzar: (avance) => { progreso.value = avance },
    detener: () => detenerPedido,
  })
  lineas.value = resumenDeEnvio(envio, envio.corte?.tipo === 'error' ? mensajeError(envio.corte.error) : null, props.canal)
  fase.value = 'listo'
  seleccion.value = {}
  await cargar()
}
</script>

<template>
  <div class="space-y-6">
    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <section v-else-if="noDisponible" class="card">
      <AppEmpty titulo="Esta pantalla aún no está disponible" descripcion="El servidor todavía no tiene los envíos masivos. Se activa cuando se despliega la versión nueva del backend." icon="heroicons:clock" />
    </section>

    <template v-else>
      <section v-if="resumen" class="grid gap-4 sm:grid-cols-3" aria-label="Totales del evento">
        <AppStat :etiqueta="textos.inscritos" :valor="numero(resumen.total)" :detalle="textos.detalleInscritos" icon="heroicons:users" />
        <AppStat etiqueta="Ya enviado" :valor="numero(resumen.enviados)" :detalle="textos.enviado" icon="heroicons:envelope-open" tono="ok" />
        <AppStat etiqueta="Sin enviar" :valor="numero(resumen.pendientes)" :detalle="textos.sinEnviar" icon="heroicons:paper-airplane" tono="warn" />
      </section>

      <slot name="editor" />

      <section class="card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="relative md:col-span-2">
            <label :for="`${id}-buscar`" class="sr-only">Buscar</label>
            <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input :id="`${id}-buscar`" v-model="busqueda" type="search" class="field-control pl-9" placeholder="Documento, nombres o correo">
          </div>
          <div>
            <label :for="`${id}-enviado`" class="sr-only">Estado del envío</label>
            <select :id="`${id}-enviado`" v-model="filtros.enviado" class="field-control">
              <option value="">Enviados y sin enviar</option>
              <option value="no">Solo los sin enviar</option>
              <option value="si">Solo los ya enviados</option>
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
          <div v-if="puedeEnviar" class="flex flex-wrap items-center gap-2">
            <template v-if="elegidas.length">
              <span class="text-slate-300"><strong class="text-white tabular-nums">{{ numero(elegidas.length) }}</strong> {{ elegidas.length === 1 ? 'elegida' : 'elegidas' }}</span>
              <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" @click="seleccion = {}">Quitar</AppButton>
              <AppButton size="sm" icon="heroicons:paper-airplane" :disabled="Boolean(bloqueo)" :title="bloqueo ?? undefined" @click="abrir">{{ textoEnviar }}</AppButton>
            </template>
            <AppButton v-else size="sm" variant="secondary" icon="heroicons:check-circle" :loading="eligiendo" :disabled="!resumen?.pendientes" @click="elegirPendientes">
              Elegir a todos los sin enviar<template v-if="resumen"> ({{ numero(resumen.pendientes) }})</template>
            </AppButton>
          </div>
        </div>
        <p v-if="puedeEnviar && bloqueo && elegidas.length" class="border-b border-white/10 bg-amber-400/10 px-5 py-2 text-xs text-amber-100">{{ bloqueo }}</p>

        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th v-if="puedeEnviar" class="w-10">
                  <label class="sr-only" :for="`${id}-todas`">Elegir a todas las personas de esta página</label>
                  <input :id="`${id}-todas`" type="checkbox" class="size-4 accent-brand-500" :checked="paginaCompleta" :disabled="!filas.length" @change="alternarPagina(($event.target as HTMLInputElement).checked)">
                </th>
                <th>Persona</th>
                <th>Inscripción</th>
                <th>{{ textos.columna }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filas" :key="fila.id">
                <td v-if="puedeEnviar">
                  <label class="sr-only" :for="`${id}-${fila.id}`">Elegir a {{ nombreCompleto(fila) }}</label>
                  <input :id="`${id}-${fila.id}`" type="checkbox" class="size-4 accent-brand-500" :checked="Boolean(seleccion[fila.id])" @change="alternarFila(fila, ($event.target as HTMLInputElement).checked)">
                </td>
                <td class="min-w-52">
                  <p class="font-medium text-white">{{ nombreCompleto(fila) }}</p>
                  <p class="font-mono text-xs text-slate-400">{{ fila.tipoDocumento.toUpperCase() }} {{ fila.numeroDocumento }}</p>
                  <p class="text-xs text-slate-500">{{ fila.correo }}</p>
                </td>
                <td class="max-w-64 text-sm text-slate-300">{{ tipoDelDestinatario(fila) }}</td>
                <td class="whitespace-nowrap">
                  <AppBadge v-if="fila.enviadoEn" tono="ok">{{ fechaDeEnvio(fila) }}</AppBadge>
                  <AppBadge v-else tono="neutral">Sin enviar</AppBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="cargando && !filas.length" class="py-14 text-center text-sm text-slate-400">Cargando…</div>
        <AppEmpty
          v-else-if="!filas.length"
          :titulo="conFiltros ? 'No hay personas con estos filtros' : textos.vacio"
          icon="heroicons:users"
        />
        <AppPagination :meta="meta" @cambiar="aplicar" />
      </section>
    </template>

    <AppModal
      :abierto="abierto"
      :titulo="fase === 'listo' ? 'Listo' : fase === 'enviando' ? 'Enviando…' : textoEnviar"
      :descripcion="fase === 'confirmar' ? queRecibe : undefined"
      ancho="md"
      @cerrar="cerrar"
    >
      <div v-if="fase === 'confirmar'" class="space-y-5">
        <p class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10 ring-inset">
          Se enviará un correo a <strong class="text-white tabular-nums">{{ numero(elegidas.length) }}</strong> {{ elegidas.length === 1 ? 'persona' : 'personas' }}, cada correo por separado: nadie ve las direcciones de las demás.
          Se envía en tandas de 25 y puedes detenerlo; a quien ya se le envió se le omite.
        </p>
        <AppSwitch v-model="reenviar" label="Volver a enviar a quien ya lo recibió" descripcion="Apagado, solo recibe quien aún no lo tiene (lo normal)." />
        <label class="flex items-start gap-3 text-sm text-slate-200">
          <input v-model="entiendo" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-brand-500">
          <span>Entiendo que los correos se envían de inmediato.</span>
        </label>
      </div>

      <div v-else-if="fase === 'enviando'" class="space-y-4" aria-live="polite">
        <p class="text-sm text-slate-300">
          Enviando… <strong class="text-white tabular-nums">{{ numero(progreso.hechas) }}</strong> de <span class="tabular-nums">{{ numero(progreso.total) }}</span>. No cierres esta pantalla.
        </p>
        <div class="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="porcentaje" aria-valuemin="0" aria-valuemax="100" aria-label="Avance del envío">
          <div class="h-full rounded-full bg-brand-400 transition-[width] duration-300" :style="{ width: `${porcentaje}%` }" />
        </div>
      </div>

      <div v-else class="space-y-3" aria-live="polite">
        <p
          v-for="linea in lineas"
          :key="linea.texto"
          class="flex gap-2 rounded-xl px-4 py-3 text-sm ring-1 ring-inset"
          :class="linea.tono === 'ok' ? 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/25' : linea.tono === 'warn' ? 'bg-amber-400/10 text-amber-100 ring-amber-300/25' : 'bg-red-500/10 text-red-200 ring-red-400/25'"
        >
          <Icon :name="linea.tono === 'ok' ? 'heroicons:check-circle' : 'heroicons:exclamation-triangle'" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {{ linea.texto }}
        </p>
      </div>

      <template #acciones>
        <template v-if="fase === 'confirmar'">
          <AppButton variant="secondary" @click="cerrar">Volver</AppButton>
          <AppButton icon="heroicons:paper-airplane" :disabled="!entiendo" @click="enviar">{{ textoEnviar }}</AppButton>
        </template>
        <AppButton v-else-if="fase === 'enviando'" variant="secondary" icon="heroicons:stop" @click="detener">Detener</AppButton>
        <AppButton v-else @click="cerrar">Cerrar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
