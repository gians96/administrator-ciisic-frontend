import { unzipSync } from 'fflate'

/**
 * ZIP de certificados firmados que se abre en el navegador (fflate) para subir los PDF en tandas
 * (backend-ciisic spec 015: el backend no recibe ZIP). Solo se toman los `.pdf`; se ignoran carpetas,
 * `__MACOSX`, los `._*` de macOS y lo demás. Cada archivo se queda con su nombre base (sin rutas: nada
 * de `../` ni `\`). Se lee el directorio central sin descomprimir nada (`abrirZip`) y los PDF se
 * extraen por tandas (`extraerDelZip`), así no se tienen todos en memoria a la vez. La salida de cada
 * archivo se limita al tamaño que declara el ZIP (fflate no agranda el búfer).
 */

/** Un firmado de más de 10 MB lo rechaza el backend: no se extrae. */
export const MAX_BYTES_ARCHIVO_ZIP = 10 * 1024 * 1024
/** Tope de lo que se puede extraer del ZIP en total (lo que declaran sus entradas). */
export const MAX_BYTES_TOTAL_ZIP = 1024 * 1024 * 1024
/** Entradas como máximo (un ZIP con miles de entradas vacías no cuelga la pantalla). */
export const MAX_ENTRADAS_ZIP = 5000

export type MotivoIgnorada = 'CARPETA' | 'SISTEMA' | 'NO_PDF' | 'NOMBRE_REPETIDO' | 'MUY_GRANDE' | 'EXCEDE_TOTAL' | 'COMPRESION'

export const MENSAJES_IGNORADA: Readonly<Record<MotivoIgnorada, string>> = {
  CARPETA: 'Es una carpeta.',
  SISTEMA: 'Archivo del sistema (macOS u oculto).',
  NO_PDF: 'No es un PDF.',
  NOMBRE_REPETIDO: 'Otro PDF del ZIP tiene el mismo nombre: se toma el primero.',
  MUY_GRANDE: 'Pesa más de 10 MB (el servidor no lo acepta).',
  EXCEDE_TOTAL: 'El ZIP tiene demasiados datos: se dejó de leer aquí.',
  COMPRESION: 'Usa un tipo de compresión que el navegador no puede abrir.',
}

export interface EntradaZip {
  /** Ruta completa dentro del ZIP (la clave para extraerla). */
  ruta: string
  /** Nombre base, sin carpetas: con este nombre se sube. */
  nombre: string
  /** Tamaño descomprimido que declara el ZIP. */
  tamano: number
  /** `null`: se puede extraer y subir. */
  ignorada: MotivoIgnorada | null
}

export interface ZipLeido {
  entradas: EntradaZip[]
  /** Entradas que se pueden extraer (los PDF aceptados). */
  pdfs: EntradaZip[]
  /** Bytes que suman los PDF aceptados. */
  bytesPdf: number
}

export interface OpcionesZip {
  maxBytesArchivo?: number
  maxBytesTotal?: number
  maxEntradas?: number
}

/** Error al abrir el ZIP (dañado, cifrado de forma no soportada, demasiadas entradas…). */
export class ErrorZip extends Error {
  constructor(public readonly codigo: 'ZIP_INVALIDO' | 'ZIP_DEMASIADAS_ENTRADAS', mensaje: string) {
    super(mensaje)
    this.name = 'ErrorZip'
  }
}

/** Nombre base de una ruta del ZIP (separadores `/` y `\`), sin caracteres de control. */
export function nombreBaseZip(ruta: string): string {
  const base = String(ruta ?? '').split(/[\\/]/).pop() ?? ''
  return Array.from(base, (letra) => (letra.charCodeAt(0) < 32 ? '' : letra)).join('').trim()
}

/** Motivo para no tomar una entrada por su ruta (`null` si es un PDF). */
export function motivoPorRuta(ruta: string): MotivoIgnorada | null {
  if (/[\\/]$/.test(ruta)) return 'CARPETA'
  const partes = ruta.split(/[\\/]/)
  const nombre = nombreBaseZip(ruta)
  if (partes.some((parte) => parte === '__MACOSX') || nombre.startsWith('._') || nombre === '.DS_Store') return 'SISTEMA'
  if (!nombre || nombre === '.' || nombre === '..') return 'CARPETA'
  if (!/\.pdf$/i.test(nombre) || nombre.length <= 4) return 'NO_PDF'
  return null
}

function bytesDe(datos: ArrayBuffer | Uint8Array): Uint8Array {
  return datos instanceof Uint8Array ? datos : new Uint8Array(datos)
}

function invalido(error: unknown): ErrorZip {
  if (error instanceof ErrorZip) return error
  return new ErrorZip('ZIP_INVALIDO', 'No se pudo abrir el ZIP: está dañado o no es un ZIP.')
}

/**
 * Lista las entradas del ZIP sin descomprimir nada y decide cuáles se suben: solo PDF, de hasta 10 MB,
 * con nombre base único, mientras la suma no pase de `maxBytesTotal`.
 */
export function abrirZip(datos: ArrayBuffer | Uint8Array, opciones: OpcionesZip = {}): ZipLeido {
  const maxBytesArchivo = opciones.maxBytesArchivo ?? MAX_BYTES_ARCHIVO_ZIP
  const maxBytesTotal = opciones.maxBytesTotal ?? MAX_BYTES_TOTAL_ZIP
  const maxEntradas = opciones.maxEntradas ?? MAX_ENTRADAS_ZIP
  const entradas: EntradaZip[] = []
  const nombres = new Set<string>()
  let bytesPdf = 0
  try {
    unzipSync(bytesDe(datos), {
      filter(archivo) {
        if (entradas.length >= maxEntradas) {
          throw new ErrorZip('ZIP_DEMASIADAS_ENTRADAS', `El ZIP tiene más de ${maxEntradas} archivos: divídelo en partes.`)
        }
        const nombre = nombreBaseZip(archivo.name)
        let ignorada = motivoPorRuta(archivo.name)
        if (!ignorada && archivo.compression !== 0 && archivo.compression !== 8) ignorada = 'COMPRESION'
        if (!ignorada && archivo.originalSize > maxBytesArchivo) ignorada = 'MUY_GRANDE'
        if (!ignorada && nombres.has(nombre.toLowerCase())) ignorada = 'NOMBRE_REPETIDO'
        if (!ignorada && bytesPdf + archivo.originalSize > maxBytesTotal) ignorada = 'EXCEDE_TOTAL'
        if (!ignorada) {
          nombres.add(nombre.toLowerCase())
          bytesPdf += archivo.originalSize
        }
        entradas.push({ ruta: archivo.name, nombre, tamano: archivo.originalSize, ignorada })
        // Nada se descomprime al listar
        return false
      },
    })
  } catch (error) {
    throw invalido(error)
  }
  return { entradas, pdfs: entradas.filter((entrada) => !entrada.ignorada), bytesPdf }
}

/**
 * Descomprime solo las entradas pedidas (por su `ruta`) de un ZIP ya revisado con `abrirZip`. Devuelve
 * los bytes por ruta; cada salida mide como mucho lo que declaró el ZIP.
 */
export function extraerDelZip(datos: ArrayBuffer | Uint8Array, entradas: readonly Pick<EntradaZip, 'ruta' | 'ignorada'>[]): Map<string, Uint8Array> {
  const pedidas = new Set(entradas.filter((entrada) => !entrada.ignorada).map((entrada) => entrada.ruta))
  if (!pedidas.size) return new Map()
  try {
    const archivos = unzipSync(bytesDe(datos), { filter: (archivo) => pedidas.has(archivo.name) })
    return new Map(Object.entries(archivos))
  } catch (error) {
    throw invalido(error)
  }
}
