<script setup lang="ts">
import type { AsistenteFotocheck, ConfigFotocheck, Rejilla } from '~/utils/fotochecks'

/**
 * Una hoja de impresión (spec 030): papel con la rejilla de fotochecks centrada, en cm reales. La usan la vista previa
 * (escalada) y la impresión (tal cual), por eso lo que se ve es lo que sale. `guias` dibuja el marco del margen y el
 * contorno de cada lugar **solo en pantalla**: la impresión nunca las pide.
 */
const props = defineProps<{
  personas: readonly AsistenteFotocheck[]
  rejilla: Rejilla
  config: ConfigFotocheck
  evento: { corto: string, nombre: string }
  guias?: boolean
}>()

const huecos = computed(() => Array.from({ length: props.rejilla.porHoja }, (_, indice) => indice))
const estiloHoja = computed(() => ({ width: `${props.rejilla.hojaAncho}cm`, height: `${props.rejilla.hojaAlto}cm` }))
const estiloRejilla = computed(() => ({
  left: `${props.rejilla.origenX}cm`,
  top: `${props.rejilla.origenY}cm`,
  gridTemplateColumns: `repeat(${props.rejilla.columnas}, ${props.config.ancho}cm)`,
  gridAutoRows: `${props.config.alto}cm`,
  gap: `${props.config.separacion}cm`,
}))
const estiloMargen = computed(() => ({ inset: `${props.config.margen}cm` }))
</script>

<template>
  <section class="hoja" :style="estiloHoja">
    <div class="hoja__rejilla" :style="estiloRejilla">
      <FotocheckTarjeta v-for="persona in personas" :key="persona.clave" :persona="persona" :config="config" :evento="evento" />
    </div>
    <template v-if="guias">
      <div class="hoja__margen" :style="estiloMargen" aria-hidden="true" />
      <div class="hoja__rejilla hoja__guias" :style="estiloRejilla" aria-hidden="true">
        <span v-for="hueco in huecos" :key="hueco" class="hoja__hueco" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.hoja {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  background: #fff;
  break-after: page;
  break-inside: avoid;
}

.hoja:last-child {
  break-after: auto;
}

.hoja__rejilla {
  position: absolute;
  display: grid;
}

.hoja__guias {
  pointer-events: none;
}

/* Lugar de cada fotocheck (también los vacíos: muestran la capacidad de la hoja) */
.hoja__hueco {
  outline: 0.1mm dashed rgb(236 72 153 / 0.9);
}

/* Área imprimible que se respeta: el margen */
.hoja__margen {
  position: absolute;
  border: 0.1mm dashed rgb(59 130 246 / 0.7);
  pointer-events: none;
}
</style>
