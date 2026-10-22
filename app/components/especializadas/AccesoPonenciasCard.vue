<script setup lang="ts">
import { mensajeError } from '~/utils/errores'
import { textoCambioAcceso } from '~/utils/ponenciasEspecializadas'

/**
 * Interruptor «Acceso libre (gratuito)» del evento (`GET|PUT events/:id/specialized-talks/access`).
 * Encendido, la landing, el alta manual y la puerta funcionan solo con el documento; apagado, solo entran
 * congresistas con el pago aprobado. Cambiarlo pide confirmación porque toma efecto de inmediato.
 */
const props = defineProps<{ accesoLibre: boolean | null, puedeCambiar: boolean, guardar: (valor: boolean) => Promise<void> }>()

const toast = useToast()
const { confirmar } = useConfirm()
const guardando = ref(false)

/** El interruptor refleja lo guardado: solo cambia cuando el servidor confirma. */
const encendido = computed({
  get: () => props.accesoLibre === true,
  set: (valor: boolean) => { void cambiar(valor) },
})

async function cambiar(valor: boolean) {
  if (guardando.value || !props.puedeCambiar) return
  const texto = textoCambioAcceso(valor)
  const ok = await confirmar({ titulo: texto.titulo, mensaje: texto.mensaje, textoConfirmar: texto.confirmar })
  if (!ok) return
  guardando.value = true
  try {
    await props.guardar(valor)
    toast.exito(valor ? 'Acceso libre encendido: se inscribe solo con el documento.' : 'Acceso libre apagado: solo congresistas con el pago aprobado.')
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section v-if="accesoLibre !== null" class="card space-y-3 p-5" aria-labelledby="acceso-ponencias">
    <h2 id="acceso-ponencias" class="font-display text-lg font-semibold text-white">Acceso a la inscripción</h2>
    <AppSwitch
      v-model="encendido"
      label="Acceso libre (gratuito): entra solo con su DNI"
      :descripcion="accesoLibre
        ? 'Encendido: cualquiera se inscribe a las ponencias con solo su documento; no se comprueba el congreso ni el pago.'
        : 'Apagado: solo se inscribe quien tiene su inscripción al congreso aprobada (pago validado). En la landing se pide DNI y correo; el staff y la puerta usan el DNI.'"
      :disabled="!puedeCambiar || guardando"
    />
    <p class="text-xs text-slate-500">
      <template v-if="accesoLibre">Con el acceso libre las inscripciones quedan «Sin validar» y todas ocupan aforo presencial.</template>
      <template v-else>Los congresistas virtuales no tienen límite de cupo; los presenciales respetan el aforo de cada ponencia.</template>
      <template v-if="!puedeCambiar"> Solo el Owner y el Administrador del sistema pueden cambiarlo.</template>
    </p>
  </section>
</template>
