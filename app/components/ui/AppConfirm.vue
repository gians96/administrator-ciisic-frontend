<script setup lang="ts">
const { estado, responder } = useConfirm()
</script>

<template>
  <AppModal :abierto="estado.abierto" :titulo="estado.titulo" ancho="sm" @cerrar="responder(false)">
    <p class="text-sm leading-relaxed text-slate-300">{{ estado.mensaje }}</p>
    <template #acciones>
      <AppButton variant="secondary" @click="responder(false)">Cancelar</AppButton>
      <AppButton :variant="estado.peligro ? 'danger' : 'primary'" @click="responder(true)">
        {{ estado.textoConfirmar ?? 'Confirmar' }}
      </AppButton>
    </template>
  </AppModal>
</template>
