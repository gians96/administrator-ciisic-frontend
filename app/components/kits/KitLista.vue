<script setup lang="ts">
import type { InscripcionFila, Meta } from '~/types/api'
import { nombreCompleto } from '~/utils/formato'
import { kitDe, TEXTO_SITUACION_KIT_FILA, textoEntregaKit, TONO_SITUACION_KIT_FILA } from '~/utils/kit'
import { estadoFilaKit, puedeDeshacerEnLista, puedeEntregarEnLista } from '~/utils/kitsTablero'
import { esVirtual, etiquetaDeInsignia } from '~/utils/modalidad'

/**
 * Personas de la vista elegida en el tablero de kits: quién es, su tipo, su estado y dónde está su kit (cuándo y quién lo
 * entregó). Con `asistencia.marcar` (`conAcciones`) cada fila entrega o deshace el kit; abrir una fila muestra su detalle.
 */
const props = defineProps<{
  filas: readonly InscripcionFila[]
  meta: Meta | null
  cargando: boolean
  /** `asistencia.marcar`: muestra «Entregar kit» y «Deshacer entrega». */
  conAcciones: boolean
  /** Inscripción cuya entrega se está cambiando. */
  enCurso: number | null
}>()

const emit = defineEmits<{
  abrir: [id: number]
  entregar: [fila: InscripcionFila]
  deshacer: [fila: InscripcionFila]
  pagina: [numero: number]
}>()

const filasKit = computed(() => props.filas.map((fila) => {
  const kit = kitDe(fila.kit)
  return {
    fila,
    estado: estadoFilaKit(fila),
    entrega: textoEntregaKit(kit),
    entregar: props.conAcciones && puedeEntregarEnLista(fila),
    deshacer: props.conAcciones && puedeDeshacerEnLista(fila),
  }
}))
</script>

<template>
  <div>
    <div class="relative overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th>Participante</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Kit</th>
            <th><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ fila, estado, entrega, entregar, deshacer } in filasKit" :key="fila.id" class="cursor-pointer" @click="emit('abrir', fila.id)">
            <td>
              <p class="font-medium text-white">{{ nombreCompleto(fila.participante) }}</p>
              <p class="text-xs text-slate-400">{{ fila.participante.tipoDocumento.toUpperCase() }} {{ fila.participante.numeroDocumento }} · {{ fila.participante.correo }}</p>
            </td>
            <td>
              <p class="text-white">{{ fila.tipoInscripcion?.nombre ?? '—' }}</p>
              <div class="mt-0.5 flex flex-wrap gap-1">
                <AppBadge v-if="etiquetaDeInsignia(fila.tipoInscripcion)" tono="neutral">{{ etiquetaDeInsignia(fila.tipoInscripcion) }}</AppBadge>
                <AppBadgeVirtual v-if="esVirtual(fila.tipoInscripcion)" />
                <AppBadge v-if="fila.delegacion" tono="info">Delegación · {{ fila.delegacion.nombre }}</AppBadge>
              </div>
            </td>
            <td><AppBadge :estado="fila.estado.codigo">{{ fila.estado.nombre }}</AppBadge></td>
            <td>
              <div class="flex flex-wrap items-center gap-1">
                <AppBadge v-if="estado.situacion !== 'NINGUNO'" :tono="TONO_SITUACION_KIT_FILA[estado.situacion]">{{ TEXTO_SITUACION_KIT_FILA[estado.situacion] }}</AppBadge>
                <AppBadge v-if="estado.aRevisar" tono="error">A revisar</AppBadge>
                <span v-if="estado.situacion === 'NINGUNO' && !estado.aRevisar" class="text-slate-500">—</span>
              </div>
              <p v-if="entrega" class="mt-1 text-xs whitespace-nowrap text-slate-400">{{ entrega }}</p>
            </td>
            <td class="text-right whitespace-nowrap">
              <AppButton
                v-if="entregar"
                size="sm"
                variant="secondary"
                icon="heroicons:gift"
                :loading="enCurso === fila.id"
                :disabled="enCurso !== null"
                @click.stop="emit('entregar', fila)"
              >
                Entregar kit
              </AppButton>
              <AppButton
                v-else-if="deshacer"
                size="sm"
                variant="ghost"
                icon="heroicons:arrow-uturn-left"
                :loading="enCurso === fila.id"
                :disabled="enCurso !== null"
                @click.stop="emit('deshacer', fila)"
              >
                Deshacer entrega
              </AppButton>
              <AppButton size="sm" variant="ghost" icon="heroicons:eye" @click.stop="emit('abrir', fila.id)">Ver</AppButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="cargando && !filas.length" class="py-14 text-center text-sm text-slate-400" role="status">Cargando inscripciones…</div>
    <AppEmpty v-else-if="!filas.length" titulo="No hay inscripciones en esta lista" icon="heroicons:clipboard-document-list" />
    <AppPagination :meta="meta" @cambiar="emit('pagina', $event)" />
  </div>
</template>
