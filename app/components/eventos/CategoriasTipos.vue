<script setup lang="ts">
import type { Caracteristica, Categoria, Respuesta, TipoInscripcion } from '~/types/api'
import { numero, soles } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'

const props = defineProps<{ eventoId: number }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()

const categorias = ref<Categoria[]>([])
const cargando = ref(false)
const guardando = ref(false)
const errores = ref<Record<string, string>>({})

async function cargar() {
  cargando.value = true
  try {
    categorias.value = (await api<Respuesta<Categoria[]>>(`events/${props.eventoId}/registration-categories`)).data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}
watch(() => props.eventoId, cargar, { immediate: true })

// ─── Categoría ───
const categoriaModal = ref(false)
const categoriaEditando = ref<Categoria | null>(null)
const categoriaForm = reactive({ codigo: '', nombre: '', descripcion: '', esEstudiantil: false, orden: 0 })

function abrirCategoria(categoria?: Categoria) {
  categoriaEditando.value = categoria ?? null
  errores.value = {}
  Object.assign(categoriaForm, {
    codigo: categoria?.codigo ?? '',
    nombre: categoria?.nombre ?? '',
    descripcion: categoria?.descripcion ?? '',
    esEstudiantil: categoria?.esEstudiantil ?? false,
    orden: categoria?.orden ?? categorias.value.length + 1,
  })
  categoriaModal.value = true
}

async function guardarCategoria() {
  guardando.value = true
  errores.value = {}
  const body = { ...categoriaForm, codigo: categoriaForm.codigo.trim().toUpperCase(), descripcion: categoriaForm.descripcion.trim() || null, orden: Number(categoriaForm.orden) || 0 }
  try {
    if (categoriaEditando.value) await api(`registration-categories/${categoriaEditando.value.id}`, { method: 'PUT', body })
    else await api(`events/${props.eventoId}/registration-categories`, { method: 'POST', body })
    toast.exito('Categoría guardada.')
    categoriaModal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function eliminarCategoria(categoria: Categoria) {
  const ok = await confirmar({ titulo: 'Eliminar categoría', mensaje: `¿Eliminar la categoría «${categoria.nombre}»? Solo es posible si no tiene tipos.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    await api(`registration-categories/${categoria.id}`, { method: 'DELETE' })
    toast.exito('Categoría eliminada.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

// ─── Tipo de inscripción ───
const tipoModal = ref(false)
const tipoCategoria = ref<Categoria | null>(null)
const tipoEditando = ref<TipoInscripcion | null>(null)
const tipoForm = reactive({ codigo: '', nombre: '', etiqueta: '', descripcion: '', precio: 0, precioInstitucional: 0, activo: true, orden: 0 })
const caracteristicas = ref<Caracteristica[]>([])

const ICONOS_SUGERIDOS = ['heroicons:academic-cap', 'heroicons:gift', 'heroicons:identification', 'heroicons:ticket', 'heroicons:x-mark', 'heroicons:sparkles', 'heroicons:computer-desktop']

function abrirTipo(categoria: Categoria, tipo?: TipoInscripcion) {
  tipoCategoria.value = categoria
  tipoEditando.value = tipo ?? null
  errores.value = {}
  Object.assign(tipoForm, {
    codigo: tipo?.codigo ?? '',
    nombre: tipo?.nombre ?? categoria.nombre,
    etiqueta: tipo?.etiqueta ?? '',
    descripcion: tipo?.descripcion ?? '',
    precio: tipo?.precio ?? 0,
    precioInstitucional: tipo?.precioInstitucional ?? 0,
    activo: tipo?.activo ?? true,
    orden: tipo?.orden ?? categoria.tipos.length + 1,
  })
  caracteristicas.value = structuredClone(tipo?.caracteristicas ?? [])
  tipoModal.value = true
}

async function guardarTipo() {
  if (!tipoCategoria.value) return
  guardando.value = true
  errores.value = {}
  const body = {
    ...tipoForm,
    codigo: tipoForm.codigo.trim().toLowerCase(),
    etiqueta: tipoForm.etiqueta.trim() || null,
    descripcion: tipoForm.descripcion.trim() || null,
    precio: Number(tipoForm.precio),
    precioInstitucional: Number(tipoForm.precioInstitucional),
    orden: Number(tipoForm.orden) || 0,
    caracteristicas: caracteristicas.value.filter((c) => c.text.trim()).map((c) => ({ icon: c.icon.trim() || 'heroicons:check', text: c.text.trim() })),
  }
  try {
    if (tipoEditando.value) await api(`registration-types/${tipoEditando.value.id}`, { method: 'PUT', body })
    else await api(`registration-categories/${tipoCategoria.value.id}/types`, { method: 'POST', body })
    toast.exito('Tipo de inscripción guardado.')
    tipoModal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function alternarActivo(tipo: TipoInscripcion) {
  try {
    await api(`registration-types/${tipo.id}`, { method: 'PUT', body: { activo: !tipo.activo } })
    tipo.activo = !tipo.activo
    toast.exito(tipo.activo ? 'Tipo activado: visible en la landing.' : 'Tipo desactivado: ya no se ofrece en la landing.')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function eliminarTipo(tipo: TipoInscripcion) {
  const ok = await confirmar({ titulo: 'Eliminar tipo', mensaje: `¿Eliminar «${tipo.nombre} ${tipo.etiqueta ?? ''}»? Si tiene inscripciones, desactívalo en su lugar.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    await api(`registration-types/${tipo.id}`, { method: 'DELETE' })
    toast.exito('Tipo eliminado.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-slate-400">
        Las categorías agrupan los planes (p. ej. Estudiantes y Público general). Una categoría <strong class="text-slate-200">estudiantil</strong> activa la verificación UNDC: solo los estudiantes verificados pagan el precio institucional.
      </p>
      <AppButton icon="heroicons:plus" @click="abrirCategoria()">Nueva categoría</AppButton>
    </div>

    <div v-if="cargando && !categorias.length" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
    <AppEmpty v-else-if="!categorias.length" titulo="Sin categorías" descripcion="Crea una categoría y luego sus tipos de inscripción con precios." icon="heroicons:tag" />

    <section v-for="categoria in categorias" :key="categoria.id" class="card overflow-hidden">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-lg font-bold">{{ categoria.nombre }}</h3>
            <AppBadge tono="neutral"><span class="font-mono">{{ categoria.codigo }}</span></AppBadge>
            <AppBadge v-if="categoria.esEstudiantil" tono="brand">Estudiantil · verificación UNDC</AppBadge>
          </div>
          <p v-if="categoria.descripcion" class="mt-1 text-sm text-slate-400">{{ categoria.descripcion }}</p>
        </div>
        <div class="flex gap-2">
          <AppButton size="sm" variant="secondary" icon="heroicons:plus" @click="abrirTipo(categoria)">Tipo</AppButton>
          <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrirCategoria(categoria)">Editar</AppButton>
          <AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar categoría" @click="eliminarCategoria(categoria)" />
        </div>
      </header>
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr><th>Tipo</th><th class="text-right">Precio</th><th class="text-right">Precio UNDC</th><th class="text-right">Inscripciones</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="tipo in categoria.tipos" :key="tipo.id">
              <td>
                <p class="font-medium text-white">{{ tipo.nombre }} <AppBadge v-if="tipo.etiqueta" tono="brand" class="ml-1">{{ tipo.etiqueta }}</AppBadge></p>
                <p class="font-mono text-xs text-slate-500">{{ tipo.codigo }}</p>
              </td>
              <td class="text-right tabular-nums">{{ soles(tipo.precio) }}</td>
              <td class="text-right tabular-nums">{{ soles(tipo.precioInstitucional) }}</td>
              <td class="text-right tabular-nums">{{ numero(tipo.totalInscripciones) }}</td>
              <td>
                <button type="button" class="cursor-pointer" :aria-label="tipo.activo ? 'Desactivar tipo' : 'Activar tipo'" @click="alternarActivo(tipo)">
                  <AppBadge :tono="tipo.activo ? 'ok' : 'neutral'">{{ tipo.activo ? 'Activo' : 'Inactivo' }}</AppBadge>
                </button>
              </td>
              <td class="text-right whitespace-nowrap">
                <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrirTipo(categoria, tipo)">Editar</AppButton>
                <AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar tipo" @click="eliminarTipo(tipo)" />
              </td>
            </tr>
            <tr v-if="!categoria.tipos.length"><td colspan="6" class="py-6 text-center text-slate-400">Sin tipos de inscripción.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal :abierto="categoriaModal" :titulo="categoriaEditando ? 'Editar categoría' : 'Nueva categoría'" @cerrar="categoriaModal = false">
      <form id="form-categoria" class="grid gap-4 md:grid-cols-2" @submit.prevent="guardarCategoria">
        <AppField label="Código" for="cat-codigo" required :error="errores.codigo" hint="ESTUDIANTES, PUBLICO_GENERAL…">
          <input id="cat-codigo" v-model="categoriaForm.codigo" class="field-control font-mono uppercase" maxlength="40">
        </AppField>
        <AppField label="Nombre" for="cat-nombre" required :error="errores.nombre">
          <input id="cat-nombre" v-model="categoriaForm.nombre" class="field-control" maxlength="120">
        </AppField>
        <AppField label="Descripción" for="cat-desc" class="md:col-span-2">
          <input id="cat-desc" v-model="categoriaForm.descripcion" class="field-control" maxlength="191">
        </AppField>
        <AppField label="Orden" for="cat-orden">
          <input id="cat-orden" v-model.number="categoriaForm.orden" type="number" min="0" class="field-control">
        </AppField>
        <div class="flex items-end">
          <AppSwitch v-model="categoriaForm.esEstudiantil" label="Categoría estudiantil" descripcion="Pide ciclo y verifica estudiantes UNDC." class="w-full" />
        </div>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="categoriaModal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-categoria" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>

    <AppModal :abierto="tipoModal" :titulo="tipoEditando ? 'Editar tipo de inscripción' : 'Nuevo tipo de inscripción'" :descripcion="tipoCategoria?.nombre" ancho="lg" @cerrar="tipoModal = false">
      <form id="form-tipo" class="grid gap-4 md:grid-cols-2" @submit.prevent="guardarTipo">
        <AppField label="Nombre" for="tipo-nombre" required :error="errores.nombre">
          <input id="tipo-nombre" v-model="tipoForm.nombre" class="field-control" maxlength="120">
        </AppField>
        <AppField label="Código" for="tipo-codigo" required :error="errores.codigo" hint="estudiantes_con_kit, general_sin_kit…">
          <input id="tipo-codigo" v-model="tipoForm.codigo" class="field-control font-mono" maxlength="80">
        </AppField>
        <AppField label="Etiqueta" for="tipo-etiqueta" hint="Se muestra como insignia: CON KIT, SIN KIT…">
          <input id="tipo-etiqueta" v-model="tipoForm.etiqueta" class="field-control" maxlength="40">
        </AppField>
        <AppField label="Orden" for="tipo-orden">
          <input id="tipo-orden" v-model.number="tipoForm.orden" type="number" min="0" class="field-control">
        </AppField>
        <AppField label="Precio regular (S/)" for="tipo-precio" required :error="errores.precio">
          <input id="tipo-precio" v-model.number="tipoForm.precio" type="number" min="0" step="0.01" class="field-control">
        </AppField>
        <AppField label="Precio UNDC / institucional (S/)" for="tipo-precio-inst" required :error="errores.precioInstitucional ?? errores.body">
          <input id="tipo-precio-inst" v-model.number="tipoForm.precioInstitucional" type="number" min="0" step="0.01" class="field-control">
        </AppField>
        <AppField label="Descripción" for="tipo-desc" class="md:col-span-2">
          <textarea id="tipo-desc" v-model="tipoForm.descripcion" rows="2" class="field-control" maxlength="1000" />
        </AppField>
        <div class="md:col-span-2">
          <div class="mb-2 flex items-center justify-between">
            <p class="field-label mb-0">Características (se muestran en la tarjeta del plan)</p>
            <AppButton size="sm" variant="secondary" icon="heroicons:plus" @click="caracteristicas.push({ icon: 'heroicons:check', text: '' })">Agregar</AppButton>
          </div>
          <div v-for="(item, indice) in caracteristicas" :key="indice" class="mb-2 grid grid-cols-[auto_1fr_1.6fr_auto] items-center gap-2">
            <Icon :name="item.icon || 'heroicons:check'" class="size-5 text-brand-300" aria-hidden="true" />
            <label :for="`car-icon-${indice}`" class="sr-only">Ícono</label>
            <select :id="`car-icon-${indice}`" v-model="item.icon" class="field-control">
              <option v-for="icono in ICONOS_SUGERIDOS" :key="icono" :value="icono">{{ icono.replace('heroicons:', '') }}</option>
              <option v-if="!ICONOS_SUGERIDOS.includes(item.icon)" :value="item.icon">{{ item.icon }}</option>
            </select>
            <label :for="`car-text-${indice}`" class="sr-only">Texto</label>
            <input :id="`car-text-${indice}`" v-model="item.text" class="field-control" maxlength="200" placeholder="Certificado digital (100h)">
            <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" aria-label="Quitar característica" @click="caracteristicas.splice(indice, 1)" />
          </div>
        </div>
        <div class="md:col-span-2">
          <AppSwitch v-model="tipoForm.activo" label="Activo" descripcion="Solo los tipos activos se ofrecen en la landing." />
        </div>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="tipoModal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-tipo" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
