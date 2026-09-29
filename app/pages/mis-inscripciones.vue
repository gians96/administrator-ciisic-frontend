<script setup lang="ts">
import { aErrorApi } from '~/utils/errores'
import { fechaDia, fechaHoraLima, modalidadPago, soles } from '~/utils/formato'
import { explicacionEstado, ordenarInscripciones, rangoFechas, type InscripcionPortal } from '~/utils/misInscripciones'

definePageMeta({ layout: 'participante', perfil: 'participante' })
useHead({ title: 'Mis inscripciones · CIISIC' })

const auth = useAuthStore()
const { portal, urlPortal } = usePortal()
const inscripciones = ref<InscripcionPortal[]>([])
const cargando = ref(true)
const error = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await portal<{ data: InscripcionPortal[] }>('inscriptions')
    inscripciones.value = ordenarInscripciones(respuesta.data)
  } catch (e) {
    error.value = aErrorApi(e).message
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">Portal del inscrito</p>
      <h1 class="mt-1 text-3xl font-extrabold">Mis inscripciones</h1>
      <p class="mt-2 text-sm text-slate-400">
        Hola, {{ auth.participante?.nombres }}. Aquí ves el estado de cada inscripción hecha con
        <span class="font-medium text-slate-200">{{ auth.participante?.correo }}</span>.
      </p>
    </div>

    <div v-if="cargando" class="card flex items-center gap-3 p-6 text-sm text-slate-300" role="status">
      <Icon name="heroicons:arrow-path" class="size-5 animate-spin" aria-hidden="true" /> Cargando tus inscripciones…
    </div>

    <div v-else-if="error" class="card p-6" role="alert">
      <p class="text-sm text-red-200">{{ error }}</p>
      <AppButton class="mt-4" variant="secondary" size="sm" icon="heroicons:arrow-path" @click="cargar">Reintentar</AppButton>
    </div>

    <AppEmpty
      v-else-if="!inscripciones.length"
      icon="heroicons:ticket"
      titulo="Aún no hay inscripciones con este correo"
      descripcion="Usa la cuenta de Google del mismo correo con el que te inscribiste. Si te inscribiste con otro correo, cierra sesión y entra con esa cuenta."
    />

    <article v-for="inscripcion in inscripciones" v-else :key="inscripcion.id" class="card overflow-hidden">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
        <div>
          <p class="kicker">{{ inscripcion.evento.nombreCorto }}</p>
          <h2 class="mt-1 text-xl font-bold">{{ inscripcion.evento.nombre }}</h2>
          <p class="mt-1 text-sm text-slate-400">
            <span class="whitespace-nowrap">{{ rangoFechas(inscripcion.evento.fechaInicio, inscripcion.evento.fechaFin) }}</span>
            <template v-if="inscripcion.evento.sede"> · {{ inscripcion.evento.sede }}</template>
          </p>
        </div>
        <AppBadge :estado="inscripcion.estado.codigo" class="text-sm">{{ inscripcion.estado.nombre }}</AppBadge>
      </div>

      <div class="space-y-5 p-5 sm:p-6">
        <p class="text-sm text-slate-200">{{ explicacionEstado(inscripcion) }}</p>

        <div v-if="inscripcion.estado.codigo === 'RECHAZADO' && inscripcion.motivoRechazo" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30">
          <span class="font-semibold">Motivo:</span> {{ inscripcion.motivoRechazo }}
        </div>

        <dl class="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs uppercase tracking-wider text-slate-500">Inscripción</dt>
            <dd class="mt-1 text-slate-200">
              {{ inscripcion.tipoInscripcion?.nombre ?? '—' }}
              <AppBadge v-if="inscripcion.tipoInscripcion?.etiqueta" tono="brand" class="ml-1">{{ inscripcion.tipoInscripcion.etiqueta }}</AppBadge>
            </dd>
            <dd v-if="inscripcion.clasificacion" class="text-slate-400">{{ inscripcion.clasificacion.nombre }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-slate-500">Monto</dt>
            <dd class="mt-1 text-slate-200">
              {{ soles(inscripcion.monto) }}
              <span v-if="inscripcion.descuento > 0" class="text-slate-400">(precio regular {{ soles(inscripcion.precioRegular) }})</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-slate-500">Pago</dt>
            <dd class="mt-1 text-slate-200">{{ modalidadPago(inscripcion.pago.modalidad, inscripcion.pago.banco, inscripcion.pago.billeteraDigital) }}</dd>
            <dd class="text-slate-400">
              Operación <span class="font-mono">{{ inscripcion.pago.numeroOperacion }}</span>
              <span v-if="inscripcion.pago.fechaPago" class="whitespace-nowrap"> · {{ fechaDia(inscripcion.pago.fechaPago) }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-slate-500">Fechas</dt>
            <dd class="mt-1 text-slate-200">Registrada: <span class="whitespace-nowrap">{{ fechaHoraLima(inscripcion.creadoEn) }}</span></dd>
            <dd v-if="inscripcion.revisadoEn" class="text-slate-400">Revisada: <span class="whitespace-nowrap">{{ fechaHoraLima(inscripcion.revisadoEn) }}</span></dd>
          </div>
        </dl>

        <div v-if="inscripcion.credencial.disponible" class="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          <a
            :href="urlPortal(`inscriptions/${inscripcion.id}/credential`)"
            class="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-navy-950 hover:bg-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
          >
            <Icon name="heroicons:arrow-down-tray" class="size-5" aria-hidden="true" /> Descargar credencial
          </a>
          <span v-if="inscripcion.credencial.enviadaEn" class="text-xs text-slate-400">También te la enviamos por correo el {{ fechaHoraLima(inscripcion.credencial.enviadaEn) }}.</span>
        </div>
      </div>
    </article>
  </div>
</template>
