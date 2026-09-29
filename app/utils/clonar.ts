import { toRaw } from 'vue'

/**
 * Copia de una lista de objetos planos (filas de un formulario: bancos, billeteras,
 * características…). `structuredClone` lanza `DataCloneError` con los proxies reactivos de Vue,
 * así que cada elemento se desenvuelve con `toRaw` y se copia: editar la copia no altera el original.
 * La copia es superficial (un nivel), suficiente para filas sin objetos anidados.
 */
export function clonarLista<T extends object>(lista?: readonly T[] | null): T[] {
  return (lista ?? []).map((x) => ({ ...toRaw(x) }))
}
