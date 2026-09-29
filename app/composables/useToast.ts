export interface Toast {
  id: number
  tipo: 'exito' | 'error' | 'info'
  mensaje: string
}

let siguienteId = 1

/** Notificaciones globales (se muestran en `AppToasts`). */
export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function mostrar(tipo: Toast['tipo'], mensaje: string, duracionMs = 4500) {
    const id = siguienteId++
    toasts.value = [...toasts.value, { id, tipo, mensaje }]
    setTimeout(() => cerrar(id), duracionMs)
  }

  function cerrar(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts,
    cerrar,
    exito: (mensaje: string) => mostrar('exito', mensaje),
    error: (mensaje: string) => mostrar('error', mensaje, 7000),
    info: (mensaje: string) => mostrar('info', mensaje),
  }
}
