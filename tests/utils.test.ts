import { describe, expect, it } from 'vitest'
import { aErrorApi, MENSAJES_POR_CODIGO, mensajeError } from '~/utils/errores'
import { aParametros, filtrosDesdeQuery } from '~/utils/filtros'
import { fechaDia, modalidadPago, nombreCompleto, slug, soles, tamanoArchivo } from '~/utils/formato'

describe('formato', () => {
  it('muestra montos en soles', () => {
    expect(soles(1460)).toMatch(/S\/\s?1,460\.00/)
    expect(soles(0)).toMatch(/0\.00/)
    // Sin pagos.ver los montos llegan en null: no se muestran como cero
    expect(soles(null)).toBe('—')
    expect(soles(undefined)).toBe('—')
  })

  it('muestra fechas de calendario sin corrimiento de zona horaria', () => {
    expect(fechaDia('2026-10-26')).toContain('26')
    expect(fechaDia('2026-10-26')).toContain('2026')
    expect(fechaDia(null)).toBe('—')
    expect(fechaDia('no-fecha')).toBe('—')
  })

  it('genera códigos de evento legibles', () => {
    expect(slug('IX CIISIC 2027')).toBe('ix-ciisic-2027')
    expect(slug('  Semana Sistémica — Edición Ñandú ')).toBe('semana-sistemica-edicion-nandu')
  })

  it('describe la modalidad de pago', () => {
    expect(modalidadPago('banco', 'bcp')).toBe('Banco · BCP')
    expect(modalidadPago('billetera', null, 'yape')).toBe('Billetera · Yape')
    expect(modalidadPago(null)).toBe('—')
  })

  it('otros formatos', () => {
    expect(nombreCompleto({ nombres: 'Ana', apellidos: 'Quispe' })).toBe('Ana Quispe')
    expect(tamanoArchivo(2048)).toBe('2.0 KB')
  })
})

describe('errores de la API', () => {
  it('lee el cuerpo normalizado del backend', () => {
    const e = aErrorApi({ status: 409, data: { success: false, code: 'ALREADY_REGISTERED', message: 'Ya inscrito' } })
    expect(e).toEqual({ status: 409, code: 'ALREADY_REGISTERED', message: 'Ya inscrito', fields: undefined })
  })

  it('lee errores del BFF anidados en data', () => {
    const e = aErrorApi({ statusCode: 403, data: { data: { code: 'CSRF_ORIGIN', message: 'Origen no permitido' } } })
    expect(e.code).toBe('CSRF_ORIGIN')
    expect(e.message).toBe('Origen no permitido')
    // Un 401 sin código se trata como sesión expirada
    expect(aErrorApi({ statusCode: 401 }).code).toBe('SESSION_EXPIRED')
  })

  it('incluye los campos de validación en el mensaje', () => {
    const texto = mensajeError({ status: 422, data: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', fields: { codigo: 'Formato inválido' } } })
    expect(texto).toBe('Datos inválidos (codigo: Formato inválido)')
  })

  it('usa mensajes por defecto sin conexión', () => {
    expect(aErrorApi(new Error('fetch failed')).message).toBe('No se pudo conectar con el servidor.')
  })

  it('usa el mensaje del panel para los códigos de credenciales y tokens', () => {
    for (const code of ['EMAIL_CREDENTIAL_NOT_FOUND', 'EMAIL_CREDENTIAL_IN_USE', 'ACCESS_TOKEN_NOT_FOUND']) {
      const e = aErrorApi({ status: code.endsWith('IN_USE') ? 409 : 404, data: { success: false, code, message: 'texto del servidor' } })
      expect(e.code).toBe(code)
      expect(e.message).toBe(MENSAJES_POR_CODIGO[code])
    }
    expect(MENSAJES_POR_CODIGO.EMAIL_CREDENTIAL_IN_USE).toContain('Usar la predeterminada')
  })

  it('usa el mensaje del panel para Google, la sesión y el sistema', () => {
    const codigos = [
      'GOOGLE_NOT_CONFIGURED', 'GOOGLE_UNAVAILABLE', 'GOOGLE_SESSION_EXPIRED', 'INVALID_GOOGLE_TOKEN', 'GOOGLE_EMAIL_NOT_VERIFIED',
      'GOOGLE_NOT_AUTHORITATIVE', 'GOOGLE_ACCOUNT_MISMATCH', 'GOOGLE_ACCOUNT_IN_USE', 'GOOGLE_ACCOUNT_NOT_REGISTERED',
      'SESSION_INVALIDATED', 'FORBIDDEN_PROFILE', 'UNDC_API_NOT_CONFIGURED', 'HOST_NOT_ALLOWED', 'INVALID_URL',
    ]
    for (const code of codigos) {
      expect(MENSAJES_POR_CODIGO[code], code).toBeTruthy()
      expect(aErrorApi({ status: 403, data: { success: false, code, message: 'texto del servidor' } }).message).toBe(MENSAJES_POR_CODIGO[code])
    }
    // Una cuenta no registrada no se confunde con credenciales inválidas
    expect(MENSAJES_POR_CODIGO.GOOGLE_ACCOUNT_NOT_REGISTERED)
      .toMatch(/^Tu cuenta de Google no está registrada como administrador ni como inscrito/)
    // Errores del BFF (createError anida el cuerpo en data)
    expect(aErrorApi({ statusCode: 400, data: { data: { code: 'GOOGLE_SESSION_EXPIRED', message: 'x' } } }).message)
      .toBe(MENSAJES_POR_CODIGO.GOOGLE_SESSION_EXPIRED)
  })

  it('usa el mensaje del panel para los códigos de roles y permisos (spec 013)', () => {
    const codigos = [
      'FORBIDDEN', 'EVENT_NOT_ASSIGNED', 'SESSION_INVALIDATED', 'SESSION_EXPIRED', 'SESSION_UNAVAILABLE', 'ROLE_NOT_ASSIGNABLE',
      'ADMIN_NOT_MANAGEABLE', 'LAST_OWNER', 'ADMIN_CHANGED', 'SELF_UPDATE_FORBIDDEN', 'EVENTS_REQUIRED', 'EVENT_NOT_FOUND',
      'PERMISSIONS_REQUIRED', 'PERMISSION_NOT_ELIGIBLE', 'OUT_OF_HOURS_NOT_ALLOWED', 'STATUS_NOT_ALLOWED', 'PARTICIPANT_NOT_FOUND',
      'AMBIGUOUS_DOCUMENT', 'ATTENDANCE_NOT_FOUND',
    ]
    for (const code of codigos) {
      expect(MENSAJES_POR_CODIGO[code], code).toBeTruthy()
      expect(aErrorApi({ status: 403, data: { success: false, code, message: 'texto del servidor' } }).message).toBe(MENSAJES_POR_CODIGO[code])
    }
    // Los campos del formulario se conservan para marcar el control
    expect(aErrorApi({ status: 422, data: { code: 'EVENTS_REQUIRED', fields: { eventoIds: 'Elige al menos un evento.' } } }).fields)
      .toEqual({ eventoIds: 'Elige al menos un evento.' })
  })

  it('conserva el mensaje del servidor en VALIDATION_ERROR y tiene respaldo', () => {
    expect(aErrorApi({ status: 422, data: { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos' } }).message)
      .toBe('Los datos enviados no son válidos')
    expect(aErrorApi({ status: 422, data: { code: 'VALIDATION_ERROR', fields: { correo: 'Correo inválido' } } }).message)
      .toBe('Revisa los datos marcados en el formulario.')
  })

  it('traduce las claves de fields con etiquetas legibles', () => {
    const error = { status: 422, data: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', fields: { remitenteCorreo: 'Debe ser un correo', otro: 'x' } } }
    expect(mensajeError(error, { remitenteCorreo: 'Correo del remitente' })).toBe('Datos inválidos (Correo del remitente: Debe ser un correo · otro: x)')
    expect(mensajeError({ status: 422, data: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', fields: {} } })).toBe('Datos inválidos')
  })
})

describe('filtros de inscripciones', () => {
  it('lee la query ignorando valores inválidos', () => {
    expect(filtrosDesdeQuery({ estado: 'pendiente', tipoInscripcionId: 'abc', esEstudianteUndc: 'quizas', page: '3' }))
      .toEqual({ estado: 'PENDIENTE', categoria: '', tipoInscripcionId: '', esEstudianteUndc: '', q: '', page: 3 })
  })

  it('serializa solo los filtros con valor', () => {
    expect(aParametros({ estado: 'APROBADO', categoria: '', tipoInscripcionId: '2', esEstudianteUndc: 'true', q: ' ana ', page: 2 }))
      .toEqual({ estado: 'APROBADO', tipoInscripcionId: '2', esEstudianteUndc: 'true', q: 'ana', page: '2' })
    expect(aParametros({ estado: '', categoria: '', tipoInscripcionId: '', esEstudianteUndc: '', q: '', page: 5 }, false)).toEqual({})
  })
})
