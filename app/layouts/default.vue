<script setup lang="ts">
import { etiquetaRol, tonoRol } from '~/utils/permisos'

const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const route = useRoute()

/** Preferencia de este navegador: menú lateral de escritorio reducido a íconos. */
const CLAVE_CONTRAIDO = 'ciisic:sidebar-contraido'

function leerContraido(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONTRAIDO) === '1'
  } catch {
    return false
  }
}

const contraido = ref(leerContraido())
/** Cajón del menú en pantallas pequeñas. */
const menuAbierto = ref(false)

watch(contraido, (valor) => {
  try {
    localStorage.setItem(CLAVE_CONTRAIDO, valor ? '1' : '0')
  } catch {
    // Sin almacenamiento la preferencia dura hasta recargar
  }
})

function alTeclear(evento: KeyboardEvent) {
  if (evento.key === 'Escape') menuAbierto.value = false
}

watch(menuAbierto, (abierto) => {
  if (abierto) document.addEventListener('keydown', alTeclear)
  else document.removeEventListener('keydown', alTeclear)
})

watch(() => route.fullPath, () => {
  menuAbierto.value = false
})

onMounted(async () => {
  try {
    await eventos.cargar()
  } catch {
    toast.error('No se pudieron cargar los eventos.')
  }
})

onBeforeUnmount(() => document.removeEventListener('keydown', alTeclear))

async function salir() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-dvh bg-navy-900">
    <!-- Barra lateral (escritorio): completa o solo íconos -->
    <aside
      id="menu-escritorio"
      class="fixed inset-y-0 left-0 z-30 hidden border-r border-white/10 bg-navy-950/60 backdrop-blur transition-[width] duration-200 lg:block"
      :class="contraido ? 'w-[4.5rem]' : 'w-64'"
    >
      <AppSidebar :contraido="contraido" />
    </aside>

    <!-- Barra lateral (móvil) -->
    <Transition enter-from-class="opacity-0" enter-active-class="transition" leave-to-class="opacity-0" leave-active-class="transition">
      <div v-if="menuAbierto" class="fixed inset-0 z-40 bg-navy-950/70 lg:hidden" @click="menuAbierto = false" />
    </Transition>
    <aside
      id="menu-movil"
      class="fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-navy-900 transition-transform lg:hidden"
      :class="menuAbierto ? 'translate-x-0' : '-translate-x-full'"
      :aria-hidden="!menuAbierto"
      :inert="!menuAbierto"
    >
      <button
        type="button"
        class="absolute top-3.5 right-3 z-10 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Cerrar menú"
        @click="menuAbierto = false"
      >
        <Icon name="heroicons:x-mark" class="size-5" aria-hidden="true" />
      </button>
      <AppSidebar @navegar="menuAbierto = false" />
    </aside>

    <div class="transition-[padding] duration-200" :class="contraido ? 'lg:pl-[4.5rem]' : 'lg:pl-64'">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-navy-900/90 px-4 backdrop-blur-xl sm:px-6">
        <!-- Hamburguesa: en móvil abre el cajón; en escritorio contrae o expande el menú lateral -->
        <button
          type="button"
          class="-ml-1 rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Abrir menú"
          aria-controls="menu-movil"
          :aria-expanded="menuAbierto"
          @click="menuAbierto = true"
        >
          <Icon name="heroicons:bars-3" class="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="-ml-2 hidden rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:inline-flex"
          :aria-label="contraido ? 'Expandir menú' : 'Contraer menú'"
          :title="contraido ? 'Expandir menú' : 'Contraer menú'"
          aria-controls="menu-escritorio"
          :aria-expanded="!contraido"
          @click="contraido = !contraido"
        >
          <Icon name="heroicons:bars-3" class="size-6" aria-hidden="true" />
        </button>

        <EventoSelector />

        <div class="ml-auto flex items-center">
          <MenuUsuario
            :nombres="auth.usuario?.nombres"
            :apellidos="auth.usuario?.apellidos"
            :correo="auth.usuario?.correo"
            :rol="etiquetaRol(auth.usuario?.rolCodigo, auth.usuario?.rolNombre)"
            :tono="tonoRol(auth.usuario?.rolCodigo)"
            @salir="salir"
          />
        </div>
      </header>

      <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
