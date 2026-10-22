import { describe, expect, it } from 'vitest'
import { ENLACE_NO_VALIDO, RESPALDO_ENLACE, formatoDeDescarga, jsonDeBytes, tokenDeCuerpo } from '../server/utils/enlace-publico'
import { errorPropagado } from '../server/utils/respuestas-auth'

const TOKEN = 'A'.repeat(43)

describe('BFF de los enlaces públicos', () => {
  it('solo acepta tokens con el formato del backend', () => {
    expect(tokenDeCuerpo(TOKEN)).toBe(TOKEN)
    expect(tokenDeCuerpo(`  ${TOKEN}\n`)).toBe(TOKEN)
    for (const invalido of [undefined, null, 123, '', 'corto', `${TOKEN}x`, `${TOKEN.slice(1)}!`, { token: TOKEN }]) expect(tokenDeCuerpo(invalido)).toBeNull()
  })

  it('el formato de descarga es xlsx (por defecto) o pdf', () => {
    expect(formatoDeDescarga(undefined)).toBe('xlsx')
    expect(formatoDeDescarga('PDF')).toBe('pdf')
    expect(formatoDeDescarga(' xlsx ')).toBe('xlsx')
    expect(formatoDeDescarga('csv')).toBeNull()
    expect(formatoDeDescarga(5)).toBeNull()
  })

  it('un enlace no válido responde 404 sin pistas de por qué', () => {
    expect(ENLACE_NO_VALIDO).toMatchObject({ statusCode: 404, data: { code: 'LINK_NOT_FOUND' } })
  })

  it('lee el cuerpo JSON de un error recibido como bytes', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ success: false, code: 'LINK_NOT_FOUND', message: 'No' }))
    expect(jsonDeBytes(bytes.buffer)).toMatchObject({ code: 'LINK_NOT_FOUND' })
    expect(jsonDeBytes(bytes)).toMatchObject({ code: 'LINK_NOT_FOUND' })
    expect(jsonDeBytes(new TextEncoder().encode('<html>').buffer)).toBeNull()
    expect(jsonDeBytes('texto')).toBeNull()
    expect(jsonDeBytes(undefined)).toBeNull()
  })

  it('propaga el código del backend y usa el respaldo si no responde', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ success: false, code: 'LINK_NOT_FOUND', message: 'El enlace no es válido o fue desactivado.' }))
    const propagado = errorPropagado({ status: 404, data: jsonDeBytes(bytes.buffer) }, RESPALDO_ENLACE)
    expect(propagado).toMatchObject({ statusCode: 404, data: { code: 'LINK_NOT_FOUND' } })
    const limitado = errorPropagado({ status: 429, data: null, response: { headers: new Headers({ 'retry-after': '30' }) } }, RESPALDO_ENLACE)
    expect(limitado).toMatchObject({ statusCode: 429, data: { code: 'RATE_LIMITED' }, reintentarEnSegundos: 30 })
    expect(errorPropagado(undefined, RESPALDO_ENLACE)).toMatchObject({ statusCode: 503, data: { code: 'LINK_UNAVAILABLE' } })
  })
})
