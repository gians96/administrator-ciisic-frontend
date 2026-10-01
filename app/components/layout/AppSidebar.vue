<script setup lang="ts">
/** Menú lateral. `contraido`: riel de solo íconos (escritorio); el nombre sale en un globo al pasar. */
const props = withDefaults(defineProps<{ contraido?: boolean }>(), { contraido: false })
defineEmits<{ navegar: [] }>()
const auth = useAuthStore()

const secciones = computed(() => [
  {
    titulo: 'Congreso',
    items: [
      { to: '/', label: 'Resumen', icon: 'heroicons:squares-2x2' },
      { to: '/inscripciones', label: 'Inscripciones', icon: 'heroicons:clipboard-document-check' },
      { to: '/asistencia', label: 'Asistencia', icon: 'heroicons:qr-code' },
      { to: '/ponencias', label: 'Ponencias', icon: 'heroicons:document-text' },
      { to: '/mensajes', label: 'Mensajes', icon: 'heroicons:envelope' },
    ],
  },
  {
    titulo: 'Configuración',
    items: [
      { to: '/eventos', label: 'Eventos', icon: 'heroicons:calendar-days' },
      { to: '/tipos-inscripcion', label: 'Tipos de inscripción', icon: 'heroicons:tag' },
      { to: '/consultas', label: 'Consultas DNI', icon: 'heroicons:identification' },
      { to: '/participantes', label: 'Participantes', icon: 'heroicons:users' },
      // Solo SuperAdmin (las páginas también lo exigen con `soloSuperAdmin`)
      ...(auth.esSuperAdmin
        ? [
            { to: '/correo', label: 'Correo', icon: 'heroicons:paper-airplane' },
            { to: '/administradores', label: 'Administradores', icon: 'heroicons:shield-check' },
            { to: '/sistema', label: 'Sistema', icon: 'heroicons:cog-8-tooth' },
          ]
        : []),
    ],
  },
])

const route = useRoute()
const activo = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

// Globo `fixed` (uno `absolute` quedaría recortado por el desplazamiento de la lista)
const globo = ref<{ texto: string, top: number, left: number } | null>(null)

function mostrarGlobo(evento: Event, texto: string) {
  if (!props.contraido) return
  const caja = (evento.currentTarget as HTMLElement).getBoundingClientRect()
  globo.value = { texto, top: caja.top + caja.height / 2, left: caja.right + 12 }
}

function ocultarGlobo() {
  globo.value = null
}

watch(() => props.contraido, ocultarGlobo)
</script>

<template>
  <div class="flex h-full flex-col">
    <NuxtLink
      to="/"
      class="flex h-16 shrink-0 items-center gap-3 border-b border-white/10"
      :class="contraido ? 'justify-center' : 'px-6'"
      aria-label="CIISIC · Panel administrativo"
      @click="$emit('navegar')"
    >
      <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
        <Icon name="heroicons:cpu-chip" class="size-6" aria-hidden="true" />
      </span>
      <span v-if="!contraido" class="min-w-0" aria-hidden="true">
        <span class="block font-display text-lg leading-tight font-extrabold text-white">CIISIC</span>
        <span class="block truncate text-xs text-slate-400">Panel administrativo</span>
      </span>
    </NuxtLink>

    <!-- Riel sin barra de desplazamiento; en línea porque `* { scrollbar-width }` de main.css va fuera de capa -->
    <nav
      class="flex flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-3 py-5"
      :style="contraido ? { scrollbarWidth: 'none' } : undefined"
      aria-label="Navegación principal"
      @scroll="ocultarGlobo"
    >
      <div v-for="(seccion, indice) in secciones" :key="seccion.titulo">
        <p v-if="!contraido" class="px-3 pb-2 text-[0.7rem] font-bold tracking-[0.18em] text-slate-500 uppercase">{{ seccion.titulo }}</p>
        <template v-else>
          <p class="sr-only">{{ seccion.titulo }}</p>
          <span v-if="indice > 0" class="mx-auto mb-4 block h-px w-6 bg-white/15" aria-hidden="true" />
        </template>
        <ul class="space-y-1">
          <li v-for="item in seccion.items" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="flex items-center gap-3 rounded-xl text-sm transition"
              :class="[
                contraido ? 'mx-auto size-11 justify-center' : 'px-3 py-2',
                activo(item.to) ? 'bg-brand-500/15 font-semibold text-white ring-1 ring-brand-400/25' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              ]"
              :aria-current="activo(item.to) ? 'page' : undefined"
              @click="$emit('navegar')"
              @mouseenter="mostrarGlobo($event, item.label)"
              @focus="mostrarGlobo($event, item.label)"
              @mouseleave="ocultarGlobo"
              @blur="ocultarGlobo"
            >
              <Icon :name="item.icon" class="size-5 shrink-0" :class="activo(item.to) ? 'text-brand-300' : ''" aria-hidden="true" />
              <span :class="contraido ? 'sr-only' : 'leading-snug'">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <Teleport to="body">
      <div
        v-if="contraido && globo"
        class="pointer-events-none fixed z-50 -translate-y-1/2 rounded-lg bg-navy-700 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg shadow-black/30 ring-1 ring-white/10"
        :style="{ top: `${globo.top}px`, left: `${globo.left}px` }"
        aria-hidden="true"
      >
        {{ globo.texto }}
      </div>
    </Teleport>
  </div>
</template>
