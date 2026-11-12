<script setup lang="ts">
import type { Respuesta } from '~/types/api'
import {
  codigoDeNombreArchivo,
  enTandas,
  MAX_BYTES_PDF,
  RESULTADOS_ARCHIVO,
  type DetalleArchivo,
  type ResultadoArchivo,
} from '~/utils/certificados'
import { mensajeError } from '~/utils/errores'
import { numero, tamanoArchivo } from '~/utils/formato'

/**
 * Carga de los PDF firmados. Cada archivo se empareja por el código de su nombre (`<código>[R][R][R].pdf`): el panel
 * lo muestra antes de subir y el backend lo vuelve a extraer y decide. Se suben en tandas de 10, una a la vez.
 */
const props = defineProps<{ abierto: boolean, eventoId: number | null }>()
const emit = defineEmits<{ cerrar: [], subido: [] }>()

const { api } = useApi()

const archivos = ref<File[]>([])
const reemplazar = ref(false)
const fase = ref<'elegir' | 'subiendo' | 'listo'>('elegir')
const progreso = ref({ hechas: 0, total: 0 })
const detalle = ref<DetalleArchivo[]>([])
const errorGeneral = ref<string | null>(null)
const soloProblemas = ref(false)
let detenerPedido = false
function detener() {
  detenerPedido = true
}

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  archivos.value = []
  reemplazar.value = false
  fase.value = 'elegir'
  detalle.value = []
  errorGeneral.value = null
  soloProblemas.value = false
})

function alElegir(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  archivos.value = [...(entrada.files ?? [])].filter(archivo => /\.pdf$/i.test(archivo.name))
}

const previa = computed(() => archivos.value.map(archivo => ({ archivo, codigo: codigoDeNombreArchivo(archivo.name), grande: archivo.size > MAX_BYTES_PDF })))
const conCodigo = computed(() => previa.value.filter(item => item.codigo && !item.grande))
const sinCodigo = computed(() => previa.value.filter(item => !item.codigo).length)
const grandes = computed(() => previa.value.filter(item => item.grande).length)
const porcentaje = computed(() => (progreso.value.total ? Math.round((progreso.value.hechas / progreso.value.total) * 100) : 0))

async function subir() {
  if (!props.eventoId || !conCodigo.value.length || fase.value === 'subiendo') return
  const eventoId = props.eventoId
  fase.value = 'subiendo'
  detenerPedido = false
  errorGeneral.value = null
  // Lo que no se manda (sin código o muy grande) se informa igual
  const resultados: DetalleArchivo[] = previa.value
    .filter(item => !item.codigo || item.grande)
    .map(item => ({
      archivo: item.archivo.name,
      codigo: item.codigo,
      resultado: (item.codigo ? 'NO_ENVIADO' : 'NOMBRE_INVALIDO') as ResultadoArchivo,
      certificadoId: null,
      nombre: null,
      firmas: 0,
      mensaje: item.grande ? `Pesa ${tamanoArchivo(item.archivo.size)}; el máximo es 10 MB.` : undefined,
    }))
  const tandas = enTandas(conCodigo.value.map(item => item.archivo))
  progreso.value = { hechas: 0, total: conCodigo.value.length }
  for (const [indice, tanda] of tandas.entries()) {
    if (detenerPedido) {
      for (const archivo of tandas.slice(indice).flat()) resultados.push({ archivo: archivo.name, codigo: codigoDeNombreArchivo(archivo.name), resultado: 'NO_ENVIADO', certificadoId: null, nombre: null, firmas: 0, mensaje: 'Se detuvo la carga.' })
      break
    }
    const cuerpo = new FormData()
    for (const archivo of tanda) cuerpo.append('files', archivo, archivo.name)
    if (reemplazar.value) cuerpo.append('reemplazar', 'true')
    try {
      const respuesta = await api<Respuesta<{ detalle: DetalleArchivo[] }>>(`events/${eventoId}/certificates/files`, { method: 'POST', body: cuerpo })
      resultados.push(...respuesta.data.detalle)
    } catch (e) {
      const mensaje = mensajeError(e)
      errorGeneral.value = mensaje
      for (const archivo of tanda) resultados.push({ archivo: archivo.name, codigo: codigoDeNombreArchivo(archivo.name), resultado: 'NO_ENVIADO', certificadoId: null, nombre: null, firmas: 0, mensaje })
    }
    progreso.value = { hechas: progreso.value.hechas + tanda.length, total: progreso.value.total }
  }
  detalle.value = resultados
  fase.value = 'listo'
  emit('subido')
}

const cuenta = (...tipos: ResultadoArchivo[]) => detalle.value.filter(d => tipos.includes(d.resultado)).length
const detalleVisible = computed(() => (soloProblemas.value ? detalle.value.filter(d => !['ASOCIADO', 'REEMPLAZADO', 'YA_TENIA'].includes(d.resultado)) : detalle.value))

function cerrar() {
  if (fase.value === 'subiendo') return
  emit('cerrar')
}
</script>

<template>
  <AppModal :abierto="abierto" titulo="Subir certificados firmados" descripcion="Elige los PDF firmados. Cada uno se asocia por el código de su nombre: 1GUdLMfaPT[R][R][R].pdf → 1GUdLMfaPT." ancho="xl" @cerrar="cerrar">
    <div v-if="fase === 'elegir'" class="space-y-5">
      <AppField label="Certificados en PDF" for="certificados-pdf" hint="Puedes elegir cientos a la vez (Ctrl + A dentro de la carpeta). Máximo 10 MB por archivo." required>
        <input
          id="certificados-pdf"
          type="file"
          multiple
          accept=".pdf,application/pdf"
          class="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
          @change="alElegir"
        >
      </AppField>

      <template v-if="archivos.length">
        <p class="text-sm text-slate-300">
          <strong class="text-white tabular-nums">{{ numero(archivos.length) }}</strong> PDF elegidos ·
          <strong class="text-emerald-300 tabular-nums">{{ numero(conCodigo.length) }}</strong> con código
          <template v-if="sinCodigo"> · <strong class="text-red-300 tabular-nums">{{ numero(sinCodigo) }}</strong> sin código reconocible</template>
          <template v-if="grandes"> · <strong class="text-red-300 tabular-nums">{{ numero(grandes) }}</strong> de más de 10 MB</template>
        </p>
        <div class="relative max-h-64 overflow-auto rounded-xl ring-1 ring-white/10">
          <table class="table-base">
            <thead><tr><th>Archivo</th><th>Código detectado</th></tr></thead>
            <tbody>
              <tr v-for="item in previa.slice(0, 300)" :key="item.archivo.name">
                <td class="max-w-80 truncate text-sm text-slate-300" :title="item.archivo.name">{{ item.archivo.name }}</td>
                <td class="whitespace-nowrap">
                  <span v-if="item.codigo" class="font-mono text-sm text-white">{{ item.codigo }}</span>
                  <AppBadge v-else tono="error">No reconocido</AppBadge>
                  <AppBadge v-if="item.grande" tono="error" class="ml-1">Muy grande</AppBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppSwitch v-model="reemplazar" label="Reemplazar el PDF si el certificado ya tiene otro" descripcion="Apagado, los que ya tienen PDF no se tocan (lo normal). Enciéndelo si volviste a firmar algunos." />
      </template>
    </div>

    <div v-else-if="fase === 'subiendo'" class="space-y-4" aria-live="polite">
      <p class="text-sm text-slate-300">Subiendo… <strong class="text-white tabular-nums">{{ numero(progreso.hechas) }}</strong> de <span class="tabular-nums">{{ numero(progreso.total) }}</span>. No cierres esta pantalla.</p>
      <div class="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="porcentaje" aria-valuemin="0" aria-valuemax="100" aria-label="Avance de la carga">
        <div class="h-full rounded-full bg-brand-400 transition-[width] duration-300" :style="{ width: `${porcentaje}%` }" />
      </div>
    </div>

    <div v-else class="space-y-4" aria-live="polite">
      <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt class="text-xs text-slate-400">Asociados</dt><dd class="font-semibold text-emerald-300 tabular-nums">{{ numero(cuenta('ASOCIADO', 'REEMPLAZADO')) }}</dd></div>
        <div><dt class="text-xs text-slate-400">Ya los tenía</dt><dd class="font-semibold text-white tabular-nums">{{ numero(cuenta('YA_TENIA')) }}</dd></div>
        <div><dt class="text-xs text-slate-400">Código no está en el Excel</dt><dd class="font-semibold tabular-nums" :class="cuenta('NO_ENCONTRADO') ? 'text-red-300' : 'text-white'">{{ numero(cuenta('NO_ENCONTRADO')) }}</dd></div>
        <div><dt class="text-xs text-slate-400">Otros problemas</dt><dd class="font-semibold text-amber-300 tabular-nums">{{ numero(cuenta('TIENE_OTRO', 'ANULADO', 'NOMBRE_INVALIDO', 'NO_ES_PDF', 'DUPLICADO', 'NO_ENVIADO')) }}</dd></div>
      </dl>
      <p v-if="errorGeneral" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/25 ring-inset">{{ errorGeneral }}</p>
      <p v-if="cuenta('TIENE_OTRO')" class="text-xs text-amber-200">«Ya tiene otro PDF»: vuelve a subirlos con «Reemplazar» encendido si son la versión correcta.</p>
      <label class="flex items-center gap-2 text-sm text-slate-300">
        <input v-model="soloProblemas" type="checkbox" class="size-4 accent-brand-500"> Ver solo los que tuvieron problemas
      </label>
      <div class="relative max-h-72 overflow-auto rounded-xl ring-1 ring-white/10">
        <table class="table-base">
          <thead><tr><th>Archivo</th><th>Certificado</th><th>Resultado</th></tr></thead>
          <tbody>
            <tr v-for="(item, indice) in detalleVisible" :key="`${item.archivo}-${indice}`">
              <td class="max-w-64 truncate text-sm text-slate-300" :title="item.archivo">{{ item.archivo }}</td>
              <td class="min-w-40 text-sm">
                <p class="text-white">{{ item.nombre ?? '—' }}</p>
                <p v-if="item.codigo" class="font-mono text-xs text-slate-400">{{ item.codigo }}<template v-if="item.firmas"> · {{ item.firmas }} firma(s)</template></p>
              </td>
              <td class="min-w-40">
                <AppBadge :tono="RESULTADOS_ARCHIVO[item.resultado].tono">{{ RESULTADOS_ARCHIVO[item.resultado].etiqueta }}</AppBadge>
                <p v-if="item.mensaje" class="mt-1 text-xs text-red-200">{{ item.mensaje }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #acciones>
      <template v-if="fase === 'elegir'">
        <AppButton variant="ghost" @click="cerrar">Cancelar</AppButton>
        <AppButton icon="heroicons:arrow-up-tray" :disabled="!conCodigo.length" @click="subir">Subir {{ numero(conCodigo.length) }} PDF</AppButton>
      </template>
      <AppButton v-else-if="fase === 'subiendo'" variant="secondary" icon="heroicons:stop" @click="detener">Detener</AppButton>
      <AppButton v-else @click="cerrar">Cerrar</AppButton>
    </template>
  </AppModal>
</template>
