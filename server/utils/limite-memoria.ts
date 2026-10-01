/**
 * Límite de solicitudes por clave (la IP del visitante) en la memoria del proceso, con ventana fija.
 * Lo usa el BFF de la verificación pública de certificados (20 por minuto por IP) antes de llamar al
 * backend, que aplica además su propio límite (30/min por IP) y un tope global. Una sola réplica del
 * panel (como hoy): con varias, cada una contaría por su lado.
 */

export interface OpcionesLimitador {
  /** Solicitudes permitidas por ventana y clave. */
  maximo: number
  /** Duración de la ventana en milisegundos. */
  ventanaMs: number
  /** Claves recordadas como máximo (al pasarse se olvidan las vencidas y luego las más antiguas). */
  maxClaves?: number
}

export interface TurnoLimitador {
  permitido: boolean
  /** Segundos hasta que se renueva la ventana de la clave (para `Retry-After`). */
  reintentarEnSegundos: number
  restantes: number
}

export interface Limitador {
  consumir: (clave: string, ahora?: number) => TurnoLimitador
  /** Claves recordadas (pruebas y diagnóstico). */
  tamano: () => number
}

interface Ventana {
  inicio: number
  cuenta: number
}

export function crearLimitador(opciones: OpcionesLimitador): Limitador {
  const maximo = Math.max(1, Math.floor(opciones.maximo))
  const ventanaMs = Math.max(1, opciones.ventanaMs)
  const maxClaves = Math.max(1, Math.floor(opciones.maxClaves ?? 10_000))
  const ventanas = new Map<string, Ventana>()

  function podar(ahora: number) {
    for (const [clave, ventana] of ventanas) {
      if (ahora - ventana.inicio >= ventanaMs) ventanas.delete(clave)
    }
    // Siguen demasiadas (muchas IP a la vez): se olvidan las más antiguas (orden de inserción)
    for (const clave of ventanas.keys()) {
      if (ventanas.size < maxClaves) break
      ventanas.delete(clave)
    }
  }

  function consumir(clave: string, ahora: number = Date.now()): TurnoLimitador {
    let ventana = ventanas.get(clave)
    if (!ventana || ahora - ventana.inicio >= ventanaMs) {
      if (ventana) ventanas.delete(clave)
      else if (ventanas.size >= maxClaves) podar(ahora)
      ventana = { inicio: ahora, cuenta: 0 }
      ventanas.set(clave, ventana)
    }
    const reintentarEnSegundos = Math.max(1, Math.ceil((ventana.inicio + ventanaMs - ahora) / 1000))
    if (ventana.cuenta >= maximo) return { permitido: false, reintentarEnSegundos, restantes: 0 }
    ventana.cuenta++
    return { permitido: true, reintentarEnSegundos, restantes: maximo - ventana.cuenta }
  }

  return { consumir, tamano: () => ventanas.size }
}
