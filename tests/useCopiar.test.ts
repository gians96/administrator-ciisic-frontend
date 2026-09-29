import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCopiar } from '~/composables/useCopiar'

describe('useCopiar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('copia al portapapeles y marca «copiado» durante unos segundos', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copiado, copiar } = useCopiar(1000)

    expect(await copiar('ciisic_AbCdEf123')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('ciisic_AbCdEf123')
    expect(copiado.value).toBe(true)
    vi.advanceTimersByTime(999)
    expect(copiado.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(copiado.value).toBe(false)
  })

  it('reinicia el estado a pedido', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const { copiado, copiar, reiniciar } = useCopiar()
    await copiar('x')
    reiniciar()
    expect(copiado.value).toBe(false)
  })

  it('devuelve false sin portapapeles o si el navegador lo rechaza', async () => {
    vi.stubGlobal('navigator', {})
    expect(await useCopiar().copiar('x')).toBe(false)

    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Permiso denegado')) } })
    const { copiado, copiar } = useCopiar()
    expect(await copiar('x')).toBe(false)
    expect(copiado.value).toBe(false)
  })
})
