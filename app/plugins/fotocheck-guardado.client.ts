import { almacenDelNavegador, vigilarCopiaFotocheck } from '~/utils/fotocheck'

/**
 * La copia del fotocheck que «Mi fotocheck» guarda para verlo sin conexión es solo del participante
 * que la vio: se borra cuando la sesión se cierra (salir, vencida o invalidada) o cambia de persona.
 * Mientras la sesión no se pudo verificar (sin red) se conserva: es justo cuando sirve.
 */
export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  vigilarCopiaFotocheck(() => ({ verificado: auth.verificado, participanteId: auth.participante?.id ?? null }), almacenDelNavegador)
})
