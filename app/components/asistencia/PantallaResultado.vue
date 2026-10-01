<script setup lang="ts">
import { esperaContinuar, type ResultadoLectura, type TonoResultado } from '~/utils/asistencia'

/**
 * Resultado de una lectura del escáner a pantalla completa: verde (registrada), ámbar (QR anterior:
 * verificar el DNI; o ya estaba registrada) o rojo (no se registró). Muestra la foto si la hay (si no,
 * o si no carga, un marcador). No toma el foco (el lector USB sigue escribiendo en su campo y, salvo el
 * aviso del QR anterior, una lectura nueva lo reemplaza); se cierra con «Continuar», tocándolo, con
 * `Escape` o solo, si el resultado lo indica (`cierraEnMs`). El aviso del QR anterior (`esperaContinuar`)
 * solo se cierra con «Continuar»: así no se salta la verificación del DNI. La página lo vuelve a montar
 * (`key`) con cada resultado.
 */
const props = defineProps<{
  resultado: ResultadoLectura
  /** Foto de la persona (`/api/backend/inscriptions/:id/photo`), o `null`. */
  urlFoto: string | null
  /** Nombre de la actividad en la que se marcó. */
  actividad: string | null
  reintentando?: boolean
}>()
const emit = defineEmits<{ cerrar: [], reintentar: [] }>()

const ESTILOS: Readonly<Record<TonoResultado, { fondo: string, icono: string, boton: string, barra: string }>> = {
  exito: { fondo: 'bg-emerald-600 text-white', icono: 'heroicons:check-circle', boton: 'bg-white text-emerald-800 hover:bg-emerald-50', barra: 'bg-white/80' },
  alerta: { fondo: 'bg-amber-400 text-navy-950', icono: 'heroicons:exclamation-triangle', boton: 'bg-navy-950 text-amber-200 hover:bg-navy-900', barra: 'bg-navy-950/70' },
  error: { fondo: 'bg-red-600 text-white', icono: 'heroicons:x-circle', boton: 'bg-white text-red-800 hover:bg-red-50', barra: 'bg-white/80' },
}

const estilo = computed(() => ESTILOS[props.resultado.tono])
const fotoFallo = ref(false)
const conFoto = computed(() => Boolean(props.urlFoto) && !fotoFallo.value)
/** Solo «Continuar» lo cierra (verificar el DNI del QR anterior). */
const soloConContinuar = computed(() => esperaContinuar(props.resultado))

let temporizador: ReturnType<typeof setTimeout> | null = null

function cerrarSinBoton() {
  if (!soloConContinuar.value) emit('cerrar')
}

function alTeclear(evento: KeyboardEvent) {
  if (evento.key === 'Escape') cerrarSinBoton()
}

onMounted(() => {
  if (props.resultado.cierraEnMs) temporizador = setTimeout(() => emit('cerrar'), props.resultado.cierraEnMs)
  document.addEventListener('keydown', alTeclear)
})

onBeforeUnmount(() => {
  if (temporizador) clearTimeout(temporizador)
  document.removeEventListener('keydown', alTeclear)
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto px-5 pt-8 pb-10 text-center sm:gap-4"
    :class="estilo.fondo"
    @click="cerrarSinBoton"
  >
    <div role="alert" class="flex flex-col items-center gap-3 sm:gap-4">
      <Icon :name="estilo.icono" class="size-14 shrink-0 sm:size-20" aria-hidden="true" />
      <p class="font-display text-3xl leading-tight font-extrabold sm:text-5xl">{{ resultado.titulo }}</p>

      <template v-if="resultado.persona">
        <img
          v-if="conFoto"
          :src="urlFoto ?? undefined"
          :alt="`Foto de ${resultado.persona.nombre}`"
          class="size-40 rounded-2xl object-cover shadow-xl ring-4 ring-white/70 sm:size-56"
          @error="fotoFallo = true"
        >
        <span v-else class="inline-flex size-28 items-center justify-center rounded-2xl bg-black/15 ring-4 ring-white/40 sm:size-36" aria-hidden="true">
          <Icon name="heroicons:user" class="size-14 opacity-70 sm:size-20" />
        </span>
        <p class="max-w-3xl text-2xl leading-tight font-bold break-words sm:text-4xl">{{ resultado.persona.nombre }}</p>
        <p class="font-mono text-xl font-semibold tracking-wide sm:text-3xl">{{ resultado.persona.documento }}</p>
        <p v-if="resultado.persona.tipoInscripcion" class="rounded-full bg-black/15 px-4 py-1 text-sm font-semibold sm:text-base">{{ resultado.persona.tipoInscripcion }}</p>
      </template>

      <p v-if="resultado.fueraDeHorario" class="rounded-full bg-black/20 px-3 py-1 text-xs font-bold tracking-wide uppercase">Fuera de horario</p>
      <p v-if="resultado.mensaje" class="max-w-xl text-base font-medium sm:text-lg">{{ resultado.mensaje }}</p>
      <p v-if="actividad" class="text-xs opacity-80 sm:text-sm">{{ actividad }}</p>
    </div>

    <div class="mt-2 flex flex-wrap justify-center gap-3">
      <button
        v-if="resultado.reintentable"
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-base font-semibold ring-2 ring-current transition disabled:opacity-60"
        :disabled="reintentando"
        @click.stop="emit('reintentar')"
      >
        <Icon name="heroicons:arrow-path" class="size-5" :class="reintentando ? 'animate-spin' : ''" aria-hidden="true" />
        Reintentar
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold shadow-lg transition"
        :class="estilo.boton"
        @click.stop="emit('cerrar')"
      >
        Continuar
      </button>
    </div>
    <p v-if="soloConContinuar" class="text-sm font-medium opacity-80">Pulsa «Continuar» cuando hayas comparado el DNI y la foto.</p>

    <div v-if="resultado.cierraEnMs" class="absolute inset-x-0 bottom-0 h-1.5 bg-black/10 motion-reduce:hidden" aria-hidden="true">
      <div class="cuenta-regresiva h-full origin-left" :class="estilo.barra" :style="{ animationDuration: `${resultado.cierraEnMs}ms` }" />
    </div>
  </div>
</template>

<style scoped>
.cuenta-regresiva {
  animation-name: cuenta-regresiva;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes cuenta-regresiva {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
</style>
