/**
 * Descarga de archivos por el BFF con `$fetch(..., { responseType: 'blob' })` (la credencial PDF del
 * portal): así un error (`503 PDF_BUSY`, la sesión vencida, `409 NOT_APPROVED`…) se muestra con su
 * mensaje en lugar de dejar a la persona en una página con el JSON del backend.
 */

/** Caracteres que no van en un nombre de archivo (rutas y reservados de Windows); también los de control. */
const NO_PERMITIDOS = '\\/:*?"<>|'

function limpiarNombre(nombre: string): string {
  return Array.from(nombre, (caracter) => (caracter.charCodeAt(0) < 32 || NO_PERMITIDOS.includes(caracter) ? '_' : caracter)).join('').trim()
}

/**
 * Nombre del archivo según `Content-Disposition` (`filename*=UTF-8''…` tiene prioridad sobre
 * `filename="…"`), sin rutas ni caracteres inválidos; si no hay uno, `respaldo`.
 */
export function nombreDeArchivo(contentDisposition: string | null | undefined, respaldo: string): string {
  const texto = contentDisposition ?? ''
  const extendido = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(texto)?.[1]
  if (extendido) {
    try {
      const nombre = limpiarNombre(decodeURIComponent(extendido.trim()))
      if (nombre) return nombre
    } catch {
      // Codificación inválida: se prueba con `filename`
    }
  }
  const simple = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/.exec(texto)
  const nombre = limpiarNombre(simple?.[1] ?? simple?.[2] ?? '')
  return nombre || respaldo
}

/** Espera antes de reintentar solo la credencial cuando el backend está ocupado (`503 PDF_BUSY`). */
export const ESPERA_PDF_OCUPADO_MS = 3000

/**
 * Tras un error al descargar la credencial: `PDF_BUSY` (cola de PDF llena, se libera en segundos) se
 * reintenta solo una vez tras 3 s; cualquier otro error, o un segundo `PDF_BUSY`, se muestra (`null`).
 */
export function esperaParaReintentarDescarga(codigo: string, intento: number): number | null {
  return codigo === 'PDF_BUSY' && intento === 0 ? ESPERA_PDF_OCUPADO_MS : null
}

/**
 * Con `responseType: 'blob'` el cuerpo de una respuesta de error también llega como `Blob` y
 * `aErrorApi` no ve su `code`. Si el error de `$fetch` trae un `Blob` con JSON, lo deja como objeto
 * (en `response._data`, de donde lee `error.data`). Otro contenido se deja como está.
 */
export async function leerCuerpoDeError(error: unknown): Promise<void> {
  const respuesta = (error && typeof error === 'object' ? (error as { response?: unknown }).response : undefined) as { _data?: unknown } | undefined
  if (!respuesta || typeof Blob === 'undefined' || !(respuesta._data instanceof Blob)) return
  try {
    respuesta._data = JSON.parse(await respuesta._data.text())
  } catch {
    // No era JSON (p. ej. una página de error del proxy): `aErrorApi` usa el estado
  }
}
