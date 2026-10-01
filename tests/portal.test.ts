import { describe, expect, it } from 'vitest'
import {
  CODIGOS_PIDEN_CODIGO,
  esItemPortalActivo,
  esNoDisponible,
  mensajeCambioAPortal,
  NAVEGACION_PORTAL,
  pideCodigoParaPortal,
} from '~/utils/portal'
import { INICIO_PARTICIPANTE } from '~/utils/sesion'

/** Error de `$fetch` con el cuerpo que reenvía el proxy del portal (el del backend tal cual). */
const errorPortal = (estado: number, code?: string) => ({ status: estado, data: code ? { success: false, code, message: 'x' } : undefined })

describe('portal: navegación', () => {
  it('cinco secciones, empezando por la página de inicio del inscrito', () => {
    expect(NAVEGACION_PORTAL.map((item) => item.to)).toEqual(['/mis-inscripciones', '/mi-fotocheck', '/mi-asistencia', '/mis-certificados', '/mi-perfil'])
    expect(NAVEGACION_PORTAL.map((item) => item.label)).toEqual(['Inscripciones', 'Fotocheck', 'Asistencia', 'Certificados', 'Perfil'])
    expect(NAVEGACION_PORTAL[0]?.to).toBe(INICIO_PARTICIPANTE)
    for (const item of NAVEGACION_PORTAL) expect(item.icon).toMatch(/^heroicons:/)
  })

  it('marca la sección activa por su ruta o una que cuelga de ella', () => {
    const fotocheck = { to: '/mi-fotocheck' }
    expect(esItemPortalActivo(fotocheck, '/mi-fotocheck')).toBe(true)
    expect(esItemPortalActivo(fotocheck, '/mi-fotocheck/500')).toBe(true)
    expect(esItemPortalActivo(fotocheck, '/mi-fotocheck?id=500')).toBe(true)
    expect(esItemPortalActivo(fotocheck, '/mi-fotochecks')).toBe(false)
    expect(esItemPortalActivo(fotocheck, '/mis-inscripciones')).toBe(false)
  })
})

describe('portal: compatibilidad con el backend anterior', () => {
  it('404 de ruta inexistente o 405: «pronto disponible»', () => {
    expect(esNoDisponible(errorPortal(404, 'NOT_FOUND'))).toBe(true)
    expect(esNoDisponible(errorPortal(404))).toBe(true)
    expect(esNoDisponible(errorPortal(405))).toBe(true)
  })

  it('los 404 de negocio y los demás errores no', () => {
    for (const code of ['INSCRIPTION_NOT_FOUND', 'PHOTO_NOT_FOUND', 'PARTICIPANT_NOT_FOUND']) expect(esNoDisponible(errorPortal(404, code)), code).toBe(false)
    expect(esNoDisponible(errorPortal(409, 'NOT_APPROVED'))).toBe(false)
    expect(esNoDisponible(errorPortal(500))).toBe(false)
    expect(esNoDisponible(new Error('fetch failed'))).toBe(false)
  })
})

describe('portal: paso del staff', () => {
  it('CODE_REQUIRED y GOOGLE_ACCOUNT_MISMATCH se resuelven con un código al correo de la cuenta', () => {
    expect(CODIGOS_PIDEN_CODIGO).toEqual(['CODE_REQUIRED', 'GOOGLE_ACCOUNT_MISMATCH'])
    expect(pideCodigoParaPortal({ statusCode: 409, data: { data: { code: 'CODE_REQUIRED' } } })).toBe(true)
    expect(pideCodigoParaPortal({ statusCode: 403, data: { data: { code: 'GOOGLE_ACCOUNT_MISMATCH' } } })).toBe(true)
    expect(pideCodigoParaPortal({ statusCode: 404, data: { data: { code: 'PARTICIPANT_NOT_FOUND' } } })).toBe(false)
    expect(pideCodigoParaPortal({ statusCode: 503, data: { data: { code: 'PORTAL_SWITCH_UNAVAILABLE' } } })).toBe(false)
  })

  it('mensajes del paso al portal', () => {
    expect(mensajeCambioAPortal({ statusCode: 404, data: { data: { code: 'PARTICIPANT_NOT_FOUND' } } })).toMatch(/ninguna inscripción con el correo de tu cuenta/)
    expect(mensajeCambioAPortal({ statusCode: 503, data: { data: { code: 'PORTAL_SWITCH_UNAVAILABLE' } } })).toMatch(/aún no está disponible/)
    expect(mensajeCambioAPortal({ statusCode: 409, data: { data: { code: 'GOOGLE_ACCOUNT_IN_USE' } } })).toMatch(/ya está vinculada a otra persona/)
  })
})
