import { describe, expect, it } from 'vitest'
import type { CredencialCorreo } from '~/types/api'
import { cuerpoCredencialCorreo, etiquetaPuertoSmtp, formularioCredencialCorreo, puertoSmtpDe } from '~/utils/credencialesCorreo'

/** Puerto SMTP de Gmail (backend spec 046): 465 (SSL) o 587 (STARTTLS). */
const gmail = (cambios: Partial<CredencialCorreo> = {}): CredencialCorreo => ({
  id: 3, proveedor: 'GMAIL_SMTP', nombre: 'Workspace', apiKeyEnmascarada: '••••mnop', remitenteCorreo: 'congreso@undc.edu.pe', remitenteNombre: null,
  smtpPuerto: 465, esPredeterminada: true, prioridad: 1, activo: true, ultimoEstado: null, ultimoError: null, ultimaPruebaEn: null, ultimoEnvioEn: null,
  eventos: [], creadoEn: '', actualizadoEn: '', ...cambios,
})

describe('puerto SMTP', () => {
  it('normaliza el puerto (465 por defecto)', () => {
    expect(puertoSmtpDe(587)).toBe(587)
    expect(puertoSmtpDe(null)).toBe(465)
    expect(puertoSmtpDe(25)).toBe(465)
  })

  it('al crear una de Gmail envía el puerto; una de Brevo no', () => {
    const form = { ...formularioCredencialCorreo(null, false, 'GMAIL_SMTP'), nombre: 'Gmail', apiKey: 'abcd efgh ijkl mnop', remitenteCorreo: 'a@gmail.com', smtpPuerto: 587 as const }
    expect(cuerpoCredencialCorreo(form)).toMatchObject({ proveedor: 'GMAIL_SMTP', smtpPuerto: 587 })
    const brevo = { ...formularioCredencialCorreo(), nombre: 'Brevo', apiKey: 'xkeysib-1234567890', remitenteCorreo: 'a@undc.edu.pe' }
    expect(cuerpoCredencialCorreo(brevo)).not.toHaveProperty('smtpPuerto')
  })

  it('al editar solo envía el puerto si cambió', () => {
    const original = gmail({ smtpPuerto: 465 })
    const sinCambio = formularioCredencialCorreo(original)
    expect(cuerpoCredencialCorreo(sinCambio, original)).not.toHaveProperty('smtpPuerto')
    expect(cuerpoCredencialCorreo({ ...sinCambio, smtpPuerto: 587 }, original)).toEqual({ smtpPuerto: 587 })
  })

  it('etiqueta de la tarjeta solo para Gmail y con un backend que lo informa', () => {
    expect(etiquetaPuertoSmtp(gmail({ smtpPuerto: 587 }))).toBe('Puerto 587 · STARTTLS')
    expect(etiquetaPuertoSmtp(gmail({ smtpPuerto: undefined }))).toBeNull()
    expect(etiquetaPuertoSmtp({ proveedor: 'BREVO', smtpPuerto: null })).toBeNull()
  })
})
