<script setup lang="ts">
import type { OpcionEvento } from '~/utils/administradores'

/** Casillas de los eventos asignados a una cuenta por evento (Tesorero o Comisión). */
const props = defineProps<{
  opciones: OpcionEvento[]
  disabled?: boolean
  error?: string
  hint?: string
}>()
const marcados = defineModel<number[]>({ required: true })
const id = useId()

function alternar(eventoId: number, evento: Event) {
  const casilla = evento.target as HTMLInputElement
  if (!props.disabled) {
    marcados.value = casilla.checked ? [...new Set([...marcados.value, eventoId])] : marcados.value.filter((otro) => otro !== eventoId)
  }
  casilla.checked = marcados.value.includes(eventoId)
}
</script>

<template>
  <fieldset :aria-describedby="error || hint ? `${id}-ayuda` : undefined">
    <legend class="field-label">Eventos<span v-if="!disabled" class="ml-0.5 text-brand-400" aria-hidden="true">*</span></legend>
    <p v-if="!opciones.length" class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-400">
      No hay eventos registrados. Crea uno en Eventos para asignarlo a esta cuenta.
    </p>
    <div v-else class="grid gap-2 sm:grid-cols-2">
      <label
        v-for="opcion in opciones"
        :key="opcion.id"
        class="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition"
        :class="[
          marcados.includes(opcion.id) ? 'border-brand-500 bg-brand-500/10' : 'border-navy-500 bg-navy-900/80',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-navy-400',
        ]"
      >
        <input
          type="checkbox"
          class="size-4 shrink-0 accent-brand-500"
          :checked="marcados.includes(opcion.id)"
          :disabled="disabled"
          @change="alternar(opcion.id, $event)"
        >
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium text-white">{{ opcion.nombreCorto }}</span>
          <span v-if="opcion.detalle" class="block text-xs text-slate-400">{{ opcion.detalle }}</span>
        </span>
      </label>
    </div>
    <p v-if="error" :id="`${id}-ayuda`" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-ayuda`" class="field-hint">{{ hint }}</p>
  </fieldset>
</template>
