<script setup lang="ts">
const { toasts, cerrar } = useToast()

const ESTILO = {
  exito: { icono: 'heroicons:check-circle', clase: 'border-emerald-400/30 text-emerald-100' },
  error: { icono: 'heroicons:exclamation-triangle', clase: 'border-red-400/30 text-red-100' },
  info: { icono: 'heroicons:information-circle', clase: 'border-brand-400/30 text-brand-100' },
}
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
    <TransitionGroup
      enter-from-class="translate-y-2 opacity-0"
      enter-active-class="transition duration-200"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border bg-navy-800/95 px-4 py-3 text-sm shadow-xl backdrop-blur"
        :class="ESTILO[toast.tipo].clase"
        role="status"
      >
        <Icon :name="ESTILO[toast.tipo].icono" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p class="flex-1">{{ toast.mensaje }}</p>
        <button type="button" class="text-slate-400 hover:text-white" aria-label="Cerrar notificación" @click="cerrar(toast.id)">
          <Icon name="heroicons:x-mark" class="size-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
