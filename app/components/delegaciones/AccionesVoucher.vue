<script setup lang="ts">
import type { PagoDelegacion } from '~/types/api'

/** Acciones de un voucher de la delegación; cada una aparece solo con el permiso que le corresponde. */
defineProps<{ pago: PagoDelegacion, puedeVer: boolean, puedeValidar: boolean, puedeEliminar: boolean }>()
defineEmits<{ ver: [], verificar: [], rechazar: [], pendiente: [], eliminar: [] }>()
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <AppButton v-if="puedeVer" size="sm" variant="secondary" icon="heroicons:eye" :aria-label="`Ver el voucher ${pago.numeroOperacion}`" @click="$emit('ver')">Ver</AppButton>
    <template v-if="puedeValidar">
      <AppButton v-if="pago.estado !== 'VERIFICADO'" size="sm" variant="success" @click="$emit('verificar')">Verificar</AppButton>
      <AppButton v-if="pago.estado !== 'RECHAZADO'" size="sm" variant="danger" @click="$emit('rechazar')">Rechazar</AppButton>
      <AppButton v-if="pago.estado !== 'PENDIENTE'" size="sm" variant="ghost" @click="$emit('pendiente')">Pendiente</AppButton>
    </template>
    <AppButton v-if="puedeEliminar" size="sm" variant="ghost" icon="heroicons:trash" :aria-label="`Eliminar el voucher ${pago.numeroOperacion}`" @click="$emit('eliminar')" />
  </div>
</template>
