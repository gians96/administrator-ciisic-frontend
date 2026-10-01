/**
 * Cola de envíos del escáner de asistencia (`/escanear`): las lecturas se registran de una en una y en
 * el orden en que llegaron (FIFO). Con el lector USB en ráfaga o dos QR a la vista ninguna lectura se
 * pierde sin aviso: o se procesa o, si la cola está llena, `agregar` lo dice para registrarla como «no
 * procesada». `detener` la pausa (un resultado que espera «Continuar») sin perder lo que ya esperaba.
 */

/** Lecturas que pueden esperar mientras se registra otra. */
export const MAXIMO_EN_COLA = 10

export interface ColaEnvios<T, R> {
  /**
   * Agrega un envío: se procesa en cuanto le toque. Devuelve la promesa con el resultado de `procesar`
   * (`undefined` si falló o se descartó con `vaciar`), o `null` si la cola estaba llena (no se agregó).
   */
  agregar: (envio: T) => Promise<R | undefined> | null
  /** No empieza el siguiente envío (el que está en curso termina) hasta `reanudar`. */
  detener: () => void
  reanudar: () => void
  /** Descarta los envíos que esperaban (sus promesas dan `undefined`) y los devuelve. */
  vaciar: () => T[]
  /** Hay un envío en curso o esperando. */
  ocupada: () => boolean
  /** Envíos que esperan (sin contar el que está en curso). */
  enEspera: () => number
  detenida: () => boolean
}

export function crearColaEnvios<T, R>(procesar: (envio: T) => Promise<R>, maximo: number = MAXIMO_EN_COLA): ColaEnvios<T, R> {
  const espera: Array<{ envio: T, resolver: (resultado: R | undefined) => void }> = []
  let enCurso = false
  let pausada = false

  async function avanzar(): Promise<void> {
    if (enCurso || pausada) return
    const siguiente = espera.shift()
    if (!siguiente) return
    enCurso = true
    let resultado: R | undefined
    try {
      resultado = await procesar(siguiente.envio)
    } catch {
      // `procesar` muestra sus propios errores: la cola sigue con el siguiente
      resultado = undefined
    } finally {
      enCurso = false
    }
    siguiente.resolver(resultado)
    void avanzar()
  }

  return {
    agregar(envio) {
      if (espera.length >= Math.max(0, maximo)) return null
      return new Promise<R | undefined>((resolver) => {
        espera.push({ envio, resolver })
        void avanzar()
      })
    },
    detener() {
      pausada = true
    },
    reanudar() {
      if (!pausada) return
      pausada = false
      void avanzar()
    },
    vaciar() {
      const quitados = espera.splice(0)
      for (const { resolver } of quitados) resolver(undefined)
      return quitados.map(({ envio }) => envio)
    },
    ocupada: () => enCurso || espera.length > 0,
    enEspera: () => espera.length,
    detenida: () => pausada,
  }
}
