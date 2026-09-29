<script setup lang="ts">
import type { Meta } from '~/types/api'
import { numero } from '~/utils/formato'

const props = defineProps<{ meta: Meta | null }>()
const emit = defineEmits<{ cambiar: [pagina: number] }>()

const totalPaginas = computed(() => (props.meta ? Math.max(1, Math.ceil(props.meta.total / props.meta.pageSize)) : 1))
const desde = computed(() => (props.meta && props.meta.total ? (props.meta.page - 1) * props.meta.pageSize + 1 : 0))
const hasta = computed(() => (props.meta ? Math.min(props.meta.page * props.meta.pageSize, props.meta.total) : 0))
</script>

<template>
  <nav v-if="meta" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-400" aria-label="Paginación">
    <p>{{ numero(desde) }}–{{ numero(hasta) }} de {{ numero(meta.total) }}</p>
    <div class="flex items-center gap-2">
      <AppButton size="sm" variant="secondary" icon="heroicons:chevron-left" :disabled="meta.page <= 1" @click="emit('cambiar', meta.page - 1)">
        Anterior
      </AppButton>
      <span class="px-2">Página {{ meta.page }} de {{ totalPaginas }}</span>
      <AppButton size="sm" variant="secondary" :disabled="meta.page >= totalPaginas" @click="emit('cambiar', meta.page + 1)">
        Siguiente
        <Icon name="heroicons:chevron-right" class="size-4" aria-hidden="true" />
      </AppButton>
    </div>
  </nav>
</template>
