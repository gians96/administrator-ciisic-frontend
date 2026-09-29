import { describe, expect, it } from 'vitest'
import type { TokenAcceso } from '~/types/api'
import {
  calcularExpiracionToken,
  cuerpoTokenAcceso,
  errorExpiracionToken,
  estadoEfectivoTokenAcceso,
  hoyEnLima,
  mensajeRevocarToken,
  ordenarTokensAcceso,
  prefijoVisibleToken,
  validarTokenAcceso,
  venceProntoTokenAcceso,
} from '~/utils/tokensAcceso'

// 29 de septiembre de 2026, 10:00 en Lima (15:00 UTC)
const AHORA = new Date('2026-09-29T15:00:00.000Z')

function token(datos: Partial<TokenAcceso> = {}): TokenAcceso {
  return {
    id: 1,
    eventoId: 3,
    nombre: 'Landing producción',
    prefijo: 'ciisic_AbCd',
    estado: 'ACTIVO',
    ultimoUsoEn: null,
    expiraEn: null,
    revocadoEn: null,
    creadoPor: { id: 1, nombres: 'Ana', apellidos: 'Quispe' },
    creadoEn: '2026-09-01T10:00:00.000Z',
    ...datos,
  }
}

describe('tokens de acceso: estado y presentación', () => {
  it('muestra como expirado un token activo cuya fecha ya pasó', () => {
    expect(estadoEfectivoTokenAcceso(token({ expiraEn: '2026-09-29T14:59:59.000Z' }), AHORA)).toBe('EXPIRADO')
    expect(estadoEfectivoTokenAcceso(token({ expiraEn: '2026-10-29T00:00:00.000Z' }), AHORA)).toBe('ACTIVO')
    expect(estadoEfectivoTokenAcceso(token(), AHORA)).toBe('ACTIVO')
    expect(estadoEfectivoTokenAcceso(token({ estado: 'REVOCADO', expiraEn: '2020-01-01T00:00:00.000Z' }), AHORA)).toBe('REVOCADO')
  })

  it('avisa cuando un token activo vence en menos de 7 días', () => {
    expect(venceProntoTokenAcceso(token({ expiraEn: '2026-10-03T15:00:00.000Z' }), AHORA)).toBe(true)
    expect(venceProntoTokenAcceso(token({ expiraEn: '2026-10-10T15:00:00.000Z' }), AHORA)).toBe(false)
    expect(venceProntoTokenAcceso(token({ expiraEn: '2026-09-28T15:00:00.000Z' }), AHORA)).toBe(false)
    expect(venceProntoTokenAcceso(token({ estado: 'REVOCADO', expiraEn: '2026-10-01T15:00:00.000Z' }), AHORA)).toBe(false)
    expect(venceProntoTokenAcceso(token(), AHORA)).toBe(false)
  })

  it('muestra el prefijo con puntos suspensivos', () => {
    expect(prefijoVisibleToken('ciisic_AbCd')).toBe('ciisic_AbCd…')
    expect(prefijoVisibleToken('ciisic_AbCd…')).toBe('ciisic_AbCd…')
    expect(prefijoVisibleToken('ciisic_AbCd...')).toBe('ciisic_AbCd...')
    expect(prefijoVisibleToken('')).toBe('—')
    expect(prefijoVisibleToken(null)).toBe('—')
  })

  it('ordena activos primero y luego por fecha de creación', () => {
    const lista = [
      token({ id: 1, estado: 'REVOCADO', creadoEn: '2026-09-20T00:00:00.000Z' }),
      token({ id: 2, creadoEn: '2026-09-10T00:00:00.000Z' }),
      token({ id: 3, creadoEn: '2026-09-25T00:00:00.000Z', expiraEn: '2026-09-26T00:00:00.000Z' }),
      token({ id: 4, creadoEn: '2026-09-15T00:00:00.000Z' }),
    ]
    expect(ordenarTokensAcceso(lista, AHORA).map((t) => t.id)).toEqual([4, 2, 3, 1])
  })

  it('confirma la revocación con el nombre y el prefijo', () => {
    expect(mensajeRevocarToken(token())).toContain('«Landing producción» (ciisic_AbCd…)')
  })
})

describe('tokens de acceso: expiración', () => {
  it('calcula la fecha de hoy en Lima', () => {
    expect(hoyEnLima(AHORA)).toBe('2026-09-29')
    // 02:00 UTC del 30 todavía es 29 en Lima
    expect(hoyEnLima(new Date('2026-09-30T02:00:00.000Z'))).toBe('2026-09-29')
  })

  it('sin expiración, por días o al final del día elegido en Lima', () => {
    expect(calcularExpiracionToken('nunca', '', AHORA)).toBeNull()
    expect(calcularExpiracionToken('30', '', AHORA)).toBe('2026-10-29T15:00:00.000Z')
    expect(calcularExpiracionToken('365', '', AHORA)).toBe('2027-09-29T15:00:00.000Z')
    expect(calcularExpiracionToken('fecha', '2026-12-31', AHORA)).toBe('2027-01-01T04:59:59.999Z')
  })

  it('rechaza fechas vacías, imposibles o pasadas', () => {
    expect(calcularExpiracionToken('fecha', '2026-02-31', AHORA)).toBeNull()
    expect(calcularExpiracionToken('fecha', '2026-13-01', AHORA)).toBeNull()
    expect(errorExpiracionToken('fecha', '', AHORA)).toBe('Elige la fecha de expiración.')
    expect(errorExpiracionToken('fecha', '31/12/2026', AHORA)).toBe('La fecha no es válida.')
    expect(errorExpiracionToken('fecha', '2026-09-28', AHORA)).toBe('La fecha debe ser hoy o posterior.')
    expect(errorExpiracionToken('fecha', '2026-09-29', AHORA)).toBeNull()
    expect(errorExpiracionToken('90', '', AHORA)).toBeNull()
  })

  it('valida el formulario y arma el cuerpo del alta', () => {
    expect(validarTokenAcceso({ nombre: ' ', expiracion: 'fecha', fecha: '' }, AHORA)).toEqual({
      nombre: 'Ingresa un nombre para reconocer el token (p. ej. Landing producción).',
      expiraEn: 'Elige la fecha de expiración.',
    })
    expect(validarTokenAcceso({ nombre: 'Landing', expiracion: 'nunca', fecha: '' }, AHORA)).toEqual({})
    expect(validarTokenAcceso({ nombre: ' L ', expiracion: 'nunca', fecha: '' }, AHORA)).toEqual({ nombre: 'El nombre debe tener al menos 2 caracteres.' })
    expect(cuerpoTokenAcceso({ nombre: ' Landing ', expiracion: 'nunca', fecha: '2026-12-31' }, AHORA)).toEqual({ nombre: 'Landing', expiraEn: null })
    expect(cuerpoTokenAcceso({ nombre: 'Landing', expiracion: '90', fecha: '' }, AHORA)).toEqual({ nombre: 'Landing', expiraEn: '2026-12-28T15:00:00.000Z' })
  })
})
