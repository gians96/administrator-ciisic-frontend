<script setup lang="ts">
import type { Actividad, Respuesta } from '~/types/api'
import { fechaDia, fechaHoraLima, nombreCompleto, numero } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'

useHead({ title: 'Asistencia · Panel CIISIC' })

interface AsistenciaFila {
  id: number
  registradoEn: string
  participante: { id: number, tipoDocumento: string, numeroDocumento: string, nombres: string, apellidos: string }
}

const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()
const route = useRoute()

const actividades = ref<Actividad[]>([])
const actividadId = ref<number | null>(Number(route.query.actividad) || null)
const asistencias = ref<AsistenciaFila[]>([])
const modo = ref<'qr' | 'dni'>('qr')
const valor = ref('')
const fueraDeHorario = ref(false)
const registrando = ref(false)
const ultimo = ref<{ ok: boolean, texto: string } | null>(null)
const entrada = ref<HTMLInputElement | null>(null)

async function cargarActividades() {
  if (!eventos.seleccionadoId) return
  try {
    actividades.value = (await api<Respuesta<Actividad[]>>(`events/${eventos.seleccionadoId}/activities`)).data
    if (!actividades.value.some((a) => a.id === actividadId.value)) actividadId.value = actividades.value[0]?.id ?? null
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function cargarAsistencias() {
  if (!actividadId.value) { asistencias.value = []; return }
  try {
    asistencias.value = (await api<Respuesta<AsistenciaFila[]>>(`activities/${actividadId.value}/attendances`)).data
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

watch(() => eventos.seleccionadoId, cargarActividades, { immediate: true })
watch(actividadId, () => { cargarAsistencias(); nextTick(() => entrada.value?.focus()) }, { immediate: true })

async function registrar() {
  const texto = valor.value.trim()
  if (!actividadId.value || !texto) return
  registrando.value = true
  try {
    const body = modo.value === 'qr' ? { participanteId: Number(texto), fueraDeHorario: fueraDeHorario.value } : { numeroDocumento: texto, fueraDeHorario: fueraDeHorario.value }
    const r = await api<Respuesta<{ participante: { nombres: string, apellidos: string } }>>(`activities/${actividadId.value}/attendances`, { method: 'POST', body })
    ultimo.value = { ok: true, texto: `✓ ${nombreCompleto(r.data.participante)}` }
    await cargarAsistencias()
  } catch (error) {
    ultimo.value = { ok: false, texto: aErrorApi(error).message }
  } finally {
    registrando.value = false
    valor.value = ''
    nextTick(() => entrada.value?.focus())
  }
}

async function eliminar(asistencia: AsistenciaFila) {
  const ok = await confirmar({ titulo: 'Quitar asistencia', mensaje: `¿Quitar la asistencia de ${nombreCompleto(asistencia.participante)}?`, textoConfirmar: 'Quitar', peligro: true })
  if (!ok) return
  try {
    await api(`attendances/${asistencia.id}`, { method: 'DELETE' })
    await cargarAsistencias()
  } catch (error) {
    toast.error(mensajeError(error))
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

const actividad = computed(() => actividades.value.find((a) => a.id === actividadId.value) ?? null)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
        <h1 class="mt-1 text-3xl font-extrabold">Asistencia</h1>
        <p class="mt-1 text-sm text-slate-400">Escanea el QR de la credencial (un lector USB escribe el código y presiona Enter) o ingresa el DNI.</p>
      </div>
      <AppButton variant="secondary" icon="heroicons:arrow-down-tray" @click="exportar">Exportar matriz</AppButton>
    </div>

    <AppEmpty v-if="!actividades.length" titulo="Este evento no tiene actividades" descripcion="Créalas en Eventos → Actividades." icon="heroicons:calendar">
      <AppButton v-if="eventos.seleccionadoId" :to="`/eventos/${eventos.seleccionadoId}?tab=actividades`" icon="heroicons:plus">Crear actividades</AppButton>
    </AppEmpty>

    <template v-else>
      <section class="card grid gap-5 p-6 lg:grid-cols-[1fr_1.4fr]">
        <div class="space-y-4">
          <AppField label="Actividad" for="as-actividad">
            <select id="as-actividad" v-model.number="actividadId" class="field-control">
              <option v-for="a in actividades" :key="a.id" :value="a.id">{{ a.nombre }} · {{ fechaDia(a.fecha) }} {{ a.horaInicio }}–{{ a.horaFin }}</option>
            </select>
          </AppField>
          <div class="flex gap-2" role="radiogroup" aria-label="Tipo de lectura">
            <AppButton size="sm" :variant="modo === 'qr' ? 'primary' : 'secondary'" icon="heroicons:qr-code" @click="modo = 'qr'">QR de credencial</AppButton>
            <AppButton size="sm" :variant="modo === 'dni' ? 'primary' : 'secondary'" icon="heroicons:identification" @click="modo = 'dni'">DNI / documento</AppButton>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input v-model="fueraDeHorario" type="checkbox" class="size-4 accent-brand-500">
            Registrar fuera del horario (extemporánea)
          </label>
        </div>
        <form class="space-y-3" @submit.prevent="registrar">
          <label for="as-valor" class="field-label">{{ modo === 'qr' ? 'Código de la credencial' : 'Número de documento' }}</label>
          <div class="flex gap-2">
            <input id="as-valor" ref="entrada" v-model="valor" :inputmode="modo === 'qr' ? 'numeric' : 'text'" autocomplete="off" class="field-control py-4 font-mono text-lg" :placeholder="modo === 'qr' ? 'Escanea o escribe el código' : '12345678'">
            <AppButton type="submit" :loading="registrando" :disabled="!valor.trim()" icon="heroicons:check">Registrar</AppButton>
          </div>
          <p v-if="ultimo" class="rounded-xl px-4 py-3 text-sm font-medium" :class="ultimo.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'" role="status">{{ ultimo.texto }}</p>
        </form>
      </section>

      <section class="card overflow-hidden">
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 class="text-lg font-bold">{{ actividad?.nombre }}</h2>
          <AppBadge tono="brand">{{ numero(asistencias.length) }} asistentes</AppBadge>
        </header>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead><tr><th>Participante</th><th>Documento</th><th>Registrado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="asistencia in asistencias" :key="asistencia.id">
                <td class="font-medium text-white">{{ nombreCompleto(asistencia.participante) }}</td>
                <td class="font-mono text-sm">{{ asistencia.participante.tipoDocumento.toUpperCase() }} {{ asistencia.participante.numeroDocumento }}</td>
                <td class="text-sm whitespace-nowrap">{{ fechaHoraLima(asistencia.registradoEn) }}</td>
                <td class="text-right"><AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Quitar asistencia" @click="eliminar(asistencia)" /></td>
              </tr>
              <tr v-if="!asistencias.length"><td colspan="4" class="py-8 text-center text-slate-400">Aún no hay asistencias en esta actividad.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
