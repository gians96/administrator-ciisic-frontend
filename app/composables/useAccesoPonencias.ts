import type { Respuesta } from '~/types/api'
import { esNoDisponible } from '~/utils/portal'
import type { AccesoPonencias } from '~/utils/ponenciasEspecializadas'

/**
 * Acceso libre de las ponencias especializadas del evento elegido (backend spec 030): encendido, entra
 * cualquiera solo con su documento; apagado, solo congresistas con el pago aprobado.
 * `accesoLibre` es `null` mientras se lee o si el backend aún no tiene la ruta (no se muestra nada).
 */
export function useAccesoPonencias() {
  const { api } = useApi()
  const eventos = useEventoStore()
  const accesoLibre = ref<boolean | null>(null)

  /** Respuestas que llegan tarde (de otro evento) se descartan. */
  let consulta = 0

  async function cargar() {
    const turno = ++consulta
    const eventoId = eventos.seleccionadoId
    accesoLibre.value = null
    if (!eventoId) return
    try {
      const respuesta = await api<Respuesta<AccesoPonencias>>(`events/${eventoId}/specialized-talks/access`)
      if (turno === consulta) accesoLibre.value = respuesta.data.accesoLibre
    } catch (error) {
      // Un backend anterior no tiene la ruta; otro fallo deja la franja sin mostrar
      if (turno === consulta && !esNoDisponible(error)) accesoLibre.value = null
    }
  }

  /** Enciende o apaga el acceso libre. Lanza el error de la API para que quien llama lo muestre. */
  async function guardar(valor: boolean) {
    const eventoId = eventos.seleccionadoId
    if (!eventoId) return
    const respuesta = await api<Respuesta<AccesoPonencias>>(`events/${eventoId}/specialized-talks/access`, { method: 'PUT', body: { accesoLibre: valor } })
    accesoLibre.value = respuesta.data.accesoLibre
  }

  watch(() => eventos.seleccionadoId, cargar, { immediate: true })

  return { accesoLibre, cargar, guardar }
}
