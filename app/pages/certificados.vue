<script setup lang="ts">
import type { Meta, Respuesta } from '~/types/api'
import {
  enlaceCertificado,
  enlaceConsulta,
  FILTROS_CERTIFICADOS_VACIOS,
  filtrosCertificadosDesdeQuery,
  hayFiltrosCertificados,
  parametrosApi,
  parametrosCertificados,
  resumenEnvioCertificados,
  SITUACIONES_CERTIFICADO,
  tipoLegible,
  type CertificadoStaff,
  type FiltrosCertificados,
  type LineaEnvioCertificados,
  type MetaCertificados,
  type PagadoSinCertificado,
  type SituacionCertificado,
} from '~/utils/certificados'
import { alternarDestinatarios, enviarPorTandas, type ProgresoEnvio, type ResultadoEnvio, type SeleccionEnvio } from '~/utils/enviosMasivos'
import { mensajeError } from '~/utils/errores'
import { fechaHoraLima, numero } from '~/utils/formato'
import { esNoDisponible } from '~/utils/portal'

/**
 * Certificados del evento (backend spec 015, fase 1). Los certificados se firman fuera del sistema: aquí se importa
 * el Excel (DNI + código), se suben los PDF firmados (`<código>[R][R][R].pdf`), se ve en qué está cada uno
 * (Falta PDF · Listo para entregar · Entregado) y se envían por correo con el PDF adjunto y dos enlaces: el del
 * certificado y la consulta pública por DNI.
 */
definePageMeta({ permiso: 'certificados.ver' })
useHead({ title: 'Certificados · Panel CIISIC' })

const { api, leerArchivo } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()
const { copiar } = useCopiar()
const route = useRoute()
const router = useRouter()
const id = useId()

const puedeOperar = computed(() => auth.puede('certificados.operar'))
const puedeGestionar = computed(() => auth.puede('certificados.gestionar'))
const origen = import.meta.client ? window.location.origin : ''

const filtros = reactive<FiltrosCertificados>(filtrosCertificadosDesdeQuery(route.query))
const busqueda = ref(filtros.q)
const filas = ref<CertificadoStaff[]>([])
const pagados = ref<PagadoSinCertificado[]>([])
const meta = ref<MetaCertificados | Meta | null>(null)
const resumen = ref<MetaCertificados['resumen'] | null>(null)
const cargando = ref(false)
const noDisponible = ref(false)
const seleccion = ref<SeleccionEnvio>({})
const eligiendo = ref(false)

const elegidas = computed(() => Object.keys(seleccion.value).map(Number))
const conFiltros = computed(() => hayFiltrosCertificados(filtros))
const paginaCompleta = computed(() => filas.value.length > 0 && filas.value.filter(f => f.tieneArchivo).every(f => seleccion.value[f.id]))

let consulta = 0

async function cargar() {
  const turno = ++consulta
  const eventoId = eventos.seleccionadoId
  if (!eventoId) {
    filas.value = []
    pagados.value = []
    meta.value = null
    return
  }
  cargando.value = true
  try {
    if (filtros.vista === 'pagados') {
      const respuesta = await api<Respuesta<PagadoSinCertificado[]>>(`events/${eventoId}/certificates/pending-inscriptions`, { query: { ...parametrosApi(filtros), pageSize: 20 } })
      if (turno !== consulta) return
      pagados.value = respuesta.data
      meta.value = respuesta.meta ?? null
    } else {
      const respuesta = await api<Omit<Respuesta<CertificadoStaff[]>, 'meta'> & { meta?: MetaCertificados }>(`events/${eventoId}/certificates`, { query: { ...parametrosApi(filtros), pageSize: 20 } })
      if (turno !== consulta) return
      filas.value = respuesta.data
      meta.value = respuesta.meta ?? null
      resumen.value = respuesta.meta?.resumen ?? null
    }
    noDisponible.value = false
  } catch (error) {
    if (turno !== consulta) return
    if (esNoDisponible(error)) noDisponible.value = true
    else toast.error(mensajeError(error))
  } finally {
    if (turno === consulta) cargando.value = false
  }
}

/** El resumen se pide aparte cuando se mira la lista de pagados (las tarjetas siguen al día). */
async function cargarResumen() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId) return
  try {
    const respuesta = await api<{ meta?: MetaCertificados }>(`events/${eventoId}/certificates`, { query: { pageSize: 1 } })
    resumen.value = respuesta.meta?.resumen ?? null
  } catch {
    // las tarjetas quedan como estaban
  }
}

function aplicar(pagina = 1) {
  filtros.page = pagina
  router.replace({ query: parametrosCertificados(filtros) })
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
watch(() => [filtros.situacion, filtros.sinInscripcion], () => aplicar())
watch(() => filtros.vista, (vista) => {
  seleccion.value = {}
  aplicar()
  if (vista === 'pagados' && !resumen.value) cargarResumen()
})

watch(() => eventos.seleccionadoId, (eventoId, anterior) => {
  filas.value = []
  pagados.value = []
  meta.value = null
  resumen.value = null
  seleccion.value = {}
  if (eventoId && anterior) {
    filtros.page = 1
    router.replace({ query: parametrosCertificados(filtros) })
  }
  cargar()
  if (filtros.vista === 'pagados') cargarResumen()
}, { immediate: true })

onBeforeUnmount(() => clearTimeout(temporizador))

function limpiar() {
  busqueda.value = ''
  Object.assign(filtros, { ...FILTROS_CERTIFICADOS_VACIOS, vista: filtros.vista })
}

function verSituacion(situacion: SituacionCertificado | '') {
  filtros.vista = 'certificados'
  filtros.situacion = situacion
}

function recargarTodo() {
  cargar()
  if (filtros.vista === 'pagados') cargarResumen()
}

// ─── Selección ──────────────────────────────────────────────────────────────

function alternarFila(fila: CertificadoStaff, marcada: boolean) {
  seleccion.value = alternarDestinatarios(seleccion.value, [fila.id], marcada)
}

/** Solo los que tienen PDF se pueden enviar. */
function alternarPagina(marcada: boolean) {
  seleccion.value = alternarDestinatarios(seleccion.value, filas.value.filter(fila => fila.tieneArchivo).map(fila => fila.id), marcada)
}

/** Elige a todos los listos para entregar (con la búsqueda puesta), sin importar la página. */
async function elegirPorEntregar() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || eligiendo.value) return
  eligiendo.value = true
  try {
    const respuesta = await api<Respuesta<number[]>>(`events/${eventoId}/certificates/ids`, { query: parametrosApi({ ...filtros, situacion: 'POR_ENTREGAR' }, false) })
    seleccion.value = Object.fromEntries(respuesta.data.map(idElegido => [idElegido, true as const]))
    if (!respuesta.data.length) toast.info('No hay certificados listos para entregar con estos filtros.')
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    eligiendo.value = false
  }
}

// ─── Acciones por fila ──────────────────────────────────────────────────────

async function verPdf(fila: CertificadoStaff) {
  const eventoId = eventos.seleccionadoId
  if (!eventoId) return
  // La pestaña se abre antes de esperar, así el navegador no la bloquea
  const ventana = window.open('', '_blank')
  try {
    const archivo = await leerArchivo(`events/${eventoId}/certificates/${fila.id}/file`)
    const url = URL.createObjectURL(archivo)
    if (ventana) ventana.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    ventana?.close()
    toast.error(mensajeError(error))
  }
}

async function copiarEnlace(texto: string, que: string) {
  if (await copiar(texto)) toast.exito(`${que} copiado.`)
  else toast.info(texto)
}

const entradaPdf = ref<HTMLInputElement | null>(null)
const subiendoPara = ref<CertificadoStaff | null>(null)

function elegirPdfPara(fila: CertificadoStaff) {
  subiendoPara.value = fila
  entradaPdf.value?.click()
}

async function alElegirPdf(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const archivo = entrada.files?.[0]
  const fila = subiendoPara.value
  entrada.value = ''
  const eventoId = eventos.seleccionadoId
  if (!archivo || !fila || !eventoId) return
  if (fila.tieneArchivo && !(await confirmar({ titulo: 'Reemplazar el PDF', mensaje: `${fila.nombre} ya tiene un PDF firmado. ¿Reemplazarlo por «${archivo.name}»?`, textoConfirmar: 'Reemplazar' }))) return
  const cuerpo = new FormData()
  cuerpo.append('file', archivo, archivo.name)
  try {
    await api(`events/${eventoId}/certificates/${fila.id}/file`, { method: 'PUT', body: cuerpo })
    toast.exito(`PDF de ${fila.nombre} guardado.`)
    recargarTodo()
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    subiendoPara.value = null
  }
}

const anulando = ref<CertificadoStaff | null>(null)
const motivoAnulacion = ref('')
const guardandoAnulacion = ref(false)

async function anular() {
  const fila = anulando.value
  const eventoId = eventos.seleccionadoId
  if (!fila || !eventoId || motivoAnulacion.value.trim().length < 5) return
  guardandoAnulacion.value = true
  try {
    await api(`events/${eventoId}/certificates/${fila.id}/annul`, { method: 'POST', body: { motivo: motivoAnulacion.value.trim() } })
    toast.exito('Certificado anulado.')
    anulando.value = null
    recargarTodo()
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    guardandoAnulacion.value = false
  }
}

const probando = ref<CertificadoStaff | null>(null)
const correoPrueba = ref(auth.usuario?.correo ?? '')
const enviandoPrueba = ref(false)

async function enviarPrueba() {
  const fila = probando.value
  const eventoId = eventos.seleccionadoId
  if (!fila || !eventoId || !correoPrueba.value.trim()) return
  enviandoPrueba.value = true
  try {
    await api(`events/${eventoId}/certificates/${fila.id}/test`, { method: 'POST', body: { correo: correoPrueba.value.trim() } })
    toast.exito(`Prueba enviada a ${correoPrueba.value.trim()}.`)
    probando.value = null
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    enviandoPrueba.value = false
  }
}

// ─── Envío por correo ───────────────────────────────────────────────────────

type Fase = 'confirmar' | 'enviando' | 'listo'
const envioAbierto = ref(false)
const fase = ref<Fase>('confirmar')
const reenviar = ref(false)
const entiendo = ref(false)
const progreso = ref<ProgresoEnvio>({ hechas: 0, total: 0 })
const lineas = ref<LineaEnvioCertificados[]>([])
let detenerPedido = false
function detener() {
  detenerPedido = true
}
const porcentaje = computed(() => (progreso.value.total ? Math.round((progreso.value.hechas / progreso.value.total) * 100) : 0))

function abrirEnvio(ids?: number[]) {
  if (ids) seleccion.value = Object.fromEntries(ids.map(idElegido => [idElegido, true as const]))
  if (!elegidas.value.length) return
  fase.value = 'confirmar'
  reenviar.value = Boolean(ids)
  entiendo.value = false
  lineas.value = []
  envioAbierto.value = true
}

function cerrarEnvio() {
  if (fase.value === 'enviando') return
  envioAbierto.value = false
}

async function enviar() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || !entiendo.value || fase.value === 'enviando') return
  const ids = elegidas.value
  const pedirReenvio = reenviar.value
  fase.value = 'enviando'
  detenerPedido = false
  const envio = await enviarPorTandas({
    ids,
    enviar: async (tanda) => (await api<Respuesta<ResultadoEnvio>>(`events/${eventoId}/certificates/send`, { method: 'POST', body: { ids: tanda, reenviar: pedirReenvio } })).data,
    alAvanzar: (avance) => { progreso.value = avance },
    detener: () => detenerPedido,
  })
  lineas.value = resumenEnvioCertificados(envio, envio.corte?.tipo === 'error' ? mensajeError(envio.corte.error) : null)
  fase.value = 'listo'
  seleccion.value = {}
  await cargar()
}

// ─── Diálogos de carga ──────────────────────────────────────────────────────

const importarAbierto = ref(false)
const subirAbierto = ref(false)

const pestanas = [
  { id: 'certificados', label: 'Certificados', icon: 'heroicons:academic-cap' },
  { id: 'pagados', label: 'Pagados sin certificado', icon: 'heroicons:exclamation-circle' },
]
const vista = computed({
  get: () => filtros.vista,
  set: (valor: string) => { filtros.vista = valor === 'pagados' ? 'pagados' : 'certificados' },
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Certificados</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Importa el Excel con el código de cada certificado, sube los PDF firmados (se asocian solos por el código del nombre del archivo) y envíalos por correo.
          Cada persona también puede consultarlos con su DNI.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton variant="ghost" icon="heroicons:link" @click="copiarEnlace(enlaceConsulta(origen), 'Enlace de consulta')">Enlace de consulta por DNI</AppButton>
        <AppButton v-if="puedeGestionar" variant="secondary" icon="heroicons:table-cells" :disabled="!eventos.seleccionadoId" @click="importarAbierto = true">Importar Excel</AppButton>
        <AppButton v-if="puedeOperar" icon="heroicons:arrow-up-tray" :disabled="!eventos.seleccionadoId" @click="subirAbierto = true">Subir PDF firmados</AppButton>
      </div>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <section v-else-if="noDisponible" class="card">
      <AppEmpty titulo="Esta pantalla aún no está disponible" descripcion="El servidor todavía no tiene el módulo de certificados. Se activa cuando se despliega la versión nueva del backend." icon="heroicons:clock" />
    </section>

    <template v-else>
      <section v-if="resumen" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Totales del evento">
        <button type="button" class="text-left" @click="verSituacion('FALTA_PDF')">
          <AppStat etiqueta="Falta PDF firmado" :valor="numero(resumen.faltaPdf)" detalle="En el Excel, sin su PDF" icon="heroicons:document-minus" tono="warn" />
        </button>
        <button type="button" class="text-left" @click="verSituacion('POR_ENTREGAR')">
          <AppStat etiqueta="Listos para entregar" :valor="numero(resumen.porEntregar)" detalle="Con PDF, sin enviar" icon="heroicons:document-check" tono="info" />
        </button>
        <button type="button" class="text-left" @click="verSituacion('ENTREGADO')">
          <AppStat etiqueta="Entregados" :valor="numero(resumen.entregados)" detalle="Enviados por correo" icon="heroicons:envelope-open" tono="ok" />
        </button>
        <button type="button" class="text-left" @click="vista = 'pagados'">
          <AppStat etiqueta="Pagados sin certificado" :valor="numero(resumen.pagadosSinCertificado)" :detalle="`Inscritos aprobados que no están en el Excel · ${numero(resumen.sinInscripcion)} sin inscripción pagada`" icon="heroicons:exclamation-circle" :tono="resumen.pagadosSinCertificado ? 'error' : 'brand'" />
        </button>
      </section>

      <AppTabs v-model="vista" :tabs="pestanas" />

      <section class="card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="relative md:col-span-2">
            <label :for="`${id}-buscar`" class="sr-only">Buscar</label>
            <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input :id="`${id}-buscar`" v-model="busqueda" type="search" class="field-control pl-9" :placeholder="vista === 'pagados' ? 'DNI, nombres o correo' : 'DNI, nombre, correo o código'">
          </div>
          <template v-if="vista === 'certificados'">
            <div>
              <label :for="`${id}-situacion`" class="sr-only">Situación</label>
              <select :id="`${id}-situacion`" v-model="filtros.situacion" class="field-control">
                <option value="">Todos (sin anulados)</option>
                <option v-for="(datos, clave) in SITUACIONES_CERTIFICADO" :key="clave" :value="clave">{{ datos.etiqueta }}</option>
              </select>
            </div>
            <div class="flex items-center justify-between gap-3">
              <label class="flex items-center gap-2 text-sm text-slate-300">
                <input v-model="filtros.sinInscripcion" type="checkbox" class="size-4 accent-brand-500"> Sin inscripción pagada
              </label>
              <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" :disabled="!conFiltros" @click="limpiar">Limpiar</AppButton>
            </div>
          </template>
        </div>
      </section>

      <!-- Certificados -->
      <section v-if="vista === 'certificados'" class="card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm text-slate-400" aria-live="polite">
          <span v-if="meta"><strong class="text-white tabular-nums">{{ numero(meta.total) }}</strong> {{ meta.total === 1 ? 'certificado' : 'certificados' }}<template v-if="conFiltros"> con estos filtros</template></span>
          <span v-else />
          <div v-if="puedeOperar" class="flex flex-wrap items-center gap-2">
            <template v-if="elegidas.length">
              <span class="text-slate-300"><strong class="text-white tabular-nums">{{ numero(elegidas.length) }}</strong> {{ elegidas.length === 1 ? 'elegido' : 'elegidos' }}</span>
              <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" @click="seleccion = {}">Quitar</AppButton>
              <AppButton size="sm" icon="heroicons:paper-airplane" @click="abrirEnvio()">Enviar por correo</AppButton>
            </template>
            <AppButton v-else size="sm" variant="secondary" icon="heroicons:check-circle" :loading="eligiendo" :disabled="!resumen?.porEntregar" @click="elegirPorEntregar">
              Elegir todos los listos para entregar<template v-if="resumen"> ({{ numero(resumen.porEntregar) }})</template>
            </AppButton>
          </div>
        </div>

        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th v-if="puedeOperar" class="w-10">
                  <label class="sr-only" :for="`${id}-todas`">Elegir los certificados con PDF de esta página</label>
                  <input :id="`${id}-todas`" type="checkbox" class="size-4 accent-brand-500" :checked="paginaCompleta" :disabled="!filas.some(f => f.tieneArchivo)" @change="alternarPagina(($event.target as HTMLInputElement).checked)">
                </th>
                <th>Persona</th>
                <th>Certificado</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filas" :key="fila.id">
                <td v-if="puedeOperar">
                  <label class="sr-only" :for="`${id}-${fila.id}`">Elegir a {{ fila.nombre }}</label>
                  <input :id="`${id}-${fila.id}`" type="checkbox" class="size-4 accent-brand-500" :checked="Boolean(seleccion[fila.id])" :disabled="!fila.tieneArchivo" :title="fila.tieneArchivo ? undefined : 'Aún no tiene su PDF firmado'" @change="alternarFila(fila, ($event.target as HTMLInputElement).checked)">
                </td>
                <td class="min-w-56">
                  <p class="font-medium text-white">{{ fila.nombre }}</p>
                  <p class="font-mono text-xs text-slate-400">DNI {{ fila.documento }}</p>
                  <p class="text-xs text-slate-500">{{ fila.correo }}</p>
                </td>
                <td class="min-w-40">
                  <p class="font-mono text-sm text-white">{{ fila.codigo }}</p>
                  <p class="text-xs text-slate-400">{{ tipoLegible(fila.tipo) }}<template v-if="fila.firmasDetectadas"> · {{ fila.firmasDetectadas }} firma(s)</template></p>
                </td>
                <td class="min-w-48">
                  <div class="flex flex-wrap gap-1">
                    <AppBadge :tono="SITUACIONES_CERTIFICADO[fila.situacion].tono" :title="SITUACIONES_CERTIFICADO[fila.situacion].ayuda">{{ SITUACIONES_CERTIFICADO[fila.situacion].etiqueta }}</AppBadge>
                    <AppBadge v-if="!fila.conInscripcion" tono="warn" title="No tiene una inscripción aprobada en este evento">Sin inscripción pagada</AppBadge>
                  </div>
                  <p v-if="fila.enviadoEn" class="mt-1 text-xs whitespace-nowrap text-slate-400">Enviado el {{ fechaHoraLima(fila.enviadoEn) }}</p>
                  <p v-else-if="fila.envioError" class="mt-1 text-xs text-red-300">Último envío falló: {{ fila.envioError }}</p>
                  <p v-if="fila.motivoAnulacion" class="mt-1 text-xs text-red-200">{{ fila.motivoAnulacion }}</p>
                </td>
                <td class="text-right whitespace-nowrap">
                  <div class="inline-flex items-center gap-1">
                    <AppButton v-if="fila.tieneArchivo" size="sm" variant="ghost" icon="heroicons:eye" @click="verPdf(fila)">Ver</AppButton>
                    <AppMenu etiqueta="Más" size="sm" variant="ghost">
                      <AppMenuItem v-if="fila.tieneArchivo" icon="heroicons:link" @click="copiarEnlace(enlaceCertificado(origen, fila.codigo), 'Enlace del certificado')">Copiar enlace del certificado</AppMenuItem>
                      <AppMenuItem v-if="puedeOperar && fila.estado !== 'ANULADO'" icon="heroicons:arrow-up-tray" @click="elegirPdfPara(fila)">{{ fila.tieneArchivo ? 'Reemplazar PDF' : 'Subir su PDF' }}</AppMenuItem>
                      <AppMenuItem v-if="puedeOperar && fila.tieneArchivo" icon="heroicons:paper-airplane" @click="abrirEnvio([fila.id])">{{ fila.enviadoEn ? 'Reenviar por correo' : 'Enviar por correo' }}</AppMenuItem>
                      <AppMenuItem v-if="puedeOperar && fila.tieneArchivo" icon="heroicons:beaker" @click="probando = fila">Enviarme una prueba</AppMenuItem>
                      <AppMenuItem v-if="puedeGestionar && fila.estado !== 'ANULADO'" icon="heroicons:no-symbol" peligro @click="anulando = fila; motivoAnulacion = ''">Anular</AppMenuItem>
                    </AppMenu>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="cargando && !filas.length" class="py-14 text-center text-sm text-slate-400">Cargando…</div>
        <AppEmpty
          v-else-if="!filas.length"
          :titulo="conFiltros ? 'No hay certificados con estos filtros' : 'Aún no hay certificados'"
          :descripcion="conFiltros ? undefined : 'Importa el Excel con los códigos y luego sube los PDF firmados.'"
          icon="heroicons:academic-cap"
        />
        <AppPagination :meta="meta" @cambiar="aplicar" />
      </section>

      <!-- Pagados sin certificado -->
      <section v-else class="card overflow-hidden">
        <p class="border-b border-white/10 px-5 py-3 text-sm text-slate-400">
          Inscritos con el pago aprobado que no vinieron en el Excel. Para darles certificado, agrégalos al Excel con su código y vuelve a importarlo.
        </p>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead><tr><th>Persona</th><th>Inscripción</th></tr></thead>
            <tbody>
              <tr v-for="fila in pagados" :key="fila.inscripcionId">
                <td class="min-w-56">
                  <p class="font-medium text-white">{{ fila.nombre }}</p>
                  <p class="font-mono text-xs text-slate-400">DNI {{ fila.documento }}</p>
                  <p class="text-xs text-slate-500">{{ fila.correo }}</p>
                </td>
                <td class="text-sm text-slate-300">{{ fila.tipoInscripcion ?? 'Cortesía' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="cargando && !pagados.length" class="py-14 text-center text-sm text-slate-400">Cargando…</div>
        <AppEmpty v-else-if="!pagados.length" titulo="Todos los que pagaron tienen certificado" icon="heroicons:check-badge" />
        <AppPagination :meta="meta" @cambiar="aplicar" />
      </section>
    </template>

    <input ref="entradaPdf" type="file" accept=".pdf,application/pdf" class="hidden" aria-hidden="true" tabindex="-1" @change="alElegirPdf">

    <CertificadosImportar :abierto="importarAbierto" :evento-id="eventos.seleccionadoId" @cerrar="importarAbierto = false" @importado="recargarTodo" />
    <CertificadosSubir :abierto="subirAbierto" :evento-id="eventos.seleccionadoId" @cerrar="subirAbierto = false" @subido="recargarTodo" />

    <!-- Anular -->
    <AppModal :abierto="Boolean(anulando)" titulo="Anular certificado" :descripcion="anulando ? `${anulando.nombre} · ${anulando.codigo}` : undefined" ancho="md" @cerrar="anulando = null">
      <div class="space-y-4">
        <p class="text-sm text-slate-300">Dejará de verse en la consulta por DNI, en su enlace y en su portal. El PDF se conserva.</p>
        <AppField label="Motivo" :for="`${id}-motivo`" required hint="Mínimo 5 caracteres.">
          <textarea :id="`${id}-motivo`" v-model="motivoAnulacion" rows="3" maxlength="500" class="field-control" />
        </AppField>
      </div>
      <template #acciones>
        <AppButton variant="ghost" @click="anulando = null">Cancelar</AppButton>
        <AppButton variant="danger" icon="heroicons:no-symbol" :loading="guardandoAnulacion" :disabled="motivoAnulacion.trim().length < 5" @click="anular">Anular</AppButton>
      </template>
    </AppModal>

    <!-- Prueba -->
    <AppModal :abierto="Boolean(probando)" titulo="Enviarme una prueba" :descripcion="probando ? `El correo de ${probando.nombre}, con su PDF, a otra dirección. No lo marca como entregado.` : undefined" ancho="md" @cerrar="probando = null">
      <AppField label="Correo de prueba" :for="`${id}-prueba`" required>
        <input :id="`${id}-prueba`" v-model="correoPrueba" type="email" class="field-control" autocomplete="email">
      </AppField>
      <template #acciones>
        <AppButton variant="ghost" @click="probando = null">Cancelar</AppButton>
        <AppButton icon="heroicons:paper-airplane" :loading="enviandoPrueba" :disabled="!correoPrueba.trim()" @click="enviarPrueba">Enviar prueba</AppButton>
      </template>
    </AppModal>

    <!-- Envío -->
    <AppModal
      :abierto="envioAbierto"
      :titulo="fase === 'listo' ? 'Listo' : fase === 'enviando' ? 'Enviando…' : 'Enviar certificados por correo'"
      :descripcion="fase === 'confirmar' ? 'Cada persona recibe su certificado en PDF adjunto, el enlace para verlo y el enlace para consultar todos sus certificados con su DNI.' : undefined"
      ancho="md"
      @cerrar="cerrarEnvio"
    >
      <div v-if="fase === 'confirmar'" class="space-y-5">
        <p class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10 ring-inset">
          Se enviará un correo a <strong class="text-white tabular-nums">{{ numero(elegidas.length) }}</strong> {{ elegidas.length === 1 ? 'persona' : 'personas' }}, cada uno por separado.
          Se envía en tandas de 25 y puedes detenerlo.
        </p>
        <AppSwitch v-model="reenviar" label="Volver a enviar a quien ya lo recibió" descripcion="Apagado, solo recibe quien aún no lo tiene (lo normal)." />
        <label class="flex items-start gap-3 text-sm text-slate-200">
          <input v-model="entiendo" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-brand-500">
          <span>Entiendo que los correos se envían de inmediato.</span>
        </label>
      </div>

      <div v-else-if="fase === 'enviando'" class="space-y-4" aria-live="polite">
        <p class="text-sm text-slate-300">Enviando… <strong class="text-white tabular-nums">{{ numero(progreso.hechas) }}</strong> de <span class="tabular-nums">{{ numero(progreso.total) }}</span>. No cierres esta pantalla.</p>
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
          <AppButton variant="secondary" @click="cerrarEnvio">Volver</AppButton>
          <AppButton icon="heroicons:paper-airplane" :disabled="!entiendo" @click="enviar">Enviar</AppButton>
        </template>
        <AppButton v-else-if="fase === 'enviando'" variant="secondary" icon="heroicons:stop" @click="detener">Detener</AppButton>
        <AppButton v-else @click="cerrarEnvio">Cerrar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
