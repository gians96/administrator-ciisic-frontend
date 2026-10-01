import { setZXingModuleOverrides } from 'vue-qrcode-reader'
import { ubicarArchivoZxing } from '~/utils/asistencia'

let configurado = false

/**
 * Apunta ZXing (decodifica el QR en `vue-qrcode-reader`) al wasm que sirve el panel
 * (`public/zxing-wasm/`), nunca a un CDN. Se aplica **una sola vez** por carga de la página: la librería
 * descarta el módulo ya compilado cada vez que recibe overrides, y volver a descargar y compilar el wasm
 * (~1 MB) en cada montaje de la cámara (otra actividad, «Reintentar», volver a «Cámara») la deja
 * segundos sin leer con el wifi del evento. `LectorCamara` lo llama antes de montar `QrcodeStream`.
 */
export function usarZxingDelPanel(): void {
  if (configurado) return
  setZXingModuleOverrides({ locateFile: ubicarArchivoZxing })
  configurado = true
}
