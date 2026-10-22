<script setup lang="ts">
import type { EnlaceAsesor, EnlaceCiclo } from '~/types/api'

/**
 * Enlaces públicos para dar seguimiento sin iniciar sesión (spec 017 y 018; backend 026 y 027): uno por docente (ve a
 * sus estudiantes) y uno por ciclo (ve a todo el ciclo). Cada pestaña es su propia lista.
 */
const props = defineProps<{
  abierto: boolean
  eventoId: number | null
  docentes: EnlaceAsesor[]
  ciclos: EnlaceCiclo[]
  eventoNombre?: string | null
  /** Pestaña que se muestra al abrir. */
  inicial?: 'docentes' | 'ciclos'
}>()
const emit = defineEmits<{ cerrar: [], docentesActualizados: [lista: EnlaceAsesor[]], ciclosActualizados: [lista: EnlaceCiclo[]] }>()

const pestana = ref<string>(props.inicial ?? 'docentes')
watch(() => props.abierto, (abierto) => { if (abierto) pestana.value = props.inicial ?? 'docentes' })

const PESTANAS = computed(() => [
  { id: 'docentes', label: `Docentes (${props.docentes.length})`, icon: 'heroicons:user-group' },
  { id: 'ciclos', label: `Ciclos (${props.ciclos.length})`, icon: 'heroicons:rectangle-stack' },
])
</script>

<template>
  <AppModal
    :abierto="abierto"
    titulo="Enlaces públicos"
    descripcion="Con su enlace, cada docente o ciclo ve cómo van los pagos de sus estudiantes sin iniciar sesión."
    ancho="xl"
    @cerrar="emit('cerrar')"
  >
    <div class="space-y-4">
      <!-- Pestañas propias: `AppTabs` pone ids (`tab-ciclos`) que chocarían con los de la pantalla Reportes, que sigue abierta detrás -->
      <div class="flex gap-1 border-b border-white/10" role="tablist" aria-label="Tipo de enlace">
        <button
          v-for="tab in PESTANAS"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="pestana === tab.id"
          class="-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition"
          :class="pestana === tab.id ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
          @click="pestana = tab.id"
        >
          <Icon :name="tab.icon" class="size-4" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </div>

      <EnlacesDocentes v-if="pestana === 'docentes'" :evento-id="eventoId" :enlaces="docentes" :evento-nombre="eventoNombre" @actualizado="emit('docentesActualizados', $event)" />
      <EnlacesCiclos v-else :evento-id="eventoId" :enlaces="ciclos" :evento-nombre="eventoNombre" @actualizado="emit('ciclosActualizados', $event)" />
    </div>

    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cerrar</AppButton>
    </template>
  </AppModal>
</template>
