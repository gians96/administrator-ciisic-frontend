<script setup lang="ts">
const store = useEventoStore()
const id = useId()

function cambiar(evento: Event) {
  store.seleccionar(Number((evento.target as HTMLSelectElement).value))
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <label :for="id" class="sr-only">Evento de trabajo</label>
    <Icon name="heroicons:calendar" class="hidden size-5 shrink-0 text-brand-300 sm:block" aria-hidden="true" />
    <select
      :id="id"
      class="field-control max-w-[18rem] min-w-0 py-2 font-medium"
      :value="store.seleccionadoId ?? ''"
      :disabled="store.cargando || !store.eventos.length"
      @change="cambiar"
    >
      <option v-if="!store.eventos.length" value="">Sin eventos</option>
      <option v-for="evento in store.eventos" :key="evento.id" :value="evento.id">
        {{ evento.nombreCorto }}{{ evento.esPrincipal ? ' ★' : '' }}{{ evento.estado !== 'PUBLICADO' ? ` · ${evento.estado.toLowerCase()}` : '' }}
      </option>
    </select>
  </div>
</template>
