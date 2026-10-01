import { describe, expect, it } from 'vitest'
import type { AccesoPanel, Permiso } from '~/types/api'
import { MENSAJES_POR_CODIGO } from '~/utils/errores'
import { PERMISOS } from '~/utils/permisos'
import {
  avisoLogin,
  destinoTrasLogin,
  esRutaInterna,
  lecturaTrasError,
  leerSesion,
  reaccionAError,
  redireccionPara,
  rutaLoginTrasCierre,
  type MetaAcceso,
} from '~/utils/sesion'

const USUARIO = { id: 1, nombres: 'Ana', apellidos: 'Quispe', correo: 'ana@undc.edu.pe', rolId: 1, rolCodigo: 'SUPERADMIN', rolNombre: 'Owner' }
const PARTICIPANTE = { id: 7, nombres: 'Luis', apellidos: 'Rojas', correo: 'luis@gmail.com' }

const acceso = (permisos: Permiso[], alcance: AccesoPanel['alcance'] = 'EVENTO'): AccesoPanel =>
  ({ alcance, permisos, eventoIds: alcance === 'GLOBAL' ? null : [2], perfilParticipante: false })
const OWNER = acceso([...PERMISOS], 'GLOBAL')
const ADMINISTRADOR = acceso(PERMISOS.filter((p) => p !== 'sistema.configurar'), 'GLOBAL')
const TESORERO = acceso(['resumen.ver', 'inscripciones.ver', 'pagos.ver', 'inscripciones.validar', 'asistencia.ver', 'ponencias.ver', 'mensajes.ver'])
const COMISION = acceso(['asistencia.marcar', 'asistencia.ver'])
const SIN_PERMISOS = acceso([])
/** Cuenta por evento que se quedó sin eventos (p. ej. se borró su único evento): conserva sus permisos. */
const SIN_EVENTOS: AccesoPanel = { ...TESORERO, eventoIds: [] }

/** Meta de las páginas del panel (las de `definePageMeta`). */
const META: Record<string, MetaAcceso> = {
  '/': { permiso: 'resumen.ver' },
  '/inscripciones': { permiso: 'inscripciones.ver' },
  '/asistencia': { permiso: 'asistencia.ver' },
  '/eventos/3': { permiso: 'eventos.configurar' },
  '/sistema': { permiso: 'sistema.configurar' },
  '/mis-inscripciones': { perfil: 'participante' },
}
const metaDe = (ruta: string): MetaAcceso => META[ruta.split(/[?#]/)[0] ?? ''] ?? {}

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
    expect(redireccionPara('PARTICIPANTE', { permiso: 'resumen.ver' }, OWNER)).toBe('/mis-inscripciones')
  })

  it('el staff no entra a páginas de participante: va a su inicio', () => {
    expect(redireccionPara('ADMIN', { perfil: 'participante' }, OWNER)).toBe('/')
    expect(redireccionPara('ADMIN', { perfil: 'participante' }, COMISION)).toBe('/asistencia')
  })

  it('las páginas exigen su permiso (basta uno de la lista)', () => {
    expect(redireccionPara('ADMIN', {}, SIN_PERMISOS)).toBeNull()
    expect(redireccionPara('ADMIN', { permiso: 'sistema.configurar' }, OWNER)).toBeNull()
    expect(redireccionPara('ADMIN', { permiso: 'sistema.configurar' }, ADMINISTRADOR)).toBe('/')
    expect(redireccionPara('ADMIN', { permiso: 'eventos.configurar' }, TESORERO)).toBe('/')
    expect(redireccionPara('ADMIN', { permiso: ['eventos.configurar', 'inscripciones.ver'] }, TESORERO)).toBeNull()
    expect(redireccionPara('ADMIN', { permiso: 'resumen.ver' }, COMISION)).toBe('/asistencia')
    expect(redireccionPara('ADMIN', { permiso: 'asistencia.ver' }, COMISION)).toBeNull()
  })

  it('sin ninguna sección va a /sin-acceso, que no exige permiso', () => {
    expect(redireccionPara('ADMIN', { permiso: 'resumen.ver' }, SIN_PERMISOS, '/')).toBe('/sin-acceso')
    expect(redireccionPara('ADMIN', { permiso: 'resumen.ver' }, null)).toBe('/sin-acceso')
    expect(redireccionPara('ADMIN', {}, SIN_PERMISOS, '/sin-acceso')).toBeNull()
  })

  it('una cuenta por evento sin eventos va a /sin-acceso aunque tenga permisos', () => {
    expect(redireccionPara('ADMIN', { permiso: 'asistencia.ver' }, { ...COMISION, eventoIds: [] }, '/asistencia')).toBe('/sin-acceso')
    expect(redireccionPara('ADMIN', { permiso: 'resumen.ver' }, SIN_EVENTOS, '/')).toBe('/sin-acceso')
    expect(redireccionPara('ADMIN', {}, SIN_EVENTOS, '/sin-acceso')).toBeNull()
    expect(destinoTrasLogin('ADMIN', '/inscripciones', SIN_EVENTOS, metaDe)).toBe('/sin-acceso')
    // Las cuentas globales no tienen eventos asignados (todos): no aplica
    expect(redireccionPara('ADMIN', { permiso: 'resumen.ver' }, OWNER, '/')).toBeNull()
  })

  it('no redirige a la misma página', () => {
    // Inconsistencia (el inicio no cumple la meta de la página): termina en /sin-acceso, sin bucles
    expect(redireccionPara('ADMIN', { permiso: 'sistema.configurar' }, COMISION, '/asistencia')).toBe('/sin-acceso')
    expect(redireccionPara('ADMIN', { permiso: 'sistema.configurar' }, SIN_PERMISOS, '/sin-acceso')).toBeNull()
  })
})

describe('sesión: destino tras el login', () => {
  it('el inscrito siempre va a «Mis inscripciones»', () => {
    expect(destinoTrasLogin('PARTICIPANTE', '/inscripciones')).toBe('/mis-inscripciones')
    expect(destinoTrasLogin('PARTICIPANTE', undefined)).toBe('/mis-inscripciones')
  })

  it('el staff vuelve a redirect solo si es una ruta interna', () => {
    expect(destinoTrasLogin('ADMIN', '/inscripciones?estado=PENDIENTE', OWNER, metaDe)).toBe('/inscripciones?estado=PENDIENTE')
    expect(destinoTrasLogin('ADMIN', undefined, OWNER, metaDe)).toBe('/')
    for (const externo of ['//evil.example', '/\\evil.example', 'https://evil.example', 'evil', '/ruta con espacio', ['/eventos'], '/login?redirect=/']) {
      expect(destinoTrasLogin('ADMIN', externo, OWNER, metaDe), String(externo)).toBe('/')
    }
  })

  it('el staff vuelve a redirect solo si puede abrirla; si no, a su inicio', () => {
    expect(destinoTrasLogin('ADMIN', '/eventos/3', ADMINISTRADOR, metaDe)).toBe('/eventos/3')
    expect(destinoTrasLogin('ADMIN', '/sistema', ADMINISTRADOR, metaDe)).toBe('/')
    expect(destinoTrasLogin('ADMIN', '/eventos/3', TESORERO, metaDe)).toBe('/')
    expect(destinoTrasLogin('ADMIN', '/inscripciones', COMISION, metaDe)).toBe('/asistencia')
    expect(destinoTrasLogin('ADMIN', '/mis-inscripciones', COMISION, metaDe)).toBe('/asistencia')
    expect(destinoTrasLogin('ADMIN', undefined, COMISION, metaDe)).toBe('/asistencia')
    expect(destinoTrasLogin('ADMIN', '/', SIN_PERMISOS, metaDe)).toBe('/sin-acceso')
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
    expect(avisoLogin('SESSION_EXPIRED')).toBe(MENSAJES_POR_CODIGO.SESSION_EXPIRED)
    expect(avisoLogin('SESSION_UNAVAILABLE')).toBe(MENSAJES_POR_CODIGO.SESSION_UNAVAILABLE)
    expect(avisoLogin('EMAIL_CREDENTIAL_NOT_FOUND')).toBeNull()
    expect(avisoLogin('<script>')).toBeNull()
    expect(avisoLogin(['SESSION_INVALIDATED'])).toBeNull()
  })
})

describe('sesión: login tras un 401', () => {
  it('lleva el motivo solo si el login lo explica', () => {
    expect(rutaLoginTrasCierre('SESSION_EXPIRED', '/inscripciones?estado=PENDIENTE')).toEqual({ path: '/login', query: { motivo: 'SESSION_EXPIRED', redirect: '/inscripciones?estado=PENDIENTE' } })
    expect(rutaLoginTrasCierre('SESSION_INVALIDATED', '/asistencia')).toEqual({ path: '/login', query: { motivo: 'SESSION_INVALIDATED', redirect: '/asistencia' } })
    expect(rutaLoginTrasCierre('INVALID_TOKEN', '/asistencia')).toEqual({ path: '/login', query: { redirect: '/asistencia' } })
  })

  it('backend caído al verificar la sesión: avisa y conserva la página', () => {
    expect(rutaLoginTrasCierre('SESSION_UNAVAILABLE', '/asistencia')).toEqual({ path: '/login', query: { motivo: 'SESSION_UNAVAILABLE', redirect: '/asistencia' } })
  })

  it('no vuelve al inicio, al login ni a rutas externas', () => {
    expect(rutaLoginTrasCierre('SESSION_EXPIRED', '/')).toEqual({ path: '/login', query: { motivo: 'SESSION_EXPIRED' } })
    expect(rutaLoginTrasCierre('', '/login')).toEqual({ path: '/login', query: {} })
    expect(rutaLoginTrasCierre('', '/login?redirect=/login')).toEqual({ path: '/login', query: {} })
    expect(rutaLoginTrasCierre('', '/login?redirect=//evil.example')).toEqual({ path: '/login', query: {} })
    expect(rutaLoginTrasCierre('', '//evil.example')).toEqual({ path: '/login', query: {} })
  })

  it('un segundo 401 ya en el login conserva la página de regreso y el motivo', () => {
    const primero = rutaLoginTrasCierre('SESSION_INVALIDATED', '/inscripciones?estado=PENDIENTE')
    const enLogin = `/login?${new URLSearchParams(primero.query).toString()}`
    expect(rutaLoginTrasCierre('INVALID_TOKEN', enLogin)).toEqual(primero)
    expect(rutaLoginTrasCierre('SESSION_EXPIRED', enLogin)).toEqual({ path: '/login', query: { motivo: 'SESSION_EXPIRED', redirect: '/inscripciones?estado=PENDIENTE' } })
    expect(rutaLoginTrasCierre('', '/login?motivo=<script>&redirect=/x')).toEqual({ path: '/login', query: { redirect: '/x' } })
  })
})

describe('sesión: errores de la API del staff', () => {
  it('al leer la sesión solo un 401 la cierra; 503 o la red caída la conservan', () => {
    expect(lecturaTrasError({ status: 401, data: { code: 'SESSION_INVALIDATED' } })).toBe('CERRADA')
    expect(lecturaTrasError({ status: 503, data: { data: { code: 'SESSION_UNAVAILABLE' } } })).toBe('NO_DISPONIBLE')
    expect(lecturaTrasError({ statusCode: 500 })).toBe('NO_DISPONIBLE')
    expect(lecturaTrasError(new TypeError('Failed to fetch'))).toBe('NO_DISPONIBLE')
  })

  it('401 → login (salvo silenciar401)', () => {
    expect(reaccionAError({ status: 401, code: 'SESSION_EXPIRED' })).toBe('LOGIN')
    expect(reaccionAError({ status: 401, code: 'SESSION_INVALIDATED' }, true)).toBeNull()
  })

  it('solo los 403 de permisos o eventos releen el acceso', () => {
    expect(reaccionAError({ status: 403, code: 'FORBIDDEN' })).toBe('RELEER_ACCESO')
    expect(reaccionAError({ status: 403, code: 'EVENT_NOT_ASSIGNED' })).toBe('RELEER_ACCESO')
    for (const code of ['OUT_OF_HOURS_NOT_ALLOWED', 'STATUS_NOT_ALLOWED', 'NOT_APPROVED', 'ADMIN_NOT_MANAGEABLE', 'ROLE_NOT_ASSIGNABLE', 'CSRF_ORIGIN', 'FORBIDDEN_PROFILE']) {
      expect(reaccionAError({ status: 403, code }), code).toBeNull()
    }
    expect(reaccionAError({ status: 503, code: 'SESSION_UNAVAILABLE' })).toBeNull()
    expect(reaccionAError({ status: 404, code: 'FORBIDDEN' })).toBeNull()
  })
})
