<script setup lang="ts">
/** Franja ámbar cuando las ponencias están en acceso libre: no se comprueba el congreso ni el pago. */
defineProps<{ activo: boolean | null }>()
</script>

<template>
  <div v-if="activo" class="flex items-start gap-3 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-300/25 ring-inset" role="status">
    <Icon name="heroicons:lock-open" class="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
    <p>
      <strong class="font-semibold">Acceso libre activo.</strong>
      Cualquiera se inscribe a las ponencias solo con su documento: no se comprueba la inscripción al congreso ni el pago.
      <NuxtLink v-if="$route.path !== '/ponencias-especializadas'" to="/ponencias-especializadas" class="underline underline-offset-2 hover:text-white">Cambiar en el Programa</NuxtLink>
    </p>
  </div>
</template>
