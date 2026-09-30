import { describe, expect, it } from 'vitest'
import { errorImagenQr, prepararDatosPago, QR_MAX_BYTES, rutaQr, urlQrExterna } from '../app/utils/qr'

const archivo = 'qr-0b6d4c9e-2f7a-4c1e-9d3b-5a8f6e7c1d2e.png'

describe('errorImagenQr', () => {
  it('acepta PNG, JPG y WebP de hasta 2 MB', () => {
    expect(errorImagenQr({ type: 'image/png', size: 1000 })).toBeNull()
    expect(errorImagenQr({ type: 'image/jpeg', size: QR_MAX_BYTES })).toBeNull()
    expect(errorImagenQr({ type: 'image/webp', size: 1 })).toBeNull()
  })

  it('rechaza otros formatos y archivos grandes', () => {
    expect(errorImagenQr({ type: 'application/pdf', size: 1000 })).toMatch(/PNG, JPG o WebP/)
    expect(errorImagenQr({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPG o WebP/)
    expect(errorImagenQr({ type: 'image/png', size: QR_MAX_BYTES + 1 })).toMatch(/2 MB/)
  })
})

describe('vista previa', () => {
  it('la imagen subida se pide a la API administrativa', () => {
    expect(rutaQr(archivo)).toBe(`payment-qr/${archivo}`)
  })

  it('solo se previsualizan URL absolutas (una ruta /images/… es de la landing)', () => {
    expect(urlQrExterna('https://cdn.example.com/yape.png')).toBe('https://cdn.example.com/yape.png')
    expect(urlQrExterna('/images/qr/yape-2026.png')).toBeNull()
    expect(urlQrExterna('javascript:alert(1)')).toBeNull()
    expect(urlQrExterna(null)).toBeNull()
  })
})

describe('prepararDatosPago', () => {
  const yape = { codigo: ' YAPE ', nombre: 'Yape', telefono: ' 999 888 777 ', qrUrl: null, qrArchivo: archivo }

  it('normaliza y conserva la imagen subida', () => {
    const { datos, errores } = prepararDatosPago(' UNDC ', [], [yape])
    expect(errores).toEqual([])
    expect(datos).toEqual({ titular: 'UNDC', bancos: [], billeteras: [{ codigo: 'yape', nombre: 'Yape', telefono: '999 888 777', qrArchivo: archivo, qrUrl: null }] })
  })

  it('la imagen subida reemplaza a la URL anterior', () => {
    const { datos } = prepararDatosPago('', [], [{ ...yape, qrUrl: '/images/qr/yape-2026.png' }])
    expect(datos.billeteras?.[0]).toMatchObject({ qrArchivo: archivo, qrUrl: null })
    expect(prepararDatosPago('', [], [{ ...yape, qrArchivo: null, qrUrl: ' /images/qr/yape-2026.png ' }]).datos.billeteras?.[0].qrUrl).toBe('/images/qr/yape-2026.png')
  })

  it('descarta filas vacías', () => {
    const { datos, errores } = prepararDatosPago('', [{ codigo: '', nombre: '', numeroCuenta: '', cci: '' }], [{ codigo: '', nombre: '', telefono: '', qrUrl: null, qrArchivo: null }])
    expect(errores).toEqual([])
    expect(datos).toEqual({ titular: null, bancos: [], billeteras: [] })
  })

  it('no descarta en silencio una billetera incompleta con su QR subido', () => {
    const { errores } = prepararDatosPago('', [], [{ codigo: '', nombre: '', telefono: '', qrUrl: null, qrArchivo: archivo }])
    expect(errores).toEqual(['Billetera 1: completa el código, el nombre y el teléfono (o quítala).'])
  })

  it('avisa de cuentas bancarias incompletas', () => {
    const { datos, errores } = prepararDatosPago('', [{ codigo: 'bcp', nombre: 'BCP', numeroCuenta: '', cci: '002' }, { codigo: 'BBVA', nombre: 'BBVA', numeroCuenta: '0011', cci: '' }], [])
    expect(errores).toEqual(['Cuenta 1: completa el código, el banco y el N° de cuenta (o quítala).'])
    expect(datos.bancos).toEqual([{ codigo: 'bbva', nombre: 'BBVA', numeroCuenta: '0011', cci: null }])
  })
})
