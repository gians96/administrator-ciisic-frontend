<script setup lang="ts">
import { REGEX_CODIGO_CERTIFICADO, tipoLegible, type CertificadoPublico } from '~/utils/certificados'
import { aErrorApi } from '~/utils/errores'
import { fechaDia } from '~/utils/formato'

/**
 * Enlace directo a un certificado (backend spec 015): `/certificado/<código>`. Sin iniciar sesión: muestra los datos
 * del certificado (sin documento) y el PDF firmado, con «Descargar». Es el enlace que llega por correo.
 */
definePageMeta({ layout: 'blank', publica: true })
useHead({
  title: 'Certificado · CIISIC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const codigo = String(useRoute().params.codigo ?? '')
const estado = ref<'cargando' | 'listo' | 'no-encontrado' | 'error'>('cargando')
const certificado = ref<CertificadoPublico | null>(null)
const mensaje = ref('')

const urlPdf = computed(() => `/api/publico/certificados/${codigo}/archivo`)

onMounted(async () => {
  if (!REGEX_CODIGO_CERTIFICADO.test(codigo)) {
    estado.value = 'no-encontrado'
    return
  }
  try {
    const respuesta = await $fetch<{ data: CertificadoPublico }>(`/api/publico/certificados/${codigo}`, { retry: 0 })
    certificado.value = respuesta.data
    estado.value = 'listo'
  } catch (error) {
    const { status, message } = aErrorApi(error)
    if (status === 404) estado.value = 'no-encontrado'
    else {
      mensaje.value = message
      estado.value = 'error'
    }
  }
})

const rangoFechas = (inicio: string, fin: string) => (inicio === fin ? fechaDia(inicio) : `${fechaDia(inicio)} al ${fechaDia(fin)}`)
</script>

<template>
  <main class="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
    <div v-if="estado === 'cargando'" class="py-20 text-center text-sm text-slate-400">Cargando certificado…</div>

    <section v-else-if="estado === 'no-encontrado'" class="card mx-auto mt-10 max-w-lg" role="alert">
      <AppEmpty titulo="No encontramos este certificado" descripcion="El enlace puede estar incompleto o el certificado aún está en firma. También puedes consultarlo con tu DNI." icon="heroicons:document-magnifying-glass" />
      <div class="flex justify-center pb-6">
        <AppButton to="/consulta-certificados" icon="heroicons:identification">Consultar con mi DNI</AppButton>
      </div>
    </section>

    <section v-else-if="estado === 'error'" class="card mx-auto mt-10 max-w-lg p-6 text-center text-sm text-red-200" role="alert">{{ mensaje }}</section>

    <section v-else-if="certificado" class="space-y-5">
      <div class="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div class="min-w-0">
          <p class="kicker">{{ certificado.evento.nombreCorto }}</p>
          <h1 class="mt-1 text-2xl font-extrabold">{{ certificado.titular }}</h1>
          <p class="text-sm text-slate-300">Certificado de {{ tipoLegible(certificado.tipo).toLowerCase() }} · {{ certificado.evento.nombre }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ rangoFechas(certificado.evento.fechaInicio, certificado.evento.fechaFin) }} · Código <span class="font-mono">{{ certificado.codigo }}</span></p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            :href="`${urlPdf}?descargar=true`"
            class="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
            download
          >
            <Icon name="heroicons:arrow-down-tray" class="size-4" aria-hidden="true" /> Descargar PDF
          </a>
          <AppButton variant="ghost" icon="heroicons:identification" to="/consulta-certificados">Ver todos mis certificados</AppButton>
        </div>
      </div>
      <div class="card overflow-hidden p-0">
        <iframe :src="urlPdf" title="Certificado en PDF" class="h-[75dvh] w-full bg-white" />
      </div>
      <p class="text-center text-xs text-slate-500">Documento firmado digitalmente. Si no se muestra, usa «Descargar PDF».</p>
    </section>
  </main>
</template>
