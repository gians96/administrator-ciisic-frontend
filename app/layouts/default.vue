<script setup lang="ts">
const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const menuAbierto = ref(false)

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

const iniciales = computed(() => {
  const u = auth.usuario
  return u ? `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase() : '?'
})
</script>

<template>
  <div class="min-h-dvh bg-navy-900">
    <!-- Barra lateral (escritorio) -->
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-navy-950/60 backdrop-blur lg:block">
      <AppSidebar />
    </aside>

    <!-- Barra lateral (móvil) -->
    <Transition enter-from-class="opacity-0" enter-active-class="transition" leave-to-class="opacity-0" leave-active-class="transition">
      <div v-if="menuAbierto" class="fixed inset-0 z-40 bg-navy-950/70 lg:hidden" @click="menuAbierto = false" />
    </Transition>
    <aside
      class="fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-navy-900 transition-transform lg:hidden"
      :class="menuAbierto ? 'translate-x-0' : '-translate-x-full'"
      :aria-hidden="!menuAbierto"
    >
      <AppSidebar @navegar="menuAbierto = false" />
    </aside>

    <div class="lg:pl-64">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-navy-900/90 px-4 backdrop-blur-xl sm:px-6">
        <button type="button" class="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Abrir menú" @click="menuAbierto = true">
          <Icon name="heroicons:bars-3" class="size-6" />
        </button>
        <EventoSelector />
        <div class="ml-auto flex items-center gap-3">
          <div class="hidden text-right sm:block">
            <p class="text-sm font-medium text-white">{{ auth.usuario?.nombres }} {{ auth.usuario?.apellidos }}</p>
            <p class="text-xs text-slate-400">{{ auth.usuario?.rolNombre }}</p>
          </div>
          <span class="inline-flex size-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-200" aria-hidden="true">{{ iniciales }}</span>
          <AppButton variant="ghost" size="sm" icon="heroicons:arrow-right-on-rectangle" @click="salir">
            <span class="hidden sm:inline">Salir</span>
          </AppButton>
        </div>
      </header>

      <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
