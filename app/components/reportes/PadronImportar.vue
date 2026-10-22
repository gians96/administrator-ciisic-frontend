<script setup lang="ts">
import type { Respuesta, ResultadoImportacionPadron } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { numero, tamanoArchivo } from '~/utils/formato'

/**
 * Carga del Excel de la facultad (hojas «ESTUDIANTES …» y «RESUMEN»). Primero se revisa (`?simular=true`,
 * sin guardar nada) y recién entonces se confirma: cargar **reemplaza** el padrón y los asesores del evento.
 */
const props = defineProps<{ abierto: boolean, eventoId: number | null, hayPadron: boolean }>()
const emit = defineEmits<{ cerrar: [], importado: [] }>()

const MAX_ADVERTENCIAS = 12

const { api } = useApi()
const toast = useToast()

const archivo = ref<File | null>(null)
const semestre = ref('')
const revision = ref<ResultadoImportacionPadron | null>(null)
const trabajando = ref<'revisar' | 'cargar' | null>(null)
const error = ref<string | null>(null)
const errorSemestre = ref<string | null>(null)

function reiniciar() {
  archivo.value = null
  semestre.value = ''
  revision.value = null
  trabajando.value = null
  error.value = null
  errorSemestre.value = null
}

watch(() => props.abierto, (abierto) => {
  if (abierto) reiniciar()
})

/** Cambiar el archivo o el semestre invalida la revisión: lo que se confirma es lo que se revisó. */
watch([archivo, semestre], () => {
  revision.value = null
  error.value = null
  errorSemestre.value = null
})

function alElegir(evento: Event) {
  archivo.value = (evento.target as HTMLInputElement).files?.[0] ?? null
}

async function enviar(simular: boolean) {
  if (!archivo.value || !props.eventoId) return
  trabajando.value = simular ? 'revisar' : 'cargar'
  error.value = null
  errorSemestre.value = null
  const cuerpo = new FormData()
  cuerpo.append('file', archivo.value)
  if (semestre.value.trim()) cuerpo.append('semestre', semestre.value.trim())
  try {
    const respuesta = await api<Respuesta<ResultadoImportacionPadron>>(`events/${props.eventoId}/advisory/import${simular ? '?simular=true' : ''}`, { method: 'POST', body: cuerpo })
    if (simular) {
      revision.value = respuesta.data
      return
    }
    toast.exito(`Padrón cargado: ${numero(respuesta.data.estudiantes)} alumnos y ${numero(respuesta.data.asesores)} asesores.`)
    emit('importado')
    emit('cerrar')
  } catch (e) {
    if (aErrorApi(e).code === 'PADRON_SEMESTER_REQUIRED') errorSemestre.value = aErrorApi(e).message
    else error.value = mensajeError(e)
  } finally {
    trabajando.value = null
  }
}

const advertencias = computed(() => revision.value?.advertencias.slice(0, MAX_ADVERTENCIAS) ?? [])
const advertenciasOcultas = computed(() => Math.max(0, (revision.value?.advertencias.length ?? 0) - MAX_ADVERTENCIAS))
</script>

<template>
  <AppModal :abierto="abierto" titulo="Cargar padrón de estudiantes" descripcion="Sube el Excel de la facultad: la hoja «ESTUDIANTES …» y la tabla de asesores de la hoja «RESUMEN»." ancho="lg" @cerrar="emit('cerrar')">
    <div class="space-y-5">
      <AppField label="Archivo Excel (.xlsx)" for="padron-archivo" :error="error ?? undefined" required>
        <input
          id="padron-archivo"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
          @change="alElegir"
        >
        <p v-if="archivo" class="field-hint">{{ archivo.name }} · {{ tamanoArchivo(archivo.size) }}</p>
      </AppField>

      <AppField label="Semestre" for="padron-semestre" hint="Opcional: se toma del nombre de la hoja (por ejemplo, «ESTUDIANTES 2026-2»). Escríbelo solo para corregirlo." :error="errorSemestre ?? undefined">
        <input id="padron-semestre" v-model="semestre" type="text" inputmode="numeric" maxlength="6" placeholder="2026-2" class="field-control max-w-40">
      </AppField>

      <p v-if="hayPadron" class="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset">
        Ya hay un padrón cargado. Al confirmar se <strong>reemplaza</strong> por el de este archivo (alumnos y asesores). El pago no se pierde: se calcula siempre con las inscripciones.
      </p>

      <section v-if="revision" class="space-y-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10 ring-inset" aria-live="polite">
        <h3 class="font-display text-base font-semibold text-white">Esto es lo que se cargará</h3>
        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt class="text-xs text-slate-400">Semestre</dt><dd class="font-semibold text-white">{{ revision.semestre }}</dd></div>
          <div><dt class="text-xs text-slate-400">Alumnos</dt><dd class="font-semibold text-white tabular-nums">{{ numero(revision.estudiantes) }}</dd></div>
          <div><dt class="text-xs text-slate-400">Asesores</dt><dd class="font-semibold text-white tabular-nums">{{ numero(revision.asesores) }}</dd></div>
          <div><dt class="text-xs text-slate-400">Ciclos y secciones</dt><dd class="font-semibold text-white tabular-nums">{{ numero(revision.secciones) }}</dd></div>
        </dl>
        <div v-if="revision.advertencias.length">
          <p class="text-sm font-semibold text-amber-300">{{ revision.advertencias.length }} advertencia(s) para revisar</p>
          <ul class="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
            <li v-for="advertencia in advertencias" :key="advertencia">{{ advertencia }}</li>
          </ul>
          <p v-if="advertenciasOcultas" class="mt-1 text-xs text-slate-400">… y {{ advertenciasOcultas }} más.</p>
        </div>
        <p v-else class="text-sm text-emerald-300">Sin advertencias.</p>
      </section>
    </div>

    <template #acciones>
      <AppButton variant="ghost" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton v-if="!revision" icon="heroicons:magnifying-glass" :loading="trabajando === 'revisar'" :disabled="!archivo || trabajando !== null" @click="enviar(true)">
        Revisar archivo
      </AppButton>
      <AppButton v-else variant="success" icon="heroicons:arrow-up-tray" :loading="trabajando === 'cargar'" :disabled="trabajando !== null" @click="enviar(false)">
        {{ hayPadron ? 'Cargar y reemplazar' : 'Cargar padrón' }}
      </AppButton>
    </template>
  </AppModal>
</template>
