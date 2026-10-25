<script setup lang="ts">
import type { EnlaceAforo, Respuesta } from '~/types/api'
import { estadoDelEnlace, haceCuanto } from '~/utils/enlacesDocentes'
import { mensajeError } from '~/utils/errores'
import { mensajeEnlaceAforo, urlEnlaceAforo } from '~/utils/ponenciasEspecializadas'

/**
 * Enlace público del aforo de las ponencias especializadas (spec 027; backend 036). Con él, en la landing
 * (`/aforo-ponencias#<token>`) se ve sin iniciar sesión el aforo, los inscritos presenciales y la asistencia de cada
 * tema, con los nombres de los inscritos (sin documento ni contacto). Es una credencial: se crea, se copia, se renueva y se desactiva. Solo el Owner
 * (`especializadas.enlace_aforo`); la página que lo usa solo muestra esta tarjeta a quien tiene el permiso.
 */
const props = defineProps<{ eventoId: number | null, eventoNombre?: string | null }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()
const { copiar } = useCopiar()

const enlace = ref<EnlaceAforo | null>(null)
const cargando = ref(false)
const trabajando = ref<'crear' | 'renovar' | 'quitar' | null>(null)

const ruta = computed(() => `events/${props.eventoId}/specialized-talks/occupancy-link`)
const url = computed(() => (enlace.value?.token ? urlEnlaceAforo(enlace.value.token) : ''))
const estado = computed(() => estadoDelEnlace(enlace.value))

/** Respuestas que llegan tarde (de otro evento) se descartan. */
let consulta = 0

async function cargar() {
  const turno = ++consulta
  enlace.value = null
  if (!props.eventoId) return
  cargando.value = true
  try {
    const respuesta = await api<Respuesta<EnlaceAforo>>(ruta.value)
    if (turno === consulta) enlace.value = respuesta.data
  } catch (error) {
    if (turno === consulta) toast.error(mensajeError(error))
  } finally {
    if (turno === consulta) cargando.value = false
  }
}
watch(() => props.eventoId, cargar, { immediate: true })

async function ejecutar(accion: 'crear' | 'renovar' | 'quitar', exito: string) {
  if (!props.eventoId || trabajando.value) return
  trabajando.value = accion
  try {
    const respuesta = accion === 'quitar'
      ? await api<Respuesta<EnlaceAforo>>(ruta.value, { method: 'DELETE' })
      : await api<Respuesta<EnlaceAforo>>(ruta.value, { method: 'POST', body: { regenerar: accion === 'renovar' } })
    enlace.value = respuesta.data
    toast.exito(exito)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    trabajando.value = null
  }
}

const crear = () => ejecutar('crear', 'Enlace creado. Cópialo y compártelo con quien deba ver el aforo.')

async function renovar() {
  const seguro = await confirmar({
    titulo: 'Renovar el enlace del aforo',
    mensaje: 'El enlace actual dejará de funcionar al instante y tendrás que enviar el nuevo a quien lo use. Úsalo si crees que se difundió.',
    textoConfirmar: 'Renovar enlace',
    peligro: true,
  })
  if (seguro) await ejecutar('renovar', 'Enlace renovado: el anterior ya no funciona.')
}

async function desactivar() {
  const seguro = await confirmar({
    titulo: 'Desactivar el enlace del aforo',
    mensaje: 'Quien tenga el enlace dejará de ver el aforo. Podrás crear otro cuando quieras.',
    textoConfirmar: 'Desactivar',
    peligro: true,
  })
  if (seguro) await ejecutar('quitar', 'Enlace desactivado.')
}

async function copiarTexto(texto: string, exito: string) {
  if (await copiar(texto)) toast.exito(exito)
  else toast.error('Tu navegador no permitió copiar. Selecciona el enlace y cópialo a mano.')
}

const copiarEnlace = () => copiarTexto(url.value, 'Enlace copiado.')
const copiarMensaje = () => copiarTexto(mensajeEnlaceAforo(url.value, props.eventoNombre), 'Mensaje copiado: pégalo en WhatsApp o en el correo.')
</script>

<template>
  <section class="card space-y-4 p-5" aria-labelledby="enlace-aforo">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="enlace-aforo" class="font-display text-lg font-semibold text-white">Enlace público del aforo</h2>
        <p class="mt-1 max-w-2xl text-sm text-slate-400">
          Una página de la landing con el aforo, los inscritos presenciales, los cupos libres y la asistencia en puerta de cada tema, que se actualiza sola. Solo la ve quien tiene el enlace.
        </p>
      </div>
      <p v-if="enlace" class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <AppBadge v-if="estado === 'SIN_ENLACE'" tono="neutral">Sin enlace</AppBadge>
        <AppBadge v-else-if="estado === 'SIN_ABRIR'" tono="warn">Aún no se abre</AppBadge>
        <template v-else>
          <AppBadge tono="ok">Activo</AppBadge>
          <span>Se abrió {{ haceCuanto(enlace.ultimoAcceso) }}</span>
        </template>
      </p>
    </div>

    <div v-if="cargando && !enlace" class="h-10 animate-pulse rounded-xl bg-white/5" role="status" aria-label="Cargando el enlace" />

    <template v-else-if="enlace">
      <div v-if="enlace.token" class="space-y-3">
        <label for="url-enlace-aforo" class="sr-only">Enlace público del aforo</label>
        <input id="url-enlace-aforo" :value="url" readonly class="field-control font-mono text-xs" @focus="($event.target as HTMLInputElement).select()">
        <div class="flex flex-wrap items-center gap-2">
          <AppButton size="sm" icon="heroicons:clipboard-document" @click="copiarEnlace">Copiar enlace</AppButton>
          <AppButton size="sm" variant="secondary" icon="heroicons:chat-bubble-left-ellipsis" @click="copiarMensaje">Copiar mensaje</AppButton>
          <AppMenu etiqueta="Más" size="sm" variant="ghost" :disabled="trabajando !== null">
            <a :href="url" target="_blank" rel="noopener noreferrer" role="menuitem" class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5">
              <Icon name="heroicons:arrow-top-right-on-square" class="size-4 shrink-0" aria-hidden="true" /> Abrir como se verá
            </a>
            <AppMenuItem icon="heroicons:arrow-path" @click="renovar">Renovar enlace</AppMenuItem>
            <AppMenuItem icon="heroicons:no-symbol" peligro @click="desactivar">Desactivar enlace</AppMenuItem>
          </AppMenu>
        </div>
      </div>
      <AppButton v-else icon="heroicons:link" :loading="trabajando === 'crear'" :disabled="trabajando !== null || !eventoId" @click="crear">Crear enlace público</AppButton>

      <p class="flex gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset">
        <Icon name="heroicons:shield-exclamation" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>Cualquiera con el enlace ve el aforo de cada tema y la <strong>lista de sus inscritos</strong> con nombre, modo y si asistió (sin DNI, correo ni celular). Compártelo solo con quien lo necesite y renuévalo si se difunde.</span>
      </p>
    </template>
  </section>
</template>
