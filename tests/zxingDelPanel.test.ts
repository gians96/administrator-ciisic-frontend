import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { setZXingModuleOverrides } from 'vue-qrcode-reader'
import { RUTA_WASM_ZXING } from '~/utils/asistencia'
import { usarZxingDelPanel } from '~/utils/zxingDelPanel'

vi.mock('vue-qrcode-reader', () => ({ setZXingModuleOverrides: vi.fn() }))

describe('escáner: wasm de ZXing', () => {
  it('apunta ZXing al wasm del panel (no a un CDN) y una sola vez, aunque la cámara se monte varias veces', () => {
    usarZxingDelPanel()
    usarZxingDelPanel()
    usarZxingDelPanel()
    const configurar = vi.mocked(setZXingModuleOverrides)
    // La librería descarta el módulo ya compilado con cada llamada: volvería a bajar ~1 MB
    expect(configurar).toHaveBeenCalledTimes(1)
    const { locateFile } = configurar.mock.calls[0]?.[0] as { locateFile: (ruta: string, prefijo: string) => string }
    expect(locateFile('zxing_reader.wasm', 'https://fastly.jsdelivr.net/npm/zxing-wasm@1.1.3/dist/reader/')).toBe(RUTA_WASM_ZXING)
  })

  it('la cámara del escáner usa esa configuración y no llama a la librería por su cuenta', () => {
    const fuente = readFileSync(fileURLToPath(new URL('../app/components/asistencia/LectorCamara.vue', import.meta.url)), 'utf8')
    expect(fuente).toMatch(/import \{ usarZxingDelPanel \} from '~\/utils\/zxingDelPanel'/)
    expect(fuente).toMatch(/^usarZxingDelPanel\(\)$/m)
    expect(fuente).not.toMatch(/setZXingModuleOverrides/)
  })
})
