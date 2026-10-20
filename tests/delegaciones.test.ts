import { describe, expect, it } from 'vitest'
import {
  enlaceInscripcionDelegacion,
  montoDelegacion,
  parsearParticipantesDelegacion,
  precioUnitarioDelegacion,
} from '~/utils/delegaciones'

describe('tarifa de la delegación', () => {
  it.each([
    [0, 60], [1, 60], [9, 60], [10, 50], [11, 50], [25, 50],
  ])('con %i integrantes cobra %i por persona', (total, esperado) => {
    expect(precioUnitarioDelegacion(60, 50, 10, total)).toBe(esperado)
  })

  it('calcula el total con la tarifa vigente', () => {
    expect(montoDelegacion(60, 9)).toBe(540)
    expect(montoDelegacion(50, 10)).toBe(500)
    expect(montoDelegacion(50, 13)).toBe(650)
  })
})

describe('carga masiva', () => {
  it('lee cinco columnas y normaliza el correo', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana, Pérez, Ana@Example.com, 987654321')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas).toEqual([{
      tipoDocumento: 'dni', numeroDocumento: '70123456', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com', celular: '987654321',
    }])
  })

  it('acepta tres columnas con el nombre completo y separa la última palabra como apellido', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana María Pérez, ana@example.com')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas[0]).toMatchObject({ nombres: 'Ana María', apellidos: 'Pérez', correo: 'ana@example.com', celular: '' })
  })

  it('ignora la cabecera, las líneas vacías y acepta punto y coma o tabulador', () => {
    const resultado = parsearParticipantesDelegacion('DNI;Nombres;Apellidos;Correo;Celular\n\n70123456;Ana;Pérez;ana@example.com;987654321\n')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas).toHaveLength(1)
    expect(parsearParticipantesDelegacion('70123456\tAna\tPérez\tana@example.com').filas).toHaveLength(1)
  })

  it('señala las filas incompletas con su número de línea', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana, ana@example.com\n70123457, Luis, Gómez, correo-invalido')
    expect(resultado.filas).toHaveLength(0)
    expect(resultado.errores).toEqual(expect.arrayContaining([
      expect.stringContaining('Línea 1: faltan los apellidos'),
      expect.stringContaining('Línea 2: el correo'),
    ]))
  })

  it('un documento que no tiene 8 dígitos se envía como carné de extranjería', () => {
    expect(parsearParticipantesDelegacion('CE1234567, Ana, Pérez, ana@example.com').filas[0].tipoDocumento).toBe('ce')
  })
})

describe('link público', () => {
  it('lleva el código al formulario de la landing', () => {
    expect(enlaceInscripcionDelegacion('abc123', 'https://ciisic.example/')).toBe('https://ciisic.example/delegaciones?delegacion=abc123')
  })

  it('escapa el código en la URL', () => {
    expect(enlaceInscripcionDelegacion('a b&c', 'https://ciisic.example')).toBe('https://ciisic.example/delegaciones?delegacion=a%20b%26c')
  })
})
