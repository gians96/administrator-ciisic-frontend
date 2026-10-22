<script setup lang="ts">
/**
 * Botón con menú desplegable de acciones (`AppMenuItem` en el slot). Usa la API nativa `popover`: el menú se
 * dibuja en la capa superior del navegador, así que no lo recortan las tablas con desplazamiento ni queda detrás de
 * un diálogo, y se cierra solo con un clic fuera o con Esc (el foco vuelve al botón). Se cierra también al elegir
 * una acción.
 */
const props = withDefaults(defineProps<{
  etiqueta: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  alinear?: 'izquierda' | 'derecha'
}>(), { icon: undefined, variant: 'secondary', size: 'md', loading: false, disabled: false, alinear: 'derecha' })

const id = useId()
const disparador = ref<HTMLElement | null>(null)
const lista = ref<HTMLElement | null>(null)

const MARGEN = 8

/** Coloca el menú junto al botón: alineado a su borde, dentro de la pantalla y hacia arriba si abajo no cabe. */
function alCambiar(evento: Event) {
  if ((evento as ToggleEvent).newState !== 'open') return
  const boton = disparador.value?.getBoundingClientRect()
  const menu = lista.value
  if (!boton || !menu) return
  const ancho = menu.offsetWidth
  const alto = menu.offsetHeight
  const izquierda = props.alinear === 'derecha' ? boton.right - ancho : boton.left
  menu.style.left = `${Math.min(Math.max(MARGEN, izquierda), window.innerWidth - ancho - MARGEN)}px`
  const abajo = boton.bottom + 6
  const cabeAbajo = abajo + alto <= window.innerHeight - MARGEN
  menu.style.top = `${cabeAbajo || boton.top - alto - 6 < MARGEN ? abajo : boton.top - alto - 6}px`
}

function cerrar() {
  lista.value?.hidePopover()
}
</script>

<template>
  <div ref="disparador" class="relative inline-block">
    <AppButton
      :variant="variant"
      :size="size"
      :icon="icon"
      :loading="loading"
      :disabled="disabled"
      aria-haspopup="menu"
      :popovertarget="id"
    >
      {{ etiqueta }}
      <Icon name="heroicons:chevron-down" class="size-3.5 opacity-70" aria-hidden="true" />
    </AppButton>
    <div
      :id="id"
      ref="lista"
      popover="auto"
      role="menu"
      class="inset-auto m-0 min-w-56 overflow-hidden rounded-xl border border-white/10 bg-navy-850 py-1 text-slate-200 shadow-xl shadow-black/40"
      @toggle="alCambiar"
      @click="cerrar"
    >
      <slot />
    </div>
  </div>
</template>
