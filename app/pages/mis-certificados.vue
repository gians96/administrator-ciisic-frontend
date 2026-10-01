<script setup lang="ts">
import { aErrorApi } from '~/utils/errores'
import { certificadosDe, detalleCertificado, MENSAJE_SIN_CERTIFICADOS, nombreTipoCertificado, type CertificadoPortal } from '~/utils/misCertificados'
import { esNoDisponible } from '~/utils/portal'

/**
 * Certificados del inscrito (`GET /me/certificates`, backend-ciisic spec 015): solo los firmados. Hasta
 * que el backend tenga la ruta responde 404 y se muestra el estado vacío, igual que sin certificados.
 */
definePageMeta({ layout: 'participante', perfil: 'participante' })
useHead({ title: 'Mis certificados · CIISIC' })

const { portal } = usePortal()
const certificados = ref<CertificadoPortal[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)

async function cargar() {
  estado.value = 'cargando'
  error.value = null
  try {
    const { data } = await portal<{ data: unknown }>('certificates')
    certificados.value = certificadosDe(data)
    estado.value = 'listo'
  } catch (e) {
    const { status, message } = aErrorApi(e)
    if (status === 401) return
    if (status === 404 || esNoDisponible(e)) {
      certificados.value = []
      estado.value = 'listo'
      return
    }
    error.value = message
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">Portal del inscrito</p>
      <h1 class="mt-1 text-3xl font-extrabold">Mis certificados</h1>
      <p class="mt-2 text-sm text-slate-400">Los certificados de los eventos en los que participaste, cuando estén firmados.</p>
    </div>

    <PortalEstado v-if="estado === 'cargando'" estado="cargando" texto="Cargando tus certificados…" />
    <PortalEstado v-else-if="estado === 'error'" estado="error" :texto="error" @reintentar="cargar" />

    <div v-else-if="!certificados.length" class="card">
      <AppEmpty icon="heroicons:academic-cap" titulo="Aún no tienes certificados" :descripcion="MENSAJE_SIN_CERTIFICADOS" />
    </div>

    <ul v-else class="space-y-4">
      <li v-for="certificado in certificados" :key="certificado.id" class="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div class="min-w-0">
          <p v-if="certificado.evento?.nombreCorto" class="kicker">{{ certificado.evento.nombreCorto }}</p>
          <h2 class="mt-1 text-lg font-bold">{{ nombreTipoCertificado(certificado.tipo) }}</h2>
          <p v-if="certificado.evento?.nombre" class="text-sm text-slate-300">{{ certificado.evento.nombre }}</p>
          <p v-if="detalleCertificado(certificado)" class="mt-1 text-xs text-slate-400">{{ detalleCertificado(certificado) }}</p>
        </div>
        <PortalBotonDescarga
          v-if="certificado.descargable"
          :ruta="`certificates/${certificado.id}/file`"
          :respaldo="`certificado-${certificado.id}.pdf`"
        />
        <AppBadge v-else tono="info">En preparación</AppBadge>
      </li>
    </ul>
  </div>
</template>
