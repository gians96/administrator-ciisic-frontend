import { aErrorApi } from '~/utils/errores'

/**
 * Foto del participante para su fotocheck (backend-ciisic spec 014, `PUT /me/photo`): JPG o PNG de
 * hasta 2 MB y 4096 px por lado, con consentimiento (Ley 29733). El panel la recodifica con canvas
 * antes de subirla: la recorta en un cuadrado centrado, la reduce a 600 × 600 px, la guarda como JPEG
 * y así pierde los metadatos (EXIF, GPS y la orientación, que el navegador ya aplicó al dibujarla) que
 * el backend quita. Aquí, los límites, el cálculo del recorte y los textos; el canvas vive en
 * `PortalFotoPerfil`.
 */

/** Tope del backend para el archivo subido. */
export const FOTO_MAX_BYTES = 2 * 1024 * 1024
/** Tope del backend por lado (`422 IMAGE_TOO_LARGE`). */
export const FOTO_MAX_LADO_PX = 4096
/** Lado de la foto recodificada: cuadrada, como la de un carné. */
export const FOTO_LADO_PX = 600
/** Lado mínimo de la imagen elegida: con menos, la cara no se reconoce en el fotocheck. */
export const FOTO_LADO_MINIMO_PX = 200
/** La foto se sube siempre como JPEG (un PNG de una foto pesaría más de 2 MB). */
export const FOTO_TIPO_SALIDA = 'image/jpeg'
export const FOTO_CALIDAD_JPEG = 0.85
/** Tope del archivo elegido antes de recodificarlo (fotos del celular de varios MB). */
export const FOTO_MAX_BYTES_ORIGINAL = 25 * 1024 * 1024
/** Valor de `accept` del selector: cualquier imagen que el navegador sepa abrir (se recodifica a JPEG). */
export const FOTO_ACEPTA = 'image/*'

export const TEXTO_CONSENTIMIENTO_FOTO = 'Acepto que mi foto se use solo para identificarme en el evento: en mi fotocheck, en mi credencial y cuando el equipo registre mi asistencia.'
/** Nota bajo la casilla de consentimiento. */
export const NOTA_CONSENTIMIENTO_FOTO = 'Tratamos tu foto según la Ley 29733 de Protección de Datos Personales. Puedes quitarla cuando quieras.'

/** Recorte de la foto: el cuadrado `lado × lado` de la imagen original que empieza en (`x`, `y`) se dibuja en un lienzo de `salida × salida`. */
export interface RecorteFoto {
  x: number
  y: number
  lado: number
  salida: number
}

/**
 * Cuadrado centrado más grande que cabe en la imagen (el lado menor) y el tamaño del lienzo: `lado`
 * (600 px) o menos si la imagen es más chica (nunca se agranda). Sin dimensiones válidas, `null`.
 */
export function recorteCuadrado(ancho: number, alto: number, lado: number = FOTO_LADO_PX): RecorteFoto | null {
  if (![ancho, alto, lado].every((valor) => Number.isFinite(valor) && valor > 0)) return null
  const corte = Math.min(ancho, alto)
  return {
    x: Math.floor((ancho - corte) / 2),
    y: Math.floor((alto - corte) / 2),
    lado: corte,
    salida: Math.max(1, Math.round(Math.min(lado, corte))),
  }
}

/** La imagen abierta es demasiado pequeña para el fotocheck. */
export function errorDimensionesFoto(ancho: number, alto: number): string | null {
  if (Math.min(ancho, alto) < FOTO_LADO_MINIMO_PX) return `La imagen es muy pequeña: usa una de al menos ${FOTO_LADO_MINIMO_PX} × ${FOTO_LADO_MINIMO_PX} píxeles.`
  return null
}

/**
 * Revisión del archivo elegido, antes de abrirlo: que sea una imagen y no enorme. Sin tipo (algunas
 * galerías de Android no lo informan) se intenta abrir: si no es una imagen, falla al decodificarla.
 */
export function errorArchivoFoto(archivo: { type: string, size: number }): string | null {
  if (archivo.type && !archivo.type.startsWith('image/')) return 'Elige una imagen (JPG o PNG).'
  if (archivo.size > FOTO_MAX_BYTES_ORIGINAL) return 'La imagen es demasiado pesada. Elige otra o tómala con menor resolución.'
  return null
}

/** Revisión de la foto recodificada, antes de subirla (el backend vuelve a validar). */
export function errorFotoLista(foto: { type: string, size: number }): string | null {
  if (foto.type !== 'image/jpeg' && foto.type !== 'image/png') return 'No se pudo preparar la foto. Prueba con otra imagen JPG o PNG.'
  if (foto.size > FOTO_MAX_BYTES) return 'La foto sigue pesando más de 2 MB. Prueba con otra imagen.'
  return null
}

/** Mensaje si el navegador no pudo abrir la imagen (formato que no sabe decodificar, archivo dañado). */
export const MENSAJE_FOTO_ILEGIBLE = 'No se pudo abrir la imagen. Prueba con otra foto en JPG o PNG.'

/**
 * Cuerpo de `PUT /me/photo`: **solo** `consentimiento=true` y `file` (otra parte → `400 UPLOAD_INVALID`).
 */
export function formularioFoto(foto: Blob, nombre: string = 'foto.jpg'): FormData {
  const formulario = new FormData()
  formulario.append('consentimiento', 'true')
  formulario.append('file', foto, nombre)
  return formulario
}

/** Mensajes de la subida de la foto en el contexto del portal. */
const MENSAJES_FOTO: Readonly<Record<string, string>> = {
  FILE_REQUIRED: 'Elige una foto para subir.',
  INVALID_FILE_TYPE: 'Sube la foto en formato JPG o PNG.',
  INVALID_FILE_CONTENT: 'El archivo no es una imagen JPG o PNG válida, o está dañado. Prueba con otra foto.',
  UPLOAD_LIMIT_EXCEEDED: 'La foto pesa más de 2 MB. Prueba con otra imagen.',
  UPLOAD_INVALID: 'No se pudo enviar la foto. Vuelve a intentarlo.',
  RATE_LIMITED: 'Cambiaste tu foto muchas veces en la última hora. Intenta más tarde.',
}

/** Mensaje de un error de `PUT /me/photo` (un 413 sin código también es «más de 2 MB»). */
export function mensajeErrorFoto(error: unknown): string {
  const e = aErrorApi(error)
  if (e.status === 413) return MENSAJES_FOTO.UPLOAD_LIMIT_EXCEEDED as string
  return MENSAJES_FOTO[e.code] ?? e.message
}
