import { decisionTrasErrorTanda } from '~/utils/certificados'
import { segundosParaReintentar } from '~/utils/codigoAcceso'
import { aErrorApi, type ErrorApi } from '~/utils/errores'
import { esCancelacion } from '~/utils/subida'

/**
 * - `EN_CURSO`: enviando una tanda; `ESPERANDO`: el backend estaba ocupado y se reintenta en
 *   `esperaSegundos`;
 * - `CANCELADO`: lo pidió la persona; `DETENIDO`: un error (`error`); los dos se pueden reanudar;
 * - `TERMINADO`: no quedan tandas.
 */
export type EstadoTandas = 'INACTIVO' | 'EN_CURSO' | 'ESPERANDO' | 'CANCELADO' | 'DETENIDO' | 'TERMINADO'

/** Lo que devuelve cada tanda: el cursor de la siguiente (`null` si no hay más) y el avance. */
export interface PasoTanda<C> {
  siguiente: C | null
  /** Elementos procesados en esta tanda (se suman en `procesados`). */
  procesados?: number
  /** Elementos que quedan después de esta tanda, si se saben (`restantes` del backend). */
  restantes?: number | null
}

/**
 * Ejecuta una tanda a partir de su cursor y acumula su resultado (reporte, filas…). Recibe la señal
 * de cancelación: puede pasarla a la petición (una subida) o dejar que la tanda termine (generar).
 */
export type EjecutarTanda<C> = (cursor: C, senal: AbortSignal) => Promise<PasoTanda<C>>

function esperar(ms: number, senal: AbortSignal, cadaSegundo: (restantes: number) => void): Promise<boolean> {
  return new Promise((resolver) => {
    if (senal.aborted) {
      resolver(false)
      return
    }
    let restantes = Math.ceil(ms / 1000)
    let reloj: ReturnType<typeof setInterval> | undefined
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const terminar = (siguio: boolean) => {
      clearTimeout(temporizador)
      clearInterval(reloj)
      senal.removeEventListener('abort', alCancelar)
      cadaSegundo(0)
      resolver(siguio)
    }
    function alCancelar() {
      terminar(false)
    }
    cadaSegundo(restantes)
    reloj = setInterval(() => {
      restantes = Math.max(0, restantes - 1)
      cadaSegundo(restantes)
    }, 1000)
    temporizador = setTimeout(() => terminar(true), ms)
    senal.addEventListener('abort', alCancelar, { once: true })
  })
}

/**
 * Bucle de tandas síncronas e idempotentes del backend (generar de a 10, subir firmados de a 10 MB,
 * importar de a 300 filas, ZIP por partes): ejecuta una tanda tras otra con el cursor que devuelve
 * cada una, informa el avance, se puede cancelar y reanudar desde la tanda pendiente. Un 401 o 403 lo
 * detiene sin reintentar (`useApi`/`useSubida` ya llevan al login o releen el acceso); un 503 de cola
 * llena (`PDF_BUSY`, `GENERATION_BUSY`, `SIGNED_UPLOAD_BUSY`) o un 429 se reintenta tras `Retry-After`
 * (`decisionTrasErrorTanda`); otro error lo detiene con `error` y se puede reanudar. Se cancela solo al
 * desmontar el componente.
 */
export function useTandas<C>() {
  const estado = ref<EstadoTandas>('INACTIVO')
  const tandas = ref(0)
  const procesados = ref(0)
  const restantes = ref<number | null>(null)
  const total = ref<number | null>(null)
  const error = ref<ErrorApi | null>(null)
  const esperaSegundos = ref(0)

  // Reactivo para que `puedeReanudar` lo vea
  const cursor = shallowRef<C | null>(null)
  let ejecutar: EjecutarTanda<C> | null = null
  let controlador: AbortController | null = null
  let ejecucion: Promise<EstadoTandas> | null = null

  const ocupado = computed(() => estado.value === 'EN_CURSO' || estado.value === 'ESPERANDO')
  const puedeReanudar = computed(() => (estado.value === 'CANCELADO' || estado.value === 'DETENIDO') && cursor.value !== null && ejecutar !== null)
  /** 0–100 si se conoce el total (`total`, o lo procesado más lo que queda); si no, `null`. */
  const porcentaje = computed<number | null>(() => {
    if (estado.value === 'TERMINADO') return 100
    const todo = total.value ?? (restantes.value === null ? null : procesados.value + restantes.value)
    if (!todo) return null
    return Math.min(100, Math.round((procesados.value / todo) * 100))
  })

  async function bucle(): Promise<EstadoTandas> {
    const control = new AbortController()
    controlador = control
    estado.value = 'EN_CURSO'
    error.value = null
    let intento = 0
    while (cursor.value !== null && ejecutar) {
      if (control.signal.aborted) return (estado.value = 'CANCELADO')
      try {
        const paso = await ejecutar(cursor.value, control.signal)
        intento = 0
        tandas.value++
        procesados.value += Math.max(0, paso.procesados ?? 0)
        if (paso.restantes !== undefined) restantes.value = paso.restantes
        cursor.value = paso.siguiente
      } catch (e) {
        if (control.signal.aborted || esCancelacion(e)) return (estado.value = 'CANCELADO')
        const decision = decisionTrasErrorTanda(e, segundosParaReintentar(e), intento)
        if (decision.accion === 'REINTENTAR') {
          intento++
          estado.value = 'ESPERANDO'
          const siguio = await esperar(decision.esperaMs, control.signal, (segundos) => { esperaSegundos.value = segundos })
          if (!siguio) return (estado.value = 'CANCELADO')
          estado.value = 'EN_CURSO'
          continue
        }
        error.value = aErrorApi(e)
        return (estado.value = 'DETENIDO')
      }
    }
    if (control.signal.aborted && cursor.value !== null) return (estado.value = 'CANCELADO')
    return (estado.value = 'TERMINADO')
  }

  function correr(): Promise<EstadoTandas> {
    ejecucion = bucle().finally(() => {
      ejecucion = null
      controlador = null
    })
    return ejecucion
  }

  /**
   * Empieza desde `inicio` con la función de cada tanda; `totalConocido` (si se sabe cuántos son) sirve
   * para el porcentaje. Si ya hay un bucle en curso, devuelve ese.
   */
  function iniciar(inicio: C, ejecutarTanda: EjecutarTanda<C>, totalConocido: number | null = null): Promise<EstadoTandas> {
    if (ejecucion) return ejecucion
    cursor.value = inicio
    ejecutar = ejecutarTanda
    tandas.value = 0
    procesados.value = 0
    restantes.value = null
    total.value = totalConocido
    return correr()
  }

  /** Sigue desde la tanda pendiente (tras cancelar o un error), con el avance acumulado. */
  function reanudar(): Promise<EstadoTandas> {
    if (ejecucion) return ejecucion
    if (!puedeReanudar.value) return Promise.resolve(estado.value)
    return correr()
  }

  /** Detiene el bucle: no empieza otra tanda y corta una espera; la tanda en curso decide con la señal. */
  function cancelar(): void {
    controlador?.abort()
  }

  /** Vuelve al estado inicial (cancela si hay un bucle en curso). */
  function reiniciar(): void {
    cancelar()
    cursor.value = null
    ejecutar = null
    estado.value = 'INACTIVO'
    tandas.value = 0
    procesados.value = 0
    restantes.value = null
    total.value = null
    error.value = null
    esperaSegundos.value = 0
  }

  if (getCurrentScope()) onScopeDispose(cancelar)

  return {
    estado: readonly(estado),
    tandas: readonly(tandas),
    procesados: readonly(procesados),
    restantes: readonly(restantes),
    total: readonly(total),
    error: readonly(error),
    esperaSegundos: readonly(esperaSegundos),
    ocupado,
    puedeReanudar,
    porcentaje,
    iniciar,
    reanudar,
    cancelar,
    reiniciar,
  }
}
