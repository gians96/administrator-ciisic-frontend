/**
 * Lectura del QR de la credencial en el escáner de asistencia (backend-ciisic spec 014,
 * `contracts/api-asistencia.md`).
 *
 * - QR nuevo (fotocheck y PDF de la 014): el código de la credencial, 10 caracteres `[0-9A-Z]` →
 *   `{ codigo }` en mayúsculas (método `QR`).
 * - QR anterior (credenciales enviadas antes de la 014): el id del participante, solo dígitos (nunca
 *   llega a 10) → `{ participanteId }` (método `QR_LEGADO`; la respuesta puede traer
 *   `alerta: 'QR_LEGADO'`). Es lo único que entiende el backend 013, así que el escáner sigue sirviendo
 *   con él mientras producción no tenga la 014.
 * - Cualquier otra cosa: «QR no válido», sin llamar al backend.
 */

export type LecturaQr = { codigo: string } | { participanteId: number }

const FORMATO_CODIGO = /^[0-9A-Za-z]{10}$/
const FORMATO_ID = /^\d+$/

/** Lo leído sin espacios ni saltos de línea (los lectores de mano suelen agregar `\r\n`). */
export function limpiarLectura(texto: string): string {
  return texto.replace(/\s+/g, '')
}

/**
 * Qué identifica lo leído: `{ codigo }` (10 letras o dígitos, en mayúsculas), `{ participanteId }`
 * (QR anterior: un entero positivo) o `null` («QR no válido»).
 */
export function interpretarLectura(texto: string): LecturaQr | null {
  const limpio = limpiarLectura(texto)
  if (FORMATO_CODIGO.test(limpio)) return { codigo: limpio.toUpperCase() }
  if (FORMATO_ID.test(limpio)) {
    const participanteId = Number(limpio)
    return Number.isSafeInteger(participanteId) && participanteId > 0 ? { participanteId } : null
  }
  return null
}

/** Es el QR anterior (id del participante): el resultado se muestra en ámbar y se verifica el DNI. */
export function esLecturaLegada(lectura: LecturaQr): lectura is { participanteId: number } {
  return 'participanteId' in lectura
}

/** Clave para comparar dos lecturas (`c:K7Q2M9X4TB`, `p:100`). */
export function claveLectura(lectura: LecturaQr): string {
  return 'codigo' in lectura ? `c:${lectura.codigo}` : `p:${lectura.participanteId}`
}

/** Última lectura procesada (la cámara decodifica el mismo QR varias veces por segundo). */
export interface LecturaReciente {
  clave: string
  /** Instante (ms) en que se procesó. */
  instante: number
}

/** Una misma lectura dentro de este intervalo se ignora. */
export const VENTANA_REPETICION_MS = 3000

/**
 * Si hay que procesar `lectura`: sí, salvo que sea la misma que la última procesada hace menos de 3 s.
 * Quien llama guarda `{ clave: claveLectura(lectura), instante: ahora }` cada vez que procesa una.
 */
export function debeProcesar(lectura: LecturaQr, reciente: LecturaReciente | null, ahora: number = Date.now()): boolean {
  if (!reciente || reciente.clave !== claveLectura(lectura)) return true
  return ahora - reciente.instante >= VENTANA_REPETICION_MS
}

/**
 * Tras cerrar el resultado de una lectura: si fue un error (rojo) la misma lectura se vuelve a
 * procesar al escanearla otra vez (p. ej. tras marcar «Fuera de horario» por un `OUTSIDE_WINDOW`); si
 * no, la ventana de 3 s cuenta desde el cierre (la cámara vuelve a ver el mismo QR al continuar).
 */
export function recienteTrasCerrar(reciente: LecturaReciente | null, tono: 'exito' | 'alerta' | 'error', ahora: number = Date.now()): LecturaReciente | null {
  if (!reciente || tono === 'error') return null
  return { clave: reciente.clave, instante: ahora }
}

/**
 * Textos que la cámara acaba de detectar y no estaban en la detección anterior, sin repetir ni vacíos.
 * La librería emite la lista completa cada vez que aparece un QR nuevo (también los que siguen a la
 * vista): así, con dos QR a la vista se procesan los dos y un QR que ya se leyó no se vuelve a enviar.
 */
export function lecturasNuevas(detectados: readonly string[], anteriores: readonly string[]): string[] {
  const vistos = new Set(anteriores)
  const nuevos: string[] = []
  for (const texto of detectados) {
    if (!texto || vistos.has(texto)) continue
    vistos.add(texto)
    nuevos.push(texto)
  }
  return nuevos
}
