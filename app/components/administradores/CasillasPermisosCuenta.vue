<script setup lang="ts">
import type { Permiso, PermisoElegible } from '~/types/api'
import { alternarPermiso, bloqueadoPor, exponeDatosPersonales, nombrePermiso } from '~/utils/administradores'

/**
 * Casillas de los permisos de una cuenta de la Comisión (`permisosElegibles` de `GET /roles`). Marcar
 * uno agrega lo que implica; lo que exige otro permiso marcado no se puede desmarcar.
 */
const props = defineProps<{
  elegibles: PermisoElegible[]
  disabled?: boolean
  error?: string
  hint?: string
}>()
const marcados = defineModel<Permiso[]>({ required: true })
const id = useId()
/** Id de la casilla de un permiso (`asistencia.marcar` → `…-permiso-asistencia-marcar`). */
const idCasilla = (codigo: string) => `${id}-permiso-${codigo.replace(/[^\w-]/g, '-')}`

const filas = computed(() => props.elegibles.map((elegible) => {
  const marcado = marcados.value.includes(elegible.codigo)
  const exigidoPor = marcado ? bloqueadoPor(elegible.codigo, marcados.value, props.elegibles) : []
  const casillaId = idCasilla(elegible.codigo)
  return {
    ...elegible,
    casillaId,
    marcado,
    exigidoPor: exigidoPor.map((codigo) => nombrePermiso(codigo, props.elegibles)),
    implica: (elegible.implica ?? []).map((codigo) => nombrePermiso(codigo, props.elegibles)),
    datosPersonales: exponeDatosPersonales(elegible.codigo, props.elegibles),
  }
}))

/** Lo que acompaña al nombre (aviso de datos personales, lo que incluye y lo que lo exige). */
function descripcionDe(fila: (typeof filas.value)[number]): string | undefined {
  const ids = [
    fila.datosPersonales ? `${fila.casillaId}-datos` : null,
    fila.implica.length ? `${fila.casillaId}-incluye` : null,
    fila.exigidoPor.length ? `${fila.casillaId}-exige` : null,
  ].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

function alternar(permiso: Permiso, evento: Event) {
  const casilla = evento.target as HTMLInputElement
  if (!props.disabled) marcados.value = alternarPermiso(marcados.value, permiso, casilla.checked, props.elegibles)
  // Si otro permiso lo exige (o el control está deshabilitado), la casilla vuelve a su estado
  casilla.checked = marcados.value.includes(permiso)
}
</script>

<template>
  <fieldset :aria-describedby="error || hint ? `${id}-ayuda` : undefined">
    <legend class="field-label">Permisos<span v-if="!disabled" class="ml-0.5 text-brand-400" aria-hidden="true">*</span></legend>
    <div class="grid gap-2 sm:grid-cols-2">
      <label
        v-for="fila in filas"
        :key="fila.codigo"
        :for="fila.casillaId"
        class="flex gap-3 rounded-xl border px-3.5 py-2.5 transition"
        :class="[
          fila.marcado ? 'border-brand-500 bg-brand-500/10' : 'border-navy-500 bg-navy-900/80',
          disabled || fila.exigidoPor.length ? 'cursor-not-allowed' : 'cursor-pointer hover:border-navy-400',
          disabled ? 'opacity-60' : '',
        ]"
      >
        <!-- Nombre accesible: el texto de la opción (aria-labelledby; aria-label repite el mismo texto
             para las herramientas que no resuelven referencias y mostrarían el valor «on») -->
        <input
          :id="fila.casillaId"
          type="checkbox"
          class="mt-0.5 size-4 shrink-0 accent-brand-500"
          :checked="fila.marcado"
          :disabled="disabled || fila.exigidoPor.length > 0"
          :aria-label="fila.nombre"
          :aria-labelledby="`${fila.casillaId}-nombre`"
          :aria-describedby="descripcionDe(fila)"
          @change="alternar(fila.codigo, $event)"
        >
        <span class="min-w-0 space-y-0.5">
          <span class="block text-sm font-medium text-white">
            <!-- En la misma línea: el espacio entre el nombre y la insignia se conserva -->
            <span :id="`${fila.casillaId}-nombre`">{{ fila.nombre }}</span> <AppBadge v-if="fila.datosPersonales" :id="`${fila.casillaId}-datos`" tono="warn" class="ml-1 align-middle">Datos personales</AppBadge>
          </span>
          <span v-if="fila.implica.length" :id="`${fila.casillaId}-incluye`" class="block text-xs text-slate-400">Incluye: {{ fila.implica.join(' · ') }}</span>
          <span v-if="fila.exigidoPor.length" :id="`${fila.casillaId}-exige`" class="block text-xs text-slate-400">Lo exige: {{ fila.exigidoPor.join(' · ') }}</span>
        </span>
      </label>
    </div>
    <p v-if="error" :id="`${id}-ayuda`" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-ayuda`" class="field-hint">{{ hint }}</p>
  </fieldset>
</template>
