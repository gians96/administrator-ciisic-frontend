<script setup lang="ts">
import { documentoConsulta, tipoLegible, type ConsultaCertificados } from '~/utils/certificados'
import { aErrorApi } from '~/utils/errores'
import { fechaDia } from '~/utils/formato'

/**
 * Consulta pública de certificados con el DNI (backend spec 015): sin iniciar sesión, muestra los certificados
 * firmados de la persona en **todos los eventos**, con «Ver» y «Descargar». El DNI solo vive en memoria (ni en la URL
 * ni en el navegador) y viaja por `POST` al BFF.
 */
definePageMeta({ layout: 'blank', publica: true })
useHead({
  title: 'Consulta de certificados · CIISIC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const dni = ref('')
const errorDni = ref<string | null>(null)
const estado = ref<'identificar' | 'cargando' | 'listo'>('identificar')
const resultado = ref<ConsultaCertificados | null>(null)

async function consultar() {
  const documento = documentoConsulta(dni.value)
  if (!documento) {
    errorDni.value = 'Escribe tu DNI de 8 dígitos.'
    return
  }
  errorDni.value = null
  estado.value = 'cargando'
  try {
    const respuesta = await $fetch<{ data: ConsultaCertificados }>('/api/publico/certificados/consulta', { method: 'POST', body: { documento }, retry: 0 })
    resultado.value = respuesta.data
    estado.value = 'listo'
  } catch (error) {
    const { status, code, message } = aErrorApi(error)
    errorDni.value = status === 404 || code === 'CERTIFICATE_NOT_FOUND'
      ? 'No encontramos certificados con ese DNI. Si participaste en un evento, es posible que aún estén en firma.'
      : message
    estado.value = 'identificar'
  }
}

function otraConsulta() {
  dni.value = ''
  resultado.value = null
  estado.value = 'identificar'
}

const rangoFechas = (inicio: string, fin: string) => (inicio === fin ? fechaDia(inicio) : `${fechaDia(inicio)} al ${fechaDia(fin)}`)
</script>

<template>
  <main class="relative mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
    <section v-if="estado !== 'listo'" class="card mx-auto mt-6 max-w-md p-6 sm:mt-12 sm:p-8" aria-labelledby="titulo-consulta">
      <p class="kicker">CIISIC · UNDC</p>
      <h1 id="titulo-consulta" class="mt-1 text-2xl leading-tight font-extrabold">Consulta tus certificados</h1>
      <p class="mt-2 text-sm text-slate-300">Escribe tu DNI para ver y descargar los certificados de los eventos en los que participaste.</p>
      <form class="mt-5 space-y-4" novalidate @submit.prevent="consultar">
        <div>
          <label for="dni" class="field-label">DNI</label>
          <input
            id="dni"
            v-model="dni"
            type="text"
            name="dni-certificados"
            inputmode="numeric"
            autocomplete="off"
            maxlength="8"
            placeholder="12345678"
            class="field-control text-lg tracking-widest tabular-nums"
            :aria-invalid="errorDni ? 'true' : undefined"
            :aria-describedby="errorDni ? 'error-dni' : undefined"
            autofocus
            @input="dni = dni.replace(/\D/g, '').slice(0, 8)"
          >
          <p v-if="errorDni" id="error-dni" class="field-error" role="alert">{{ errorDni }}</p>
        </div>
        <AppButton type="submit" class="w-full justify-center" icon="heroicons:magnifying-glass" :loading="estado === 'cargando'" :disabled="dni.length < 7">Consultar</AppButton>
      </form>
      <p class="mt-5 text-xs leading-relaxed text-slate-400">Tu DNI solo se usa para esta consulta y no se guarda en este dispositivo.</p>
    </section>

    <section v-else-if="resultado" class="space-y-5" aria-live="polite">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="kicker">Certificados de</p>
          <h1 class="mt-1 text-2xl font-extrabold sm:text-3xl">{{ resultado.titular }}</h1>
          <p class="mt-1 text-sm text-slate-400">{{ resultado.certificados.length }} {{ resultado.certificados.length === 1 ? 'certificado' : 'certificados' }}</p>
        </div>
        <AppButton variant="ghost" icon="heroicons:arrow-uturn-left" @click="otraConsulta">Otra consulta</AppButton>
      </div>

      <ul class="space-y-4">
        <li v-for="certificado in resultado.certificados" :key="certificado.codigo" class="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div class="min-w-0">
            <p class="kicker">{{ certificado.evento.nombreCorto }}</p>
            <h2 class="mt-1 text-lg font-bold">{{ tipoLegible(certificado.tipo) }}</h2>
            <p class="text-sm text-slate-300">{{ certificado.evento.nombre }}</p>
            <p class="mt-1 text-xs text-slate-400">{{ rangoFechas(certificado.evento.fechaInicio, certificado.evento.fechaFin) }} · Código <span class="font-mono">{{ certificado.codigo }}</span></p>
          </div>
          <div class="flex flex-wrap gap-2">
            <AppButton variant="secondary" size="sm" icon="heroicons:eye" :to="`/certificado/${certificado.codigo}`">Ver</AppButton>
            <a
              :href="`/api/publico/certificados/${certificado.codigo}/archivo?descargar=true`"
              class="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-400"
              download
            >
              <Icon name="heroicons:arrow-down-tray" class="size-4" aria-hidden="true" /> Descargar
            </a>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
