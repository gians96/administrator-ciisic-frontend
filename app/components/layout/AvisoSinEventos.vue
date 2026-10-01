<script setup lang="ts">
// Páginas por evento sin ningún evento en la barra superior: quien configura eventos puede crearlos;
// una cuenta por evento debe pedir que se los asignen.
const auth = useAuthStore()
</script>

<template>
  <AppEmpty
    v-if="auth.puede('eventos.configurar')"
    titulo="Aún no hay eventos"
    descripcion="Crea el primer evento para empezar a recibir inscripciones."
    icon="heroicons:calendar-days"
  >
    <AppButton to="/eventos/nuevo" icon="heroicons:plus">Crear evento</AppButton>
  </AppEmpty>
  <AppEmpty
    v-else
    titulo="Aún no tienes eventos asignados"
    descripcion="Pide a un Owner o a un Administrador del sistema que te asigne el evento en el que trabajarás."
    icon="heroicons:calendar-days"
  />
</template>
