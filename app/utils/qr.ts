import type { Banco, Billetera, DatosPago } from '~/types/api'

export const QR_MAX_BYTES = 2 * 1024 * 1024
const QR_TIPOS = ['image/png', 'image/jpeg', 'image/webp']
/** Valor de `accept` del selector de archivos. */
export const QR_ACEPTA = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp'

/** Revisión local antes de subir (el backend vuelve a validar tipo, contenido y tamaño). */
export function errorImagenQr(archivo: { type: string, size: number }): string | null {
  if (!QR_TIPOS.includes(archivo.type)) return 'Sube una imagen PNG, JPG o WebP.'
  if (archivo.size > QR_MAX_BYTES) return 'La imagen supera los 2 MB.'
  return null
}

/** Ruta de la API administrativa con la imagen subida (para la vista previa). */
export function rutaQr(archivo: string): string {
  return `payment-qr/${encodeURIComponent(archivo)}`
}

/** Solo una URL absoluta se puede previsualizar aquí; una ruta como `/images/…` es de la landing. */
export function urlQrExterna(url?: string | null): string | null {
  const valor = url?.trim() ?? ''
  return /^https?:\/\/\S+$/i.test(valor) ? valor : null
}

const texto = (valor?: string | null) => valor?.trim() ?? ''

/**
 * Datos de pago listos para guardar. Las filas vacías se descartan; las incompletas no se
 * descartan en silencio (se perdería, por ejemplo, un QR ya subido): devuelven un error.
 */
export function prepararDatosPago(titular: string, bancos: Banco[], billeteras: Billetera[]): { datos: DatosPago, errores: string[] } {
  const errores: string[] = []
  const bancosListos: Banco[] = []
  bancos.forEach((banco, indice) => {
    const campos = [banco.codigo, banco.nombre, banco.numeroCuenta, banco.cci]
    if (campos.every((campo) => !texto(campo))) return
    if (!texto(banco.codigo) || !texto(banco.nombre) || !texto(banco.numeroCuenta)) {
      errores.push(`Cuenta ${indice + 1}: completa el código, el banco y el N° de cuenta (o quítala).`)
      return
    }
    bancosListos.push({ codigo: texto(banco.codigo).toLowerCase(), nombre: texto(banco.nombre), numeroCuenta: texto(banco.numeroCuenta), cci: texto(banco.cci) || null })
  })
  const billeterasListas: Billetera[] = []
  billeteras.forEach((billetera, indice) => {
    const campos = [billetera.codigo, billetera.nombre, billetera.telefono, billetera.qrUrl, billetera.qrArchivo]
    if (campos.every((campo) => !texto(campo))) return
    if (!texto(billetera.codigo) || !texto(billetera.nombre) || !texto(billetera.telefono)) {
      errores.push(`Billetera ${indice + 1}: completa el código, el nombre y el teléfono (o quítala).`)
      return
    }
    const qrArchivo = texto(billetera.qrArchivo) || null
    billeterasListas.push({
      codigo: texto(billetera.codigo).toLowerCase(),
      nombre: texto(billetera.nombre),
      telefono: texto(billetera.telefono),
      // La imagen subida reemplaza a la URL
      qrArchivo,
      qrUrl: qrArchivo ? null : texto(billetera.qrUrl) || null,
    })
  })
  return { datos: { titular: texto(titular) || null, bancos: bancosListos, billeteras: billeterasListas }, errores }
}
