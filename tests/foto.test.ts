import { describe, expect, it } from 'vitest'
import {
  errorArchivoFoto,
  errorDimensionesFoto,
  errorFotoLista,
  FOTO_LADO_MINIMO_PX,
  FOTO_LADO_PX,
  FOTO_MAX_BYTES,
  FOTO_MAX_BYTES_ORIGINAL,
  FOTO_MAX_LADO_PX,
  formularioFoto,
  mensajeErrorFoto,
  recorteCuadrado,
} from '~/utils/foto'

describe('foto: recorte cuadrado centrado', () => {
  it('foto horizontal: corta los costados por igual y la reduce a 600 px', () => {
    expect(recorteCuadrado(4032, 3024)).toEqual({ x: 504, y: 0, lado: 3024, salida: 600 })
  })

  it('foto vertical: corta arriba y abajo por igual', () => {
    expect(recorteCuadrado(3024, 4032)).toEqual({ x: 0, y: 504, lado: 3024, salida: 600 })
  })

  it('cuadrada: la usa entera', () => {
    expect(recorteCuadrado(1000, 1000)).toEqual({ x: 0, y: 0, lado: 1000, salida: 600 })
    expect(recorteCuadrado(600, 600)).toEqual({ x: 0, y: 0, lado: 600, salida: 600 })
  })

  it('margen impar: el recuadro queda dentro de la imagen', () => {
    const recorte = recorteCuadrado(801, 600)
    expect(recorte).toEqual({ x: 100, y: 0, lado: 600, salida: 600 })
    expect((recorte?.x ?? 0) + (recorte?.lado ?? 0)).toBeLessThanOrEqual(801)
  })

  it('nunca agranda una imagen pequeña', () => {
    expect(recorteCuadrado(400, 300)).toEqual({ x: 50, y: 0, lado: 300, salida: 300 })
    expect(recorteCuadrado(300, 400, 600)?.salida).toBe(300)
  })

  it('otro lado de salida', () => {
    expect(recorteCuadrado(2000, 1000, 250)).toEqual({ x: 500, y: 0, lado: 1000, salida: 250 })
  })

  it('dimensiones inválidas: null', () => {
    expect(recorteCuadrado(0, 600)).toBeNull()
    expect(recorteCuadrado(Number.NaN, 600)).toBeNull()
    expect(recorteCuadrado(800, Number.POSITIVE_INFINITY)).toBeNull()
    expect(recorteCuadrado(800, 600, 0)).toBeNull()
  })

  it('la salida cabe en el tope del backend', () => {
    expect(FOTO_LADO_PX).toBeLessThanOrEqual(FOTO_MAX_LADO_PX)
    expect(FOTO_LADO_MINIMO_PX).toBeLessThanOrEqual(FOTO_LADO_PX)
  })

  it('imagen muy pequeña para el fotocheck', () => {
    expect(errorDimensionesFoto(FOTO_LADO_MINIMO_PX, 900)).toBeNull()
    expect(errorDimensionesFoto(1200, FOTO_LADO_MINIMO_PX - 1)).toMatch(/muy pequeña/)
  })
})

describe('foto: revisiones locales', () => {
  it('el archivo elegido debe ser una imagen razonable', () => {
    expect(errorArchivoFoto({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBeNull()
    expect(errorArchivoFoto({ type: 'image/heic', size: 3 * 1024 * 1024 })).toBeNull()
    expect(errorArchivoFoto({ type: 'application/pdf', size: 1000 })).toMatch(/Elige una imagen/)
    // Sin tipo (galerías de Android): se intenta abrir
    expect(errorArchivoFoto({ type: '', size: 1000 })).toBeNull()
    expect(errorArchivoFoto({ type: 'image/png', size: FOTO_MAX_BYTES_ORIGINAL + 1 })).toMatch(/demasiado pesada/)
  })

  it('la foto lista: JPEG o PNG de hasta 2 MB', () => {
    expect(errorFotoLista({ type: 'image/jpeg', size: FOTO_MAX_BYTES })).toBeNull()
    expect(errorFotoLista({ type: 'image/png', size: 1000 })).toBeNull()
    expect(errorFotoLista({ type: 'image/webp', size: 1000 })).toMatch(/No se pudo preparar/)
    expect(errorFotoLista({ type: 'image/jpeg', size: FOTO_MAX_BYTES + 1 })).toMatch(/más de 2 MB/)
  })
})

describe('foto: subida', () => {
  it('solo dos partes: consentimiento=true y file', () => {
    const formulario = formularioFoto(new Blob(['x'], { type: 'image/jpeg' }))
    expect([...formulario.keys()]).toEqual(['consentimiento', 'file'])
    expect(formulario.get('consentimiento')).toBe('true')
    expect((formulario.get('file') as File).name).toBe('foto.jpg')
  })

  it('mensajes de los errores de la foto', () => {
    expect(mensajeErrorFoto({ status: 413, data: { code: 'UPLOAD_LIMIT_EXCEEDED', message: 'El archivo supera el límite permitido' } })).toMatch(/más de 2 MB/)
    expect(mensajeErrorFoto({ status: 413 })).toMatch(/más de 2 MB/)
    expect(mensajeErrorFoto({ status: 422, data: { code: 'INVALID_FILE_CONTENT', message: 'x' } })).toMatch(/no es una imagen JPG o PNG válida/)
    expect(mensajeErrorFoto({ status: 422, data: { code: 'CONSENT_REQUIRED', message: 'x' } })).toBe('Debes aceptar el uso de tu foto en el fotocheck.')
    expect(mensajeErrorFoto({ status: 422, data: { code: 'IMAGE_TOO_LARGE', message: 'x' } })).toMatch(/4096 × 4096/)
    expect(mensajeErrorFoto({ status: 429, data: { code: 'RATE_LIMITED', message: 'x' } })).toMatch(/muchas veces en la última hora/)
  })
})
