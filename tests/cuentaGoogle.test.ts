import { describe, expect, it } from 'vitest'
import {
  etiquetaTipoCuenta,
  fechaCorreoVerificado,
  mensajeDesvincularGoogle,
  textoCorreoVerificado,
  tituloVinculoGoogle,
} from '~/utils/cuentaGoogle'

// 29 de septiembre de 2026, 10:00 en Lima (15:00 UTC)
const VERIFICADO_EN = '2026-09-29T15:00:00.000Z'
const persona = { nombres: 'Ana', apellidos: 'Quispe', correo: 'aquispe@undc.edu.pe' }

describe('cuentas de Google en el panel', () => {
  it('nombra el tipo de cuenta según las reglas del dominio UNDC', () => {
    expect(etiquetaTipoCuenta('ESTUDIANTE')).toBe('Estudiante UNDC')
    expect(etiquetaTipoCuenta('PERSONAL')).toBe('Personal UNDC')
    expect(etiquetaTipoCuenta('EXTERNO')).toBe('Externo')
    expect(etiquetaTipoCuenta('OTRO')).toBeNull()
    expect(etiquetaTipoCuenta(null)).toBeNull()
  })

  it('describe el correo verificado con Google solo cuando lo está', () => {
    const detalle = { metodo: 'GOOGLE' as const, tipoCuenta: 'ESTUDIANTE' as const, hd: 'undc.edu.pe', verificadoEn: VERIFICADO_EN }
    expect(textoCorreoVerificado({ verificado: true, detalle })).toBe('Correo verificado con Google (Estudiante UNDC)')
    expect(textoCorreoVerificado({ verificado: true, detalle: { ...detalle, tipoCuenta: 'EXTERNO', hd: null } })).toBe('Correo verificado con Google (Externo)')
    expect(textoCorreoVerificado({ verificado: true, detalle: null })).toBe('Correo verificado con Google')
    expect(textoCorreoVerificado({ verificado: false, detalle: null })).toBeNull()
    expect(textoCorreoVerificado(undefined)).toBeNull()

    expect(fechaCorreoVerificado({ verificado: true, detalle })).toMatch(/^Verificado al inscribirse, el 29 .*2026.*10:00/)
    expect(fechaCorreoVerificado({ verificado: true, detalle: null })).toBe('Verificado al inscribirse')
    expect(fechaCorreoVerificado({ verificado: false, detalle: null })).toBeNull()
  })

  it('titula la insignia «Google vinculado» con la fecha del vínculo', () => {
    expect(tituloVinculoGoogle({ googleVinculado: true, googleVinculadoEn: VERIFICADO_EN })).toMatch(/^Vinculado el 29 .*2026.*10:00/)
    expect(tituloVinculoGoogle({ googleVinculado: true, googleVinculadoEn: null })).toBe('Cuenta de Google vinculada')
    expect(tituloVinculoGoogle({ googleVinculado: false, googleVinculadoEn: null })).toBeNull()
    expect(tituloVinculoGoogle({})).toBeNull()
  })

  it('explica qué pasa al desvincular Google', () => {
    const admin = mensajeDesvincularGoogle(persona, 'ADMIN')
    expect(admin).toContain('Ana Quispe')
    expect(admin).toContain('aquispe@undc.edu.pe')
    expect(admin).toContain('contraseña sigue funcionando')

    const participante = mensajeDesvincularGoogle(persona, 'PARTICIPANTE')
    expect(participante).toContain('quedará vinculada la cuenta de aquispe@undc.edu.pe')
    expect(participante).not.toContain('contraseña')
  })
})
