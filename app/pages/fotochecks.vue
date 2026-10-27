<script setup lang="ts">
import { mensajeError } from '~/utils/errores'
import { almacenDelNavegador } from '~/utils/fotocheck'
import { numero } from '~/utils/formato'
import {
  ASISTENTE_EJEMPLO,
  calcularRejilla,
  configPorDefectoFotocheck,
  esImpresoFotocheck,
  formatoCm,
  guardarConfigFotocheck,
  guardarImpresosFotocheck,
  leerConfigFotocheck,
  leerImpresosFotocheck,
  leerInscritosCsv,
  medidasHoja,
  normalizarConfigFotocheck,
  olvidarQrs,
  ordenarAsistentes,
  paginarFotochecks,
  resumenRejilla,
  rutaExportacionInscritos,
  type AsistenteFotocheck,
  type ConfigFotocheck,
} from '~/utils/fotochecks'

// Mismo permiso que exportar a CSV: el código del QR solo sale en ese CSV (backend spec 040) y es una credencial.
definePageMeta({ permiso: 'inscripciones.exportar' })
useHead({ title: 'Fotochecks · Panel CIISIC' })

const eventos = useEventoStore()
const toast = useToast()
const { leerArchivo } = useApi()
const { confirmar } = useConfirm()
const almacen = almacenDelNavegador()

// ─── Diseño (se recuerda en este navegador) ───

const config = ref<ConfigFotocheck>(leerConfigFotocheck(almacen) ?? configPorDefectoFotocheck())
const efectiva = computed(() => normalizarConfigFotocheck(config.value))
const orden = computed(() => efectiva.value.orden)
watch(config, (valor) => guardarConfigFotocheck(almacen, normalizarConfigFotocheck(valor)), { deep: true })

const rejilla = computed(() => {
  const { margen, separacion, orientacion } = efectiva.value
  return calcularRejilla(medidasHoja(efectiva.value), efectiva.value, margen, separacion, orientacion)
})

/** Textos del evento: los editados o, si están vacíos, los del evento elegido. */
const evento = computed(() => ({
  corto: efectiva.value.textos.eventoCorto || eventos.seleccionado?.nombreCorto || '',
  nombre: efectiva.value.textos.eventoNombre || eventos.seleccionado?.nombre || '',
}))

// ─── Personas: lo que dice el CSV, lo agregado a mano y lo elegido ───

const cargados = shallowRef<AsistenteFotocheck[]>([])
const manuales = ref<AsistenteFotocheck[]>([])
const asistentes = computed(() => [...cargados.value, ...manuales.value])
const seleccion = ref<ReadonlySet<string>>(new Set())
const impresos = ref<ReadonlySet<number>>(leerImpresosFotocheck(almacen, eventos.seleccionadoId))
const cargando = ref(false)
const resumen = ref<{ sinCodigo: number, noAprobados: number } | null>(null)
const aviso = ref<string | null>(null)

const seleccionados = computed(() => ordenarAsistentes(asistentes.value.filter((persona) => seleccion.value.has(persona.clave)), orden.value))
const puedeImprimir = computed(() => seleccionados.value.length > 0 && rejilla.value.porHoja > 0)
const resumenTexto = computed(() => resumenRejilla(rejilla.value, seleccionados.value.length))

/** Lo que muestra la vista previa: lo elegido; si no hay nada elegido, los primeros de la lista o una persona de ejemplo. */
const muestra = computed<{ personas: readonly AsistenteFotocheck[], aviso: string | null }>(() => {
  if (seleccionados.value.length) return { personas: seleccionados.value, aviso: null }
  if (asistentes.value.length) {
    const primeros = ordenarAsistentes(asistentes.value.filter((persona) => !persona.virtual), orden.value).slice(0, Math.max(1, rejilla.value.porHoja))
    return { personas: primeros, aviso: 'Muestra: todavía no elegiste a nadie, así que ves a los primeros de la lista.' }
  }
  return { personas: [ASISTENTE_EJEMPLO], aviso: 'Ejemplo con datos ficticios: carga a los inscritos para ver los fotochecks reales.' }
})

/** El código del QR es una credencial: lo cargado vive solo en memoria y se descarta al cambiar de evento o de pantalla. */
function descartar() {
  cargados.value = []
  manuales.value = []
  seleccion.value = new Set()
  resumen.value = null
  aviso.value = null
  olvidarQrs()
}

watch(() => eventos.seleccionadoId, (id) => {
  descartar()
  impresos.value = leerImpresosFotocheck(almacen, id)
})

onBeforeUnmount(olvidarQrs)

const AVISO_SIN_CODIGO = 'El CSV no trae la columna «Código QR»: el servidor todavía no tiene el cambio que la agrega (backend, spec 040, pendiente de desplegar). Despliégalo y vuelve a cargar.'

/** Lee el CSV (del servidor o de un archivo propio) y deja elegidos a los presenciales que aún no se imprimieron. */
function aplicarCsv(texto: string) {
  const resultado = leerInscritosCsv(texto)
  if (resultado.faltanColumnas.includes('Código QR')) {
    aviso.value = AVISO_SIN_CODIGO
    return
  }
  if (resultado.faltanColumnas.length) {
    aviso.value = `Ese archivo no trae las columnas ${resultado.faltanColumnas.map((nombre) => `«${nombre}»`).join(', ')}. Usa el CSV de Inscripciones → Exportar CSV.`
    return
  }
  aviso.value = null
  cargados.value = resultado.asistentes
  resumen.value = { sinCodigo: resultado.sinCodigo, noAprobados: resultado.noAprobados }
  seleccion.value = new Set(resultado.asistentes.filter((persona) => !persona.virtual && !esImpresoFotocheck(persona, impresos.value)).map((persona) => persona.clave))
  if (resultado.asistentes.length) toast.exito(`${numero(resultado.asistentes.length)} inscritos cargados.`)
  else toast.info('No hay inscritos aprobados con código para imprimir.')
}

async function cargarDelServidor() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId || cargando.value) return
  cargando.value = true
  try {
    const archivo = await leerArchivo(rutaExportacionInscritos(eventoId))
    const texto = await archivo.text()
    if (eventoId === eventos.seleccionadoId) aplicarCsv(texto)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}

const MAXIMO_CSV_BYTES = 20 * 1024 * 1024

async function cargarArchivo(archivo: File) {
  if (archivo.size > MAXIMO_CSV_BYTES) {
    toast.error('El archivo pesa demasiado para ser un CSV de inscripciones.')
    return
  }
  try {
    aplicarCsv(await archivo.text())
  } catch {
    toast.error('No se pudo leer el archivo.')
  }
}

function agregarManual(persona: AsistenteFotocheck) {
  manuales.value = [...manuales.value, persona]
}

function quitarManual(clave: string) {
  manuales.value = manuales.value.filter((persona) => persona.clave !== clave)
  const siguiente = new Set(seleccion.value)
  siguiente.delete(clave)
  seleccion.value = siguiente
}

/** Marca o desmarca como impresas (solo ids de inscripción, en este navegador). */
function marcar(ids: number[], impreso: boolean) {
  const siguiente = new Set(impresos.value)
  for (const id of ids) {
    if (impreso) siguiente.add(id)
    else siguiente.delete(id)
  }
  impresos.value = siguiente
  guardarImpresosFotocheck(almacen, eventos.seleccionadoId, siguiente)
}

// ─── Impresión ───

async function preguntarImpresos() {
  const pendientes = seleccionados.value.flatMap((persona) => (persona.id === null || impresos.value.has(persona.id) ? [] : [persona.id]))
  if (!pendientes.length) return
  const marcarlos = await confirmar({
    titulo: '¿Marcar como impresos?',
    mensaje: `Si imprimiste los ${numero(pendientes.length)} fotochecks, márcalos para sacar la próxima vez solo los pendientes. La marca queda solo en este navegador.`,
    textoConfirmar: 'Marcar como impresos',
  })
  if (marcarlos) marcar(pendientes, true)
}

const { imprimiendo, imprimir } = useImpresionFotochecks({
  puedeImprimir: () => puedeImprimir.value,
  hoja: () => ({ ancho: rejilla.value.hojaAncho, alto: rejilla.value.hojaAlto }),
  titulo: () => `Fotochecks ${evento.value.corto}`.trim(),
  muestra: () => [...new Set(seleccionados.value.map((persona) => `${persona.nombres}${persona.apellidos}${persona.rol}`).join(''))].join(''),
  alTerminar: () => { void preguntarImpresos() },
})

/** Las hojas completas solo existen mientras se imprime. */
const hojasImpresion = computed(() => (imprimiendo.value ? paginarFotochecks(seleccionados.value, rejilla.value.porHoja) : []))

const ampliada = ref(false)

async function imprimirDesdeAmpliada() {
  ampliada.value = false
  await nextTick()
  await imprimir()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Fotochecks</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-400">
        Imprime los fotochecks de los inscritos en hojas A4 (o la hoja que elijas): elige a quién, ajusta el diseño en modo oscuro o claro y revisa cómo saldrá antes de imprimir o guardar el PDF.
        Necesita el CSV de inscripciones con el código del QR.
      </p>
    </div>

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <FotochecksInscritos
        v-model:seleccion="seleccion"
        :asistentes="asistentes"
        :impresos="impresos"
        :orden="orden"
        :cargando="cargando"
        :puede-cargar="Boolean(eventos.seleccionadoId)"
        :resumen="resumen"
        :aviso="aviso"
        @cargar="cargarDelServidor"
        @archivo="cargarArchivo"
        @agregar="agregarManual"
        @quitar="quitarManual"
        @limpiar="descartar"
        @marcar="marcar"
      />

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <section class="card p-4 sm:p-5" aria-labelledby="fotochecks-diseno">
          <h2 id="fotochecks-diseno" class="mb-4 text-xl font-bold">Diseño</h2>
          <FotochecksDiseno v-model="config" :evento="evento" />
        </section>

        <section class="card p-4 sm:p-5 xl:sticky xl:top-20" aria-labelledby="fotochecks-vista">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="fotochecks-vista" class="text-xl font-bold">Vista previa de impresión</h2>
              <p class="mt-1 text-sm font-semibold text-slate-200" aria-live="polite">{{ resumenTexto }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <AppButton variant="secondary" icon="heroicons:arrows-pointing-out" @click="ampliada = true">Ampliar</AppButton>
              <AppButton icon="heroicons:printer" :disabled="!puedeImprimir" :title="puedeImprimir ? undefined : 'Elige al menos a una persona y una medida que quepa en la hoja'" @click="imprimir">
                Imprimir / Guardar PDF
              </AppButton>
            </div>
          </div>

          <FotochecksVistaPrevia :personas="muestra.personas" :rejilla="rejilla" :config="efectiva" :evento="evento" :muestra="muestra.aviso" alto="min(70dvh, 60rem)" />

          <details class="mt-4 rounded-xl bg-white/5 p-3 text-sm text-slate-300 ring-1 ring-white/10 ring-inset">
            <summary class="cursor-pointer font-medium text-white">Cómo sacar el PDF o imprimir bien</summary>
            <ol class="mt-3 list-decimal space-y-1.5 pl-5">
              <li>Pulsa <strong class="text-white">Imprimir / Guardar PDF</strong>: se abre el cuadro de impresión del navegador con todas las hojas.</li>
              <li>En <strong class="text-white">Destino</strong> elige «Guardar como PDF» (para tener el archivo) o tu impresora.</li>
              <li>
                Papel del mismo tamaño que la hoja, <strong class="text-white">Márgenes: Ninguno</strong>, <strong class="text-white">Escala: 100 %</strong> (sin «ajustar a la página») y activa
                <strong class="text-white">Gráficos de fondo</strong> (en Chrome, en «Más ajustes»).
              </li>
              <li>Imprime primero <strong class="text-white">una hoja de prueba</strong> y mide un fotocheck: debe medir {{ formatoCm(efectiva.ancho) }} × {{ formatoCm(efectiva.alto) }} cm. Si la impresora recorta los bordes, sube el margen.</li>
              <li>Corta por el borde fino de cada fotocheck.</li>
            </ol>
          </details>
        </section>
      </div>
    </template>

    <AppModal :abierto="ampliada" titulo="Vista previa de impresión" :descripcion="resumenTexto" ancho="xl" @cerrar="ampliada = false">
      <FotochecksVistaPrevia :personas="muestra.personas" :rejilla="rejilla" :config="efectiva" :evento="evento" :muestra="muestra.aviso" alto="64dvh" />
      <template #acciones>
        <AppButton variant="secondary" @click="ampliada = false">Cerrar</AppButton>
        <AppButton icon="heroicons:printer" :disabled="!puedeImprimir" @click="imprimirDesdeAmpliada">Imprimir / Guardar PDF</AppButton>
      </template>
    </AppModal>

    <!-- Todas las hojas, solo mientras se imprime: en pantalla no se ven y el resto de la página se oculta al imprimir -->
    <Teleport to="body">
      <div v-if="imprimiendo" class="fotochecks-impresion" aria-hidden="true">
        <FotochecksHoja v-for="(hoja, indice) in hojasImpresion" :key="indice" :personas="hoja" :rejilla="rejilla" :config="efectiva" :evento="evento" />
      </div>
    </Teleport>
  </div>
</template>

<style>
/* Impresión de fotochecks: todo bajo `html.imprimiendo-fotochecks` para no afectar a ninguna otra pantalla */
@media screen {
  .fotochecks-impresion {
    display: none;
  }
}

@media print {
  html.imprimiendo-fotochecks,
  html.imprimiendo-fotochecks body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  html.imprimiendo-fotochecks #__nuxt {
    display: none !important;
  }

  html.imprimiendo-fotochecks .fotochecks-impresion {
    display: block;
  }

  html.imprimiendo-fotochecks .fotochecks-impresion,
  html.imprimiendo-fotochecks .fotochecks-impresion * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
