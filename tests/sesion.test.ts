import { describe, expect, it } from 'vitest'
import { MENSAJES_POR_CODIGO } from '~/utils/errores'
import { avisoLogin, destinoTrasLogin, esRutaInterna, leerSesion, redireccionPara } from '~/utils/sesion'

const USUARIO = { id: 1, nombres: 'Ana', apellidos: 'Quispe', correo: 'ana@undc.edu.pe', rolId: 1, rolCodigo: 'SUPERADMIN', rolNombre: 'SuperAdmin' }
const PARTICIPANTE = { id: 7, nombres: 'Luis', apellidos: 'Rojas', correo: 'luis@gmail.com' }

describe('sesión: lectura de las respuestas del BFF', () => {
  it('lee sesiones de administrador y de inscrito', () => {
    expect(leerSesion({ authenticated: true, tipo: 'ADMIN', user: USUARIO, participante: null })).toEqual({ tipo: 'ADMIN', usuario: USUARIO })
    expect(leerSesion({ success: true, tipo: 'ADMIN', usuario: USUARIO })).toEqual({ tipo: 'ADMIN', usuario: USUARIO })
    expect(leerSesion({ authenticated: true, tipo: 'PARTICIPANTE', user: null, participante: PARTICIPANTE })).toEqual({ tipo: 'PARTICIPANTE', participante: PARTICIPANTE })
  })

  it('deduce el perfil si falta tipo (forma anterior)', () => {
    expect(leerSesion({ authenticated: true, user: USUARIO })).toEqual({ tipo: 'ADMIN', usuario: USUARIO })
    expect(leerSesion({ participante: PARTICIPANTE })).toEqual({ tipo: 'PARTICIPANTE', participante: PARTICIPANTE })
  })

  it('sin sesión o con datos incompletos devuelve null', () => {
    expect(leerSesion({ authenticated: false, tipo: null, user: null, participante: null })).toBeNull()
    expect(leerSesion({ authenticated: true, tipo: 'PARTICIPANTE', user: USUARIO })).toBeNull()
    expect(leerSesion({ authenticated: true, tipo: 'ADMIN' })).toBeNull()
    expect(leerSesion(null)).toBeNull()
    expect(leerSesion('x')).toBeNull()
  })
})

describe('sesión: acceso por perfil', () => {
  it('el inscrito solo entra a páginas de participante', () => {
    expect(redireccionPara('PARTICIPANTE', { perfil: 'participante' })).toBeNull()
    expect(redireccionPara('PARTICIPANTE', {})).toBe('/mis-inscripciones')
    expect(redireccionPara('PARTICIPANTE', { perfil: 'admin' })).toBe('/mis-inscripciones')
    expect(redireccionPara('PARTICIPANTE', { soloSuperAdmin: true }, true)).toBe('/mis-inscripciones')
  })

  it('el administrador no entra a páginas de participante y soloSuperAdmin sigue igual', () => {
    expect(redireccionPara('ADMIN', {})).toBeNull()
    expect(redireccionPara('ADMIN', { perfil: 'participante' }, true)).toBe('/')
    expect(redireccionPara('ADMIN', { soloSuperAdmin: true }, false)).toBe('/')
    expect(redireccionPara('ADMIN', { soloSuperAdmin: true }, true)).toBeNull()
  })
})

describe('sesión: destino tras el login', () => {
  it('el inscrito siempre va a «Mis inscripciones»', () => {
    expect(destinoTrasLogin('PARTICIPANTE', '/inscripciones')).toBe('/mis-inscripciones')
    expect(destinoTrasLogin('PARTICIPANTE', undefined)).toBe('/mis-inscripciones')
  })

  it('el administrador vuelve a redirect solo si es una ruta interna', () => {
    expect(destinoTrasLogin('ADMIN', '/inscripciones?estado=PENDIENTE')).toBe('/inscripciones?estado=PENDIENTE')
    expect(destinoTrasLogin('ADMIN', undefined)).toBe('/')
    for (const externo of ['//evil.example', '/\\evil.example', 'https://evil.example', 'evil', '/ruta con espacio', ['/eventos'], '/login?redirect=/']) {
      expect(destinoTrasLogin('ADMIN', externo), String(externo)).toBe('/')
    }
  })

  it('valida rutas internas', () => {
    expect(esRutaInterna('/eventos/3?tab=general')).toBe(true)
    expect(esRutaInterna('//x')).toBe(false)
    expect(esRutaInterna('/\\x')).toBe(false)
    expect(esRutaInterna('/a\tb')).toBe(false)
    expect(esRutaInterna(null)).toBe(false)
  })

  it('muestra el aviso solo para motivos conocidos', () => {
    expect(avisoLogin('SESSION_INVALIDATED')).toBe(MENSAJES_POR_CODIGO.SESSION_INVALIDATED)
    expect(avisoLogin('EMAIL_CREDENTIAL_NOT_FOUND')).toBeNull()
    expect(avisoLogin('<script>')).toBeNull()
    expect(avisoLogin(['SESSION_INVALIDATED'])).toBeNull()
  })
})
