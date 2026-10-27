<script setup lang="ts">
import { colorTextoSobre, modulosQr, nombreParaFotocheck, tamanoNombreFotocheck, type AsistenteFotocheck, type ConfigFotocheck } from '~/utils/fotochecks'

/**
 * Un fotocheck para imprimir (spec 030), con el formato de la credencial 3D de la landing: cabecera con el logo del
 * congreso, nombre del congreso, nombre grande, QR sobre cuadro blanco y el código. Todo va en `cqw` (1 % del ancho del
 * fotocheck), así que escala a cualquier medida. Es un cuadro recto: se corta a mano y el porta-fotocheck lo redondea.
 * El fondo se extiende `sangrado` cm fuera del corte; el borde fino es la guía de corte. Sin código (personas a mano) no
 * lleva QR: una banda con el rol ocupa su lugar.
 */
const props = defineProps<{
  persona: AsistenteFotocheck
  config: ConfigFotocheck
  /** Textos del evento ya resueltos (los editados o, si están vacíos, los del evento elegido). */
  evento: { corto: string, nombre: string }
}>()

const nombre = computed(() => nombreParaFotocheck(props.persona, props.config.mayusculas))
const tamano = computed(() => tamanoNombreFotocheck(nombre.value))
const qr = computed(() => (props.persona.codigo ? modulosQr(props.persona.codigo) : null))
const estilo = computed(() => ({
  width: `${props.config.ancho}cm`,
  height: `${props.config.alto}cm`,
  '--acento': props.config.acento,
  '--sobre-acento': colorTextoSobre(props.config.acento),
  '--sangrado': `${props.config.sangrado}cm`,
}))
</script>

<template>
  <article class="ft" :class="config.tema === 'CLARO' ? 'ft--claro' : 'ft--oscuro'" :style="estilo" :aria-label="`Fotocheck de ${nombre}`">
    <div class="ft__fondo" aria-hidden="true">
      <img v-if="config.mostrar.marcaDeAgua" class="ft__marca" src="/fotocheck/logo-ciisic.png" alt="" decoding="async">
    </div>
    <div class="ft__borde" aria-hidden="true" />

    <div class="ft__contenido">
      <header class="ft__cabecera">
        <img v-if="config.mostrar.logoCongreso" class="ft__logo" src="/fotocheck/logo-ciisic.png" alt="" decoding="async">
        <p class="ft__evento">{{ evento.corto }}</p>
        <span v-if="config.mostrar.logoFi" class="ft__fi">
          <img src="/fotocheck/logo-fi.png" alt="Facultad de Ingeniería" decoding="async">
        </span>
      </header>
      <p v-if="config.mostrar.nombreCongreso && evento.nombre" class="ft__congreso">{{ evento.nombre }}</p>

      <div class="ft__datos">
        <p class="ft__nombre" :style="{ fontSize: `${tamano}cqw` }">{{ nombre }}</p>
        <p v-if="config.mostrar.tipo && qr && persona.rol" class="ft__rol"><span>{{ persona.rol }}</span></p>
      </div>

      <footer class="ft__pie">
        <template v-if="qr">
          <div class="ft__qr">
            <svg :viewBox="`0 0 ${qr.lado} ${qr.lado}`" shape-rendering="crispEdges" role="img" aria-label="Código QR">
              <path :d="qr.ruta" fill="currentColor" />
            </svg>
          </div>
          <p v-if="config.mostrar.codigo" class="ft__codigo">{{ persona.codigo }}</p>
        </template>
        <p v-else-if="persona.rol" class="ft__banda">{{ persona.rol }}</p>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.ft {
  --tinta: #fff;
  --tinta-suave: rgb(226 240 255 / 0.88);
  --linea: rgb(255 255 255 / 0.22);
  --fondo: linear-gradient(165deg, #0b2547 0%, #07162b 55%, #050f20 100%);
  --borde: color-mix(in srgb, var(--acento) 70%, transparent);
  --marca: 0.1;
  --qr-borde: transparent;
  --fi-fondo: #fff;

  position: relative;
  box-sizing: border-box;
  container-type: size;
  color: var(--tinta);
  font-family: Poppins, ui-sans-serif, system-ui, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.ft--claro {
  --tinta: #041d39;
  --tinta-suave: #3b556f;
  --linea: rgb(4 29 57 / 0.3);
  --fondo: linear-gradient(165deg, #fff 0%, #f3f7fb 55%, #e6eef7 100%);
  --borde: color-mix(in srgb, var(--acento) 55%, #041d39);
  --marca: 0.08;
  --qr-borde: #cbd8e6;
  --fi-fondo: transparent;
}

/* Fondo con sangrado: se extiende fuera del corte para que un corte imperfecto no deje un filo blanco */
.ft__fondo {
  position: absolute;
  inset: calc(-1 * var(--sangrado));
  overflow: hidden;
  background: var(--fondo);
}

/* El logo del congreso, grande y tenue (en la web esa marca es el ícono de la tecnología principal) */
.ft__marca {
  position: absolute;
  top: 16cqh;
  right: -16cqw;
  width: 82cqw;
  height: auto;
  opacity: var(--marca);
  transform: rotate(-8deg);
  pointer-events: none;
}

/* Borde fino: guía de corte y marco de la tarjeta */
.ft__borde {
  position: absolute;
  inset: 0;
  border: 0.3mm solid var(--borde);
  pointer-events: none;
}

/* Área útil: aquí `cqw` es el 1 % del ancho útil, como en la credencial web */
.ft__contenido {
  position: absolute;
  inset: 7cqw 8.5cqw;
  container-type: size;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ft__cabecera {
  display: flex;
  align-items: center;
  gap: 3cqw;
}

.ft__logo {
  flex: none;
  width: 11cqw;
  height: 11cqw;
  object-fit: contain;
}

.ft__evento {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 4.2cqw;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

/* El logo de la Facultad es navy con disco blanco: en oscuro va sobre un círculo blanco para que no se pierda */
.ft__fi {
  flex: none;
  display: grid;
  place-items: center;
  width: 15cqw;
  height: 15cqw;
  border-radius: 50%;
  background: var(--fi-fondo);
}

.ft__fi img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ft__congreso {
  max-width: 94%;
  margin: 5cqw 0 0;
  font-size: 5.4cqw;
  font-weight: 600;
  line-height: 1.32;
  color: var(--tinta-suave);
  text-wrap: balance;
}

.ft__datos {
  margin-top: auto;
}

.ft__nombre {
  margin: 0;
  font-family: Barlow, ui-sans-serif, system-ui, sans-serif;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}

.ft__rol {
  display: flex;
  margin: 5cqw 0 0;
}

.ft__rol span {
  max-width: 100%;
  padding: 1.4cqw 3.6cqw;
  border-radius: 99cqw;
  background: var(--acento);
  color: var(--sobre-acento);
  font-size: 3.6cqw;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ft__pie {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3cqw;
  margin-top: 7cqw;
  padding-top: 6cqw;
  border-top: 0.25mm dashed var(--linea);
}

.ft__qr {
  box-sizing: content-box;
  width: min(46cqw, 25cqh);
  aspect-ratio: 1;
  padding: 2.6cqw;
  border-radius: 4.4cqw;
  background: #fff;
  color: #041d39;
  box-shadow: 0 0 0 0.25mm var(--qr-borde);
}

.ft__qr svg {
  display: block;
  width: 100%;
  height: 100%;
}

.ft__codigo {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 5.4cqw;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.18em;
  text-indent: 0.18em;
}

/* Sin QR: el rol, en grande, para reconocerlo de lejos */
.ft__banda {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 6cqw 4cqw;
  border-radius: 3cqw;
  background: var(--acento);
  color: var(--sobre-acento);
  font-family: Barlow, ui-sans-serif, system-ui, sans-serif;
  font-size: 9cqw;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
</style>
