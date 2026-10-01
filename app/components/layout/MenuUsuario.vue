<script setup lang="ts">
import { iniciales, nombreCorto } from '~/utils/perfil'

/**
 * Menú de la cuenta en la barra superior: avatar + nombre + flecha; al abrirlo muestra los datos
 * de la cuenta y «Cerrar sesión». Cierra con clic fuera, `Escape` o al cambiar de ruta.
 */
const props = withDefaults(defineProps<{
  nombres?: string | null
  apellidos?: string | null
  correo?: string | null
  rol?: string | null
  /** Tono del `AppBadge` del rol. */
  tono?: 'brand' | 'neutral' | 'ok' | 'warn' | 'error' | 'info'
}>(), { nombres: null, apellidos: null, correo: null, rol: null, tono: 'brand' })

const emit = defineEmits<{ salir: [] }>()

const id = useId()
const raiz = ref<HTMLElement | null>(null)
const disparador = ref<HTMLButtonElement | null>(null)
const primerItem = ref<HTMLButtonElement | null>(null)
const abierto = ref(false)
const saliendo = ref(false)

const avatar = computed(() => iniciales(props.nombres, props.apellidos))
const corto = computed(() => nombreCorto(props.nombres, props.apellidos))
const completo = computed(() => [props.nombres, props.apellidos].map((parte) => parte?.trim()).filter(Boolean).join(' '))

function cerrar(devolverFoco = false) {
  abierto.value = false
  if (devolverFoco) disparador.value?.focus()
}

async function abrir(enfocar = false) {
  abierto.value = true
  if (!enfocar) return
  await nextTick()
  primerItem.value?.focus()
}

function alternar() {
  if (abierto.value) cerrar()
  else abrir()
}

function alPulsarFuera(evento: PointerEvent) {
  if (raiz.value && !raiz.value.contains(evento.target as Node)) cerrar()
}

function alTeclear(evento: KeyboardEvent) {
  if (evento.key === 'Escape') cerrar(true)
}

watch(abierto, (valor) => {
  if (valor) {
    document.addEventListener('pointerdown', alPulsarFuera)
    document.addEventListener('keydown', alTeclear)
  } else {
    document.removeEventListener('pointerdown', alPulsarFuera)
    document.removeEventListener('keydown', alTeclear)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', alPulsarFuera)
  document.removeEventListener('keydown', alTeclear)
})

const route = useRoute()
watch(() => route.fullPath, () => cerrar())

function salir() {
  saliendo.value = true
  emit('salir')
}
</script>

<template>
  <div ref="raiz" class="relative">
    <button
      ref="disparador"
      type="button"
      class="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 ring-1 transition sm:gap-2.5 sm:pr-3"
      :class="abierto ? 'bg-white/5 ring-brand-400/60' : 'ring-white/10 hover:bg-white/5 hover:ring-white/20'"
      aria-haspopup="menu"
      :aria-expanded="abierto"
      :aria-controls="id"
      :aria-label="`Menú de la cuenta de ${completo || 'usuario'}`"
      @click="alternar"
      @keydown.down.prevent="abrir(true)"
    >
      <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200 ring-1 ring-brand-400/30" aria-hidden="true">{{ avatar }}</span>
      <span class="hidden max-w-[12rem] truncate text-sm font-semibold text-white sm:block">{{ corto }}</span>
      <Icon name="heroicons:chevron-down" class="size-4 shrink-0 text-slate-400 transition-transform" :class="abierto ? 'rotate-180' : ''" aria-hidden="true" />
    </button>

    <Transition
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-active-class="transition duration-150 ease-out"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
    >
      <div
        v-if="abierto"
        :id="id"
        class="absolute top-full right-0 z-40 mt-2 w-72 origin-top-right rounded-2xl border border-white/10 bg-navy-850 p-1.5 shadow-2xl shadow-black/40"
        role="menu"
        :aria-label="`Cuenta de ${completo || 'usuario'}`"
      >
        <div class="flex items-center gap-3 px-3 py-3">
          <span class="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-200 ring-1 ring-brand-400/30" aria-hidden="true">{{ avatar }}</span>
          <div class="min-w-0">
            <p class="text-sm leading-snug font-semibold break-words text-white">{{ completo || '—' }}</p>
            <p v-if="correo" class="truncate text-xs text-slate-400" :title="correo">{{ correo }}</p>
            <AppBadge v-if="rol" :tono="tono" class="mt-1.5">{{ rol }}</AppBadge>
          </div>
        </div>

        <div class="my-1 h-px bg-white/10" role="separator" />

        <button
          ref="primerItem"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200 focus-visible:bg-red-500/10 disabled:cursor-wait disabled:opacity-60"
          :disabled="saliendo"
          @click="salir"
        >
          <Icon :name="saliendo ? 'heroicons:arrow-path' : 'heroicons:arrow-right-on-rectangle'" class="size-5 shrink-0" :class="saliendo ? 'animate-spin' : ''" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </Transition>
  </div>
</template>
