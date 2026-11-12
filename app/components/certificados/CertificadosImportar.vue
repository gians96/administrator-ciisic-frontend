<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import { RESULTADOS_FILA, type ResultadoImportacion } from '~/utils/certificados'
import { mensajeError } from '~/utils/errores'
import { numero, tamanoArchivo } from '~/utils/formato'

/**
 * Importación del Excel de certificados (`N° | DNI | Nombres | Apellidos | Tipo | Correo | Telefono | Codigo | Obs`).
 * Primero se revisa (`?simular=true`, sin guardar) y luego se confirma. El backend empareja por DNI con los
 * inscritos; quien no existe se registra con los datos del Excel y queda «sin inscripción pagada».
 */
const props = defineProps<{ abierto: boolean, eventoId: number | null }>()
const emit = defineEmits<{ cerrar: [], importado: [] }>()

const MAX_FILAS_VISIBLES = 200

const { api } = useApi()
const toast = useToast()

const archivo = ref<File | null>(null)
const revision = ref<ResultadoImportacion | null>(null)
const trabajando = ref<'revisar' | 'cargar' | null>(null)
const error = ref<string | null>(null)
const soloErrores = ref(false)

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  archivo.value = null
  revision.value = null
  trabajando.value = null
  error.value = null
  soloErrores.value = false
})

watch(archivo, () => {
  revision.value = null
  error.value = null
})

function alElegir(evento: Event) {
  archivo.value = (evento.target as HTMLInputElement).files?.[0] ?? null
}

async function enviar(simular: boolean) {
  if (!archivo.value || !props.eventoId) return
  trabajando.value = simular ? 'revisar' : 'cargar'
  error.value = null
  const cuerpo = new FormData()
  cuerpo.append('file', archivo.value)
  try {
    const respuesta = await api<Respuesta<ResultadoImportacion>>(`events/${props.eventoId}/certificates/import${simular ? '?simular=true' : ''}`, { method: 'POST', body: cuerpo })
    revision.value = respuesta.data
    if (!simular) {
      const { crear, actualizar, errores } = respuesta.data.resumen
      toast.exito(`Excel importado: ${numero(crear)} certificado(s) nuevos${actualizar ? ` y ${numero(actualizar)} actualizado(s)` : ''}${errores ? `; ${numero(errores)} fila(s) con error` : ''}.`)
      emit('importado')
    }
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    trabajando.value = null
  }
}

const filasVisibles = computed(() => {
  const filas = revision.value?.filas ?? []
  return (soloErrores.value ? filas.filter(fila => fila.resultado === 'ERROR') : filas).slice(0, MAX_FILAS_VISIBLES)
})
const hayAlgoQueCargar = computed(() => Boolean(revision.value && (revision.value.resumen.crear || revision.value.resumen.actualizar)))
</script>

<template>
  <AppModal :abierto="abierto" titulo="Importar Excel de certificados" descripcion="Columnas: DNI, Nombres, Apellidos, Tipo, Correo, Telefono y Codigo (el código con el que se nombró cada PDF firmado)." ancho="xl" @cerrar="emit('cerrar')">
    <div class="space-y-5">
      <AppField label="Archivo Excel (.xlsx)" for="certificados-excel" :error="error ?? undefined" required>
        <input
          id="certificados-excel"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
          @change="alElegir"
        >
        <p v-if="archivo" class="field-hint">{{ archivo.name }} · {{ tamanoArchivo(archivo.size) }}</p>
      </AppField>

      <p class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10 ring-inset">
        Cada fila se empareja por <strong class="text-white">DNI</strong> con los inscritos del evento. Si la persona no está registrada se crea con los datos del Excel y
        queda marcada como «sin inscripción pagada». Volver a importar el mismo Excel no duplica nada.
      </p>

      <section v-if="revision" class="space-y-3" aria-live="polite">
        <h3 class="font-display text-base font-semibold text-white">{{ revision.simulado ? 'Esto es lo que se registrará' : 'Resultado de la importación' }}</h3>
        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div><dt class="text-xs text-slate-400">Filas</dt><dd class="font-semibold text-white tabular-nums">{{ numero(revision.resumen.total) }}</dd></div>
          <div><dt class="text-xs text-slate-400">{{ revision.simulado ? 'Nuevos' : 'Registrados' }}</dt><dd class="font-semibold text-emerald-300 tabular-nums">{{ numero(revision.resumen.crear) }}</dd></div>
          <div><dt class="text-xs text-slate-400">Sin cambios</dt><dd class="font-semibold text-white tabular-nums">{{ numero(revision.resumen.sinCambios + revision.resumen.actualizar) }}</dd></div>
          <div><dt class="text-xs text-slate-400">Sin inscripción pagada</dt><dd class="font-semibold text-amber-300 tabular-nums">{{ numero(revision.resumen.sinInscripcion) }}</dd></div>
          <div><dt class="text-xs text-slate-400">Con error</dt><dd class="font-semibold tabular-nums" :class="revision.resumen.errores ? 'text-red-300' : 'text-white'">{{ numero(revision.resumen.errores) }}</dd></div>
        </dl>
        <label v-if="revision.resumen.errores" class="flex items-center gap-2 text-sm text-slate-300">
          <input v-model="soloErrores" type="checkbox" class="size-4 accent-brand-500"> Ver solo las filas con error
        </label>
        <div class="relative max-h-80 overflow-auto rounded-xl ring-1 ring-white/10">
          <table class="table-base">
            <thead>
              <tr><th>Fila</th><th>Persona</th><th>Código</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              <tr v-for="fila in filasVisibles" :key="fila.fila">
                <td class="tabular-nums text-slate-400">{{ fila.fila }}</td>
                <td class="min-w-52">
                  <p class="font-medium text-white">{{ fila.nombre || '—' }}</p>
                  <p class="font-mono text-xs text-slate-400">DNI {{ fila.documento }} · {{ fila.tipo }}</p>
                </td>
                <td class="font-mono text-sm whitespace-nowrap">{{ fila.codigo || '—' }}</td>
                <td class="min-w-48">
                  <div class="flex flex-wrap gap-1">
                    <AppBadge :tono="RESULTADOS_FILA[fila.resultado].tono">{{ RESULTADOS_FILA[fila.resultado].etiqueta }}</AppBadge>
                    <AppBadge v-if="fila.resultado !== 'ERROR' && !fila.conInscripcion" tono="warn">Sin inscripción pagada</AppBadge>
                    <AppBadge v-if="fila.resultado !== 'ERROR' && fila.personaNueva" tono="neutral">Persona nueva</AppBadge>
                  </div>
                  <p v-if="fila.mensaje" class="mt-1 text-xs text-red-200">{{ fila.mensaje }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="(revision.filas.length) > MAX_FILAS_VISIBLES && !soloErrores" class="text-xs text-slate-400">Se muestran las primeras {{ MAX_FILAS_VISIBLES }} filas.</p>
      </section>
    </div>

    <template #acciones>
      <AppButton variant="ghost" @click="emit('cerrar')">{{ revision && !revision.simulado ? 'Cerrar' : 'Cancelar' }}</AppButton>
      <AppButton v-if="!revision" icon="heroicons:magnifying-glass" :loading="trabajando === 'revisar'" :disabled="!archivo || trabajando !== null" @click="enviar(true)">
        Revisar archivo
      </AppButton>
      <AppButton v-else-if="revision.simulado" variant="success" icon="heroicons:arrow-up-tray" :loading="trabajando === 'cargar'" :disabled="trabajando !== null || !hayAlgoQueCargar" @click="enviar(false)">
        Importar {{ numero(revision.resumen.crear + revision.resumen.actualizar) }} certificado(s)
      </AppButton>
    </template>
  </AppModal>
</template>
