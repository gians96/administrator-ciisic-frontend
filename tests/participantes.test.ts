import { describe, expect, it } from 'vitest'
import type { Categoria, TipoInscripcion } from '~/types/api'
import {
  avisoCambioCorreo,
  cambiaCorreo,
  camposErrorEdicion,
  CONSULTA_INICIAL,
  cuerpoCortesia,
  cuerpoNuevoParticipante,
  errorAlta,
  errorCortesia,
  esDocumentoValido,
  formularioCortesia,
  formularioNuevoParticipante,
  gruposTiposCortesia,
  inscripcionEnEvento,
  MENSAJE_ALTA_NO_DISPONIBLE,
  MENSAJE_CORTESIA_NO_DISPONIBLE,
  mensajeConsultaDni,
  nombresDeConsulta,
  nombresObligatorios,
  normalizarCelular,
  normalizarDocumento,
  personaDeConsulta,
  puedeConsultarDni,
  resultadoCortesia,
  validarNuevoParticipante,
  type ConsultaDni,
  type FormNuevoParticipante,
} from '~/utils/participantes'

/** Error de `$fetch` con el cuerpo que reenvía el proxy (el del backend tal cual). */
const errorBackend = (status: number, code?: string, fields?: Record<string, string>, message = 'Mensaje del servidor.') =>
  ({ status, data: code ? { success: false, code, message, ...(fields ? { fields } : {}) } : undefined })

const form = (cambios: Partial<FormNuevoParticipante> = {}): FormNuevoParticipante => ({ ...formularioNuevoParticipante(), ...cambios })
const consulta = (estado: ConsultaDni['estado'], numero: string): ConsultaDni => ({ estado, numero, mensaje: '' })

describe('participantes: documento y celular', () => {
  it('el DNI se queda con 8 dígitos y el carné con 12 letras o dígitos', () => {
    expect(normalizarDocumento('dni', ' 7000-1234 99')).toBe('70001234')
    expect(normalizarDocumento('ce', 'ab 12.345-6789xyz')).toBe('ab123456789x')
  })

  it('mismas reglas que el backend', () => {
    expect(esDocumentoValido('dni', '70001234')).toBe(true)
    expect(esDocumentoValido('dni', '7000123')).toBe(false)
    expect(esDocumentoValido('ce', '001234567')).toBe(true)
    expect(esDocumentoValido('ce', 'AB12345678CD')).toBe(true)
    expect(esDocumentoValido('ce', '12345678')).toBe(false)
  })

  it('el celular pierde espacios, guiones y paréntesis', () => {
    expect(normalizarCelular(' +51 (987) 654-321 ')).toBe('+51987654321')
  })
})

describe('participantes: consulta DNI', () => {
  it('solo con un DNI de 8 dígitos', () => {
    expect(puedeConsultarDni(form({ numeroDocumento: '70001234' }))).toBe(true)
    expect(puedeConsultarDni(form({ numeroDocumento: '7000123' }))).toBe(false)
    expect(puedeConsultarDni(form({ tipoDocumento: 'ce', numeroDocumento: '70001234' }))).toBe(false)
  })

  it('los nombres se bloquean si la consulta encontró el número actual', () => {
    const dni = form({ numeroDocumento: '70001234' })
    expect(nombresDeConsulta(dni, consulta('ENCONTRADO', '70001234'))).toBe(true)
    expect(nombresDeConsulta(dni, consulta('ENCONTRADO', '70009999'))).toBe(false)
    expect(nombresDeConsulta(dni, consulta('FALLO', '70001234'))).toBe(false)
    expect(nombresDeConsulta(form({ tipoDocumento: 'ce', numeroDocumento: '70001234' }), consulta('ENCONTRADO', '70001234'))).toBe(false)
  })

  it('nombres obligatorios: siempre con carné; con DNI solo si la consulta del número actual falló', () => {
    expect(nombresObligatorios(form({ tipoDocumento: 'ce' }), CONSULTA_INICIAL)).toBe(true)
    expect(nombresObligatorios(form({ numeroDocumento: '70001234' }), CONSULTA_INICIAL)).toBe(false)
    expect(nombresObligatorios(form({ numeroDocumento: '70001234' }), consulta('FALLO', '70001234'))).toBe(true)
    expect(nombresObligatorios(form({ numeroDocumento: '70005678' }), consulta('FALLO', '70001234'))).toBe(false)
    expect(nombresObligatorios(form({ numeroDocumento: '70001234' }), consulta('ENCONTRADO', '70001234'))).toBe(false)
  })

  it('lee nombres y apellidos de la respuesta', () => {
    expect(personaDeConsulta({ nombres: ' ANA ', apellidos: 'PÉREZ GARCÍA', fuente: 'CACHE' })).toEqual({ nombres: 'ANA', apellidos: 'PÉREZ GARCÍA' })
    expect(personaDeConsulta({ nombres: 'ANA', apellidos: '' })).toBeNull()
    expect(personaDeConsulta({ nombres: 'ANA' })).toBeNull()
    expect(personaDeConsulta(null)).toBeNull()
  })

  it('si la consulta falla, pide escribir los nombres', () => {
    expect(mensajeConsultaDni(errorBackend(404, 'DOCUMENT_NOT_FOUND'))).toBe('No se encontraron datos para ese DNI. Escribe los nombres y apellidos.')
    expect(mensajeConsultaDni(errorBackend(503, 'LOOKUP_UNAVAILABLE'))).toMatch(/no está disponible.*Escribe los nombres/)
    expect(mensajeConsultaDni(errorBackend(500))).toMatch(/Escribe los nombres y apellidos\.$/)
  })
})

describe('participantes: validación del alta', () => {
  const valido = form({ numeroDocumento: '70001234', correo: 'ana@gmail.com' })

  it('con DNI basta el documento y el correo (los nombres salen de la consulta al guardar)', () => {
    expect(validarNuevoParticipante(valido, { nombresObligatorios: false })).toEqual({})
  })

  it('el correo es obligatorio y explica para qué sirve', () => {
    const errores = validarNuevoParticipante({ ...valido, correo: '  ' }, { nombresObligatorios: false })
    expect(errores.correo).toMatch(/portal.*certificados/)
    expect(validarNuevoParticipante({ ...valido, correo: 'ana@' }, { nombresObligatorios: false }).correo).toBe('Ingresa un correo válido.')
  })

  it('documento vacío o con otro formato', () => {
    expect(validarNuevoParticipante({ ...valido, numeroDocumento: '' }, { nombresObligatorios: false }).numeroDocumento).toBe('Ingresa el número de documento.')
    expect(validarNuevoParticipante({ ...valido, numeroDocumento: '123' }, { nombresObligatorios: false }).numeroDocumento).toMatch(/8 dígitos/)
    expect(validarNuevoParticipante({ ...valido, tipoDocumento: 'ce', numeroDocumento: '123', nombres: 'Ana', apellidos: 'Pérez' }, { nombresObligatorios: true }).numeroDocumento).toMatch(/9 y 12/)
  })

  it('nombres obligatorios cuando corresponde y siempre con 2 a 120 caracteres', () => {
    const errores = validarNuevoParticipante(valido, { nombresObligatorios: true })
    expect(errores).toEqual({ nombres: 'Ingresa los nombres.', apellidos: 'Ingresa los apellidos.' })
    expect(validarNuevoParticipante({ ...valido, nombres: 'A' }, { nombresObligatorios: false }).nombres).toMatch(/al menos 2/)
    expect(validarNuevoParticipante({ ...valido, apellidos: 'x'.repeat(121) }, { nombresObligatorios: false }).apellidos).toMatch(/como máximo 120/)
  })

  it('celular opcional; si se escribe, 9 a 15 dígitos', () => {
    expect(validarNuevoParticipante({ ...valido, celular: '987 654 321' }, { nombresObligatorios: false })).toEqual({})
    expect(validarNuevoParticipante({ ...valido, celular: '12345' }, { nombresObligatorios: false }).celular).toMatch(/9 y 15/)
  })
})

describe('participantes: cuerpo del alta', () => {
  it('normaliza y no envía los opcionales vacíos', () => {
    expect(cuerpoNuevoParticipante(form({ numeroDocumento: '70001234', correo: ' Ana@Gmail.COM ', nombres: '  ', apellidos: '', celular: ' ' }))).toEqual({
      tipoDocumento: 'dni', numeroDocumento: '70001234', correo: 'ana@gmail.com',
    })
  })

  it('con todos los datos', () => {
    expect(cuerpoNuevoParticipante(form({ tipoDocumento: 'ce', numeroDocumento: '001234567', nombres: ' Ana ', apellidos: ' Pérez ', correo: 'ana@gmail.com', celular: '+51 987 654 321' }))).toEqual({
      tipoDocumento: 'ce', numeroDocumento: '001234567', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@gmail.com', celular: '+51987654321',
    })
  })
})

describe('participantes: errores del alta', () => {
  it('PARTICIPANT_EXISTS ofrece abrir el registro existente (fields.id llega como texto)', () => {
    const e = errorAlta(errorBackend(409, 'PARTICIPANT_EXISTS', { id: '7' }))
    expect(e.existenteId).toBe(7)
    expect(e.campos).toEqual({ numeroDocumento: 'Este documento ya está registrado.' })
    expect(errorAlta(errorBackend(409, 'PARTICIPANT_EXISTS', { id: 'x' })).existenteId).toBeNull()
    expect(errorAlta(errorBackend(409, 'PARTICIPANT_EXISTS')).existenteId).toBeNull()
  })

  it('EMAIL_IN_USE marca el correo', () => {
    const e = errorAlta(errorBackend(409, 'EMAIL_IN_USE'))
    expect(e.campos).toEqual({ correo: 'Este correo ya lo usa otra persona.' })
    expect(e.existenteId).toBeNull()
  })

  it('NAMES_REQUIRED marca los nombres que faltan', () => {
    expect(errorAlta(errorBackend(422, 'NAMES_REQUIRED', { nombres: 'Ingresa los nombres' })).campos).toEqual({ nombres: 'Ingresa los nombres', apellidos: 'Ingresa los apellidos.' })
  })

  it('VALIDATION_ERROR conserva los campos del backend', () => {
    expect(errorAlta(errorBackend(422, 'VALIDATION_ERROR', { celular: 'Celular inválido' })).campos).toEqual({ celular: 'Celular inválido' })
  })

  it('con el backend anterior (sin la ruta) avisa que aún no está disponible', () => {
    expect(errorAlta(errorBackend(404, 'NOT_FOUND'))).toEqual({ mensaje: MENSAJE_ALTA_NO_DISPONIBLE, campos: {}, existenteId: null })
    expect(errorAlta(errorBackend(405)).mensaje).toBe(MENSAJE_ALTA_NO_DISPONIBLE)
  })

  it('EMAIL_IN_USE al editar también marca el correo', () => {
    expect(camposErrorEdicion(errorBackend(409, 'EMAIL_IN_USE'))).toEqual({ correo: 'Este correo ya lo usa otra persona.' })
    expect(camposErrorEdicion(errorBackend(422, 'VALIDATION_ERROR', { nombres: 'Muy corto' }))).toEqual({ nombres: 'Muy corto' })
    expect(camposErrorEdicion(errorBackend(500))).toEqual({})
  })
})

describe('participantes: cambio de correo', () => {
  it('solo cuenta un correo distinto (sin mayúsculas ni espacios) y no vacío', () => {
    expect(cambiaCorreo('ana@gmail.com', ' ANA@gmail.com ')).toBe(false)
    expect(cambiaCorreo('ana@gmail.com', '')).toBe(false)
    expect(cambiaCorreo('ana@gmail.com', 'ana.perez@gmail.com')).toBe(true)
  })

  it('el aviso nombra el correo anterior y el vínculo con Google', () => {
    expect(avisoCambioCorreo('ana@gmail.com')).toMatch(/^Se avisará al correo anterior \(ana@gmail\.com\)/)
    expect(avisoCambioCorreo('ana@gmail.com')).not.toMatch(/Google/)
    expect(avisoCambioCorreo('ana@gmail.com', true)).toMatch(/desvinculará su cuenta de Google/)
  })
})

describe('participantes: inscripción de cortesía', () => {
  const tipo = (id: number, nombre: string, orden: number, cambios: Partial<TipoInscripcion> = {}): TipoInscripcion => ({
    id, categoriaId: 1, codigo: `T${id}`, nombre, etiqueta: null, descripcion: null, caracteristicas: null, precio: null, precioInstitucional: null, activo: true, orden, ...cambios,
  })
  const categoria = (id: number, nombre: string, orden: number, tipos: TipoInscripcion[]): Categoria => ({
    id, eventoId: 2, codigo: `C${id}`, nombre, descripcion: null, caracteristicas: null, precioDesde: null, esEstudiantil: false, orden, tipos,
  })

  it('agrupa los tipos por categoría en orden, con los inactivos marcados y sin categorías vacías', () => {
    const grupos = gruposTiposCortesia([
      categoria(2, 'Invitados', 2, [tipo(12, 'Ponente', 1, { activo: false })]),
      categoria(1, 'General', 1, [tipo(11, 'Profesionales', 2), tipo(10, 'Estudiantes', 1, { etiqueta: 'CON KIT' })]),
      categoria(3, 'Vacía', 3, []),
    ])
    expect(grupos).toEqual([
      { id: 1, categoria: 'General', tipos: [{ id: 10, etiqueta: 'Estudiantes · CON KIT' }, { id: 11, etiqueta: 'Profesionales' }] },
      { id: 2, categoria: 'Invitados', tipos: [{ id: 12, etiqueta: 'Ponente (inactivo)' }] },
    ])
  })

  it('cuerpo: sin tipo va en null y la credencial no se envía por defecto', () => {
    expect(cuerpoCortesia(7, formularioCortesia())).toEqual({ participanteId: 7, tipoInscripcionId: null, enviarCredencial: false })
    expect(cuerpoCortesia(7, { tipoInscripcionId: 12, enviarCredencial: true })).toEqual({ participanteId: 7, tipoInscripcionId: 12, enviarCredencial: true })
    expect(cuerpoCortesia(7, { tipoInscripcionId: 0, enviarCredencial: false }).tipoInscripcionId).toBeNull()
  })

  it('detecta la inscripción que ya tiene en el evento', () => {
    const inscripciones = [{ id: 1, evento: { codigo: 'VII', nombreCorto: 'VII CIISIC' } }, { id: 2, evento: { codigo: 'VIII', nombreCorto: 'VIII CIISIC' } }]
    expect(inscripcionEnEvento(inscripciones, 'VIII')?.id).toBe(2)
    expect(inscripcionEnEvento(inscripciones, 'IX')).toBeNull()
    expect(inscripcionEnEvento(inscripciones, null)).toBeNull()
    expect(inscripcionEnEvento(undefined, 'VIII')).toBeNull()
  })

  it('errores con el nombre del evento y el campo del tipo', () => {
    expect(errorCortesia(errorBackend(409, 'ALREADY_REGISTERED'), 'VIII CIISIC 2026')).toEqual({ mensaje: 'La persona ya tiene una inscripción en VIII CIISIC 2026. Revísala en Inscripciones.', campo: null })
    expect(errorCortesia(errorBackend(422, 'REGISTRATION_TYPE_INVALID'), 'VIII').campo).toBe('tipoInscripcionId')
    expect(errorCortesia(errorBackend(404, 'PARTICIPANT_NOT_FOUND'), 'VIII').mensaje).toBe('El participante ya no existe. Actualiza la lista.')
    expect(errorCortesia(errorBackend(404, 'EVENT_NOT_FOUND'), 'VIII').mensaje).toMatch(/barra superior/)
    expect(errorCortesia(errorBackend(403, 'FORBIDDEN'), 'VIII').mensaje).toMatch(/no tiene permiso/)
  })

  it('con el backend anterior (sin la ruta) avisa que aún no está disponible', () => {
    expect(errorCortesia(errorBackend(404, 'NOT_FOUND'), 'VIII')).toEqual({ mensaje: MENSAJE_CORTESIA_NO_DISPONIBLE, campo: null })
  })

  it('aviso según la credencial', () => {
    expect(resultadoCortesia(null, false)).toEqual({ tono: 'exito', mensaje: expect.stringMatching(/enviar la credencial desde Inscripciones/) })
    expect(resultadoCortesia(true, true)).toEqual({ tono: 'exito', mensaje: expect.stringMatching(/se envió por correo/) })
    expect(resultadoCortesia(false, true)).toEqual({ tono: 'info', mensaje: expect.stringMatching(/no se pudo enviar/) })
    expect(resultadoCortesia(undefined, true).tono).toBe('info')
  })
})
