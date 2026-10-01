import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs'
// Vite copia el worker a `/_nuxt/` con un nombre versionado (caché inmutable): nada de CDN
import urlWorkerPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

export type ModuloPdfJs = typeof PdfJs

let modulo: Promise<ModuloPdfJs> | null = null

/**
 * pdf.js para el editor visual de plantillas de certificado (ver el diseño y ubicar los campos). Se carga
 * solo cuando se usa (~0,5 MB + el worker de ~1,3 MB) y una sola vez por página. Se usa la compilación
 * `legacy`: la normal llama a métodos recientes (`Map.prototype.getOrInsertComputed`) que aún faltan en
 * navegadores de uso común. El worker lo sirve el panel (`GlobalWorkerOptions.workerSrc`).
 */
export function cargarPdfJs(): Promise<ModuloPdfJs> {
  modulo ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = urlWorkerPdf
    return pdfjs
  }).catch((error: unknown) => {
    // Un fallo de red al cargar el módulo no queda guardado: se puede reintentar
    modulo = null
    throw error
  })
  return modulo
}

/** Composable del visor: `abrir` lee un PDF (los bytes del diseño de `GET /certificate-templates/:id/design`). */
export function usePdfJs() {
  /**
   * Documento de pdf.js a partir de los bytes (se copian: pdf.js los transfiere al worker). Sin XFA ni
   * scripts; las fuentes estándar que no vengan incrustadas se dibujan con las del sistema.
   */
  async function abrir(datos: ArrayBuffer | Uint8Array): Promise<PdfJs.PDFDocumentProxy> {
    const pdfjs = await cargarPdfJs()
    const copia = datos instanceof Uint8Array ? datos.slice() : new Uint8Array(datos.slice(0))
    return pdfjs.getDocument({ data: copia, enableXfa: false }).promise
  }

  return { cargar: cargarPdfJs, abrir }
}
