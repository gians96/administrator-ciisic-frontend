import { describe, expect, it } from 'vitest'
import { aErrorApi, MENSAJES_POR_CODIGO } from '~/utils/errores'

/** Códigos nuevos de backend-ciisic spec 014 (contracts/api-acceso-codigo, api-portal, api-asistencia). */
const CODIGOS_014 = [
  // Código por correo y paso al portal
  'CODE_COOLDOWN', 'RATE_LIMITED', 'CODE_LOGIN_UNAVAILABLE', 'CODE_LOGIN_PAUSED', 'INVALID_CODE', 'CODE_EXPIRED',
  'CODE_LOCKED', 'CODE_REQUIRED', 'PARTICIPANT_NOT_FOUND', 'GOOGLE_ACCOUNT_MISMATCH', 'GOOGLE_ACCOUNT_IN_USE',
  'PORTAL_SWITCH_UNAVAILABLE',
  // Portal: foto, fotocheck y credencial
  'FILE_REQUIRED', 'CONSENT_REQUIRED', 'INVALID_FILE_TYPE', 'INVALID_FILE_CONTENT', 'IMAGE_TOO_LARGE',
  'UPLOAD_LIMIT_EXCEEDED', 'UPLOAD_INVALID', 'PHOTO_CONFLICT', 'PHOTO_NOT_FOUND', 'INSCRIPTION_NOT_FOUND', 'NOT_APPROVED',
  'PDF_BUSY',
  // Asistencia por QR
  'CODE_NOT_FOUND', 'CODE_OTHER_EVENT', 'LEGACY_QR_NOT_ALLOWED', 'OUTSIDE_WINDOW', 'ATTENDANCE_ALREADY_REGISTERED',
  'AMBIGUOUS_DOCUMENT', 'OUT_OF_HOURS_NOT_ALLOWED', 'MANUAL_NOT_ALLOWED',
  // Alta de participantes y cortesías
  'PARTICIPANT_EXISTS', 'EMAIL_IN_USE', 'NAMES_REQUIRED', 'ALREADY_REGISTERED', 'REGISTRATION_TYPE_INVALID', 'DUPLICATE_RECORD',
]

describe('errores de la spec 014', () => {
  it('cada código tiene un mensaje del panel aunque el servidor no envíe uno', () => {
    for (const code of CODIGOS_014) {
      const { message } = aErrorApi({ status: 409, data: { success: false, code } })
      expect(message, code).not.toBe('No se pudo completar la operación.')
      expect(message.length, code).toBeGreaterThan(10)
    }
  })

  it('los mensajes del servidor con datos (hora, fecha, intentos) se conservan', () => {
    const conDatos = {
      OUTSIDE_WINDOW: 'Fuera del horario: desde 08:30 hasta 10:30.',
      ATTENDANCE_ALREADY_REGISTERED: 'Ya se registró a las 09:05.',
      LEGACY_QR_NOT_ALLOWED: 'El QR anterior solo valía hasta el fin del evento (2026-10-30).',
      INVALID_CODE: 'El código no es correcto. Te quedan 3 intentos.',
      CODE_COOLDOWN: 'Alcanzaste el máximo de códigos por día. Intenta mañana o entra con Google.',
      NOT_APPROVED: 'Tu fotocheck estará disponible cuando se apruebe tu inscripción.',
    }
    for (const [code, message] of Object.entries(conDatos)) {
      expect(MENSAJES_POR_CODIGO[code], code).toBeUndefined()
      expect(aErrorApi({ status: 409, data: { code, message } }).message, code).toBe(message)
    }
  })

  it('el BFF del paso al portal sin backend 014 explica que aún no está disponible', () => {
    expect(aErrorApi({ statusCode: 503, data: { data: { code: 'PORTAL_SWITCH_UNAVAILABLE' } } }).message).toMatch(/aún no está disponible/)
  })
})
