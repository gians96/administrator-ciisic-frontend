<script setup lang="ts">
import type { Meta } from '~/types/api'
import { numero } from '~/utils/formato'
import {
  FILTROS_FOTOCHECKS_INICIALES,
  crearAsistenteManual,
  esImpresoFotocheck,
  filtrarAsistentes,
  ordenarAsistentes,
  tiposDeAsistentes,
  type AsistenteFotocheck,
  type FiltrosFotochecks,
  type OrdenFotochecks,
} from '~/utils/fotochecks'

/**
 * A quién se imprime (spec 030): carga de los aprobados (la pantalla lee el CSV del backend), búsqueda y filtros, selección,
 * marca de «ya impreso» y personas agregadas a mano. La tabla no muestra el código del QR (es una credencial). Los datos
 * y la lectura del CSV son de la pantalla: aquí solo se muestran y se elige.
 */
const props = defineProps<{
  /** Cargados del CSV y agregados a mano. */
  asistentes: readonly AsistenteFotocheck[]
  impresos: ReadonlySet<number>
  orden: OrdenFotochecks
  cargando: boolean
  /** Hay un evento elegido de donde cargar (mientras se leen los eventos no hay ninguno). */
  puedeCargar: boolean
  /** Contadores de la última carga (`null` = aún no se cargó nada). */
  resumen: { sinCodigo: number, noAprobados: number } | null
  /** Por qué no se pudo usar la carga (p. ej. un backend sin el código QR en el CSV). */
  aviso: string | null
}>()

const emit = defineEmits<{
  cargar: []
  archivo: [archivo: File]
  agregar: [persona: AsistenteFotocheck]
  quitar: [clave: string]
  limpiar: []
  marcar: [ids: number[], impreso: boolean]
}>()

const seleccion = defineModel<ReadonlySet<string>>('seleccion', { required: true })

const toast = useToast()
const id = useId()
const POR_PAGINA = 25

const filtros = reactive<FiltrosFotochecks>({ ...FILTROS_FOTOCHECKS_INICIALES })
const pagina = ref(1)

const filtrados = computed(() => ordenarAsistentes(filtrarAsistentes(props.asistentes, filtros, props.impresos), props.orden))
const filas = computed(() => filtrados.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))
const meta = computed<Meta>(() => ({ page: pagina.value, pageSize: POR_PAGINA, total: filtrados.value.length }))
const tipos = computed(() => tiposDeAsistentes(props.asistentes))
const conFiltros = computed(() => Boolean(filtros.busqueda.trim() || filtros.tipo || filtros.impresion !== 'TODOS'))
const elegidos = computed(() => props.asistentes.filter((persona) => seleccion.value.has(persona.clave)))
const idsElegidos = computed(() => elegidos.value.flatMap((persona) => (persona.id === null ? [] : [persona.id])))
const impresas = computed(() => props.asistentes.filter((persona) => esImpresoFotocheck(persona, props.impresos)).length)
const conCodigo = computed(() => props.asistentes.filter((persona) => persona.codigo).length)
const paginaCompleta = computed(() => filas.value.length > 0 && filas.value.every((persona) => seleccion.value.has(persona.clave)))

watch(() => [filtros.busqueda, filtros.tipo, filtros.impresion, filtros.virtuales], () => { pagina.value = 1 })
watch(filtrados, (lista) => {
  const ultima = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  if (pagina.value > ultima) pagina.value = ultima
})
/** Al ocultar a los virtuales también dejan de estar elegidos: no se imprime lo que no se ve. */
watch(() => filtros.virtuales, (incluir) => {
  if (!incluir) elegir(props.asistentes.filter((persona) => persona.virtual).map((persona) => persona.clave), false)
})

function elegir(claves: Iterable<string>, valor: boolean) {
  const siguiente = new Set(seleccion.value)
  for (const clave of claves) {
    if (valor) siguiente.add(clave)
    else siguiente.delete(clave)
  }
  seleccion.value = siguiente
}

const alternarPagina = (marcar: boolean) => elegir(filas.value.map((persona) => persona.clave), marcar)
const nombreEnLista = (persona: AsistenteFotocheck) => (persona.apellidos ? `${persona.apellidos}, ${persona.nombres}` : persona.nombres)

function limpiarFiltros() {
  filtros.busqueda = ''
  filtros.tipo = ''
  filtros.impresion = 'TODOS'
}

// ─── CSV propio ───

const selectorArchivo = ref<HTMLInputElement | null>(null)

function alElegirArchivo(evento: Event) {
  const campo = evento.target as HTMLInputElement
  const archivo = campo.files?.[0]
  campo.value = ''
  if (archivo) emit('archivo', archivo)
}

// ─── Agregar a mano ───

const SUGERENCIAS_ROL = ['Ponente', 'Organizador', 'Staff', 'Prensa', 'Invitado']
const modalAbierto = ref(false)
const manual = reactive({ nombre: '', rol: 'Ponente', codigo: '' })
const erroresManual = ref<Partial<Record<'nombre' | 'rol' | 'codigo', string>>>({})
const campoNombre = ref<HTMLInputElement | null>(null)
let contadorManual = 0

function siguienteManual(): number {
  const mayor = props.asistentes.reduce((maximo, persona) => {
    const coincide = /^manual:(\d+)$/.exec(persona.clave)
    return coincide ? Math.max(maximo, Number(coincide[1])) : maximo
  }, contadorManual)
  contadorManual = mayor + 1
  return contadorManual
}

function agregarManual() {
  const resultado = crearAsistenteManual({ nombre: manual.nombre, rol: manual.rol, codigo: manual.codigo }, siguienteManual())
  if (!resultado.ok) {
    erroresManual.value = resultado.errores
    return
  }
  erroresManual.value = {}
  emit('agregar', resultado.asistente)
  elegir([resultado.asistente.clave], true)
  toast.exito(`Agregado: ${resultado.asistente.nombres}.`)
  manual.nombre = ''
  manual.codigo = ''
  void nextTick(() => campoNombre.value?.focus())
}

function cerrarModal() {
  modalAbierto.value = false
  erroresManual.value = {}
}
</script>

<template>
  <section class="card overflow-hidden" :aria-labelledby="`${id}-titulo`">
    <div class="space-y-4 p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 :id="`${id}-titulo`" class="text-xl font-bold">Inscritos</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-400">
            Carga a los inscritos <strong class="text-slate-200">aprobados</strong> del evento, elige a quién imprimir y marca lo que ya imprimiste para sacar después solo los pendientes.
            El código del QR no se muestra en la lista.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton icon="heroicons:arrow-down-tray" :loading="cargando" :disabled="!puedeCargar" @click="emit('cargar')">Cargar inscritos aprobados</AppButton>
          <AppButton variant="secondary" icon="heroicons:document-arrow-up" :disabled="cargando" @click="selectorArchivo?.click()">Cargar un CSV</AppButton>
          <AppButton variant="secondary" icon="heroicons:user-plus" @click="modalAbierto = true">Agregar a mano</AppButton>
        </div>
      </div>
      <input ref="selectorArchivo" type="file" accept=".csv,text/csv" class="sr-only" tabindex="-1" aria-label="Cargar un CSV de inscripciones" @change="alElegirArchivo">

      <p v-if="aviso" class="rounded-lg bg-amber-400/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/30 ring-inset" role="alert">{{ aviso }}</p>

      <p v-if="asistentes.length" class="text-sm text-slate-300" aria-live="polite">
        <strong class="text-white tabular-nums">{{ numero(asistentes.length) }}</strong> {{ asistentes.length === 1 ? 'persona' : 'personas' }}
        (<span class="tabular-nums">{{ numero(conCodigo) }}</span> con QR)
        <template v-if="resumen?.sinCodigo"> · <span class="tabular-nums">{{ numero(resumen.sinCodigo) }}</span> aprobadas aún sin código</template>
        <template v-if="resumen?.noAprobados"> · <span class="tabular-nums">{{ numero(resumen.noAprobados) }}</span> no aprobadas (omitidas)</template>
        · <strong class="text-white tabular-nums">{{ numero(elegidos.length) }}</strong> {{ elegidos.length === 1 ? 'elegida' : 'elegidas' }}
        · <span class="tabular-nums">{{ numero(impresas) }}</span> {{ impresas === 1 ? 'impresa' : 'impresas' }}
        <AppButton class="ml-2" size="sm" variant="ghost" icon="heroicons:trash" @click="emit('limpiar')">Descartar la lista</AppButton>
      </p>
    </div>

    <template v-if="asistentes.length">
      <div class="grid gap-3 border-t border-white/10 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]">
        <div class="relative">
          <label :for="`${id}-buscar`" class="sr-only">Buscar por nombre o tipo</label>
          <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input :id="`${id}-buscar`" v-model="filtros.busqueda" type="search" class="field-control pl-9" placeholder="Nombre o tipo de inscripción">
        </div>
        <div>
          <label :for="`${id}-tipo`" class="sr-only">Tipo de inscripción</label>
          <select :id="`${id}-tipo`" v-model="filtros.tipo" class="field-control">
            <option value="">Todos los tipos</option>
            <option v-for="tipo in tipos" :key="tipo" :value="tipo">{{ tipo }}</option>
          </select>
        </div>
        <div>
          <label :for="`${id}-impresion`" class="sr-only">Estado de impresión</label>
          <select :id="`${id}-impresion`" v-model="filtros.impresion" class="field-control">
            <option value="TODOS">Impresos y pendientes</option>
            <option value="PENDIENTES">Solo los pendientes</option>
            <option value="IMPRESOS">Solo los ya impresos</option>
          </select>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input v-model="filtros.virtuales" type="checkbox" class="size-4 accent-brand-500">
          Incluir virtuales
        </label>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm text-slate-400 sm:px-5" aria-live="polite">
        <span>
          <strong class="text-white tabular-nums">{{ numero(filtrados.length) }}</strong> {{ filtrados.length === 1 ? 'persona' : 'personas' }}<template v-if="conFiltros"> con estos filtros</template>
          <AppButton v-if="conFiltros" class="ml-2" size="sm" variant="ghost" icon="heroicons:x-mark" @click="limpiarFiltros">Limpiar filtros</AppButton>
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton size="sm" variant="secondary" icon="heroicons:check-circle" :disabled="!filtrados.length" @click="elegir(filtrados.map((persona) => persona.clave), true)">
            Elegir a las {{ numero(filtrados.length) }}
          </AppButton>
          <template v-if="elegidos.length">
            <AppButton size="sm" variant="ghost" icon="heroicons:x-mark" @click="seleccion = new Set()">Quitar la selección</AppButton>
            <AppButton size="sm" variant="secondary" icon="heroicons:printer" :disabled="!idsElegidos.length" @click="emit('marcar', idsElegidos, true)">Marcar como impresas</AppButton>
            <AppButton size="sm" variant="ghost" :disabled="!idsElegidos.length" @click="emit('marcar', idsElegidos, false)">Quitar la marca</AppButton>
          </template>
        </div>
      </div>

      <div class="relative overflow-x-auto border-t border-white/10">
        <table class="table-base">
          <thead>
            <tr>
              <th class="w-10">
                <label class="sr-only" :for="`${id}-todas`">Elegir a todas las personas de esta página</label>
                <input :id="`${id}-todas`" type="checkbox" class="size-4 accent-brand-500" :checked="paginaCompleta" :disabled="!filas.length" @change="alternarPagina(($event.target as HTMLInputElement).checked)">
              </th>
              <th>Persona</th>
              <th>Tipo de inscripción</th>
              <th>Impresión</th>
              <th class="w-12"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="persona in filas" :key="persona.clave">
              <td>
                <label class="sr-only" :for="`${id}-${persona.clave}`">Elegir a {{ nombreEnLista(persona) }}</label>
                <input
                  :id="`${id}-${persona.clave}`"
                  type="checkbox"
                  class="size-4 accent-brand-500"
                  :checked="seleccion.has(persona.clave)"
                  @change="elegir([persona.clave], ($event.target as HTMLInputElement).checked)"
                >
              </td>
              <td class="min-w-52 font-medium text-white">{{ nombreEnLista(persona) }}</td>
              <td class="max-w-64 text-sm text-slate-300">
                <span class="mr-1.5">{{ persona.tipo || '—' }}</span>
                <AppBadgeVirtual v-if="persona.virtual" />
                <AppBadge v-if="!persona.codigo" tono="warn">Sin QR</AppBadge>
              </td>
              <td class="whitespace-nowrap">
                <AppBadge v-if="persona.id === null" tono="info">A mano</AppBadge>
                <AppBadge v-else-if="esImpresoFotocheck(persona, impresos)" tono="ok">Impreso</AppBadge>
                <AppBadge v-else tono="neutral">Pendiente</AppBadge>
              </td>
              <td>
                <AppButton v-if="persona.id === null" size="sm" variant="ghost" icon="heroicons:trash" :aria-label="`Quitar a ${persona.nombres}`" @click="emit('quitar', persona.clave)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppEmpty v-if="!filas.length" titulo="No hay personas con estos filtros" icon="heroicons:users" />
      <AppPagination :meta="meta" @cambiar="pagina = $event" />
    </template>
    <AppEmpty
      v-else
      titulo="Aún no hay inscritos cargados"
      descripcion="Carga a los aprobados del evento, sube un CSV exportado de Inscripciones o agrega a mano a ponentes y organizadores. Mientras tanto, la vista previa usa una persona de ejemplo."
      icon="heroicons:identification"
    />

    <AppModal :abierto="modalAbierto" titulo="Agregar a una persona a mano" descripcion="Ponentes, organizadores, prensa… quienes no están en las inscripciones." ancho="sm" @cerrar="cerrarModal">
      <form :id="`${id}-manual`" class="space-y-4" novalidate @submit.prevent="agregarManual">
        <AppField label="Nombre completo" :for="`${id}-m-nombre`" :error="erroresManual.nombre" required>
          <input :id="`${id}-m-nombre`" ref="campoNombre" v-model="manual.nombre" type="text" class="field-control" maxlength="80" autocomplete="off" placeholder="Dr. Juan Pérez">
        </AppField>
        <AppField label="Rol" :for="`${id}-m-rol`" :error="erroresManual.rol" hint="Se imprime en una banda grande cuando no lleva QR." required>
          <input :id="`${id}-m-rol`" v-model="manual.rol" type="text" class="field-control" maxlength="30" autocomplete="off" :list="`${id}-roles`">
          <datalist :id="`${id}-roles`">
            <option v-for="rol in SUGERENCIAS_ROL" :key="rol" :value="rol" />
          </datalist>
        </AppField>
        <AppField label="Código del QR (opcional)" :for="`${id}-m-codigo`" :error="erroresManual.codigo" hint="Solo si la persona ya está inscrita (por ejemplo, como cortesía): sin código la tarjeta no lleva QR. Un código inventado no marcaría asistencia.">
          <input :id="`${id}-m-codigo`" v-model="manual.codigo" type="text" class="field-control font-mono uppercase" maxlength="10" autocomplete="off" spellcheck="false" placeholder="10 letras o números">
        </AppField>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="cerrarModal">Cerrar</AppButton>
        <AppButton type="submit" :form="`${id}-manual`" icon="heroicons:plus">Agregar</AppButton>
      </template>
    </AppModal>
  </section>
</template>
