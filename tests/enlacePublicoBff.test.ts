import { describe, expect, it } from 'vitest'
import {
  DOCENTE_NO_ENCONTRADO,
  ENLACE_NO_VALIDO,
  RESPALDO_ENLACE,
  RUTA_BACKEND,
  credencialDeCuerpo,
  documentoDeCuerpo,
  formatoDeDescarga,
  jsonDeBytes,
  peticionAlBackend,
  tipoDeCuerpo,
  tokenDeCuerpo,
} from '../server/utils/enlace-publico'
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

  it('la vista es la del docente por defecto o la del ciclo, y cada una va a su ruta del backend', () => {
    expect(tipoDeCuerpo(undefined)).toBe('asesor')
    expect(tipoDeCuerpo('asesor')).toBe('asesor')
    expect(tipoDeCuerpo('ciclo')).toBe('ciclo')
    for (const invalido of [null, '', 'Ciclo', 'cycle', 'advisor', 7, ['ciclo'], { tipo: 'ciclo' }]) expect(tipoDeCuerpo(invalido)).toBeNull()
    expect(RUTA_BACKEND).toEqual({ asesor: 'public/advisor', ciclo: 'public/cycle' })
  })

  it('el DNI es de 7 u 8 dígitos, como texto o número; lo demás no es un DNI', () => {
    expect(documentoDeCuerpo('12345678')).toBe('12345678')
    expect(documentoDeCuerpo(' 1234 5678 ')).toBe('12345678')
    expect(documentoDeCuerpo(2442123)).toBe('2442123')
    for (const invalido of [undefined, null, '', '123', '123456789', '1234567a', '12-345678', ['12345678'], { documento: '12345678' }, true]) expect(documentoDeCuerpo(invalido)).toBeNull()
  })

  it('la vista del DNI es otro tipo, con su propio error y sin pistas de por qué', () => {
    expect(tipoDeCuerpo('documento')).toBe('documento')
    expect(DOCENTE_NO_ENCONTRADO).toMatchObject({ statusCode: 404, data: { code: 'ADVISOR_DOCUMENT_NOT_FOUND' } })
  })

  it('lee la credencial del cuerpo según el tipo', () => {
    expect(credencialDeCuerpo({ token: TOKEN })).toEqual({ credencial: { tipo: 'asesor', token: TOKEN } })
    expect(credencialDeCuerpo({ token: TOKEN, tipo: 'ciclo' })).toEqual({ credencial: { tipo: 'ciclo', token: TOKEN } })
    expect(credencialDeCuerpo({ tipo: 'documento', documento: '12345678' })).toEqual({ credencial: { tipo: 'documento', documento: '12345678' } })
    // El token no sirve para entrar por DNI ni el DNI para un enlace
    expect(credencialDeCuerpo({ tipo: 'documento', token: TOKEN })).toEqual({ error: DOCENTE_NO_ENCONTRADO })
    expect(credencialDeCuerpo({ tipo: 'ciclo', documento: '12345678' })).toEqual({ error: ENLACE_NO_VALIDO })
    expect(credencialDeCuerpo({ token: 'corto' })).toEqual({ error: ENLACE_NO_VALIDO })
    expect(credencialDeCuerpo({ tipo: 'documento', documento: 'abc' })).toEqual({ error: DOCENTE_NO_ENCONTRADO })
    expect(credencialDeCuerpo(null)).toEqual({ error: ENLACE_NO_VALIDO })
    const mala = credencialDeCuerpo({ token: TOKEN, tipo: 'otro' })
    expect('error' in mala && mala.error.statusCode).toBe(422)
  })

  it('pide al backend con el token en el encabezado o con el DNI en el cuerpo, nunca en la URL', () => {
    const token = peticionAlBackend({ tipo: 'ciclo', token: TOKEN }, '10.0.0.7')
    expect(token).toEqual({ ruta: 'public/cycle', opciones: { method: 'GET', headers: { 'x-forwarded-for': '10.0.0.7', 'x-link-token': TOKEN } } })
    expect(peticionAlBackend({ tipo: 'asesor', token: TOKEN }, null, 'pdf').ruta).toBe('public/advisor/export?formato=pdf')

    const dni = peticionAlBackend({ tipo: 'documento', documento: '12345678' }, '10.0.0.7')
    expect(dni).toEqual({ ruta: 'public/advisor/lookup', opciones: { method: 'POST', headers: { 'x-forwarded-for': '10.0.0.7' }, body: { documento: '12345678' } } })
    const descarga = peticionAlBackend({ tipo: 'documento', documento: '12345678' }, null, 'xlsx')
    expect(descarga.ruta).toBe('public/advisor/lookup/export')
    expect(descarga.opciones.body).toEqual({ documento: '12345678', formato: 'xlsx' })
    for (const p of [dni, descarga]) expect(p.ruta).not.toContain('12345678')
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
