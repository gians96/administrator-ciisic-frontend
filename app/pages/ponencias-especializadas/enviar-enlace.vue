<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { mensajeError } from '~/utils/errores'
import {
  cuerpoMensajePonencias,
  LARGO_ASUNTO,
  LARGO_MENSAJE,
  mensajePonenciasPropuesto,
  parrafosDelMensaje,
  rutaEnvio,
  TEXTO_BOTON_PONENCIAS,
  validarMensajePonencias,
} from '~/utils/enviosMasivos'

definePageMeta({ permiso: 'especializadas.ver' })
useHead({ title: 'Enviar el enlace de inscripción · Ponencias especializadas · Panel CIISIC' })

const { api } = useApi()
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const id = useId()

const puedeEnviar = computed(() => auth.puede('especializadas.inscribir'))
const evento = computed(() => eventos.seleccionado?.nombreCorto ?? null)

const form = reactive(mensajePonenciasPropuesto(evento.value))
/** El texto propuesto se arma con el evento: si cambia de evento y no se editó, se vuelve a proponer. */
let textoEditado = false
watch(() => [form.asunto, form.mensaje], () => { textoEditado = true })
watch(evento, (nuevo) => {
  if (!textoEditado) {
    Object.assign(form, mensajePonenciasPropuesto(nuevo))
    textoEditado = false
  }
})

const errores = computed(() => validarMensajePonencias(form))
const hayErrores = computed(() => Object.keys(errores.value).length > 0)
const mostrarErrores = ref(false)
const bloqueo = computed(() => (hayErrores.value ? 'Corrige el asunto y el mensaje antes de enviar.' : null))
const cuerpo = computed(() => cuerpoMensajePonencias(form))
const parrafos = computed(() => parrafosDelMensaje(form.mensaje))

function restablecer() {
  Object.assign(form, mensajePonenciasPropuesto(evento.value))
  textoEditado = false
  mostrarErrores.value = false
}

// ─── Correo de prueba ───
const correoPrueba = ref(auth.usuario?.correo ?? '')
const probando = ref(false)

async function probar() {
  mostrarErrores.value = true
  const eventoId = eventos.seleccionadoId
  const correo = correoPrueba.value.trim()
  if (!eventoId || hayErrores.value) return
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    toast.error('Escribe un correo válido para la prueba.')
    return
  }
  probando.value = true
  try {
    await api<Respuesta<{ enviado: true }>>(rutaEnvio(eventoId, 'ponencias', 'probar'), { method: 'POST', body: { correo, ...cuerpo.value } })
    toast.exito(`Prueba enviada a ${correo}. No se marcó a nadie.`)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    probando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Enviar el enlace de inscripción a las ponencias</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-400">
        Un mismo mensaje para los inscritos presenciales con el pago aprobado, con el botón a la página de inscripción a las ponencias especializadas.
        Cada persona recibe su correo por separado y queda marcada como «enviado»: la próxima vez eliges solo a quien falta.
      </p>
    </div>

    <PanelEnvio
      canal="ponencias"
      :puede-enviar="puedeEnviar"
      :cuerpo-extra="cuerpo"
      :bloqueo="bloqueo"
      texto-enviar="Enviar el mensaje"
      :que-recibe="`Cada persona recibe el mensaje «${cuerpo.asunto}» con el botón «${TEXTO_BOTON_PONENCIAS}».`"
    >
      <template #editor>
        <section class="card p-5" :aria-labelledby="`${id}-mensaje-titulo`">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 :id="`${id}-mensaje-titulo`" class="text-lg font-bold text-white">Mensaje</h2>
              <p class="mt-0.5 text-sm text-slate-400">Es el mismo para todas las personas. Las líneas en blanco separan párrafos; el botón con el enlace se agrega solo al final.</p>
            </div>
            <AppButton size="sm" variant="ghost" icon="heroicons:arrow-uturn-left" @click="restablecer">Restablecer texto</AppButton>
          </div>

          <div class="mt-5 grid gap-6 lg:grid-cols-2">
            <div class="space-y-4">
              <AppField label="Asunto" :for="`${id}-asunto`" required :error="mostrarErrores || form.asunto ? errores.asunto : null">
                <input :id="`${id}-asunto`" v-model="form.asunto" class="field-control" :maxlength="LARGO_ASUNTO.maximo" autocomplete="off" :aria-invalid="errores.asunto ? true : undefined">
              </AppField>
              <AppField label="Mensaje" :for="`${id}-mensaje`" required :error="mostrarErrores || form.mensaje ? errores.mensaje : null">
                <textarea :id="`${id}-mensaje`" v-model="form.mensaje" rows="12" class="field-control" :maxlength="LARGO_MENSAJE.maximo" :aria-invalid="errores.mensaje ? true : undefined" />
                <p class="mt-1 text-right text-xs text-slate-500 tabular-nums">{{ form.mensaje.length }} / {{ LARGO_MENSAJE.maximo }}</p>
              </AppField>
            </div>

            <div>
              <p class="field-label">Así lo verá quien lo reciba</p>
              <div class="mt-1.5 rounded-2xl bg-white p-5 text-[0.93rem] leading-relaxed text-slate-800 shadow-inner">
                <p class="text-xs font-semibold tracking-wide text-slate-500">Asunto: <span class="text-slate-800">{{ cuerpo.asunto || '—' }}</span></p>
                <hr class="my-3 border-slate-200">
                <h3 class="mb-3 text-lg font-bold text-[#0b3a6f]">{{ eventos.seleccionado?.nombre ?? 'Evento' }}</h3>
                <p v-for="parrafo in parrafos" :key="parrafo" class="mb-3 whitespace-pre-line">{{ parrafo }}</p>
                <p class="mt-5">
                  <span class="inline-block rounded-full bg-[#041d39] px-6 py-3 text-sm font-bold text-white">{{ TEXTO_BOTON_PONENCIAS }}</span>
                </p>
                <p class="mt-3 text-xs text-slate-500">Si el botón no abre, copia este enlace en tu navegador: <span class="break-all text-[#0071bc]">…/inscripcion-ponencias</span></p>
              </div>
            </div>
          </div>

          <div v-if="puedeEnviar" class="mt-5 flex flex-wrap items-end gap-3 border-t border-white/5 pt-4">
            <div class="min-w-64 flex-1 sm:max-w-sm">
              <AppField label="Enviarme una prueba" :for="`${id}-prueba`" hint="Sale como «[Prueba]» y no marca a nadie.">
                <input :id="`${id}-prueba`" v-model="correoPrueba" type="email" class="field-control" autocomplete="off" placeholder="tu correo">
              </AppField>
            </div>
            <AppButton variant="secondary" icon="heroicons:beaker" :loading="probando" @click="probar">Enviar prueba</AppButton>
          </div>
        </section>
      </template>
    </PanelEnvio>
  </div>
</template>
