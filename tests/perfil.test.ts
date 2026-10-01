import { describe, expect, it } from 'vitest'
import { iniciales, nombreCorto } from '~/utils/perfil'

describe('iniciales', () => {
  it('toma la primera letra del primer nombre y del primer apellido', () => {
    expect(iniciales('Gianmarcos Daniel', 'Arias Pérez')).toBe('GA')
  })

  it('tolera espacios extra y minúsculas con tilde', () => {
    expect(iniciales('  ángel  ', '  ñique  rojas ')).toBe('ÁÑ')
  })

  it('usa lo que haya si falta uno de los dos', () => {
    expect(iniciales('Rosa', '')).toBe('R')
    expect(iniciales(null, 'Quispe')).toBe('Q')
  })

  it('sin datos devuelve «?»', () => {
    expect(iniciales('', '   ')).toBe('?')
    expect(iniciales(undefined, null)).toBe('?')
  })
})

describe('nombreCorto', () => {
  it('une el primer nombre y el primer apellido', () => {
    expect(nombreCorto('Gianmarcos Daniel', 'Arias Pérez')).toBe('Gianmarcos Arias')
  })

  it('tolera espacios extra y datos incompletos', () => {
    expect(nombreCorto('  Rosa   María ', '')).toBe('Rosa')
    expect(nombreCorto(null, ' Quispe ')).toBe('Quispe')
    expect(nombreCorto(undefined, undefined)).toBe('')
  })
})
