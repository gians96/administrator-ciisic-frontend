export interface SolicitudConfirmacion {
  titulo: string
  mensaje: string
  textoConfirmar?: string
  peligro?: boolean
}

interface EstadoConfirmacion extends SolicitudConfirmacion {
  abierto: boolean
}

let resolver: ((valor: boolean) => void) | null = null

/** Diálogo de confirmación basado en promesas (se muestra en `AppConfirm`). */
export function useConfirm() {
  const estado = useState<EstadoConfirmacion>('confirmacion', () => ({ abierto: false, titulo: '', mensaje: '' }))

  function confirmar(solicitud: SolicitudConfirmacion): Promise<boolean> {
    estado.value = { ...solicitud, abierto: true }
    return new Promise((resolve) => { resolver = resolve })
  }

  function responder(valor: boolean) {
    estado.value = { ...estado.value, abierto: false }
    resolver?.(valor)
    resolver = null
  }

  return { estado, confirmar, responder }
}
