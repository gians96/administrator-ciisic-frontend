import { getCurrentScope, onScopeDispose, ref } from 'vue'

/**
 * Copia texto al portapapeles con la API asíncrona (requiere HTTPS o localhost) y deja
 * `copiado` en `true` durante `duracionMs` para dar feedback. `copiar` devuelve `false` si el
 * navegador no lo permite (sin portapapeles o permiso denegado).
 */
export function useCopiar(duracionMs = 2000) {
  const copiado = ref(false)
  let temporizador: ReturnType<typeof setTimeout> | undefined

  function reiniciar() {
    clearTimeout(temporizador)
    copiado.value = false
  }

  async function copiar(texto: string): Promise<boolean> {
    const portapapeles = globalThis.navigator?.clipboard
    if (typeof portapapeles?.writeText !== 'function') return false
    try {
      await portapapeles.writeText(texto)
    } catch {
      return false
    }
    clearTimeout(temporizador)
    copiado.value = true
    temporizador = setTimeout(() => { copiado.value = false }, duracionMs)
    return true
  }

  if (getCurrentScope()) onScopeDispose(reiniciar)

  return { copiado, copiar, reiniciar }
}
