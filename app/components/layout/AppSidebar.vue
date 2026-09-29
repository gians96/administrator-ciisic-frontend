<script setup lang="ts">
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
          ]
        : []),
    ],
  },
])

const route = useRoute()
const activo = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <nav class="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5" aria-label="Navegación principal">
    <NuxtLink to="/" class="flex items-center gap-3 px-3" @click="$emit('navegar')">
      <span class="inline-flex size-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
        <Icon name="heroicons:cpu-chip" class="size-6" aria-hidden="true" />
      </span>
      <span>
        <span class="block font-display text-lg leading-tight font-extrabold text-white">CIISIC</span>
        <span class="block text-xs text-slate-400">Panel administrativo</span>
      </span>
    </NuxtLink>

    <div v-for="seccion in secciones" :key="seccion.titulo">
      <p class="px-3 pb-2 text-[0.7rem] font-bold tracking-[0.18em] text-slate-500 uppercase">{{ seccion.titulo }}</p>
      <ul class="space-y-1">
        <li v-for="item in seccion.items" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition"
            :class="activo(item.to) ? 'bg-brand-500/15 font-semibold text-white ring-1 ring-brand-400/25' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
            :aria-current="activo(item.to) ? 'page' : undefined"
            @click="$emit('navegar')"
          >
            <Icon :name="item.icon" class="size-5 shrink-0" :class="activo(item.to) ? 'text-brand-300' : ''" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
