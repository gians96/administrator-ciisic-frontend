<script setup lang="ts">
import type { EnlaceAsesor, Respuesta } from '~/types/api'
import { estadoDelEnlace, haceCuanto, mensajeParaDocente, urlEnlaceDocente } from '~/utils/enlacesDocentes'
import { mensajeError } from '~/utils/errores'
import { numero } from '~/utils/formato'

/**
 * Enlaces públicos de los docentes (spec 017; backend 026). Cada docente ve, con su enlace personal y sin
 * iniciar sesión, cómo van los pagos de sus estudiantes. El enlace es una credencial: quien lo tiene entra, así
 * que aquí se crea, se copia (también como mensaje listo para enviar), se renueva (el anterior deja de valer) y se
 * desactiva. Solo lo ve quien tiene `reportes.gestionar`.
 */
const props = defineProps<{ abierto: boolean, eventoId: number | null, enlaces: EnlaceAsesor[], eventoNombre?: string | null }>()
const emit = defineEmits<{ cerrar: [], actualizado: [lista: EnlaceAsesor[]] }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()
const { copiar } = useCopiar()

const trabajando = ref<string | null>(null)
const origen = ref('')
onMounted(() => { origen.value = window.location.origin })

const faltantes = computed(() => props.enlaces.filter((enlace) => !enlace.token))
const activos = computed(() => props.enlaces.length - faltantes.value.length)

const urlDe = (enlace: EnlaceAsesor): string => (enlace.token ? urlEnlaceDocente(origen.value, enlace.token) : '')

async function ejecutar(clave: string, accion: () => Promise<Respuesta<EnlaceAsesor[]>>, exito: string) {
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

const crear = (asesorIds: number[] | undefined, regenerar: boolean, clave: string, exito: string) => ejecutar(
  clave,
  () => api<Respuesta<EnlaceAsesor[]>>(`events/${props.eventoId}/advisory/links`, { method: 'POST', body: { asesorIds, regenerar } }),
  exito,
)

function crearFaltantes() {
  return crear(faltantes.value.map((enlace) => enlace.asesorId), false, 'faltantes', `Se crearon ${numero(faltantes.value.length)} enlaces.`)
}

async function renovar(enlace: EnlaceAsesor) {
  const seguro = await confirmar({
    titulo: 'Renovar el enlace',
    mensaje: `El enlace actual de ${enlace.nombre} dejará de funcionar y tendrás que enviarle el nuevo. Úsalo si cree que otra persona lo tiene.`,
    textoConfirmar: 'Renovar enlace',
    peligro: true,
  })
  if (seguro) await crear([enlace.asesorId], true, `renovar-${enlace.asesorId}`, 'Enlace renovado: el anterior ya no funciona.')
}

async function desactivar(enlace: EnlaceAsesor) {
  const seguro = await confirmar({
    titulo: 'Desactivar el enlace',
    mensaje: `${enlace.nombre} dejará de ver el seguimiento de sus estudiantes. Podrás crearle otro enlace cuando quieras.`,
    textoConfirmar: 'Desactivar',
    peligro: true,
  })
  if (!seguro) return
  await ejecutar(
    `quitar-${enlace.asesorId}`,
    () => api<Respuesta<EnlaceAsesor[]>>(`events/${props.eventoId}/advisory/links/${enlace.asesorId}`, { method: 'DELETE' }),
    'Enlace desactivado.',
  )
}

async function copiarTexto(texto: string, exito: string) {
  if (await copiar(texto)) toast.exito(exito)
  else toast.error('Tu navegador no permitió copiar. Selecciona el enlace y cópialo a mano.')
}

const copiarEnlace = (enlace: EnlaceAsesor) => copiarTexto(urlDe(enlace), 'Enlace copiado.')
const copiarMensaje = (enlace: EnlaceAsesor) => copiarTexto(mensajeParaDocente(enlace.nombre, urlDe(enlace), props.eventoNombre), 'Mensaje copiado: pégalo en WhatsApp o en el correo.')
</script>

<template>
  <AppModal
    :abierto="abierto"
    titulo="Enlaces de los docentes"
    descripcion="Con su enlace, cada docente ve cómo van los pagos de sus estudiantes sin iniciar sesión."
    ancho="xl"
    @cerrar="emit('cerrar')"
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10 ring-inset">
        <p class="text-sm text-slate-200">
          <strong class="text-white tabular-nums">{{ numero(activos) }}</strong> de <span class="tabular-nums">{{ numero(enlaces.length) }}</span> docentes tienen enlace.
        </p>
        <AppButton v-if="faltantes.length" size="sm" icon="heroicons:link" :loading="trabajando === 'faltantes'" :disabled="trabajando !== null" @click="crearFaltantes">
          Crear los {{ numero(faltantes.length) }} que faltan
        </AppButton>
      </div>

      <p class="flex gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset">
        <Icon name="heroicons:shield-exclamation" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>El enlace es personal: <strong>quien lo tenga puede ver a los estudiantes de ese docente</strong> (nombre, código, celular y si pagó). No se muestran DNI, correos ni montos. Envíalo solo a su docente y renuévalo si se difunde.</span>
      </p>

      <ul class="divide-y divide-white/5 rounded-xl ring-1 ring-white/10 ring-inset" aria-label="Docentes y sus enlaces">
        <li v-for="enlace in enlaces" :key="enlace.asesorId" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-white">{{ enlace.nombre }}</p>
            <p class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <AppBadge v-if="estadoDelEnlace(enlace) === 'SIN_ENLACE'" tono="neutral">Sin enlace</AppBadge>
              <AppBadge v-else-if="estadoDelEnlace(enlace) === 'SIN_ABRIR'" tono="warn">Aún no lo abre</AppBadge>
              <AppBadge v-else tono="ok">Activo</AppBadge>
              <span v-if="estadoDelEnlace(enlace) === 'ABIERTO'">Lo abrió {{ haceCuanto(enlace.ultimoAcceso) }}</span>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <template v-if="enlace.token">
              <AppButton size="sm" variant="secondary" icon="heroicons:clipboard-document" @click="copiarEnlace(enlace)">Copiar enlace</AppButton>
              <AppButton size="sm" variant="secondary" icon="heroicons:chat-bubble-left-ellipsis" @click="copiarMensaje(enlace)">Copiar mensaje</AppButton>
              <AppMenu etiqueta="Más" size="sm" variant="ghost" :disabled="trabajando !== null">
                <a :href="urlDe(enlace)" target="_blank" rel="noopener noreferrer" role="menuitem" class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5">
                  <Icon name="heroicons:arrow-top-right-on-square" class="size-4 shrink-0" aria-hidden="true" /> Abrir como la verá el docente
                </a>
                <AppMenuItem icon="heroicons:arrow-path" @click="renovar(enlace)">Renovar enlace</AppMenuItem>
                <AppMenuItem icon="heroicons:no-symbol" peligro @click="desactivar(enlace)">Desactivar enlace</AppMenuItem>
              </AppMenu>
            </template>
            <AppButton
              v-else
              size="sm"
              icon="heroicons:link"
              :loading="trabajando === `crear-${enlace.asesorId}`"
              :disabled="trabajando !== null"
              @click="crear([enlace.asesorId], false, `crear-${enlace.asesorId}`, 'Enlace creado.')"
            >
              Crear enlace
            </AppButton>
          </div>
        </li>
      </ul>
      <AppEmpty v-if="!enlaces.length" titulo="Aún no hay asesores" descripcion="Carga el padrón para que aparezcan los docentes." icon="heroicons:user-group" />
    </div>

    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cerrar</AppButton>
    </template>
  </AppModal>
</template>
