<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { fechaDia, fechaHoraLima, numero } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import { normalizarDocumento, TIPOS_DOCUMENTO } from '~/utils/participantes'
import {
  agruparPorDia,
  cuerpoPersona,
  errorDePuerta,
  formularioPersona,
  mensajeDePuerta,
  PROCEDENCIAS,
  ponenciaDePuertaInicial,
  rangoHorario,
  textoCupo,
  presenciales,
  tonoCupo,
  validarPersona,
  type MensajePuerta,
  type PonenciaEspecializada,
  type ResultadoPuerta,
  type TonoPuerta,
} from '~/utils/ponenciasEspecializadas'

definePageMeta({ permiso: 'especializadas.asistencia' })
useHead({ title: 'Asistencia en puerta · Panel CIISIC' })

interface Lectura {
  clave: number
  hora: string
  documento: string
  mensaje: MensajePuerta
}

const MAX_LECTURAS = 12

const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()
const { accesoLibre } = useAccesoPonencias()

const ponencias = ref<PonenciaEspecializada[]>([])
const cargando = ref(false)
const ponenciaId = ref<number | null>(null)
const form = reactive(formularioPersona())
const errores = ref<Record<string, string>>({})
const pideNombres = ref(false)
const registrando = ref(false)
const ultimo = ref<MensajePuerta | null>(null)
const lecturas = ref<Lectura[]>([])
const entrada = ref<HTMLInputElement | null>(null)
let secuencia = 0

/** Enlace desde el Programa (`?ponencia=`): se usa una sola vez. */
let ponenciaPedida = /^\d+$/.test(String(route.query.ponencia ?? '')) ? Number(route.query.ponencia) : null

const ponencia = computed(() => ponencias.value.find((p) => p.id === ponenciaId.value) ?? null)
const grupos = computed(() => agruparPorDia(ponencias.value))
const esDni = computed(() => form.tipoDocumento === 'dni')
const TONOS: Readonly<Record<TonoPuerta, string>> = {
  ok: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30',
  aviso: 'bg-amber-400/15 text-amber-100 ring-amber-300/30',
  error: 'bg-red-500/15 text-red-100 ring-red-400/30',
}
const ICONOS: Readonly<Record<TonoPuerta, string>> = {
  ok: 'heroicons:check-circle',
  aviso: 'heroicons:exclamation-triangle',
  error: 'heroicons:x-circle',
}

/** Respuestas que llegan tarde (de otro evento) se descartan. */
let consulta = 0

async function cargar() {
  const turno = ++consulta
  const eventoId = eventos.seleccionadoId
  ponencias.value = []
  ponenciaId.value = null
  if (!eventoId) return
  cargando.value = true
  try {
    const lista = (await api<Respuesta<PonenciaEspecializada[]>>(`events/${eventoId}/specialized-talks`)).data
    if (turno !== consulta) return
    ponencias.value = lista
    const pedida = ponenciaPedida !== null ? lista.find((p) => p.id === ponenciaPedida) : null
    ponenciaPedida = null
    ponenciaId.value = (pedida ?? ponenciaDePuertaInicial(lista))?.id ?? null
  } catch (error) {
    if (turno === consulta) toast.error(mensajeError(error))
  } finally {
    if (turno === consulta) cargando.value = false
  }
}
watch(() => eventos.seleccionadoId, () => {
  lecturas.value = []
  ultimo.value = null
  cargar()
}, { immediate: true })

watch(ponenciaId, () => {
  ultimo.value = null
  reiniciarCampos()
  nextTick(() => entrada.value?.focus())
})

watch(() => [form.tipoDocumento, form.numeroDocumento] as const, ([tipo, numeroDoc]) => {
  const limpio = normalizarDocumento(tipo, numeroDoc)
  if (limpio !== numeroDoc) form.numeroDocumento = limpio
})

function reiniciarCampos() {
  Object.assign(form, { numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', procedencia: '' })
  errores.value = {}
  pideNombres.value = false
}

/** Actualiza los contadores de la ponencia con los números que devolvió el servidor. */
function actualizarConteo(resultado: ResultadoPuerta) {
  const actual = ponencias.value.find((p) => p.id === resultado.ponencia.id)
  if (!actual) return
  actual.inscritos = resultado.ponencia.inscritos
  actual.inscritosPresenciales = resultado.ponencia.presenciales ?? resultado.ponencia.inscritos
  actual.inscritosVirtuales = resultado.ponencia.virtuales ?? 0
  actual.asistentes = resultado.ponencia.asistentes
  actual.cuposDisponibles = actual.cupo === null ? null : Math.max(0, actual.cupo - presenciales(actual))
}

function anotar(documento: string, mensaje: MensajePuerta) {
  lecturas.value = [{ clave: ++secuencia, hora: fechaHoraLima(new Date().toISOString()), documento, mensaje }, ...lecturas.value].slice(0, MAX_LECTURAS)
}

async function registrar() {
  if (registrando.value || !ponenciaId.value) return
  errores.value = validarPersona(form, { nombresObligatorios: pideNombres.value || form.tipoDocumento === 'ce' })
  if (Object.keys(errores.value).length) {
    ultimo.value = { tono: 'error', titulo: 'Documento no válido', detalle: Object.values(errores.value).join(' · ') }
    nextTick(() => entrada.value?.focus())
    return
  }
  registrando.value = true
  const documento = `${form.tipoDocumento.toUpperCase()} ${form.numeroDocumento}`
  try {
    const respuesta = await api<Respuesta<ResultadoPuerta>>(`specialized-talks/${ponenciaId.value}/check-in`, { method: 'POST', body: cuerpoPersona(form) })
    const mensaje = mensajeDePuerta(respuesta.data)
    ultimo.value = mensaje
    anotar(documento, mensaje)
    actualizarConteo(respuesta.data)
    reiniciarCampos()
  } catch (error) {
    const fallo = errorDePuerta(error)
    ultimo.value = { tono: fallo.tono, titulo: fallo.titulo, detalle: fallo.detalle }
    if (fallo.pideNombres) {
      // El DNI no trajo nombres: se conserva el documento y se piden a mano
      pideNombres.value = true
      errores.value = {}
      nextTick(() => document.getElementById('puerta-nombres')?.focus())
    } else {
      anotar(documento, { tono: fallo.tono, titulo: fallo.titulo, detalle: fallo.detalle })
      reiniciarCampos()
      // Un cupo lleno o una asistencia repetida cambian los números: se releen
      if (fallo.codigo === 'TALK_FULL' || fallo.codigo === 'ATTENDANCE_ALREADY_REGISTERED') cargarConteos()
    }
  } finally {
    registrando.value = false
    if (!pideNombres.value) nextTick(() => entrada.value?.focus())
  }
}

/** Relee el programa conservando la ponencia elegida (los contadores cambian por otras cuentas también). */
async function cargarConteos() {
  const eventoId = eventos.seleccionadoId
  if (!eventoId) return
  try {
    const lista = (await api<Respuesta<PonenciaEspecializada[]>>(`events/${eventoId}/specialized-talks`)).data
    if (eventoId === eventos.seleccionadoId) ponencias.value = lista
  } catch {
    // Los contadores se actualizarán en la próxima lectura
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Asistencia en puerta</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-400">
        Escribe o escanea el DNI. Si la persona está inscrita se marca su asistencia; si no, se inscribe en el acto (si hay cupo) y se marca. Debe ser congresista con el pago aprobado (se comprueba con el DNI); el congresista virtual no ocupa aforo. Quien cambia de ponencia libera su cupo en la anterior.
      </p>
    </div>

    <AvisoAccesoLibre :activo="accesoLibre" />

    <section v-if="eventos.cargado && !eventos.seleccionadoId" class="card">
      <AvisoSinEventos />
    </section>

    <template v-else>
      <section class="card space-y-3 p-5">
        <label for="puerta-ponencia" class="field-label">Ponencia</label>
        <select id="puerta-ponencia" v-model="ponenciaId" class="field-control" :disabled="!ponencias.length">
          <option v-if="!ponencias.length" :value="null">{{ cargando ? 'Cargando…' : 'No hay ponencias' }}</option>
          <optgroup v-for="dia in grupos" :key="dia.fecha" :label="fechaDia(dia.fecha)">
            <option v-for="p in dia.ponencias" :key="p.id" :value="p.id">
              {{ rangoHorario(p.horaInicio, p.horaFin) }} · {{ p.ambiente }} · {{ p.tema }}
            </option>
          </optgroup>
        </select>
        <div v-if="ponencia" class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span class="text-slate-300">{{ ponencia.ambiente }} · {{ rangoHorario(ponencia.horaInicio, ponencia.horaFin) }}</span>
          <AppBadge :tono="tonoCupo(ponencia)" title="Presenciales sobre el aforo; los virtuales no lo ocupan">Inscritos {{ textoCupo(ponencia) }}</AppBadge>
          <AppBadge tono="ok">{{ numero(ponencia.asistentes) }} asistieron</AppBadge>
          <AppBadge v-if="ponencia.cuposDisponibles !== null" :tono="ponencia.cuposDisponibles === 0 ? 'error' : 'neutral'">
            {{ ponencia.cuposDisponibles === 0 ? 'Sin cupos' : `Quedan ${ponencia.cuposDisponibles}` }}
          </AppBadge>
        </div>
      </section>

      <section class="card p-5">
        <form class="space-y-4" novalidate @submit.prevent="registrar">
          <div class="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <div>
              <label for="puerta-tipo" class="field-label">Documento</label>
              <select id="puerta-tipo" v-model="form.tipoDocumento" class="field-control">
                <option v-for="t in TIPOS_DOCUMENTO" :key="t.valor" :value="t.valor">{{ t.etiqueta }}</option>
              </select>
            </div>
            <div>
              <label for="puerta-numero" class="field-label">Número</label>
              <input
                id="puerta-numero"
                ref="entrada"
                v-model="form.numeroDocumento"
                class="field-control h-14 font-mono text-2xl tracking-widest"
                :inputmode="esDni ? 'numeric' : 'text'"
                :placeholder="esDni ? '12345678' : '9 a 12 caracteres'"
                autocomplete="off"
                autofocus
                :disabled="!ponencia"
                :aria-invalid="errores.numeroDocumento ? true : undefined"
              >
            </div>
            <AppButton type="submit" icon="heroicons:check" :loading="registrando" :disabled="!ponencia || !form.numeroDocumento" class="h-14 px-6">Registrar</AppButton>
          </div>

          <div v-if="pideNombres || !esDni" class="grid gap-3 sm:grid-cols-2">
            <AppField label="Nombres" for="puerta-nombres" required :error="errores.nombres">
              <input id="puerta-nombres" v-model="form.nombres" class="field-control" maxlength="120" autocomplete="off">
            </AppField>
            <AppField label="Apellidos" for="puerta-apellidos" required :error="errores.apellidos">
              <input id="puerta-apellidos" v-model="form.apellidos" class="field-control" maxlength="120" autocomplete="off">
            </AppField>
          </div>

          <details class="text-sm text-slate-400">
            <summary class="cursor-pointer select-none hover:text-slate-200">Datos opcionales (si no estaba registrado)</summary>
            <div class="mt-3 grid gap-3 sm:grid-cols-3">
              <AppField label="Correo" for="puerta-correo" :error="errores.correo">
                <input id="puerta-correo" v-model="form.correo" type="email" class="field-control" maxlength="191" autocomplete="off">
              </AppField>
              <AppField label="Celular" for="puerta-celular" :error="errores.celular">
                <input id="puerta-celular" v-model="form.celular" type="tel" inputmode="tel" class="field-control" maxlength="20" autocomplete="off">
              </AppField>
              <AppField label="Procedencia" for="puerta-procedencia">
                <select id="puerta-procedencia" v-model="form.procedencia" class="field-control">
                  <option value="">Sin dato</option>
                  <option v-for="p in PROCEDENCIAS" :key="p.valor" :value="p.valor">{{ p.etiqueta }}</option>
                </select>
              </AppField>
            </div>
          </details>
        </form>

        <!-- Región viva siempre presente para que el lector de pantalla anuncie cada resultado -->
        <div role="status" aria-live="assertive" class="mt-4">
          <div v-if="ultimo" class="flex items-start gap-3 rounded-2xl px-5 py-4 ring-1 ring-inset" :class="TONOS[ultimo.tono]">
            <Icon :name="ICONOS[ultimo.tono]" class="mt-0.5 size-7 shrink-0" aria-hidden="true" />
            <div>
              <p class="text-lg font-semibold">{{ ultimo.titulo }}</p>
              <p class="text-sm opacity-90">{{ ultimo.detalle }}</p>
            </div>
          </div>
        </div>
      </section>

      <section v-if="lecturas.length" class="card overflow-hidden">
        <h2 class="border-b border-white/10 px-5 py-3 font-display text-lg font-semibold text-white">Últimas lecturas</h2>
        <ul class="divide-y divide-white/5">
          <li v-for="lectura in lecturas" :key="lectura.clave" class="flex items-start gap-3 px-5 py-3">
            <Icon :name="ICONOS[lectura.mensaje.tono]" class="mt-0.5 size-5 shrink-0" :class="lectura.mensaje.tono === 'ok' ? 'text-emerald-300' : lectura.mensaje.tono === 'aviso' ? 'text-amber-300' : 'text-red-300'" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white">{{ lectura.mensaje.titulo }}</p>
              <p class="text-xs text-slate-400">{{ lectura.mensaje.detalle }}</p>
            </div>
            <div class="text-right text-xs whitespace-nowrap text-slate-500">
              <p class="font-mono">{{ lectura.documento }}</p>
              <p>{{ lectura.hora }}</p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
