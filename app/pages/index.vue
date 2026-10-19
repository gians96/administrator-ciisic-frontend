<script setup lang="ts">
import type { Respuesta, ResumenEvento, ResumenSemana } from '~/types/api'
import { COLOR_GRAFICO_ESTADO, fechaDia, numero, soles } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import { esVirtual, etiquetaDeInsignia } from '~/utils/modalidad'
import { filasPorModalidad } from '~/utils/resumen'

definePageMeta({ permiso: 'resumen.ver' })
useHead({ title: 'Resumen · Panel CIISIC' })

const { api } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()

/** Sin `pagos.ver` los montos llegan en `null`: se ocultan sus tarjetas y columnas. */
const conPagos = computed(() => auth.puede('pagos.ver'))

const resumen = ref<ResumenEvento | null>(null)
const semana = ref<ResumenSemana | null>(null)
const cargando = ref(false)
const cargandoSemana = ref(false)

/** Respuestas de un evento anterior que llegan tarde se descartan. */
let consulta = 0

async function cargar(id: number | null) {
  const actual = ++consulta
  // Los datos del evento anterior no quedan a la vista bajo el nuevo
  resumen.value = null
  semana.value = null
  cargando.value = Boolean(id)
  cargandoSemana.value = Boolean(id)
  if (!id) return
  try {
    const datos = (await api<Respuesta<ResumenEvento>>(`events/${id}/summary`)).data
    if (actual === consulta) resumen.value = datos
  } catch (error) {
    if (actual === consulta) toast.error(mensajeError(error))
  } finally {
    if (actual === consulta) cargando.value = false
  }
  if (actual !== consulta) return
  try {
    const datos = (await api<Respuesta<ResumenSemana>>(`events/${id}/integrations/sports-summary`)).data
    if (actual === consulta) semana.value = datos
  } catch {
    if (actual === consulta) semana.value = null
  } finally {
    if (actual === consulta) cargandoSemana.value = false
  }
}

watch(() => eventos.seleccionadoId, cargar, { immediate: true })

const porDia = computed(() => resumen.value?.porDia.slice(-30) ?? [])
const estadosConDatos = computed(() => resumen.value?.porEstado.filter((estado) => estado.total > 0) ?? [])
/** Presencial vs virtual (spec 018 del backend); sin el dato —un backend anterior— el bloque no se muestra. */
const modalidades = computed(() => filasPorModalidad(resumen.value?.totales.porModalidad))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Resumen</p>
        <h1 class="mt-1 text-3xl font-extrabold">{{ eventos.seleccionado?.nombreCorto ?? 'Panel CIISIC' }}</h1>
        <p v-if="eventos.seleccionado" class="mt-1 text-sm text-slate-400">
          {{ fechaDia(eventos.seleccionado.fechaInicio) }} – {{ fechaDia(eventos.seleccionado.fechaFin) }} · {{ eventos.seleccionado.sede ?? 'Sede por definir' }}
        </p>
      </div>
      <div v-if="auth.puede('inscripciones.ver')" class="flex flex-wrap gap-2">
        <AppButton variant="secondary" icon="heroicons:clock" to="/inscripciones?estado=PENDIENTE">
          {{ auth.puede('inscripciones.validar') ? 'Revisar pendientes' : 'Ver pendientes' }}
        </AppButton>
        <AppButton icon="heroicons:clipboard-document-check" to="/inscripciones">Inscripciones</AppButton>
      </div>
    </div>

    <AvisoSinEventos v-if="eventos.cargado && !eventos.seleccionado" />

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2" :class="conPagos ? 'xl:grid-cols-4' : 'xl:grid-cols-3'">
        <AppStat etiqueta="Inscripciones" :valor="numero(resumen?.totales.inscripciones)" icon="heroicons:users" :detalle="`${numero(resumen?.totales.estudiantesUndc)} estudiantes UNDC verificados`" />
        <AppStat etiqueta="Por revisar" :valor="numero((resumen?.totales.pendientes ?? 0) + (resumen?.totales.enRevision ?? 0))" icon="heroicons:clock" tono="warn" :detalle="`${numero(resumen?.totales.enRevision)} en revisión`" />
        <AppStat etiqueta="Aprobadas" :valor="numero(resumen?.totales.aprobadas)" icon="heroicons:check-badge" tono="ok" :detalle="`${numero(resumen?.totales.rechazadas)} rechazadas · ${numero(resumen?.totales.canceladas)} canceladas`" />
        <AppStat v-if="conPagos" etiqueta="Recaudado (aprobado)" :valor="soles(resumen?.totales.montoAprobado)" icon="heroicons:banknotes" tono="info" :detalle="`${soles(resumen?.totales.montoPendiente)} por validar`" />
      </div>

      <div class="grid gap-6 xl:grid-cols-5">
        <section class="card p-6 xl:col-span-3">
          <h2 class="text-lg font-bold">Inscripciones por día</h2>
          <p class="mb-4 text-xs text-slate-400">Últimos {{ porDia.length }} días con registros (hora de Lima)</p>
          <BarChart
            v-if="porDia.length"
            :etiquetas="porDia.map((dia) => fechaDia(dia.fecha))"
            :series="[{ label: 'Inscripciones', data: porDia.map((dia) => dia.total), color: '#00d9e8' }]"
            descripcion="Gráfico de barras de inscripciones por día"
          />
          <AppEmpty v-else titulo="Sin inscripciones todavía" icon="heroicons:chart-bar" />
        </section>
        <section class="card p-6 xl:col-span-2">
          <h2 class="text-lg font-bold">Por estado</h2>
          <p class="mb-4 text-xs text-slate-400">Distribución de las inscripciones</p>
          <DoughnutChart
            v-if="estadosConDatos.length"
            :etiquetas="estadosConDatos.map((estado) => estado.nombre)"
            :valores="estadosConDatos.map((estado) => estado.total)"
            :colores="estadosConDatos.map((estado) => COLOR_GRAFICO_ESTADO[estado.codigo])"
            descripcion="Gráfico de dona de inscripciones por estado"
          />
          <AppEmpty v-else titulo="Sin datos" icon="heroicons:chart-pie" />
        </section>
      </div>

      <section v-if="modalidades.length" class="card p-6" aria-labelledby="resumen-modalidad">
        <h2 id="resumen-modalidad" class="text-lg font-bold">Por modalidad de asistencia</h2>
        <p class="mb-4 text-xs text-slate-400">Presencial y virtual, según el tipo de inscripción</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="fila in modalidades" :key="fila.modalidad" class="rounded-xl bg-white/5 p-4">
            <p class="flex items-center gap-2 text-sm font-semibold text-white">
              <Icon :name="fila.modalidad === 'VIRTUAL' ? 'heroicons:computer-desktop' : 'heroicons:building-office-2'" class="size-4 text-brand-300" aria-hidden="true" />
              {{ fila.nombre }}
            </p>
            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm" :class="conPagos ? 'sm:grid-cols-3' : ''">
              <div><dt class="text-xs text-slate-400">Inscripciones</dt><dd class="font-semibold text-white tabular-nums">{{ numero(fila.inscripciones) }}</dd></div>
              <div><dt class="text-xs text-slate-400">Aprobadas</dt><dd class="font-semibold text-white tabular-nums">{{ numero(fila.aprobadas) }}</dd></div>
              <div v-if="conPagos"><dt class="text-xs text-slate-400">Monto aprobado</dt><dd class="font-semibold text-white tabular-nums">{{ soles(fila.montoAprobado) }}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <header class="border-b border-white/10 px-6 py-4">
          <h2 class="text-lg font-bold">Por tipo de inscripción</h2>
        </header>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Tipo</th><th>Categoría</th><th class="text-right">Inscripciones</th><th class="text-right">Aprobadas</th>
                <th v-if="conPagos" class="text-right">Monto aprobado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tipo in resumen?.porTipo ?? []" :key="tipo.tipoInscripcionId">
                <td class="text-white">
                  {{ tipo.nombre }} <AppBadge v-if="etiquetaDeInsignia(tipo)" tono="brand" class="ml-1">{{ etiquetaDeInsignia(tipo) }}</AppBadge>
                  <AppBadgeVirtual v-if="esVirtual(tipo)" class="ml-1" />
                </td>
                <td>{{ tipo.categoria }}</td>
                <td class="text-right tabular-nums">{{ numero(tipo.total) }}</td>
                <td class="text-right tabular-nums">{{ numero(tipo.aprobadas) }}</td>
                <td v-if="conPagos" class="text-right tabular-nums">{{ soles(tipo.montoAprobado) }}</td>
              </tr>
              <tr v-if="!cargando && !resumen?.porTipo.length">
                <td :colspan="conPagos ? 5 : 4" class="py-8 text-center text-slate-400">Este evento aún no tiene tipos de inscripción.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <SemanaSistemicaCard :resumen="semana" :cargando="cargandoSemana" :evento-id="eventos.seleccionadoId" />
    </template>
  </div>
</template>
