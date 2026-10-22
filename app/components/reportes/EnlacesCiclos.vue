<script setup lang="ts">
import type { EnlaceCiclo, Respuesta } from '~/types/api'
import { estadoDelEnlace, haceCuanto, mensajeParaCiclo, urlEnlaceCiclo } from '~/utils/enlacesDocentes'
import { mensajeError } from '~/utils/errores'
import { numero } from '~/utils/formato'

/**
 * Lista de los enlaces públicos de los ciclos (spec 018; backend 027), dentro de `EnlacesPublicos`. Con el enlace de un
 * ciclo se ve, sin iniciar sesión, cómo van los pagos de todos sus estudiantes (y el docente de cada sección). Es una
 * credencial como la de los docentes: se crea, se copia, se renueva y se desactiva. Solo lo ve quien tiene `reportes.gestionar`.
 */
const props = defineProps<{ eventoId: number | null, enlaces: EnlaceCiclo[], eventoNombre?: string | null }>()
const emit = defineEmits<{ actualizado: [lista: EnlaceCiclo[]] }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()
const { copiar } = useCopiar()

const trabajando = ref<string | null>(null)
const origen = ref('')
onMounted(() => { origen.value = window.location.origin })

/** Solo los ciclos que están en el padrón pueden recibir un enlace nuevo. */
const faltantes = computed(() => props.enlaces.filter((enlace) => !enlace.token && enlace.alumnos > 0))
const activos = computed(() => props.enlaces.filter((enlace) => enlace.token).length)

const urlDe = (enlace: EnlaceCiclo): string => (enlace.token ? urlEnlaceCiclo(origen.value, enlace.token) : '')

async function ejecutar(clave: string, accion: () => Promise<Respuesta<EnlaceCiclo[]>>, exito: string) {
  if (!props.eventoId || trabajando.value) return
  trabajando.value = clave
  try {
    emit('actualizado', (await accion()).data)
    toast.exito(exito)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    trabajando.value = null
  }
}

const crear = (ciclos: string[] | undefined, regenerar: boolean, clave: string, exito: string) => ejecutar(
  clave,
  () => api<Respuesta<EnlaceCiclo[]>>(`events/${props.eventoId}/advisory/cycle-links`, { method: 'POST', body: { ciclos, regenerar } }),
  exito,
)

function crearFaltantes() {
  return crear(faltantes.value.map((enlace) => enlace.ciclo), false, 'faltantes', `Se crearon ${numero(faltantes.value.length)} enlaces.`)
}

async function renovar(enlace: EnlaceCiclo) {
  const seguro = await confirmar({
    titulo: 'Renovar el enlace',
    mensaje: `El enlace actual del ciclo ${enlace.ciclo} dejará de funcionar y tendrás que enviar el nuevo a quien lo use. Úsalo si crees que otra persona lo tiene.`,
    textoConfirmar: 'Renovar enlace',
    peligro: true,
  })
  if (seguro) await crear([enlace.ciclo], true, `renovar-${enlace.ciclo}`, 'Enlace renovado: el anterior ya no funciona.')
}

async function desactivar(enlace: EnlaceCiclo) {
  const seguro = await confirmar({
    titulo: 'Desactivar el enlace',
    mensaje: `Quien use el enlace del ciclo ${enlace.ciclo} dejará de ver el seguimiento. Podrás crear otro enlace cuando quieras.`,
    textoConfirmar: 'Desactivar',
    peligro: true,
  })
  if (!seguro) return
  await ejecutar(
    `quitar-${enlace.ciclo}`,
    () => api<Respuesta<EnlaceCiclo[]>>(`events/${props.eventoId}/advisory/cycle-links/${encodeURIComponent(enlace.ciclo)}`, { method: 'DELETE' }),
    'Enlace desactivado.',
  )
}

async function copiarTexto(texto: string, exito: string) {
  if (await copiar(texto)) toast.exito(exito)
  else toast.error('Tu navegador no permitió copiar. Selecciona el enlace y cópialo a mano.')
}

const copiarEnlace = (enlace: EnlaceCiclo) => copiarTexto(urlDe(enlace), 'Enlace copiado.')
const copiarMensaje = (enlace: EnlaceCiclo) => copiarTexto(mensajeParaCiclo(enlace.ciclo, urlDe(enlace), props.eventoNombre), 'Mensaje copiado: pégalo en WhatsApp o en el correo.')
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10 ring-inset">
      <p class="text-sm text-slate-200">
        <strong class="text-white tabular-nums">{{ numero(activos) }}</strong> de <span class="tabular-nums">{{ numero(enlaces.length) }}</span> ciclos tienen enlace.
      </p>
      <AppButton v-if="faltantes.length" size="sm" icon="heroicons:link" :loading="trabajando === 'faltantes'" :disabled="trabajando !== null" @click="crearFaltantes">
        Crear los {{ numero(faltantes.length) }} que faltan
      </AppButton>
    </div>

    <p class="flex gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset">
      <Icon name="heroicons:shield-exclamation" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>El enlace de un ciclo muestra a <strong>todos sus estudiantes</strong> (nombre, código y si pagó) y el docente de cada sección. No muestra celular, DNI, correo ni montos. Compártelo solo con quien deba dar seguimiento y renuévalo si se difunde.</span>
    </p>

    <ul class="divide-y divide-white/5 rounded-xl ring-1 ring-white/10 ring-inset" aria-label="Ciclos y sus enlaces">
      <li v-for="enlace in enlaces" :key="enlace.ciclo" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate font-medium text-white">Ciclo {{ enlace.ciclo }} <span class="font-normal text-slate-400">· {{ numero(enlace.alumnos) }} {{ enlace.alumnos === 1 ? 'estudiante' : 'estudiantes' }}</span></p>
          <p class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <AppBadge v-if="estadoDelEnlace(enlace) === 'SIN_ENLACE'" tono="neutral">Sin enlace</AppBadge>
            <AppBadge v-else-if="estadoDelEnlace(enlace) === 'SIN_ABRIR'" tono="warn">Aún no se abre</AppBadge>
            <AppBadge v-else tono="ok">Activo</AppBadge>
            <span v-if="estadoDelEnlace(enlace) === 'ABIERTO'">Se abrió {{ haceCuanto(enlace.ultimoAcceso) }}</span>
            <span v-if="!enlace.alumnos" class="text-amber-300">Ya no está en el padrón</span>
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <template v-if="enlace.token">
            <AppButton size="sm" variant="secondary" icon="heroicons:clipboard-document" @click="copiarEnlace(enlace)">Copiar enlace</AppButton>
            <AppButton size="sm" variant="secondary" icon="heroicons:chat-bubble-left-ellipsis" @click="copiarMensaje(enlace)">Copiar mensaje</AppButton>
            <AppMenu etiqueta="Más" size="sm" variant="ghost" :disabled="trabajando !== null">
              <a :href="urlDe(enlace)" target="_blank" rel="noopener noreferrer" role="menuitem" class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5">
                <Icon name="heroicons:arrow-top-right-on-square" class="size-4 shrink-0" aria-hidden="true" /> Abrir como se verá
              </a>
              <AppMenuItem v-if="enlace.alumnos" icon="heroicons:arrow-path" @click="renovar(enlace)">Renovar enlace</AppMenuItem>
              <AppMenuItem icon="heroicons:no-symbol" peligro @click="desactivar(enlace)">Desactivar enlace</AppMenuItem>
            </AppMenu>
          </template>
          <AppButton
            v-else
            size="sm"
            icon="heroicons:link"
            :loading="trabajando === `crear-${enlace.ciclo}`"
            :disabled="trabajando !== null"
            @click="crear([enlace.ciclo], false, `crear-${enlace.ciclo}`, 'Enlace creado.')"
          >
            Crear enlace
          </AppButton>
        </div>
      </li>
    </ul>
    <AppEmpty v-if="!enlaces.length" titulo="Aún no hay ciclos" descripcion="Carga el padrón para que aparezcan los ciclos." icon="heroicons:rectangle-stack" />
  </div>
</template>
