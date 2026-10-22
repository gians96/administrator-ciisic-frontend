<script setup lang="ts">
import { MIN_INTEGRANTES_MAXIMO, PLANES, type Cifra, type FormularioPlanes } from '~/utils/delegaciones'

/**
 * Planes de una delegación (spec 029): Con kit, Sin kit y Virtual, cada uno con su estado, su precio por persona
 * y un precio promocional opcional que se cobra desde el mínimo de integrantes de la delegación.
 */
const planes = defineModel<FormularioPlanes>({ required: true })
const minIntegrantes = defineModel<Cifra>('minIntegrantes', { required: true })
const props = withDefaults(defineProps<{
  /** Errores por campo: `CON_KIT.precio`, `SIN_KIT.precioPromocional`, `minIntegrantes`… */
  errores?: Record<string, string>
  /** Prefijo de los `id` (dos editores en pantalla no deben repetirlos). */
  prefijo?: string
}>(), { errores: () => ({}), prefijo: 'planes' })

const hayPromocional = computed(() => PLANES.some(({ codigo }) => planes.value[codigo].activo && planes.value[codigo].precioPromocional !== ''))
</script>

<template>
  <div class="space-y-3">
    <div v-for="plan in PLANES" :key="plan.codigo" class="rounded-xl bg-white/5 p-4">
      <AppSwitch v-model="planes[plan.codigo].activo" :label="plan.etiqueta" :descripcion="plan.descripcion" />
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <AppField label="Precio por persona (S/)" :for="`${props.prefijo}-${plan.codigo}-precio`" :required="planes[plan.codigo].activo" :error="errores[`${plan.codigo}.precio`]">
          <input :id="`${props.prefijo}-${plan.codigo}-precio`" v-model.number="planes[plan.codigo].precio" type="number" min="0" step="0.01" inputmode="decimal" class="field-control">
        </AppField>
        <AppField label="Precio promocional (S/)" :for="`${props.prefijo}-${plan.codigo}-promo`" :error="errores[`${plan.codigo}.precioPromocional`]" hint="Opcional: desde el mínimo de integrantes, para todo este plan.">
          <input :id="`${props.prefijo}-${plan.codigo}-promo`" v-model.number="planes[plan.codigo].precioPromocional" type="number" min="0" step="0.01" inputmode="decimal" class="field-control">
        </AppField>
      </div>
    </div>
    <div class="max-w-xs">
      <AppField label="Mínimo de integrantes" :for="`${props.prefijo}-minimo`" :error="errores.minIntegrantes" :hint="hayPromocional ? `Desde ese total, los planes con precio promocional lo cobran. Entre 1 y ${MIN_INTEGRANTES_MAXIMO}.` : `Solo cuenta si algún plan tiene precio promocional. Entre 1 y ${MIN_INTEGRANTES_MAXIMO}.`">
        <input :id="`${props.prefijo}-minimo`" v-model.number="minIntegrantes" type="number" min="1" :max="MIN_INTEGRANTES_MAXIMO" step="1" inputmode="numeric" class="field-control">
      </AppField>
    </div>
  </div>
</template>
