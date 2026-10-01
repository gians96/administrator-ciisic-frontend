import type { Categoria } from '~/types/api'
import { aErrorApi } from '~/utils/errores'
import { esCorreoDeAcceso, normalizarCorreo } from '~/utils/codigoAcceso'
import { esNoDisponible } from '~/utils/portal'

/**
 * Participantes desde el panel (backend-ciisic spec 014, `contracts/api-asistencia.md`): alta sin
 * inscripción (`POST /participants`, `participantes.gestionar`), inscripción de cortesía
 * (`POST /events/:eventId/courtesy-inscriptions`, `inscripciones.cortesia`) y aviso al cambiar el
 * correo (`PUT /participants/:id`). Con el backend anterior (013) las dos rutas nuevas responden 404
 * de ruta inexistente: la pantalla avisa que aún no están disponibles.
 */

export type TipoDocumento = 'dni' | 'ce'

export const TIPOS_DOCUMENTO: ReadonlyArray<{ valor: TipoDocumento, etiqueta: string }> = [
  { valor: 'dni', etiqueta: 'DNI' },
  { valor: 'ce', etiqueta: 'Carné de extranjería' },
]

/** Mismas reglas que el backend (`participanteSchema`). */
const FORMATO_DNI = /^\d{8}$/
const FORMATO_CE = /^[A-Za-z0-9]{9,12}$/
const FORMATO_CELULAR = /^\+?\d{9,15}$/
const MIN_NOMBRE = 2
export const MAX_NOMBRE = 120
export const LONGITUD_DOCUMENTO: Readonly<Record<TipoDocumento, number>> = { dni: 8, ce: 12 }

/** Inscripción de `GET /participants/:id`. */
export interface InscripcionDeParticipante {
  id: number
  evento: { codigo: string, nombreCorto: string }
  estado: { codigo: string, nombre: string }
  tipoInscripcion: string | null
  creadoEn: string
}

// ─── Alta de participantes ───

export interface FormNuevoParticipante {
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  nombres: string
  apellidos: string
  correo: string
  celular: string
}

export function formularioNuevoParticipante(): FormNuevoParticipante {
  return { tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '' }
}

/** Lo escrito o pegado en el número: el DNI solo con dígitos (8) y el carné solo con letras y dígitos (12). */
export function normalizarDocumento(tipo: TipoDocumento, texto: string): string {
  const limpio = tipo === 'dni' ? texto.replace(/\D/g, '') : texto.replace(/[^0-9A-Za-z]/g, '')
  return limpio.slice(0, LONGITUD_DOCUMENTO[tipo])
}

export function esDocumentoValido(tipo: TipoDocumento, numero: string): boolean {
  return (tipo === 'dni' ? FORMATO_DNI : FORMATO_CE).test(numero)
}

/** Celular sin espacios, guiones ni paréntesis («987 654 321» → «987654321»). */
export function normalizarCelular(texto: string): string {
  return texto.replace(/[\s\-()]/g, '')
}

/**
 * Resultado de «Consultar DNI» para un número. Los nombres solo se bloquean si la consulta encontró
 * ese mismo número (al guardar, el backend usa igualmente los de RENIEC).
 */
export interface ConsultaDni {
  estado: 'INICIAL' | 'CONSULTANDO' | 'ENCONTRADO' | 'FALLO'
  numero: string
  mensaje: string
}

export const CONSULTA_INICIAL: Readonly<ConsultaDni> = Object.freeze({ estado: 'INICIAL', numero: '', mensaje: '' })

/** El botón «Consultar DNI» tiene sentido con un DNI de 8 dígitos. */
export function puedeConsultarDni(form: Pick<FormNuevoParticipante, 'tipoDocumento' | 'numeroDocumento'>): boolean {
  return form.tipoDocumento === 'dni' && FORMATO_DNI.test(form.numeroDocumento)
}

function consultaVigente(form: Pick<FormNuevoParticipante, 'tipoDocumento' | 'numeroDocumento'>, consulta: ConsultaDni): boolean {
  return form.tipoDocumento === 'dni' && consulta.numero === form.numeroDocumento
}

/** Nombres de solo lectura: vienen de la consulta DNI del número actual. */
export function nombresDeConsulta(form: Pick<FormNuevoParticipante, 'tipoDocumento' | 'numeroDocumento'>, consulta: ConsultaDni): boolean {
  return consultaVigente(form, consulta) && consulta.estado === 'ENCONTRADO'
}

/**
 * Con carné de extranjería los nombres son obligatorios; con DNI solo si la consulta del número
 * actual falló (si no, el backend los obtiene de la consulta DNI al guardar).
 */
export function nombresObligatorios(form: Pick<FormNuevoParticipante, 'tipoDocumento' | 'numeroDocumento'>, consulta: ConsultaDni): boolean {
  return form.tipoDocumento === 'ce' || (consultaVigente(form, consulta) && consulta.estado === 'FALLO')
}

/** Nombres y apellidos de la respuesta de `GET /document-lookup/dni/:numero` (`data`), o `null`. */
export function personaDeConsulta(datos: unknown): { nombres: string, apellidos: string } | null {
  if (!datos || typeof datos !== 'object') return null
  const { nombres, apellidos } = datos as Record<string, unknown>
  if (typeof nombres !== 'string' || typeof apellidos !== 'string') return null
  const persona = { nombres: nombres.trim(), apellidos: apellidos.trim() }
  return persona.nombres && persona.apellidos ? persona : null
}

/** Por qué no se completaron los nombres: siempre termina pidiendo escribirlos. */
export function mensajeConsultaDni(error: unknown): string {
  const e = aErrorApi(error)
  if (e.code === 'DOCUMENT_NOT_FOUND') return 'No se encontraron datos para ese DNI. Escribe los nombres y apellidos.'
  if (e.code === 'LOOKUP_UNAVAILABLE') return 'La consulta DNI no está disponible en este momento. Escribe los nombres y apellidos.'
  return `${e.message} Escribe los nombres y apellidos.`
}

function validarNombre(valor: string, obligatorio: boolean, etiqueta: string): string | null {
  const texto = valor.trim()
  if (!texto) return obligatorio ? `Ingresa los ${etiqueta}.` : null
  if (texto.length < MIN_NOMBRE) return `Los ${etiqueta} deben tener al menos ${MIN_NOMBRE} caracteres.`
  if (texto.length > MAX_NOMBRE) return `Los ${etiqueta} deben tener como máximo ${MAX_NOMBRE} caracteres.`
  return null
}

/** Errores por campo antes de enviar (vacío = se puede enviar). */
export function validarNuevoParticipante(form: FormNuevoParticipante, opciones: { nombresObligatorios: boolean }): Record<string, string> {
  const errores: Record<string, string> = {}
  const numero = form.numeroDocumento.trim()
  if (!numero) errores.numeroDocumento = 'Ingresa el número de documento.'
  else if (!esDocumentoValido(form.tipoDocumento, numero)) {
    errores.numeroDocumento = form.tipoDocumento === 'dni' ? 'El DNI debe tener 8 dígitos.' : 'El carné de extranjería debe tener entre 9 y 12 letras o dígitos.'
  }
  const nombres = validarNombre(form.nombres, opciones.nombresObligatorios, 'nombres')
  if (nombres) errores.nombres = nombres
  const apellidos = validarNombre(form.apellidos, opciones.nombresObligatorios, 'apellidos')
  if (apellidos) errores.apellidos = apellidos
  if (!form.correo.trim()) errores.correo = 'Ingresa el correo: con él entra a su portal y recibe sus certificados.'
  else if (!esCorreoDeAcceso(form.correo)) errores.correo = 'Ingresa un correo válido.'
  const celular = normalizarCelular(form.celular)
  if (celular && !FORMATO_CELULAR.test(celular)) errores.celular = 'El celular debe tener entre 9 y 15 dígitos (puede empezar con +).'
  return errores
}

/** Cuerpo de `POST /participants`: sin los opcionales vacíos (el backend rechaza nombres vacíos). */
export function cuerpoNuevoParticipante(form: FormNuevoParticipante): Record<string, string> {
  const cuerpo: Record<string, string> = {
    tipoDocumento: form.tipoDocumento,
    numeroDocumento: form.numeroDocumento.trim(),
    correo: normalizarCorreo(form.correo),
  }
  const nombres = form.nombres.trim()
  const apellidos = form.apellidos.trim()
  const celular = normalizarCelular(form.celular)
  if (nombres) cuerpo.nombres = nombres
  if (apellidos) cuerpo.apellidos = apellidos
  if (celular) cuerpo.celular = celular
  return cuerpo
}

export const MENSAJE_ALTA_NO_DISPONIBLE = 'El registro de participantes aún no está disponible en el servidor. Estará listo con su próxima actualización.'

/** Error de `POST /participants` listo para el formulario. */
export interface ErrorAlta {
  mensaje: string
  campos: Record<string, string>
  /** `PARTICIPANT_EXISTS`: id del registro existente, para abrirlo. */
  existenteId: number | null
}

function idPositivo(valor: unknown): number | null {
  const id = typeof valor === 'number' ? valor : typeof valor === 'string' && /^\d+$/.test(valor.trim()) ? Number(valor) : Number.NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function errorAlta(error: unknown): ErrorAlta {
  if (esNoDisponible(error)) return { mensaje: MENSAJE_ALTA_NO_DISPONIBLE, campos: {}, existenteId: null }
  const e = aErrorApi(error)
  const campos = { ...(e.fields ?? {}) }
  switch (e.code) {
    case 'PARTICIPANT_EXISTS':
      // `fields.id` es el id del registro, no un campo del formulario
      return { mensaje: 'Ya existe un participante con ese documento.', campos: { numeroDocumento: 'Este documento ya está registrado.' }, existenteId: idPositivo(campos.id) }
    case 'EMAIL_IN_USE':
      return { mensaje: 'El correo ya es de otra persona registrada. Usa otro correo o búscala en la lista para corregir su registro.', campos: { correo: 'Este correo ya lo usa otra persona.' }, existenteId: null }
    case 'NAMES_REQUIRED':
      return {
        mensaje: e.message,
        campos: { nombres: campos.nombres ?? 'Ingresa los nombres.', apellidos: campos.apellidos ?? 'Ingresa los apellidos.' },
        existenteId: null,
      }
    default:
      return { mensaje: e.message, campos, existenteId: null }
  }
}

/** Campos marcados al fallar `PUT /participants/:id` (el backend no marca el correo en `EMAIL_IN_USE`). */
export function camposErrorEdicion(error: unknown): Record<string, string> {
  const e = aErrorApi(error)
  if (e.code === 'EMAIL_IN_USE') return { ...(e.fields ?? {}), correo: 'Este correo ya lo usa otra persona.' }
  return e.fields ?? {}
}

// ─── Cambio de correo ───

/** El correo escrito es otro (sin contar mayúsculas ni espacios alrededor). */
export function cambiaCorreo(anterior: string, nuevo: string): boolean {
  const correo = normalizarCorreo(nuevo)
  return correo !== '' && correo !== normalizarCorreo(anterior)
}

/** Aviso antes de guardar un correo nuevo (`PUT /participants/:id`). */
export function avisoCambioCorreo(anterior: string, googleVinculado = false): string {
  const google = googleVinculado ? ' También se desvinculará su cuenta de Google.' : ''
  return `Se avisará al correo anterior (${anterior}) del cambio y se cerrarán sus sesiones del portal.${google}`
}

// ─── Inscripción de cortesía ───

export interface GrupoTipos {
  id: number
  categoria: string
  tipos: Array<{ id: number, etiqueta: string }>
}

/**
 * Tipos de inscripción del evento agrupados por categoría (para `<optgroup>`), en el orden del
 * evento. Incluye los inactivos (p. ej. «Ponente»): la cortesía los admite.
 */
export function gruposTiposCortesia(categorias: readonly Categoria[]): GrupoTipos[] {
  return [...categorias]
    .sort((a, b) => a.orden - b.orden)
    .map((categoria) => ({
      id: categoria.id,
      categoria: categoria.nombre,
      tipos: [...categoria.tipos]
        .sort((a, b) => a.orden - b.orden)
        .map((tipo) => ({
          id: tipo.id,
          etiqueta: `${tipo.nombre}${tipo.etiqueta ? ` · ${tipo.etiqueta}` : ''}${tipo.activo ? '' : ' (inactivo)'}`,
        })),
    }))
    .filter((grupo) => grupo.tipos.length > 0)
}

export interface FormCortesia {
  /** `null`: sin tipo de inscripción. */
  tipoInscripcionId: number | null
  enviarCredencial: boolean
}

export function formularioCortesia(): FormCortesia {
  return { tipoInscripcionId: null, enviarCredencial: false }
}

/** Cuerpo de `POST /events/:eventId/courtesy-inscriptions`. */
export function cuerpoCortesia(participanteId: number, form: FormCortesia): { participanteId: number, tipoInscripcionId: number | null, enviarCredencial: boolean } {
  const tipo = form.tipoInscripcionId
  return {
    participanteId,
    tipoInscripcionId: typeof tipo === 'number' && Number.isSafeInteger(tipo) && tipo > 0 ? tipo : null,
    enviarCredencial: form.enviarCredencial,
  }
}

/** Inscripción que la persona ya tiene en el evento (el backend respondería `ALREADY_REGISTERED`). */
export function inscripcionEnEvento<T extends Pick<InscripcionDeParticipante, 'evento'>>(inscripciones: readonly T[] | null | undefined, codigoEvento: string | null | undefined): T | null {
  if (!codigoEvento) return null
  return inscripciones?.find((inscripcion) => inscripcion.evento.codigo === codigoEvento) ?? null
}

export const MENSAJE_CORTESIA_NO_DISPONIBLE = 'Las inscripciones de cortesía aún no están disponibles en el servidor. Estarán listas con su próxima actualización.'

/** Error de la cortesía listo para el modal; `campo` marca el tipo de inscripción. */
export interface ErrorCortesia {
  mensaje: string
  campo: 'tipoInscripcionId' | null
}

export function errorCortesia(error: unknown, evento: string): ErrorCortesia {
  if (esNoDisponible(error)) return { mensaje: MENSAJE_CORTESIA_NO_DISPONIBLE, campo: null }
  const e = aErrorApi(error)
  switch (e.code) {
    case 'ALREADY_REGISTERED':
      return { mensaje: `La persona ya tiene una inscripción en ${evento}. Revísala en Inscripciones.`, campo: null }
    case 'REGISTRATION_TYPE_INVALID':
      return { mensaje: 'El tipo de inscripción ya no existe o no es de este evento. Elige otro o deja «Sin tipo de inscripción».', campo: 'tipoInscripcionId' }
    case 'PARTICIPANT_NOT_FOUND':
      return { mensaje: 'El participante ya no existe. Actualiza la lista.', campo: null }
    case 'EVENT_NOT_FOUND':
      return { mensaje: 'El evento ya no existe. Elige otro en la barra superior.', campo: null }
    case 'DUPLICATE_RECORD':
      return { mensaje: 'No se pudo generar el código de la inscripción. Intenta nuevamente.', campo: null }
    default:
      return { mensaje: e.message, campo: null }
  }
}

/** Aviso tras crear la cortesía según `credencialEnviada` (`null` si no se pidió enviarla). */
export function resultadoCortesia(credencialEnviada: boolean | null | undefined, pidioCredencial: boolean): { tono: 'exito' | 'info', mensaje: string } {
  const base = 'Inscripción de cortesía registrada y aprobada.'
  if (!pidioCredencial) return { tono: 'exito', mensaje: `${base} Puedes enviar la credencial desde Inscripciones.` }
  if (credencialEnviada === true) return { tono: 'exito', mensaje: `${base} La credencial se envió por correo.` }
  return { tono: 'info', mensaje: `${base} La credencial no se pudo enviar ahora: reenvíala desde Inscripciones.` }
}
