<script setup lang="ts">
import type { DocenteAdmin, Respuesta, SeccionRef } from '~/types/api'
import { cambiosDeSecciones, claveDeSeccionDocente, dniDelDocente, seccionesAsignables, seccionesPorCiclo, soloDigitosDni } from '~/utils/docentes'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { etiquetaSeccion } from '~/utils/reportes'

/**
 * Agregar o editar un docente (spec 019; backend 028): nombre, DNI y las secciones que atiende (ciclo y sección). Antes
 * solo existían por el Excel de la facultad. Guardar **reemplaza** sus secciones por las marcadas; su enlace personal
 * no cambia. Solo lo usa quien tiene `reportes.gestionar` (el DNI es un dato personal).
 */
const props = defineProps<{
  abierto: boolean
  eventoId: number | null
  /** `null`: se agrega un docente nuevo. */
  docente: DocenteAdmin | null
  /** Ciclos y secciones del padrón: lo que se puede asignar. */
  catalogo: SeccionRef[]
}>()
const emit = defineEmits<{ cerrar: [], guardado: [docente: DocenteAdmin], eliminado: [id: number] }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()

const nombre = ref('')
const documento = ref('')
const elegidas = ref<Set<string>>(new Set())
const trabajando = ref<'guardar' | 'eliminar' | null>(null)
const errores = reactive({ nombre: '', documento: '', secciones: '', general: '' })

function reiniciar() {
  nombre.value = props.docente?.nombre ?? ''
  documento.value = props.docente?.documento ?? ''
  elegidas.value = new Set((props.docente?.secciones ?? []).map(claveDeSeccionDocente))
  trabajando.value = null
  Object.assign(errores, { nombre: '', documento: '', secciones: '', general: '' })
}
watch(() => props.abierto, (abierto) => { if (abierto) reiniciar() }, { immediate: true })

const asignables = computed(() => seccionesAsignables(props.catalogo, props.docente?.secciones ?? []))
const grupos = computed(() => seccionesPorCiclo(asignables.value))
const secciones = computed(() => asignables.value.filter((seccion) => elegidas.value.has(claveDeSeccionDocente(seccion))))
const cambios = computed(() => cambiosDeSecciones(props.docente?.secciones ?? [], secciones.value))
const esNuevo = computed(() => props.docente === null)

const sinCambios = computed(() => !esNuevo.value
  && nombre.value.trim() === props.docente?.nombre
  && (dniDelDocente(documento.value) ?? '') === (props.docente?.documento ?? '')
  && !cambios.value.agregadas.length
  && !cambios.value.quitadas.length)

function alternar(seccion: SeccionRef) {
  const clave = claveDeSeccionDocente(seccion)
  const nuevas = new Set(elegidas.value)
  if (nuevas.has(clave)) nuevas.delete(clave)
  else nuevas.add(clave)
  elegidas.value = nuevas
}

/** Marca o desmarca todas las secciones de un ciclo. */
function alternarCiclo(ciclo: string, lista: SeccionRef[]) {
  const nuevas = new Set(elegidas.value)
  const todas = lista.every((seccion) => nuevas.has(claveDeSeccionDocente(seccion)))
  for (const seccion of lista) {
    if (todas) nuevas.delete(claveDeSeccionDocente(seccion))
    else nuevas.add(claveDeSeccionDocente(seccion))
  }
  elegidas.value = nuevas
}

function validar(): boolean {
  Object.assign(errores, { nombre: '', documento: '', secciones: '', general: '' })
  if (nombre.value.trim().length < 3) errores.nombre = 'Escribe el nombre del docente.'
  if (documento.value && !dniDelDocente(documento.value)) errores.documento = 'El DNI debe tener 8 dígitos.'
  return !errores.nombre && !errores.documento
}

async function guardar() {
  if (!props.eventoId || trabajando.value || !validar()) return
  trabajando.value = 'guardar'
  const cuerpo = { nombre: nombre.value.trim(), documento: dniDelDocente(documento.value), secciones: secciones.value }
  try {
    const ruta = `events/${props.eventoId}/advisory/advisors`
    const respuesta = esNuevo.value
      ? await api<Respuesta<DocenteAdmin>>(ruta, { method: 'POST', body: cuerpo })
      : await api<Respuesta<DocenteAdmin>>(`${ruta}/${props.docente?.id}`, { method: 'PUT', body: cuerpo })
    toast.exito(esNuevo.value ? 'Docente agregado.' : 'Docente actualizado.')
    emit('guardado', respuesta.data)
    emit('cerrar')
  } catch (error) {
    const e = aErrorApi(error)
    if (e.code === 'ADVISOR_DOCUMENT_TAKEN') errores.documento = e.message
    else if (e.code === 'ADVISOR_NAME_TAKEN') errores.nombre = e.message
    else if (e.code === 'SECTION_NOT_FOUND') errores.secciones = e.message
    else errores.general = mensajeError(error)
  } finally {
    trabajando.value = null
  }
}

async function eliminar() {
  if (!props.eventoId || !props.docente || trabajando.value) return
  const seguro = await confirmar({
    titulo: 'Eliminar al docente',
    mensaje: `${props.docente.nombre} dejará de ser asesor de sus secciones y perderá su enlace y su acceso con el DNI. Sus estudiantes quedarán sin asesor en esas secciones.`,
    textoConfirmar: 'Eliminar docente',
    peligro: true,
  })
  if (!seguro) return
  trabajando.value = 'eliminar'
  try {
    await api(`events/${props.eventoId}/advisory/advisors/${props.docente.id}`, { method: 'DELETE' })
    toast.exito('Docente eliminado.')
    emit('eliminado', props.docente.id)
    emit('cerrar')
  } catch (error) {
    errores.general = mensajeError(error)
  } finally {
    trabajando.value = null
  }
}
</script>

<template>
  <AppModal
    :abierto="abierto"
    :titulo="esNuevo ? 'Agregar docente' : 'Editar docente'"
    descripcion="Su DNI le permite entrar a la página común de consulta; los ciclos y secciones son los que verá en su seguimiento."
    ancho="lg"
    @cerrar="emit('cerrar')"
  >
    <form id="form-docente" class="space-y-5" novalidate @submit.prevent="guardar">
      <div class="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <AppField label="Nombre del docente" for="docente-nombre" :error="errores.nombre" required>
          <input id="docente-nombre" v-model="nombre" type="text" maxlength="200" autocomplete="off" class="field-control" placeholder="MG. APELLIDOS NOMBRES">
        </AppField>
        <AppField label="DNI" for="docente-dni" :error="errores.documento" hint="8 dígitos. Sin DNI no podrá usar la página común.">
          <input
            id="docente-dni"
            v-model="documento"
            type="text"
            inputmode="numeric"
            maxlength="8"
            autocomplete="off"
            class="field-control tabular-nums"
            placeholder="12345678"
            @input="documento = soloDigitosDni(documento)"
          >
        </AppField>
      </div>

      <fieldset class="space-y-3">
        <legend class="field-label">Ciclos y secciones que atiende</legend>
        <p v-if="errores.secciones" class="field-error" role="alert">{{ errores.secciones }}</p>
        <p v-if="!asignables.length" class="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset">
          Aún no hay secciones: carga primero el padrón de estudiantes.
        </p>
        <div v-for="grupo in grupos" :key="grupo.ciclo" class="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 ring-inset">
          <div class="mb-2 flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-white">Ciclo {{ grupo.ciclo }}</p>
            <button type="button" class="text-xs text-brand-300 hover:text-brand-200" @click="alternarCiclo(grupo.ciclo, grupo.secciones)">
              {{ grupo.secciones.every((s) => elegidas.has(claveDeSeccionDocente(s))) ? 'Quitar todas' : 'Marcar todas' }}
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="seccion in grupo.secciones"
              :key="claveDeSeccionDocente(seccion)"
              class="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 transition ring-inset select-none"
              :class="elegidas.has(claveDeSeccionDocente(seccion)) ? 'bg-brand-500/15 font-semibold text-white ring-brand-400/50' : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'"
            >
              <input type="checkbox" class="sr-only" :checked="elegidas.has(claveDeSeccionDocente(seccion))" @change="alternar(seccion)">
              {{ etiquetaSeccion(seccion.ciclo, seccion.seccion) }}
            </label>
          </div>
        </div>
        <p v-if="!esNuevo && (cambios.agregadas.length || cambios.quitadas.length)" class="text-xs text-slate-300" aria-live="polite">
          <template v-if="cambios.agregadas.length">Se agregan: <strong class="text-emerald-300">{{ cambios.agregadas.map((s) => etiquetaSeccion(s.ciclo, s.seccion)).join(', ') }}</strong>. </template>
          <template v-if="cambios.quitadas.length">Se quitan: <strong class="text-red-300">{{ cambios.quitadas.map((s) => etiquetaSeccion(s.ciclo, s.seccion)).join(', ') }}</strong>.</template>
        </p>
      </fieldset>

      <p v-if="errores.general" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30 ring-inset" role="alert">{{ errores.general }}</p>
    </form>

    <template #acciones>
      <AppButton v-if="!esNuevo" variant="danger" class="mr-auto" icon="heroicons:trash" :loading="trabajando === 'eliminar'" :disabled="trabajando !== null" @click="eliminar">Eliminar</AppButton>
      <AppButton variant="ghost" @click="emit('cerrar')">Cancelar</AppButton>
      <AppButton type="submit" form="form-docente" icon="heroicons:check" :loading="trabajando === 'guardar'" :disabled="trabajando !== null || sinCambios">
        {{ esNuevo ? 'Agregar docente' : 'Guardar cambios' }}
      </AppButton>
    </template>
  </AppModal>
</template>
