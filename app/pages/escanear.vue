<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import {
  agregarRegistro,
  cuerpoLectura,
  cuerpoMarca,
  describirLectura,
  ESTADO_ESCANER,
  estadoEscanerInicial,
  esperaContinuar,
  PAUSA_TONOS_MS,
  pausaLaCamara,
  registroDeResultado,
  resultadoDeError,
  resultadoDeMarca,
  resultadoNoProcesada,
  resultadoQrNoValido,
  SENALES,
  textoVentana,
  TIPOS_DOCUMENTO_MARCA,
  ventanaActividad,
  type CuerpoMarca,
  type EstadoEscaner,
  type MarcaAsistencia,
  type RegistroLectura,
  type ResultadoLectura,
  type TipoDocumentoMarca,
  type TonoResultado,
} from '~/utils/asistencia'
import { crearColaEnvios } from '~/utils/colaEnvios'
import { aErrorApi } from '~/utils/errores'
import { claveLectura, debeProcesar, interpretarLectura, limpiarLectura, recienteTrasCerrar, type LecturaQr, type LecturaReciente } from '~/utils/lecturaQr'

/**
 * Escáner de asistencia a pantalla completa (layout `escaner`): cámara del celular, lector USB (escribe
 * el código y pulsa Enter) o DNI, sobre la actividad elegida en la barra (`SelectorActividad`).
 * Lo leído se interpreta con `interpretarLectura` (código del fotocheck o QR anterior; otra cosa no se
 * envía) y la misma lectura dentro de 3 s se ignora (`debeProcesar`, con aviso). Las lecturas se
 * registran de una en una y en orden (`crearColaEnvios`): ninguna se pierde sin aviso. Cada resultado se
 * muestra a pantalla completa con vibración y un pitido, y queda en las últimas 10 lecturas. Mientras se
 * ve un resultado que no se cierra solo (error o QR anterior) la cámara se pausa; al cerrarlo un error,
 * el mismo QR se puede volver a escanear.
 */
definePageMeta({ permiso: 'asistencia.marcar', layout: 'escaner' })
useHead({ title: 'Escanear asistencia · Panel CIISIC' })

const { api, urlArchivo, releerAcceso } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const estado = useState<EstadoEscaner>(ESTADO_ESCANER, estadoEscanerInicial)

type Modo = 'camara' | 'lector' | 'documento'

const MODOS: ReadonlyArray<{ valor: Modo, nombre: string, icono: string }> = [
  { valor: 'camara', nombre: 'Cámara', icono: 'heroicons:camera' },
  { valor: 'lector', nombre: 'Lector USB', icono: 'heroicons:qr-code' },
  { valor: 'documento', nombre: 'DNI', icono: 'heroicons:identification' },
]

// ─── Preferencias de este navegador (modo y sonido) ───

const CLAVE_MODO = 'ciisic:escaner-modo'
const CLAVE_SONIDO = 'ciisic:escaner-sonido'

function leerPreferencia(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardarPreferencia(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento la preferencia dura hasta recargar
  }
}

const modoGuardado = MODOS.find((opcion) => opcion.valor === leerPreferencia(CLAVE_MODO))?.valor
const modo = ref<Modo>(modoGuardado ?? 'camara')
const sonido = ref(leerPreferencia(CLAVE_SONIDO) !== '0')

// ─── Actividad y horario ───

const actividad = computed(() => estado.value.actividades.find((a) => a.id === estado.value.actividadId) ?? null)
const puedeFueraDeHorario = computed(() => auth.puede('asistencia.fuera_horario'))
const fueraDeHorario = ref(false)

const ahora = ref(new Date())
const ventana = computed(() => (actividad.value ? ventanaActividad(actividad.value, ahora.value) : null))

// ─── Resultado y últimas lecturas ───

const resultado = ref<ResultadoLectura | null>(null)
/** Cambia con cada resultado: la pantalla se vuelve a montar (foto, temporizador). */
const resultadoId = ref(0)
const resultadoActividad = ref<string | null>(null)
const recientes = ref<RegistroLectura[]>([])
const urlFoto = computed(() => {
  const id = resultado.value?.persona?.fotoInscripcionId
  return id ? urlArchivo(`inscriptions/${id}/photo`) : null
})

/** Con un error o el aviso del QR anterior a la vista, la cámara no lee (al cerrarlo, vuelve a leer). */
const camaraPausada = computed(() => pausaLaCamara(resultado.value))

let siguienteRegistro = 1

/** Agrega la lectura a la lista con su señal (vibración y pitido). */
function registrar(nuevo: ResultadoLectura, leido: string | null, actividadNombre: string | null) {
  recientes.value = agregarRegistro(recientes.value, registroDeResultado(nuevo, { id: siguienteRegistro++, instante: Date.now(), leido, actividad: actividadNombre }))
  senal(nuevo.tono)
}

/**
 * Muestra el resultado a pantalla completa (y lo registra en la lista). El aviso del QR anterior no se
 * reemplaza hasta «Continuar»: mientras tanto la cola no avanza y lo demás solo va a la lista.
 */
function mostrar(nuevo: ResultadoLectura, leido: string | null, actividadNombre: string | null) {
  registrar(nuevo, leido, actividadNombre)
  if (resultado.value && esperaContinuar(resultado.value)) return
  resultado.value = nuevo
  resultadoId.value++
  resultadoActividad.value = actividadNombre
  if (esperaContinuar(nuevo)) cola.detener()
}

/** Quita el resultado: tras un error la misma lectura se vuelve a procesar; la cola sigue. */
function quitarResultado() {
  const anterior = resultado.value
  resultado.value = null
  if (anterior) reciente = recienteTrasCerrar(reciente, anterior.tono)
  cola.reanudar()
}

function cerrarResultado() {
  quitarResultado()
  enfocar()
}

// ─── Envío de la marca ───

interface Envio {
  cuerpo: CuerpoMarca
  /** Lectura del QR (`null` en modo DNI). */
  lectura: LecturaQr | null
  /** Qué se leyó, para la lista. */
  leido: string
  actividadId: number
  actividadNombre: string
}

const enviando = ref(false)
let ultimoEnvio: Envio | null = null
/** Última lectura del QR procesada (`debeProcesar`). */
let reciente: LecturaReciente | null = null

/** Registra la marca y muestra el resultado; devuelve el código del error (o `null` si entró). */
async function enviar(envio: Envio): Promise<string | null> {
  enviando.value = true
  ultimoEnvio = envio
  try {
    const respuesta = await api<Respuesta<MarcaAsistencia>>(`activities/${envio.actividadId}/attendances`, { method: 'POST', body: envio.cuerpo })
    mostrar(resultadoDeMarca(respuesta.data), envio.leido, envio.actividadNombre)
    return null
  } catch (error) {
    const e = aErrorApi(error)
    if (e.status === 401) {
      // useApi ya lleva al login: lo que esperaba no se envía
      cola.vaciar()
      return e.code
    }
    mostrar(resultadoDeError(e, envio.lectura), envio.leido, envio.actividadNombre)
    if (e.code === 'OUT_OF_HOURS_NOT_ALLOWED') {
      // Se le quitó el permiso: se desmarca la casilla y se relee el acceso para ocultarla
      fueraDeHorario.value = false
      await releerAcceso()
    }
    return e.code
  } finally {
    enviando.value = false
  }
}

/** Una marca a la vez y en orden: lo que llega mientras se registra otra espera su turno. */
const cola = crearColaEnvios<Envio, string | null>(enviar)

/**
 * Pone el envío en la cola. Si la cola está llena no se pierde sin aviso: queda en la lista como «No
 * procesada» (rojo, con su señal) para volver a escanear. Devuelve la promesa del resultado o `null`.
 */
function encolar(envio: Envio): Promise<string | null | undefined> | null {
  const enCola = cola.agregar(envio)
  if (!enCola) registrar(resultadoNoProcesada(), envio.leido, envio.actividadNombre)
  return enCola
}

async function reintentar() {
  const envio = ultimoEnvio
  if (!envio || enviando.value) return
  const codigo = await encolar(envio)
  if (codigo === null && envio.lectura === null) limpiarDocumento()
}

/** Aviso breve: la misma lectura de hace un momento se ignoró. */
const avisoRepetida = ref(false)
let apagarAvisoRepetida: ReturnType<typeof setTimeout> | null = null

function avisarRepetida() {
  avisoRepetida.value = true
  if (apagarAvisoRepetida) clearTimeout(apagarAvisoRepetida)
  apagarAvisoRepetida = setTimeout(() => { avisoRepetida.value = false }, 2500)
}

/** Texto leído por la cámara o el lector USB. */
function alLeer(texto: string) {
  const actual = actividad.value
  if (!actual) return
  const lectura = interpretarLectura(texto)
  if (!lectura) {
    const limpio = limpiarLectura(texto)
    mostrar(resultadoQrNoValido(), limpio ? `Leído: ${limpio.slice(0, 40)}` : null, actual.nombre)
    return
  }
  const instante = Date.now()
  if (!debeProcesar(lectura, reciente, instante)) {
    avisarRepetida()
    return
  }
  const enCola = encolar({
    cuerpo: cuerpoLectura(lectura, puedeFueraDeHorario.value && fueraDeHorario.value),
    lectura,
    leido: describirLectura(lectura),
    actividadId: actual.id,
    actividadNombre: actual.nombre,
  })
  if (enCola) reciente = { clave: claveLectura(lectura), instante }
}

// ─── Lector USB ───

const textoLector = ref('')
const entradaLector = ref<HTMLInputElement | null>(null)
const lectorConFoco = ref(false)

function leerDelLector() {
  const texto = textoLector.value
  // Se limpia ya: el lector puede escribir el siguiente código enseguida
  textoLector.value = ''
  if (texto.trim()) alLeer(texto)
}

// ─── DNI ───

const documento = ref('')
const tipoDocumento = ref<TipoDocumentoMarca>('')
const errorDocumento = ref<string | null>(null)
const entradaDocumento = ref<HTMLInputElement | null>(null)
const selectorTipo = ref<HTMLSelectElement | null>(null)
/** Tras `AMBIGUOUS_DOCUMENT` el foco va al tipo de documento (al cerrar el resultado). */
let enfocarTipo = false

function limpiarDocumento() {
  documento.value = ''
  tipoDocumento.value = ''
  errorDocumento.value = null
}

async function registrarDocumento() {
  const actual = actividad.value
  if (!actual || enviando.value) return
  const marca = cuerpoMarca(
    { modo: 'dni', valor: documento.value, tipoDocumento: tipoDocumento.value, fueraDeHorario: fueraDeHorario.value },
    puedeFueraDeHorario.value,
  )
  if ('error' in marca) {
    errorDocumento.value = marca.error
    return
  }
  errorDocumento.value = null
  const leido = `${tipoDocumento.value ? tipoDocumento.value.toUpperCase() : 'Documento'} ${documento.value.trim()}`
  const enCola = encolar({ cuerpo: marca.body, lectura: null, leido, actividadId: actual.id, actividadNombre: actual.nombre })
  if (!enCola) {
    errorDocumento.value = 'Hay muchas lecturas esperando: vuelve a registrar en unos segundos.'
    return
  }
  const codigo = await enCola
  // No se envió (la sesión se cerró): no hay nada que limpiar
  if (codigo === undefined) return
  // Tras un error se conserva el número (para corregirlo); con AMBIGUOUS_DOCUMENT se elige DNI o CE
  if (codigo === null) limpiarDocumento()
  else enfocarTipo = codigo === 'AMBIGUOUS_DOCUMENT'
}

// ─── Foco ───

function enfocar() {
  nextTick(() => {
    if (modo.value === 'lector') {
      entradaLector.value?.focus()
    } else if (modo.value === 'documento' && !resultado.value) {
      if (enfocarTipo) selectorTipo.value?.focus()
      else entradaDocumento.value?.focus()
      enfocarTipo = false
    }
  })
}

function cambiarModo(nuevo: Modo) {
  modo.value = nuevo
}

watch(modo, (valor) => {
  guardarPreferencia(CLAVE_MODO, valor)
  enfocar()
})
watch(sonido, (valor) => guardarPreferencia(CLAVE_SONIDO, valor ? '1' : '0'))

/**
 * Cambia para volver a abrir la cámara (otra actividad o «Fuera de horario»: la librería no repite el
 * QR que sigue a la vista).
 */
const claveCamara = ref(0)

// Lo que ya esperaba en la cola se registra en la actividad en la que se leyó (va en cada envío).
// «Fuera de horario» es para una actividad concreta: al cambiar de actividad se desmarca.
watch(() => estado.value.actividadId, () => {
  fueraDeHorario.value = false
  quitarResultado()
  reciente = null
  claveCamara.value++
  enfocar()
})

// Con «Fuera de horario» recién marcado (p. ej. tras un OUTSIDE_WINDOW) el mismo QR se vuelve a procesar
watch(fueraDeHorario, () => {
  reciente = null
  claveCamara.value++
})

// ─── Señales: vibración y pitido ───

let audio: AudioContext | null = null

function contextoAudio(): AudioContext | null {
  if (!audio) {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contexto) return null
    try {
      audio = new Contexto()
    } catch {
      return null
    }
  }
  if (audio.state === 'suspended') audio.resume().catch(() => undefined)
  return audio
}

function pitar(tono: TonoResultado) {
  const contexto = contextoAudio()
  if (!contexto) return
  let inicio = contexto.currentTime + 0.01
  for (const { frecuencia, duracionMs } of SENALES[tono].tonos) {
    const oscilador = contexto.createOscillator()
    const volumen = contexto.createGain()
    const fin = inicio + duracionMs / 1000
    oscilador.type = tono === 'error' ? 'square' : 'sine'
    oscilador.frequency.value = frecuencia
    volumen.gain.setValueAtTime(0.0001, inicio)
    volumen.gain.exponentialRampToValueAtTime(0.2, inicio + 0.01)
    volumen.gain.exponentialRampToValueAtTime(0.0001, fin)
    oscilador.connect(volumen).connect(contexto.destination)
    oscilador.start(inicio)
    oscilador.stop(fin + 0.02)
    inicio = fin + PAUSA_TONOS_MS / 1000
  }
}

function senal(tono: TonoResultado) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(SENALES[tono].vibracion)
  } catch {
    // Sin vibración (iPhone, escritorio)
  }
  if (!sonido.value) return
  try {
    pitar(tono)
  } catch {
    // Sin Web Audio
  }
}

/** Los navegadores solo dejan sonar el audio tras un gesto: se activa con el primer toque o tecla. */
function desbloquearAudio() {
  if (sonido.value) contextoAudio()
}

let reloj: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  window.addEventListener('pointerdown', desbloquearAudio, { passive: true })
  window.addEventListener('keydown', desbloquearAudio)
  reloj = setInterval(() => { ahora.value = new Date() }, 30_000)
  enfocar()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', desbloquearAudio)
  window.removeEventListener('keydown', desbloquearAudio)
  if (reloj) clearInterval(reloj)
  if (apagarAvisoRepetida) clearTimeout(apagarAvisoRepetida)
  audio?.close().catch(() => undefined)
  audio = null
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-4">
    <h1 class="sr-only">Escanear asistencia</h1>

    <div v-if="eventos.cargado && !eventos.seleccionadoId" class="card lg:col-span-2">
      <AvisoSinEventos />
    </div>
    <div v-else-if="!eventos.cargado || estado.cargando" class="card py-14 text-center text-sm text-slate-400 lg:col-span-2" role="status">Cargando actividades…</div>
    <div v-else-if="!actividad" class="card lg:col-span-2">
      <AppEmpty
        titulo="Este evento no tiene actividades"
        :descripcion="auth.puede('eventos.configurar') ? 'Créalas en Eventos → Actividades.' : 'Aún no se crearon las actividades de este evento.'"
        icon="heroicons:calendar"
      >
        <AppButton
          v-if="eventos.seleccionadoId && auth.puede('eventos.configurar')"
          :to="`/eventos/${eventos.seleccionadoId}?tab=actividades`"
          icon="heroicons:plus"
        >
          Crear actividades
        </AppButton>
      </AppEmpty>
    </div>

    <template v-else>
      <section class="flex min-w-0 flex-col gap-3" aria-label="Lectura">
        <div class="flex flex-wrap items-center gap-2">
          <AppBadge v-if="ventana" :tono="ventana.estado === 'ABIERTA' ? 'ok' : 'warn'">{{ textoVentana(ventana) }}</AppBadge>
          <label v-if="puedeFueraDeHorario" class="flex items-center gap-2 text-sm text-slate-300">
            <input v-model="fueraDeHorario" type="checkbox" class="size-4 accent-brand-500">
            Fuera de horario
          </label>
          <!-- Etiqueta fija: el estado lo dicen el ícono y aria-pressed (sin «Sin sonido, no presionado») -->
          <button
            type="button"
            class="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white"
            :class="sonido ? 'text-slate-200' : 'text-slate-400 line-through decoration-slate-500'"
            :aria-pressed="sonido"
            @click="sonido = !sonido"
          >
            <Icon :name="sonido ? 'heroicons:speaker-wave' : 'heroicons:speaker-x-mark'" class="size-4" aria-hidden="true" />
            Sonido
          </button>
        </div>

        <p
          v-if="puedeFueraDeHorario && fueraDeHorario"
          class="flex items-start gap-2 rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-400/40"
          role="status"
        >
          <Icon name="heroicons:exclamation-triangle" class="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>«Fuera de horario» activado: las lecturas se registran en <strong class="font-semibold">{{ actividad.nombre }}</strong> sin validar su horario. Desmárcalo al terminar.</span>
        </p>

        <div class="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10" role="group" aria-label="Forma de lectura">
          <button
            v-for="opcion in MODOS"
            :key="opcion.valor"
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-semibold transition"
            :class="modo === opcion.valor ? 'bg-brand-500 text-navy-900' : 'text-slate-300 hover:bg-white/5 hover:text-white'"
            :aria-pressed="modo === opcion.valor"
            @click="cambiarModo(opcion.valor)"
          >
            <Icon :name="opcion.icono" class="size-5 shrink-0" aria-hidden="true" />
            {{ opcion.nombre }}
          </button>
        </div>

        <div v-if="modo === 'camara'" class="flex flex-col gap-2">
          <div class="h-[min(60dvh,34rem)] min-h-64 w-full">
            <ClientOnly>
              <LazyLectorCamara :key="claveCamara" :pausada="camaraPausada" @lectura="alLeer" @cambiar-modo="cambiarModo" />
              <template #fallback>
                <div class="flex h-full items-center justify-center rounded-2xl bg-black text-sm text-slate-400">Cargando la cámara…</div>
              </template>
            </ClientOnly>
          </div>
          <p class="text-center text-xs text-slate-400">Apunta al QR del fotocheck (en el celular de la persona) o de su credencial impresa.</p>
        </div>

        <form v-else-if="modo === 'lector'" class="card flex flex-col gap-3 p-5" @submit.prevent="leerDelLector">
          <label for="esc-lector" class="field-label">Código leído</label>
          <input
            id="esc-lector"
            ref="entradaLector"
            v-model="textoLector"
            class="field-control py-4 font-mono text-lg"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="Escanea con el lector o escribe el código y pulsa Enter"
            @focus="lectorConFoco = true"
            @blur="lectorConFoco = false"
          >
          <p class="flex items-center gap-2 text-xs" :class="lectorConFoco ? 'text-emerald-300' : 'text-amber-300'" aria-live="polite">
            <Icon :name="lectorConFoco ? 'heroicons:check-circle' : 'heroicons:cursor-arrow-rays'" class="size-4 shrink-0" aria-hidden="true" />
            {{ lectorConFoco ? 'Listo: escanea el QR con el lector.' : 'Haz clic en el campo para que el lector escriba en él.' }}
          </p>
          <AppButton type="submit" :disabled="!textoLector.trim()" icon="heroicons:check">Registrar</AppButton>
        </form>

        <form v-else class="card grid gap-3 p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-start" @submit.prevent="registrarDocumento">
          <AppField label="Tipo de documento" for="esc-tipo" hint="Elige DNI o CE si hay dos inscritos con el mismo número.">
            <select id="esc-tipo" ref="selectorTipo" v-model="tipoDocumento" class="field-control">
              <option v-for="opcion in TIPOS_DOCUMENTO_MARCA" :key="opcion.valor" :value="opcion.valor">{{ opcion.nombre }}</option>
            </select>
          </AppField>
          <AppField label="Número de documento" for="esc-documento" :error="errorDocumento">
            <input
              id="esc-documento"
              ref="entradaDocumento"
              v-model="documento"
              class="field-control py-3 font-mono text-lg"
              :inputmode="tipoDocumento === 'ce' ? 'text' : 'numeric'"
              autocomplete="off"
              spellcheck="false"
              placeholder="12345678"
              :aria-invalid="Boolean(errorDocumento)"
            >
          </AppField>
          <AppButton type="submit" class="sm:col-span-2" :loading="enviando" :disabled="!documento.trim()" icon="heroicons:check">Registrar asistencia</AppButton>
        </form>

        <p v-if="enviando" class="flex items-center gap-2 text-sm text-slate-400" role="status">
          <Icon name="heroicons:arrow-path" class="size-4 animate-spin" aria-hidden="true" />
          Registrando…
        </p>
        <p v-if="avisoRepetida" class="flex items-center gap-2 text-sm text-amber-200" role="status">
          <Icon name="heroicons:arrow-path-rounded-square" class="size-4 shrink-0" aria-hidden="true" />
          Misma lectura de hace un momento: se ignoró. Si fue a propósito, vuelve a escanear en unos segundos.
        </p>
      </section>

      <LecturasRecientes :lecturas="recientes" class="max-h-96 lg:max-h-[calc(100dvh-9rem)]" />
    </template>

    <PantallaResultado
      v-if="resultado"
      :key="resultadoId"
      :resultado="resultado"
      :url-foto="urlFoto"
      :actividad="resultadoActividad"
      :reintentando="enviando"
      @cerrar="cerrarResultado"
      @reintentar="reintentar"
    />
  </div>
</template>
