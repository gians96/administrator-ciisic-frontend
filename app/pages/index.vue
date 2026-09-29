<script setup lang="ts">
import type { Respuesta, ResumenEvento, ResumenSemana } from '~/types/api'
import { COLOR_GRAFICO_ESTADO, fechaDia, numero, soles } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'

useHead({ title: 'Resumen · Panel CIISIC' })

const { api } = useApi()
const eventos = useEventoStore()
const toast = useToast()

const resumen = ref<ResumenEvento | null>(null)
const semana = ref<ResumenSemana | null>(null)
const cargando = ref(false)
const cargandoSemana = ref(false)

async function cargar(id: number) {
  cargando.value = true
  cargandoSemana.value = true
  try {
    resumen.value = (await api<Respuesta<ResumenEvento>>(`events/${id}/summary`)).data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
  try {
    semana.value = (await api<Respuesta<ResumenSemana>>(`events/${id}/integrations/sports-summary`)).data
  } catch {
    semana.value = null
  } finally {
    cargandoSemana.value = false
  }
}

watch(() => eventos.seleccionadoId, (id) => { if (id) cargar(id) }, { immediate: true })

const porDia = computed(() => resumen.value?.porDia.slice(-30) ?? [])
const estadosConDatos = computed(() => resumen.value?.porEstado.filter((estado) => estado.total > 0) ?? [])
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
      <div class="flex flex-wrap gap-2">
        <AppButton variant="secondary" icon="heroicons:clock" to="/inscripciones?estado=PENDIENTE">Revisar pendientes</AppButton>
        <AppButton icon="heroicons:clipboard-document-check" to="/inscripciones">Inscripciones</AppButton>
      </div>
    </div>

    <AppEmpty v-if="eventos.cargado && !eventos.seleccionado" titulo="Aún no hay eventos" descripcion="Crea el primer evento para empezar a recibir inscripciones." icon="heroicons:calendar-days">
      <AppButton to="/eventos/nuevo" icon="heroicons:plus">Crear evento</AppButton>
    </AppEmpty>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AppStat etiqueta="Inscripciones" :valor="numero(resumen?.totales.inscripciones)" icon="heroicons:users" :detalle="`${numero(resumen?.totales.estudiantesUndc)} estudiantes UNDC verificados`" />
        <AppStat etiqueta="Por revisar" :valor="numero((resumen?.totales.pendientes ?? 0) + (resumen?.totales.enRevision ?? 0))" icon="heroicons:clock" tono="warn" :detalle="`${numero(resumen?.totales.enRevision)} en revisión`" />
        <AppStat etiqueta="Aprobadas" :valor="numero(resumen?.totales.aprobadas)" icon="heroicons:check-badge" tono="ok" :detalle="`${numero(resumen?.totales.rechazadas)} rechazadas · ${numero(resumen?.totales.canceladas)} canceladas`" />
        <AppStat etiqueta="Recaudado (aprobado)" :valor="soles(resumen?.totales.montoAprobado)" icon="heroicons:banknotes" tono="info" :detalle="`${soles(resumen?.totales.montoPendiente)} por validar`" />
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

      <section class="card overflow-hidden">
        <header class="border-b border-white/10 px-6 py-4">
          <h2 class="text-lg font-bold">Por tipo de inscripción</h2>
        </header>
        <div class="relative overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr><th>Tipo</th><th>Categoría</th><th class="text-right">Inscripciones</th><th class="text-right">Aprobadas</th><th class="text-right">Monto aprobado</th></tr>
            </thead>
            <tbody>
              <tr v-for="tipo in resumen?.porTipo ?? []" :key="tipo.tipoInscripcionId">
                <td class="text-white">{{ tipo.nombre }} <AppBadge v-if="tipo.etiqueta" tono="brand" class="ml-1">{{ tipo.etiqueta }}</AppBadge></td>
                <td>{{ tipo.categoria }}</td>
                <td class="text-right tabular-nums">{{ numero(tipo.total) }}</td>
                <td class="text-right tabular-nums">{{ numero(tipo.aprobadas) }}</td>
                <td class="text-right tabular-nums">{{ soles(tipo.montoAprobado) }}</td>
              </tr>
              <tr v-if="!cargando && !resumen?.porTipo.length">
                <td colspan="5" class="py-8 text-center text-slate-400">Este evento aún no tiene tipos de inscripción.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <SemanaSistemicaCard :resumen="semana" :cargando="cargandoSemana" :evento-id="eventos.seleccionadoId" />
    </template>
  </div>
</template>
