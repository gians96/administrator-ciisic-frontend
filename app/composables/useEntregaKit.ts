import type { KitEstado, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { mensajeDeshacerKit, rutaKit, type ResultadoKit } from '~/utils/kit'

/**
 * Entregar el kit de una inscripción, o deshacer la entrega, desde una lista (el tablero de kits, spec 035). Es el mismo flujo del
 * detalle de la inscripción (spec 028): `PUT|DELETE inscriptions/:id/kit` (de quien marca asistencia, `asistencia.marcar`),
 * confirmación al deshacer y avisos. Lo que se muestra lo vuelve a leer quien llama.
 */
export function useEntregaKit() {
  const { api } = useApi()
  const toast = useToast()
  const { confirmar } = useConfirm()
  /** Inscripción cuya entrega se está cambiando (una a la vez). */
  const enCurso = ref<number | null>(null)

  /**
   * Entrega (o deshace) el kit de `inscripcionId`. Devuelve `true` si hay que volver a leer lo que se muestra: la entrega cambió, o otra
   * cuenta ya la había cambiado (`KIT_ALREADY_DELIVERED`, `KIT_NOT_DELIVERED`). `false` si se canceló o falló sin cambiar nada.
   */
  async function cambiar(inscripcionId: number, nombre: string, entregar: boolean, kitActual?: KitEstado | null): Promise<boolean> {
    if (enCurso.value !== null) return false
    if (!entregar) {
      const ok = await confirmar({
        titulo: 'Deshacer entrega del kit',
        mensaje: mensajeDeshacerKit(nombre, kitActual),
        textoConfirmar: 'Deshacer',
        peligro: true,
      })
      if (!ok) return false
    }
    enCurso.value = inscripcionId
    try {
      await api<Respuesta<ResultadoKit>>(rutaKit(inscripcionId), { method: entregar ? 'PUT' : 'DELETE' })
      toast.exito(entregar ? `Kit entregado a ${nombre}.` : `Entrega deshecha: el kit de ${nombre} quedó pendiente.`)
      return true
    } catch (error) {
      toast.error(mensajeError(error))
      const codigo = aErrorApi(error).code
      return codigo === 'KIT_ALREADY_DELIVERED' || codigo === 'KIT_NOT_DELIVERED'
    } finally {
      enCurso.value = null
    }
  }

  return { enCurso, cambiar }
}
