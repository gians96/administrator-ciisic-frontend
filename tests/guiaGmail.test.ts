import { describe, expect, it } from 'vitest'
import {
  NOTA_SEGURIDAD_GMAIL,
  PASOS_GUIA_GMAIL,
  PROBLEMAS_GUIA_GMAIL,
  textoAvanceGuia,
  URL_CONTRASENAS_APLICACION,
  URL_SEGURIDAD_GOOGLE,
} from '~/utils/guiaGmail'

describe('guía de Gmail por SMTP', () => {
  it('tiene los pasos en el orden de la configuración, con título y texto', () => {
    expect(PASOS_GUIA_GMAIL.map((paso) => paso.titulo)).toEqual([
      'Elige la cuenta que enviará los correos',
      'Activa la verificación en dos pasos',
      'Crea la contraseña de aplicación',
      'Agrégala en el panel',
      'Prueba la conexión',
      'Define el orden de uso',
    ])
    for (const paso of PASOS_GUIA_GMAIL) {
      expect(paso.texto.length).toBeGreaterThan(20)
      expect(paso.detalles?.every((detalle) => detalle.trim().length > 0) ?? true).toBe(true)
    }
  })

  it('solo enlaza a las páginas de cuenta de Google, por https', () => {
    const enlaces = PASOS_GUIA_GMAIL.flatMap((paso) => (paso.enlace ? [paso.enlace] : []))
    expect(enlaces.map((enlace) => enlace.url)).toEqual([URL_SEGURIDAD_GOOGLE, URL_CONTRASENAS_APLICACION])
    for (const { url } of enlaces) expect(new URL(url).origin).toBe('https://myaccount.google.com')
  })

  it('explica los errores que traduce el backend (contraseña rechazada y límite diario)', () => {
    const problemas = PROBLEMAS_GUIA_GMAIL.map((p) => p.problema).join(' | ')
    expect(problemas).toContain('Gmail rechazó el usuario o la contraseña de aplicación')
    expect(problemas).toContain('Gmail alcanzó su límite de envíos')
    for (const p of PROBLEMAS_GUIA_GMAIL) expect(p.solucion.length).toBeGreaterThan(20)
  })

  it('no incluye ningún secreto ni contraseña de ejemplo, y avisa que se guarda cifrada', () => {
    const todo = JSON.stringify([PASOS_GUIA_GMAIL, PROBLEMAS_GUIA_GMAIL])
    expect(todo).not.toMatch(/\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b/)
    expect(NOTA_SEGURIDAD_GMAIL).toContain('cifrada')
  })

  it('cuenta el avance sin salirse de 0 a total', () => {
    expect(textoAvanceGuia(2)).toBe('2 de 6 pasos')
    expect(textoAvanceGuia(-1)).toBe('0 de 6 pasos')
    expect(textoAvanceGuia(9)).toBe('6 de 6 pasos')
    expect(textoAvanceGuia(1, 3)).toBe('1 de 3 pasos')
  })
})
