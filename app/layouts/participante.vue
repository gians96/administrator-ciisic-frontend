<script setup lang="ts">
import { esItemPortalActivo, NAVEGACION_PORTAL } from '~/utils/portal'

/**
 * Portal del participante: barra superior con el menú de la cuenta y la navegación del portal
 * (`NAVEGACION_PORTAL`): pestañas en escritorio y barra inferior fija en el celular.
 */
const auth = useAuthStore()
const route = useRoute()

const seccionActual = computed(() => NAVEGACION_PORTAL.find((item) => esItemPortalActivo(item, route.path)) ?? null)

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
          <p class="text-xs text-slate-400">
            Portal del participante<span v-if="seccionActual" class="sm:hidden"> · {{ seccionActual.label }}</span>
          </p>
        </div>
        <div class="ml-auto flex items-center">
          <MenuUsuario
            :nombres="auth.participante?.nombres"
            :apellidos="auth.participante?.apellidos"
            :correo="auth.participante?.correo"
            rol="Participante"
            @salir="salir"
          />
        </div>
      </div>

      <!-- Escritorio: pestañas -->
      <nav class="mx-auto hidden max-w-4xl px-4 sm:block sm:px-6" aria-label="Portal del participante">
        <ul class="-mb-px flex gap-1 overflow-x-auto">
          <li v-for="item in NAVEGACION_PORTAL" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition"
              :class="esItemPortalActivo(item, route.path) ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
              :aria-current="esItemPortalActivo(item, route.path) ? 'page' : undefined"
            >
              <Icon :name="item.icon" class="size-4" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>

    <main class="mx-auto max-w-4xl px-4 pt-8 pb-28 sm:px-6 sm:pb-8">
      <slot />
    </main>

    <!-- Celular: barra inferior fija -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      aria-label="Portal del participante"
    >
      <!-- Columnas al ancho de su etiqueta (no cinco iguales): «Inscripciones» y «Certificados» caben
           enteras desde 320 px; 11 px desde 360 px -->
      <ul class="mx-auto flex max-w-md">
        <li v-for="item in NAVEGACION_PORTAL" :key="item.to" class="min-w-0 flex-auto">
          <NuxtLink
            :to="item.to"
            class="flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[0.625rem] leading-none font-medium tracking-tight transition min-[360px]:text-[0.6875rem]"
            :class="esItemPortalActivo(item, route.path) ? 'text-brand-300' : 'text-slate-400 hover:text-slate-200'"
            :aria-current="esItemPortalActivo(item, route.path) ? 'page' : undefined"
          >
            <Icon :name="item.icon" class="size-6" aria-hidden="true" />
            <span class="max-w-full truncate">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
