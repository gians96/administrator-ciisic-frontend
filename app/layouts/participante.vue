<script setup lang="ts">
const auth = useAuthStore()

async function salir() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-dvh bg-navy-900">
    <header class="sticky top-0 z-20 border-b border-white/10 bg-navy-900/90 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
        <span class="inline-flex size-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30" aria-hidden="true">
          <Icon name="heroicons:cpu-chip" class="size-5" />
        </span>
        <div class="leading-tight">
          <p class="font-display text-sm font-extrabold text-white">CIISIC</p>
          <p class="text-xs text-slate-400">Mis inscripciones</p>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <div class="hidden text-right sm:block">
            <p class="text-sm font-medium text-white">{{ auth.participante?.nombres }} {{ auth.participante?.apellidos }}</p>
            <p class="text-xs text-slate-400">{{ auth.participante?.correo }}</p>
          </div>
          <AppButton variant="ghost" size="sm" icon="heroicons:arrow-right-on-rectangle" @click="salir">
            <span class="hidden sm:inline">Salir</span>
          </AppButton>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <slot />
    </main>
  </div>
</template>
