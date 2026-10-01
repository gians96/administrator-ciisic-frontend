<script setup lang="ts">
import { ESTADO_ESCANER, estadoEscanerInicial, type EstadoEscaner } from '~/utils/asistencia'
import { etiquetaRol, inicioPara, RUTA_ESCANER, tonoRol } from '~/utils/permisos'

/**
 * Escáner de asistencia a pantalla completa (sin menú lateral): barra con «volver», el selector de
 * evento del panel (`useEventoStore`), la actividad (`SelectorActividad`) y el menú de la cuenta.
 */
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const estado = useState<EstadoEscaner>(ESTADO_ESCANER, estadoEscanerInicial)

/** Asistencia (con el evento y la actividad del escáner); sin `asistencia.ver`, el inicio de la cuenta. */
const volverA = computed(() => {
  if (!auth.puede('asistencia.ver')) {
    const inicio = inicioPara(auth.acceso)
    return inicio === RUTA_ESCANER ? null : inicio
  }
  const { eventoId, actividadId } = estado.value
  const query: Record<string, string> = {}
  if (eventoId) query.evento = String(eventoId)
  if (eventoId && actividadId) query.actividad = String(actividadId)
  return { path: '/asistencia', query }
})

onMounted(async () => {
  try {
    await eventos.cargar()
  } catch {
    toast.error('No se pudieron cargar los eventos.')
  }
})

async function salir() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-navy-950">
    <header class="sticky top-0 z-20 border-b border-white/10 bg-navy-950/95 backdrop-blur-xl">
      <div class="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <NuxtLink
          v-if="volverA"
          :to="volverA"
          class="-ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          :aria-label="typeof volverA === 'string' ? 'Volver al inicio' : 'Volver a Asistencia'"
        >
          <Icon name="heroicons:arrow-left" class="size-5" aria-hidden="true" />
          <span class="hidden md:inline" aria-hidden="true">{{ typeof volverA === 'string' ? 'Inicio' : 'Asistencia' }}</span>
        </NuxtLink>
        <EventoSelector />
        <div class="ml-auto flex shrink-0 items-center">
          <MenuUsuario
            :nombres="auth.usuario?.nombres"
            :apellidos="auth.usuario?.apellidos"
            :correo="auth.usuario?.correo"
            :rol="etiquetaRol(auth.usuario?.rolCodigo, auth.usuario?.rolNombre)"
            :tono="tonoRol(auth.usuario?.rolCodigo)"
            @salir="salir"
          />
        </div>
      </div>
      <div class="px-3 pb-2.5 sm:px-4">
        <SelectorActividad />
      </div>
    </header>

    <main class="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
      <slot />
    </main>
  </div>
</template>
