<script setup lang="ts">
import type { Actividad, Respuesta } from '~/types/api'
import { fechaDia, fechaHoraLima, nombreCompleto, numero } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import {
  actividadInicial,
  conservarValorTrasError,
  cuerpoMarca,
  etiquetaMetodo,
  idDeConsulta,
  resultadoDeError,
  textoMarca,
  TIPOS_DOCUMENTO_MARCA,
  type AsistenciaFila,
  type MarcaAsistencia,
  type ModoLectura,
  type TipoDocumentoMarca,
  type TonoResultado,
} from '~/utils/asistencia'
import { claveLectura, debeProcesar, interpretarLectura, type LecturaReciente } from '~/utils/lecturaQr'
import { RUTA_ESCANER } from '~/utils/permisos'

definePageMeta({ permiso: 'asistencia.ver' })
useHead({ title: 'Asistencia · Panel CIISIC' })

const { api, releerAcceso } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()
const route = useRoute()

const actividades = ref<Actividad[]>([])
const cargandoActividades = ref(false)
const actividadId = ref<number | null>(null)
const asistencias = ref<AsistenciaFila[]>([])
const modo = ref<ModoLectura>('qr')
const valor = ref('')
const tipoDocumento = ref<TipoDocumentoMarca>('')
const fueraDeHorario = ref(false)
const registrando = ref(false)
/** Resultado de la última marca: verde, ámbar (QR anterior o ya registrada) o rojo. */
const ultimo = ref<{ tono: TonoResultado, texto: string } | null>(null)
/** Última lectura del QR procesada: el lector USB a veces envía la misma dos veces (`debeProcesar`). */
let lecturaReciente: LecturaReciente | null = null
/** La última lectura se ignoró por repetida (se avisa sin tapar el resultado anterior). */
const repetida = ref(false)

const TONOS_ULTIMO: Readonly<Record<TonoResultado, string>> = {
  exito: 'bg-emerald-500/15 text-emerald-200',
  alerta: 'bg-amber-400/15 text-amber-200',
  error: 'bg-red-500/15 text-red-200',
}
const entrada = ref<HTMLInputElement | null>(null)
const selectorTipo = ref<HTMLSelectElement | null>(null)

/** Enlace desde Eventos → Actividades (`?evento=&actividad=`): se usan una sola vez. */
let eventoPedido = idDeConsulta(route.query.evento)
let actividadPedida = idDeConsulta(route.query.actividad)

const puedeMarcar = computed(() => auth.puede('asistencia.marcar'))
const puedeFueraDeHorario = computed(() => auth.puede('asistencia.fuera_horario'))
const puedeAnular = computed(() => auth.puede('asistencia.anular'))
/** Actividad elegida, siempre una de las del evento elegido. */
const actividad = computed(() => actividades.value.find((a) => a.id === actividadId.value) ?? null)
/** Escáner a pantalla completa con el evento y la actividad elegidos. */
const enlaceEscaner = computed(() => {
  const consulta = new URLSearchParams()
  if (eventos.seleccionadoId) consulta.set('evento', String(eventos.seleccionadoId))
  if (eventos.seleccionadoId && actividad.value) consulta.set('actividad', String(actividad.value.id))
  const texto = consulta.toString()
  return texto ? `${RUTA_ESCANER}?${texto}` : RUTA_ESCANER
})

/** Respuestas que llegan tarde (de un evento o una actividad anteriores) se descartan. */
let consultaActividades = 0
let consultaAsistencias = 0

async function cargarActividades() {
  const consulta = ++consultaActividades
  const eventoId = eventos.seleccionadoId
  // Nada del evento anterior queda a la vista ni se puede marcar en él
  actividades.value = []
  actividadId.value = null
  ultimo.value = null
  cargandoActividades.value = Boolean(eventoId)
  if (!eventoId) return
  try {
    const lista = (await api<Respuesta<Actividad[]>>(`events/${eventoId}/activities`)).data
    if (consulta !== consultaActividades) return
    actividades.value = lista
    const inicial = actividadInicial(lista, actividadPedida)
    if (inicial.ajena) toast.info('La actividad del enlace no es de este evento: se muestra la primera del evento elegido.')
    actividadPedida = null
    actividadId.value = inicial.id
  } catch (error) {
    if (consulta === consultaActividades) toast.error(mensajeError(error))
  } finally {
    if (consulta === consultaActividades) cargandoActividades.value = false
  }
}

async function cargarAsistencias() {
  const consulta = ++consultaAsistencias
  const id = actividadId.value
  if (!id) { asistencias.value = []; return }
  try {
    const lista = (await api<Respuesta<AsistenciaFila[]>>(`activities/${id}/attendances`)).data
    if (consulta === consultaAsistencias) asistencias.value = lista
  } catch (error) {
    if (consulta === consultaAsistencias) toast.error(mensajeError(error))
  }
}

function enfocarEntrada() {
  nextTick(() => entrada.value?.focus())
}

// Si el enlace trae el evento y la cuenta lo tiene, se trabaja sobre él (antes de cargar actividades)
watch(() => eventos.cargado, (cargado) => {
  if (!cargado || !eventoPedido) return
  if (eventos.eventos.some((evento) => evento.id === eventoPedido)) eventos.seleccionar(eventoPedido)
  eventoPedido = null
}, { immediate: true })
watch(() => eventos.seleccionadoId, cargarActividades, { immediate: true })
// La lista de otra actividad no queda a la vista mientras carga la nueva; «Fuera de horario» es para
// una actividad concreta y se desmarca al cambiar
watch(actividadId, () => {
  asistencias.value = []
  lecturaReciente = null
  repetida.value = false
  fueraDeHorario.value = false
  cargarAsistencias()
  enfocarEntrada()
}, { immediate: true })
// Con «Fuera de horario» recién marcado (p. ej. tras un OUTSIDE_WINDOW) la misma lectura se vuelve a procesar
watch(fueraDeHorario, () => { lecturaReciente = null })
// El tipo de documento solo aplica al modo DNI
watch(modo, () => { tipoDocumento.value = ''; enfocarEntrada() })

async function registrar() {
  // Solo en una actividad del evento elegido ya cargada
  const id = actividad.value?.id
  if (!id || registrando.value) return
  // Código del fotocheck (10 caracteres) o QR anterior (id); la misma lectura en 3 s se ignora
  const lectura = modo.value === 'qr' ? interpretarLectura(valor.value) : null
  const instante = Date.now()
  if (lectura && !debeProcesar(lectura, lecturaReciente, instante)) {
    // El resultado anterior sigue a la vista; se avisa aparte que esta lectura no se envió
    repetida.value = true
    valor.value = ''
    enfocarEntrada()
    return
  }
  repetida.value = false
  const resultado = cuerpoMarca(
    { modo: modo.value, valor: valor.value, tipoDocumento: tipoDocumento.value, fueraDeHorario: fueraDeHorario.value },
    puedeFueraDeHorario.value,
  )
  if ('error' in resultado) {
    ultimo.value = { tono: 'error', texto: resultado.error }
    if (modo.value === 'qr') valor.value = ''
    enfocarEntrada()
    return
  }
  if (lectura) lecturaReciente = { clave: claveLectura(lectura), instante }
  registrando.value = true
  let enfocarTipo = false
  try {
    const r = await api<Respuesta<MarcaAsistencia>>(`activities/${id}/attendances`, { method: 'POST', body: resultado.body })
    // Con el QR anterior (alerta QR_LEGADO) se pide verificar el DNI
    ultimo.value = { tono: r.data.alerta === 'QR_LEGADO' ? 'alerta' : 'exito', texto: textoMarca(r.data) }
    valor.value = ''
    tipoDocumento.value = ''
    await cargarAsistencias()
  } catch (error) {
    const e = aErrorApi(error)
    // Ya registrada en ámbar (con la hora); un código que el backend 013 no reconoce lo explica
    const rechazo = resultadoDeError(e, lectura)
    ultimo.value = { tono: rechazo.tono, texto: rechazo.mensaje ?? e.message }
    // Tras un rechazo, volver a escanear el mismo código lo envía de nuevo (como en el escáner)
    if (rechazo.tono === 'error') lecturaReciente = null
    if (conservarValorTrasError(modo.value, e.code)) {
      // Dos inscritos comparten el número: se elige DNI o CE y se vuelve a registrar
      enfocarTipo = true
    } else {
      valor.value = ''
    }
    if (e.code === 'OUT_OF_HOURS_NOT_ALLOWED') {
      // Se le quitó el permiso: se desmarca la casilla y se relee el acceso ya para ocultarla
      fueraDeHorario.value = false
      await releerAcceso()
    }
  } finally {
    registrando.value = false
    if (enfocarTipo) nextTick(() => selectorTipo.value?.focus())
    else enfocarEntrada()
  }
}

async function anular(asistencia: AsistenciaFila) {
  const ok = await confirmar({
    titulo: 'Anular asistencia',
    mensaje: `¿Anular la asistencia de ${nombreCompleto(asistencia.participante)}? Queda registrado quién la anuló y se puede volver a marcar.`,
    textoConfirmar: 'Anular',
    peligro: true,
  })
  if (!ok) return
  try {
    await api(`attendances/${asistencia.id}`, { method: 'DELETE' })
    toast.exito('Asistencia anulada.')
    await cargarAsistencias()
  } catch (error) {
    toast.error(mensajeError(error))
    // Otra persona ya la anuló: se actualiza la lista
    if (aErrorApi(error).code === 'ATTENDANCE_NOT_FOUND') await cargarAsistencias()
  }
}

/** Descarga la matriz participantes × actividades como CSV (separador `;`, con BOM para Excel). */
async function exportar() {
  if (!eventos.seleccionadoId) return
  try {
    const r = await api<Respuesta<{ actividades: Actividad[], participantes: Array<{ tipoDocumento: string, numeroDocumento: string, nombres: string, apellidos: string, asistencias: Record<string, number>, total: number }> }>>(`events/${eventos.seleccionadoId}/attendances/export`)
    const celda = (v: unknown) => { const t = String(v ?? ''); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
    const cabecera = ['Tipo doc.', 'N° documento', 'Apellidos', 'Nombres', ...r.data.actividades.map((a) => `${a.nombre} (${a.fecha})`), 'Total']
    const filas = r.data.participantes.map((p) => [p.tipoDocumento.toUpperCase(), p.numeroDocumento, p.apellidos, p.nombres, ...r.data.actividades.map((a) => p.asistencias[a.id] ?? 0), p.total])
    const csv = '﻿' + [cabecera, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n')
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    enlace.download = `asistencia-${eventos.seleccionado?.codigo ?? 'evento'}.csv`
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

const columnas = computed(() => (puedeAnular.value ? 6 : 5))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Asistencia</h1>
        <p class="mt-1 text-sm text-slate-400">
          {{ puedeMarcar
            ? 'Escanea el QR del fotocheck o de la credencial (un lector USB escribe el código y presiona Enter) o ingresa el DNI. Con la cámara del celular, usa «Abrir escáner».'
            : 'Asistentes registrados en cada actividad del evento.' }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton v-if="puedeMarcar" :to="enlaceEscaner" icon="heroicons:camera">Abrir escáner</AppButton>
        <AppButton v-if="eventos.seleccionadoId && auth.puede('asistencia.exportar')" variant="secondary" icon="heroicons:arrow-down-tray" @click="exportar">Exportar matriz</AppButton>
      </div>
    </div>

    <AvisoSinEventos v-if="eventos.cargado && !eventos.seleccionadoId" />
    <div v-else-if="!eventos.seleccionadoId || cargandoActividades" class="card py-14 text-center text-sm text-slate-400">Cargando actividades…</div>
    <AppEmpty
      v-else-if="!actividades.length"
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

    <template v-else>
      <section class="card grid gap-5 p-6" :class="{ 'lg:grid-cols-[1fr_1.4fr]': puedeMarcar }">
        <div class="space-y-4">
          <AppField label="Actividad" for="as-actividad">
            <select id="as-actividad" v-model.number="actividadId" class="field-control">
              <option v-for="a in actividades" :key="a.id" :value="a.id">{{ a.nombre }} · {{ fechaDia(a.fecha) }} {{ a.horaInicio }}–{{ a.horaFin }}</option>
            </select>
          </AppField>
          <template v-if="puedeMarcar">
            <div class="flex gap-2" role="radiogroup" aria-label="Tipo de lectura">
              <AppButton size="sm" :variant="modo === 'qr' ? 'primary' : 'secondary'" icon="heroicons:qr-code" @click="modo = 'qr'">QR del fotocheck</AppButton>
              <AppButton size="sm" :variant="modo === 'dni' ? 'primary' : 'secondary'" icon="heroicons:identification" @click="modo = 'dni'">DNI / documento</AppButton>
            </div>
            <AppField v-if="modo === 'dni'" label="Tipo de documento" for="as-tipo-documento" hint="Elige DNI o CE si hay dos inscritos con el mismo número.">
              <select id="as-tipo-documento" ref="selectorTipo" v-model="tipoDocumento" class="field-control">
                <option v-for="opcion in TIPOS_DOCUMENTO_MARCA" :key="opcion.valor" :value="opcion.valor">{{ opcion.nombre }}</option>
              </select>
            </AppField>
            <label v-if="puedeFueraDeHorario" class="flex items-center gap-2 text-sm text-slate-300">
              <input v-model="fueraDeHorario" type="checkbox" class="size-4 accent-brand-500">
              Registrar fuera del horario (extemporánea)
            </label>
          </template>
        </div>
        <form v-if="puedeMarcar" class="space-y-3" @submit.prevent="registrar">
          <label for="as-valor" class="field-label">{{ modo === 'qr' ? 'Código del fotocheck o de la credencial' : 'Número de documento' }}</label>
          <div class="flex gap-2">
            <input
              id="as-valor"
              ref="entrada"
              v-model="valor"
              inputmode="text"
              autocomplete="off"
              spellcheck="false"
              :autocapitalize="modo === 'qr' ? 'characters' : 'off'"
              class="field-control py-4 font-mono text-lg"
              :placeholder="modo === 'qr' ? 'Escanea o escribe el código' : '12345678'"
            >
            <AppButton type="submit" :loading="registrando" :disabled="!valor.trim()" icon="heroicons:check">Registrar</AppButton>
          </div>
          <p v-if="ultimo" class="rounded-xl px-4 py-3 text-sm font-medium" :class="TONOS_ULTIMO[ultimo.tono]" role="status">{{ ultimo.texto }}</p>
          <p v-if="repetida" class="text-xs text-amber-200" role="status">Misma lectura de hace un momento: se ignoró. Si fue a propósito, vuelve a escanear en unos segundos.</p>
        </form>
      </section>

      <section class="card overflow-hidden">
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 class="text-lg font-bold">{{ actividad?.nombre }}</h2>
          <AppBadge tono="brand">{{ numero(asistencias.length) }} asistentes</AppBadge>
        </header>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Documento</th>
                <th>Método</th>
                <th>Registrado</th>
                <th>Registrado por</th>
                <th v-if="puedeAnular"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asistencia in asistencias" :key="asistencia.id">
                <td class="font-medium text-white">{{ nombreCompleto(asistencia.participante) }}</td>
                <td class="font-mono text-sm whitespace-nowrap">{{ asistencia.participante.tipoDocumento.toUpperCase() }} {{ asistencia.participante.numeroDocumento }}</td>
                <td class="text-sm whitespace-nowrap">{{ etiquetaMetodo(asistencia.metodo) }}</td>
                <td class="text-sm whitespace-nowrap">
                  {{ fechaHoraLima(asistencia.registradoEn) }}
                  <AppBadge v-if="asistencia.esFueraDeHorario" tono="warn" class="ml-1">Fuera de horario</AppBadge>
                </td>
                <td class="text-sm">{{ nombreCompleto(asistencia.registradoPor) }}</td>
                <td v-if="puedeAnular" class="text-right">
                  <AppButton size="sm" variant="ghost" icon="heroicons:no-symbol" :aria-label="`Anular la asistencia de ${nombreCompleto(asistencia.participante)}`" @click="anular(asistencia)">Anular</AppButton>
                </td>
              </tr>
              <tr v-if="!asistencias.length"><td :colspan="columnas" class="py-8 text-center text-slate-400">Aún no hay asistencias en esta actividad.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
