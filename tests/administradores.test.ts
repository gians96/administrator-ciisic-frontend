import { describe, expect, it } from 'vitest'
import { accesoDe, contrasenaObligatoria, cuerpoAdmin, etiquetaAcceso, type FormAdmin } from '../app/utils/administradores'

const base: FormAdmin = { nombres: ' Ana ', apellidos: 'Ríos ', correo: ' ana@undc.edu.pe ', acceso: 'GOOGLE', contrasena: '', rolCodigo: 'ADMIN', activo: true }
const conContrasena = { tieneContrasena: true }
const soloGoogle = { tieneContrasena: false }

describe('accesoDe / etiquetaAcceso', () => {
  it('un administrador nuevo empieza con «Solo Google»', () => {
    expect(accesoDe()).toBe('GOOGLE')
    expect(accesoDe(null)).toBe('GOOGLE')
  })

  it('lee el acceso de la cuenta', () => {
    expect(accesoDe(soloGoogle)).toBe('GOOGLE')
    expect(accesoDe(conContrasena)).toBe('CONTRASENA')
    expect(etiquetaAcceso(soloGoogle)).toBe('Solo Google')
    expect(etiquetaAcceso(conContrasena)).toBe('Contraseña o Google')
  })

  it('una respuesta sin el campo se trata como con contraseña', () => {
    expect(accesoDe({})).toBe('CONTRASENA')
  })
})

describe('contrasenaObligatoria', () => {
  it('solo cuando se elige contraseña y la cuenta aún no tiene', () => {
    expect(contrasenaObligatoria('CONTRASENA')).toBe(true)
    expect(contrasenaObligatoria('CONTRASENA', soloGoogle)).toBe(true)
    expect(contrasenaObligatoria('CONTRASENA', conContrasena)).toBe(false)
    expect(contrasenaObligatoria('GOOGLE')).toBe(false)
  })
})

describe('cuerpoAdmin', () => {
  it('alta solo con Google: sin contraseña y con los textos recortados', () => {
    const { body, errores } = cuerpoAdmin(base)
    expect(errores).toEqual({})
    expect(body).toEqual({ nombres: 'Ana', apellidos: 'Ríos', correo: 'ana@undc.edu.pe', rolCodigo: 'ADMIN', activo: true })
  })

  it('«Solo Google» nunca envía la contraseña escrita', () => {
    expect(cuerpoAdmin({ ...base, contrasena: 'una-clave-segura-2026' }).body).not.toHaveProperty('contrasena')
  })

  it('alta con contraseña: obligatoria y de 12 caracteres', () => {
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }).errores).toHaveProperty('contrasena')
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA', contrasena: 'corta' }).errores.contrasena).toMatch(/12/)
    const { body, errores } = cuerpoAdmin({ ...base, acceso: 'CONTRASENA', contrasena: 'una-clave-segura-2026' })
    expect(errores).toEqual({})
    expect(body.contrasena).toBe('una-clave-segura-2026')
  })

  it('editar con contraseña y dejarla vacía la conserva', () => {
    const { body, errores } = cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }, conContrasena)
    expect(errores).toEqual({})
    expect(body).not.toHaveProperty('contrasena')
    expect(body).not.toHaveProperty('quitarContrasena')
  })

  it('pasar una cuenta con contraseña a «Solo Google» pide quitarla', () => {
    expect(cuerpoAdmin(base, conContrasena).body.quitarContrasena).toBe(true)
  })

  it('una cuenta que ya es solo Google no envía cambios de contraseña', () => {
    const { body } = cuerpoAdmin(base, soloGoogle)
    expect(body).not.toHaveProperty('quitarContrasena')
    expect(body).not.toHaveProperty('contrasena')
  })

  it('pasar una cuenta solo Google a contraseña exige escribirla', () => {
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }, soloGoogle).errores).toHaveProperty('contrasena')
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA', contrasena: 'una-clave-segura-2026' }, soloGoogle).body.contrasena).toBe('una-clave-segura-2026')
  })
})
