<script setup lang="ts">
import {
  ELEMENTOS_FOTOCHECK,
  OPCIONES_HOJA,
  TAMANOS_FOTOCHECK,
  compararOrientaciones,
  configPorDefectoFotocheck,
  esColorHex,
  medidasHoja,
  normalizarConfigFotocheck,
  type ConfigFotocheck,
  type TemaFotocheck,
} from '~/utils/fotochecks'

/**
 * Formulario del diseño y de la hoja (spec 030). Edita la configuración tal como se escribe (puede quedar a medias);
 * la pantalla la normaliza (`normalizarConfigFotocheck`) antes de dibujar, así que un valor inválido nunca rompe la vista.
 */
const props = defineProps<{
  /** Textos del evento elegido: se muestran como ayuda en los campos que se dejan vacíos. */
  evento: { corto: string, nombre: string }
}>()

const config = defineModel<ConfigFotocheck>({ required: true })

const id = useId()
const pestana = ref('diseno')
const PESTANAS = [
  { id: 'diseno', label: 'Diseño', icon: 'heroicons:paint-brush' },
  { id: 'hoja', label: 'Medidas', icon: 'heroicons:document' },
  { id: 'textos', label: 'Textos', icon: 'heroicons:pencil-square' },
]

const MODOS: ReadonlyArray<{ id: TemaFotocheck, etiqueta: string, detalle: string, muestra: string }> = [
  { id: 'OSCURO', etiqueta: 'Oscuro', detalle: 'Como la credencial de la web', muestra: '#0b2547' },
  { id: 'CLARO', etiqueta: 'Claro', detalle: 'Gasta menos tinta', muestra: '#ffffff' },
]

const ACENTOS = [
  { nombre: 'Cian del congreso', valor: '#00d9e8' },
  { nombre: 'Azul', valor: '#3b82f6' },
  { nombre: 'Violeta', valor: '#8b5cf6' },
  { nombre: 'Rojo', valor: '#e0234e' },
  { nombre: 'Naranja', valor: '#f59e0b' },
  { nombre: 'Verde', valor: '#10b981' },
]

const acentoValido = computed(() => esColorHex(config.value.acento))

const medidaFotocheck = computed({
  get: () => TAMANOS_FOTOCHECK.find((medida) => medida.ancho === Number(config.value.ancho) && medida.alto === Number(config.value.alto))?.id ?? 'otra',
  set: (valor: string) => {
    const medida = TAMANOS_FOTOCHECK.find((candidata) => candidata.id === valor)
    if (!medida) return
    config.value.ancho = medida.ancho
    config.value.alto = medida.alto
  },
})

const efectiva = computed(() => normalizarConfigFotocheck(config.value))
const comparacion = computed(() => compararOrientaciones(medidasHoja(efectiva.value), efectiva.value, efectiva.value.margen, efectiva.value.separacion))
const avisoOrientacion = computed(() => `Vertical: ${comparacion.value.vertical.porHoja} · Horizontal: ${comparacion.value.horizontal.porHoja} fotochecks por hoja`)
const sangradoMaximo = computed(() => Math.round((efectiva.value.separacion / 2) * 100) / 100)

function restablecer() {
  config.value = configPorDefectoFotocheck()
}
</script>

<template>
  <div class="space-y-5">
    <AppTabs v-model="pestana" :tabs="PESTANAS" />

    <!-- Diseño -->
    <div v-show="pestana === 'diseno'" class="space-y-5" role="tabpanel" aria-labelledby="tab-diseno">
      <div>
        <p :id="`${id}-modo`" class="field-label">Modo</p>
        <div class="grid grid-cols-2 gap-2" role="radiogroup" :aria-labelledby="`${id}-modo`">
          <button
            v-for="modo in MODOS"
            :key="modo.id"
            type="button"
            role="radio"
            :aria-checked="config.tema === modo.id"
            class="rounded-xl border px-3 py-2.5 text-left transition"
            :class="config.tema === modo.id ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 hover:bg-white/5'"
            @click="config.tema = modo.id"
          >
            <span class="flex items-center gap-2 text-sm font-semibold text-white">
              <span class="inline-block size-4 rounded-full ring-1 ring-white/40" :style="{ background: modo.muestra }" aria-hidden="true" />
              {{ modo.etiqueta }}
            </span>
            <span class="mt-0.5 block text-xs text-slate-400">{{ modo.detalle }}</span>
          </button>
        </div>
      </div>

      <AppField label="Color de acento" :for="`${id}-acento`" :error="acentoValido ? null : 'Usa el formato #rrggbb, por ejemplo #00d9e8.'" hint="Borde, pastilla de la categoría y banda del rol.">
        <div class="flex items-center gap-2">
          <input
            type="color"
            class="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-navy-500 bg-navy-900 p-1"
            :value="acentoValido ? config.acento : '#00d9e8'"
            aria-label="Elegir el color de acento"
            @input="config.acento = ($event.target as HTMLInputElement).value"
          >
          <input :id="`${id}-acento`" v-model="config.acento" type="text" class="field-control font-mono" maxlength="7" spellcheck="false" :aria-invalid="!acentoValido">
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="acento in ACENTOS"
            :key="acento.valor"
            type="button"
            class="size-6 rounded-full ring-1 ring-white/30 transition hover:scale-110 focus-visible:scale-110"
            :class="config.acento.toLowerCase() === acento.valor ? 'outline-2 outline-offset-2 outline-white' : ''"
            :style="{ background: acento.valor }"
            :title="acento.nombre"
            :aria-label="acento.nombre"
            @click="config.acento = acento.valor"
          />
        </div>
      </AppField>

      <div class="space-y-3">
        <p class="field-label !mb-0">Qué lleva el fotocheck</p>
        <AppSwitch v-for="elemento in ELEMENTOS_FOTOCHECK" :key="elemento.id" v-model="config.mostrar[elemento.id]" :label="elemento.etiqueta" :descripcion="elemento.descripcion" />
        <AppSwitch v-model="config.mayusculas" label="Nombre en MAYÚSCULAS" descripcion="Así se ve parejo aunque lo hayan escrito distinto" />
      </div>
    </div>

    <!-- Tamaño y hoja -->
    <div v-show="pestana === 'hoja'" class="space-y-5" role="tabpanel" aria-labelledby="tab-hoja">
      <fieldset class="space-y-3">
        <legend class="field-label">Fotocheck</legend>
        <AppField label="Medida" :for="`${id}-medida`" hint="El porta-fotocheck del congreso es de 6.7 × 10 cm. Puedes escribir otra medida.">
          <select :id="`${id}-medida`" v-model="medidaFotocheck" class="field-control">
            <option v-for="medida in TAMANOS_FOTOCHECK" :key="medida.id" :value="medida.id">{{ medida.etiqueta }}</option>
            <option value="otra">Otra medida</option>
          </select>
        </AppField>
        <div class="grid grid-cols-2 gap-3">
          <AppField label="Ancho (cm)" :for="`${id}-ancho`">
            <input :id="`${id}-ancho`" v-model.number="config.ancho" type="number" class="field-control" min="3" max="30" step="0.1" inputmode="decimal">
          </AppField>
          <AppField label="Alto (cm)" :for="`${id}-alto`">
            <input :id="`${id}-alto`" v-model.number="config.alto" type="number" class="field-control" min="3" max="30" step="0.1" inputmode="decimal">
          </AppField>
        </div>
      </fieldset>

      <fieldset class="space-y-3">
        <legend class="field-label">Hoja</legend>
        <AppField label="Tamaño de hoja" :for="`${id}-hoja`">
          <select :id="`${id}-hoja`" v-model="config.hoja" class="field-control">
            <option v-for="hoja in OPCIONES_HOJA" :key="hoja.id" :value="hoja.id">{{ hoja.etiqueta }}<template v-if="hoja.id !== 'PERSONALIZADA'"> · {{ hoja.ancho }} × {{ hoja.alto }} cm</template></option>
          </select>
        </AppField>
        <div v-if="config.hoja === 'PERSONALIZADA'" class="grid grid-cols-2 gap-3">
          <AppField label="Ancho de hoja (cm)" :for="`${id}-hoja-ancho`">
            <input :id="`${id}-hoja-ancho`" v-model.number="config.hojaAncho" type="number" class="field-control" min="10" max="100" step="0.1" inputmode="decimal">
          </AppField>
          <AppField label="Alto de hoja (cm)" :for="`${id}-hoja-alto`">
            <input :id="`${id}-hoja-alto`" v-model.number="config.hojaAlto" type="number" class="field-control" min="10" max="100" step="0.1" inputmode="decimal">
          </AppField>
        </div>
        <AppField label="Orientación" :for="`${id}-orientacion`" :hint="avisoOrientacion">
          <select :id="`${id}-orientacion`" v-model="config.orientacion" class="field-control">
            <option value="AUTO">Automática (la que más fotochecks acomode)</option>
            <option value="VERTICAL">Vertical</option>
            <option value="HORIZONTAL">Horizontal</option>
          </select>
        </AppField>
        <div class="grid grid-cols-2 gap-3">
          <AppField label="Margen (cm)" :for="`${id}-margen`" hint="Lo que tu impresora no alcanza: suele ser 0.4–0.5.">
            <input :id="`${id}-margen`" v-model.number="config.margen" type="number" class="field-control" min="0" max="3" step="0.05" inputmode="decimal">
          </AppField>
          <AppField label="Separación (cm)" :for="`${id}-separacion`" hint="Espacio entre fotochecks.">
            <input :id="`${id}-separacion`" v-model.number="config.separacion" type="number" class="field-control" min="0" max="3" step="0.05" inputmode="decimal">
          </AppField>
        </div>
        <AppField label="Sangrado (cm)" :for="`${id}-sangrado`" :hint="`El fondo se extiende fuera del corte para que un corte flojo no deje un filo blanco. Máximo ${sangradoMaximo} con esa separación.`">
          <input :id="`${id}-sangrado`" v-model.number="config.sangrado" type="number" class="field-control" min="0" max="0.5" step="0.05" inputmode="decimal">
        </AppField>
        <AppField label="Orden de impresión" :for="`${id}-orden`">
          <select :id="`${id}-orden`" v-model="config.orden" class="field-control">
            <option value="APELLIDOS">Apellidos (A–Z)</option>
            <option value="INSCRIPCION">Orden de inscripción</option>
          </select>
        </AppField>
      </fieldset>
    </div>

    <!-- Textos -->
    <div v-show="pestana === 'textos'" class="space-y-5" role="tabpanel" aria-labelledby="tab-textos">
      <AppField label="Nombre corto del evento" :for="`${id}-corto`" hint="Va junto al logo. Vacío usa el del evento elegido.">
        <input :id="`${id}-corto`" v-model="config.textos.eventoCorto" type="text" class="field-control" maxlength="120" :placeholder="props.evento.corto || 'VIII CIISIC 2026'">
      </AppField>
      <AppField label="Nombre completo del congreso" :for="`${id}-nombre`" hint="Bajo la cabecera. Vacío usa el del evento elegido.">
        <textarea :id="`${id}-nombre`" v-model="config.textos.eventoNombre" rows="3" class="field-control" maxlength="120" :placeholder="props.evento.nombre" />
      </AppField>
    </div>

    <div class="border-t border-white/10 pt-4">
      <AppButton variant="ghost" size="sm" icon="heroicons:arrow-uturn-left" @click="restablecer">Restablecer el diseño</AppButton>
      <p class="field-hint">El diseño se recuerda en este navegador.</p>
    </div>
  </div>
</template>
