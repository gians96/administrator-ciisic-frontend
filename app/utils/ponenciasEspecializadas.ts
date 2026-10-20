import { aErrorApi } from '~/utils/errores'
import { esCorreoDeAcceso, normalizarCorreo } from '~/utils/codigoAcceso'
import { hoyEnLima } from '~/utils/tokensAcceso'
import {
  esDocumentoValido,
  normalizarCelular,
  type TipoDocumento,
} from '~/utils/participantes'

/**
 * Ponencias especializadas (backend-ciisic spec 019, `contracts/api-ponencias-especializadas.md`):
 * programa, inscripciones con filtros y asistencia en puerta con el DNI. No son los «papers» del
 * Call for Papers (esos son `/ponencias`).
 */

export type Modalidad = 'PRESENCIAL' | 'VIRTUAL'
export type Procedencia = 'INTERNO' | 'EXTERNO'
export type EstadoInscripcionPonencia = 'INSCRITO' | 'CANCELADO'
export type OrigenInscripcion = 'LANDING' | 'STAFF' | 'PUERTA'
export type MotivoCancelacion = 'STAFF' | 'CAMBIO_EN_PUERTA'

export interface PonenteEspecializado {
  nombre: string
  bio: string | null
  foto: string | null
  externo: boolean
}

export interface PonenciaEspecializada {
  id: number
  eventoId: number
  tema: string
  /** `YYYY-MM-DD`. */
  fecha: string
  /** `HH:mm` en hora de Lima. */
  horaInicio: string
  horaFin: string
  duracionMin: number
  ambiente: string
  modalidad: Modalidad
  precio: number
  esGratuita: boolean
  /** `null`: sin límite. */
  cupo: number | null
  inscritos: number
  asistentes: number
  cuposDisponibles: number | null
  ponente: PonenteEspecializado
  publicada: boolean
  orden: number
}

export interface AsistentePonencia {
  id: number
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidos: string
  correo: string | null
  celular: string | null
  procedencia: Procedencia | null
}

export interface InscripcionPonencia {
  id: number
  estado: EstadoInscripcionPonencia
  origen: OrigenInscripcion
  creadoEn: string
  canceladoEn: string | null
  motivoCancelacion: MotivoCancelacion | null
  asistioEn: string | null
  esFueraDeHorario: boolean
  asistente: AsistentePonencia
  ponencia: Pick<PonenciaEspecializada, 'id' | 'tema' | 'fecha' | 'horaInicio' | 'horaFin' | 'ambiente' | 'modalidad'>
  registradoPor: { id: number, nombres: string, apellidos: string } | null
  asistenciaPor: { id: number, nombres: string, apellidos: string } | null
}

/** Respuesta de `POST /specialized-talks/:id/check-in`. */
export interface ResultadoPuerta {
  id: number
  inscripcionNueva: boolean
  asistioEn: string
  esFueraDeHorario: boolean
  asistente: AsistentePonencia
  ponencia: { id: number, tema: string, ambiente: string, cupo: number | null, inscritos: number, asistentes: number }
  liberadas: Array<{ inscripcionId: number, ponenciaId: number, tema: string, ambiente: string }>
}

// ─── Etiquetas ───

export const MODALIDADES: ReadonlyArray<{ valor: Modalidad, etiqueta: string }> = [
  { valor: 'PRESENCIAL', etiqueta: 'Presencial' },
  { valor: 'VIRTUAL', etiqueta: 'Virtual' },
]

export const PROCEDENCIAS: ReadonlyArray<{ valor: Procedencia, etiqueta: string }> = [
  { valor: 'INTERNO', etiqueta: 'Interno (UNDC)' },
  { valor: 'EXTERNO', etiqueta: 'Externo' },
]

export function etiquetaModalidad(modalidad: string): string {
  return MODALIDADES.find((m) => m.valor === modalidad)?.etiqueta ?? modalidad
}

export function etiquetaProcedencia(procedencia: string | null | undefined): string {
  return PROCEDENCIAS.find((p) => p.valor === procedencia)?.etiqueta ?? 'Sin dato'
}

const ORIGENES: Readonly<Record<OrigenInscripcion, string>> = { LANDING: 'Landing', STAFF: 'Staff', PUERTA: 'En puerta' }

export function etiquetaOrigen(origen: string): string {
  return ORIGENES[origen as OrigenInscripcion] ?? origen
}

export function etiquetaMotivoCancelacion(motivo: string | null | undefined): string {
  if (motivo === 'CAMBIO_EN_PUERTA') return 'Cambió de ponencia en puerta'
  if (motivo === 'STAFF') return 'Cancelada por el staff'
  return 'Cancelada'
}

// ─── Horario y cupos ───

/** «45 min», «1 h», «1 h 30 min». */
export function duracionTexto(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '—'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

export function rangoHorario(horaInicio: string, horaFin: string): string {
  return `${horaInicio} – ${horaFin}`
}

function aMinutos(hora: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Hora de fin a partir del inicio y la duración; `null` si no es válida o pasa de la medianoche. */
export function horaFinDesde(horaInicio: string, duracionMin: number): string | null {
  const inicio = aMinutos(horaInicio)
  if (inicio === null || !Number.isInteger(duracionMin) || duracionMin < 1) return null
  const fin = inicio + duracionMin
  if (fin >= 24 * 60) return null
  return `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`
}

/** Duración en minutos entre dos horas `HH:mm` (0 si no es válida). */
export function minutosEntre(horaInicio: string, horaFin: string): number {
  const inicio = aMinutos(horaInicio)
  const fin = aMinutos(horaFin)
  return inicio === null || fin === null || fin <= inicio ? 0 : fin - inicio
}

/** «14 / 20» o «14 · sin límite». */
export function textoCupo(ponencia: Pick<PonenciaEspecializada, 'cupo' | 'inscritos'>): string {
  return ponencia.cupo === null ? `${ponencia.inscritos} · sin límite` : `${ponencia.inscritos} / ${ponencia.cupo}`
}

export type TonoCupo = 'ok' | 'warn' | 'error' | 'neutral'

/** Lleno = error; desde el 80 % = aviso. Sin límite = neutro. */
export function tonoCupo(ponencia: Pick<PonenciaEspecializada, 'cupo' | 'inscritos'>): TonoCupo {
  if (ponencia.cupo === null) return 'neutral'
  if (ponencia.inscritos >= ponencia.cupo) return 'error'
  return ponencia.inscritos / ponencia.cupo >= 0.8 ? 'warn' : 'ok'
}

export interface DiaDePonencias {
  fecha: string
  ponencias: PonenciaEspecializada[]
}

/** Agrupa por día (cronológico) y ordena cada día por hora, orden y ambiente. */
export function agruparPorDia(ponencias: readonly PonenciaEspecializada[]): DiaDePonencias[] {
  const dias = new Map<string, PonenciaEspecializada[]>()
  for (const ponencia of ponencias) dias.set(ponencia.fecha, [...(dias.get(ponencia.fecha) ?? []), ponencia])
  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, delDia]) => ({
      fecha,
      ponencias: [...delDia].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.orden - b.orden || a.ambiente.localeCompare(b.ambiente, 'es', { numeric: true })),
    }))
}

/**
 * Ponencia a preseleccionar en la puerta: la que está en curso o por empezar hoy y, si no, la primera
 * de hoy; si hoy no hay ninguna, la primera del programa.
 */
export function ponenciaDePuertaInicial(ponencias: readonly PonenciaEspecializada[], ahora = new Date()): PonenciaEspecializada | null {
  if (!ponencias.length) return null
  const hoy = hoyEnLima(ahora)
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(ahora)
  const delDia = agruparPorDia(ponencias).find((dia) => dia.fecha === hoy)?.ponencias ?? []
  return delDia.find((p) => p.horaFin >= hora) ?? delDia[0] ?? agruparPorDia(ponencias)[0]?.ponencias[0] ?? null
}

// ─── Formulario de la ponencia ───

export interface FormPonencia {
  tema: string
  fecha: string
  horaInicio: string
  duracionMin: string
  ambiente: string
  modalidad: Modalidad
  esGratuita: boolean
  precio: string
  /** Vacío = sin límite. */
  cupo: string
  ponenteNombre: string
  ponenteBio: string
  ponenteFoto: string
  ponenteExterno: boolean
  publicada: boolean
  orden: string
}

export function formularioPonencia(ponencia?: PonenciaEspecializada | null): FormPonencia {
  if (!ponencia) {
    return {
      tema: '', fecha: '', horaInicio: '12:00', duracionMin: '45', ambiente: '', modalidad: 'PRESENCIAL', esGratuita: true, precio: '', cupo: '',
      ponenteNombre: '', ponenteBio: '', ponenteFoto: '', ponenteExterno: false, publicada: true, orden: '0',
    }
  }
  return {
    tema: ponencia.tema,
    fecha: ponencia.fecha,
    horaInicio: ponencia.horaInicio,
    duracionMin: String(ponencia.duracionMin),
    ambiente: ponencia.ambiente,
    modalidad: ponencia.modalidad,
    esGratuita: ponencia.esGratuita,
    precio: ponencia.esGratuita ? '' : String(ponencia.precio),
    cupo: ponencia.cupo === null ? '' : String(ponencia.cupo),
    ponenteNombre: ponencia.ponente.nombre,
    ponenteBio: ponencia.ponente.bio ?? '',
    ponenteFoto: ponencia.ponente.foto ?? '',
    ponenteExterno: ponencia.ponente.externo,
    publicada: ponencia.publicada,
    orden: String(ponencia.orden),
  }
}

const ENTERO = /^\d+$/

/** Errores por campo antes de enviar (vacío = se puede enviar). */
export function validarPonencia(form: FormPonencia): Record<string, string> {
  const errores: Record<string, string> = {}
  const tema = form.tema.trim()
  if (tema.length < 3) errores.tema = 'Escribe el tema (mínimo 3 caracteres).'
  else if (tema.length > 300) errores.tema = 'El tema admite hasta 300 caracteres.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) errores.fecha = 'Elige la fecha.'
  if (aMinutos(form.horaInicio) === null) errores.horaInicio = 'Elige la hora de inicio.'
  const duracion = ENTERO.test(form.duracionMin.trim()) ? Number(form.duracionMin) : 0
  if (duracion < 1) errores.duracionMin = 'Indica la duración en minutos.'
  else if (aMinutos(form.horaInicio) !== null && horaFinDesde(form.horaInicio, duracion) === null) errores.duracionMin = 'La ponencia debe terminar antes de la medianoche.'
  if (!form.ambiente.trim()) errores.ambiente = 'Indica el ambiente (laboratorio, aula o plataforma).'
  if (!form.esGratuita) {
    const precio = Number(form.precio.replace(',', '.'))
    if (!form.precio.trim() || !Number.isFinite(precio) || precio <= 0) errores.precio = 'Indica un precio mayor que cero o márcala como gratuita.'
    else if (!Number.isInteger(Number((precio * 100).toFixed(6)))) errores.precio = 'Usa como máximo dos decimales.'
  }
  const cupo = form.cupo.trim()
  if (cupo && (!ENTERO.test(cupo) || Number(cupo) < 1)) errores.cupo = 'El cupo es un número entero desde 1 (vacío = sin límite).'
  if (form.ponenteNombre.trim().length < 2) errores['ponente.nombre'] = 'Escribe el nombre del ponente.'
  const foto = form.ponenteFoto.trim()
  if (foto && !(/^\/(?!\/)[\w./-]+$/.test(foto) && !foto.includes('..')) && !/^https:\/\/\S+$/i.test(foto)) {
    errores['ponente.foto'] = 'Usa una ruta del sitio (/images/…) o una URL https.'
  }
  if (form.orden.trim() && !ENTERO.test(form.orden.trim())) errores.orden = 'El orden es un número entero.'
  return errores
}

/** Cuerpo de `POST /events/:eventId/specialized-talks` y `PUT /specialized-talks/:id`. */
export function cuerpoPonencia(form: FormPonencia): Record<string, unknown> {
  const duracion = Number(form.duracionMin)
  return {
    tema: form.tema.trim(),
    fecha: form.fecha,
    horaInicio: form.horaInicio,
    horaFin: horaFinDesde(form.horaInicio, duracion),
    ambiente: form.ambiente.trim(),
    modalidad: form.modalidad,
    precio: form.esGratuita ? 0 : Number(form.precio.replace(',', '.')),
    cupo: form.cupo.trim() ? Number(form.cupo) : null,
    ponente: {
      nombre: form.ponenteNombre.trim(),
      bio: form.ponenteBio.trim() || null,
      foto: form.ponenteFoto.trim() || null,
      externo: form.ponenteExterno,
    },
    publicada: form.publicada,
    orden: form.orden.trim() ? Number(form.orden) : 0,
  }
}

// ─── Filtros de las inscripciones ───

export interface FiltrosInscripcionesPonencia {
  ponenciaId: string
  fecha: string
  modalidad: string
  estado: string
  asistencia: string
  procedencia: string
  origen: string
  q: string
  page: number
}

export const FILTROS_PONENCIA_VACIOS: Readonly<FiltrosInscripcionesPonencia> = Object.freeze({
  ponenciaId: '', fecha: '', modalidad: '', estado: '', asistencia: '', procedencia: '', origen: '', q: '', page: 1,
})

const CLAVES_FILTRO = ['ponenciaId', 'fecha', 'modalidad', 'estado', 'asistencia', 'procedencia', 'origen', 'q'] as const

/** Lee los filtros desde la query de la ruta (valores inválidos se ignoran). */
export function filtrosPonenciaDesdeQuery(query: Record<string, unknown>): FiltrosInscripcionesPonencia {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '')
  const opcion = (valor: unknown, permitidos: readonly string[]) => (permitidos.includes(texto(valor)) ? texto(valor) : '')
  const page = Number(texto(query.page))
  return {
    ponenciaId: ENTERO.test(texto(query.ponenciaId)) ? texto(query.ponenciaId) : '',
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(texto(query.fecha)) ? texto(query.fecha) : '',
    modalidad: opcion(query.modalidad, ['PRESENCIAL', 'VIRTUAL']),
    estado: opcion(query.estado, ['INSCRITO', 'CANCELADO']),
    asistencia: opcion(query.asistencia, ['si', 'no']),
    procedencia: opcion(query.procedencia, ['INTERNO', 'EXTERNO', 'SIN_DATO']),
    origen: opcion(query.origen, ['LANDING', 'STAFF', 'PUERTA']),
    q: texto(query.q).slice(0, 100),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

/** Parámetros no vacíos para la API o la URL. */
export function parametrosPonencia(filtros: FiltrosInscripcionesPonencia, incluirPagina = true): Record<string, string> {
  const params: Record<string, string> = {}
  for (const clave of CLAVES_FILTRO) {
    const valor = filtros[clave].trim()
    if (valor) params[clave] = valor
  }
  if (incluirPagina && filtros.page > 1) params.page = String(filtros.page)
  return params
}

export function hayFiltros(filtros: FiltrosInscripcionesPonencia): boolean {
  return CLAVES_FILTRO.some((clave) => filtros[clave].trim() !== '')
}

// ─── Persona (alta manual y puerta) ───

export interface FormPersona {
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  nombres: string
  apellidos: string
  correo: string
  celular: string
  procedencia: '' | Procedencia
}

export function formularioPersona(): FormPersona {
  return { tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', procedencia: '' }
}

/**
 * Errores por campo antes de enviar. Correo, celular y procedencia son opcionales; los nombres solo
 * se exigen si ya se sabe que el DNI no los traerá (carné de extranjería o `NAMES_REQUIRED`).
 */
export function validarPersona(form: FormPersona, opciones: { nombresObligatorios: boolean }): Record<string, string> {
  const errores: Record<string, string> = {}
  const numero = form.numeroDocumento.trim()
  if (!numero) errores.numeroDocumento = 'Ingresa el número de documento.'
  else if (!esDocumentoValido(form.tipoDocumento, numero)) {
    errores.numeroDocumento = form.tipoDocumento === 'dni' ? 'El DNI debe tener 8 dígitos.' : 'El carné de extranjería debe tener entre 9 y 12 letras o dígitos.'
  }
  for (const [campo, etiqueta] of [['nombres', 'nombres'], ['apellidos', 'apellidos']] as const) {
    const valor = form[campo].trim()
    if (!valor && opciones.nombresObligatorios) errores[campo] = `Ingresa los ${etiqueta}.`
    else if (valor && valor.length < 2) errores[campo] = `Los ${etiqueta} deben tener al menos 2 caracteres.`
    else if (valor.length > 120) errores[campo] = `Los ${etiqueta} admiten hasta 120 caracteres.`
  }
  if (form.correo.trim() && !esCorreoDeAcceso(form.correo)) errores.correo = 'Ingresa un correo válido.'
  const celular = normalizarCelular(form.celular)
  if (celular && !/^\+?\d{9,15}$/.test(celular)) errores.celular = 'El celular debe tener entre 9 y 15 dígitos (puede empezar con +).'
  return errores
}

/** Cuerpo de la persona: sin los opcionales vacíos (el backend los trata como ausentes). */
export function cuerpoPersona(form: FormPersona): Record<string, string> {
  const cuerpo: Record<string, string> = { tipoDocumento: form.tipoDocumento, numeroDocumento: form.numeroDocumento.trim() }
  const nombres = form.nombres.trim()
  const apellidos = form.apellidos.trim()
  const correo = form.correo.trim()
  const celular = normalizarCelular(form.celular)
  if (nombres) cuerpo.nombres = nombres
  if (apellidos) cuerpo.apellidos = apellidos
  if (correo) cuerpo.correo = normalizarCorreo(correo)
  if (celular) cuerpo.celular = celular
  if (form.procedencia) cuerpo.procedencia = form.procedencia
  return cuerpo
}

/** Cuerpo de `PATCH /specialized-talk-registrations/:id` para corregir los datos de la persona (vacío borra). */
export function cuerpoCorreccion(form: Pick<FormPersona, 'nombres' | 'apellidos' | 'correo' | 'celular' | 'procedencia'>): { asistente: Record<string, string> } {
  return {
    asistente: {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      correo: form.correo.trim() ? normalizarCorreo(form.correo) : '',
      celular: normalizarCelular(form.celular),
      procedencia: form.procedencia,
    },
  }
}

// ─── Resultado y errores de la puerta ───

export type TonoPuerta = 'ok' | 'aviso' | 'error'

export interface MensajePuerta {
  tono: TonoPuerta
  titulo: string
  detalle: string
}

/** Lo que ve el operador tras una lectura correcta. */
export function mensajeDePuerta(resultado: ResultadoPuerta): MensajePuerta {
  const nombre = `${resultado.asistente.nombres} ${resultado.asistente.apellidos}`.trim()
  const partes: string[] = []
  if (resultado.inscripcionNueva) partes.push('No estaba inscrito: se inscribió en el acto.')
  if (resultado.liberadas.length) {
    partes.push(`Se liberó su cupo en ${resultado.liberadas.map((l) => `«${l.tema}» (${l.ambiente})`).join(' y ')}.`)
  }
  if (resultado.esFueraDeHorario) partes.push('Fuera del horario de la ponencia.')
  const conAviso = resultado.inscripcionNueva || resultado.liberadas.length > 0 || resultado.esFueraDeHorario
  return {
    tono: conAviso ? 'aviso' : 'ok',
    titulo: `Asistencia registrada · ${nombre}`,
    detalle: partes.join(' ') || 'Estaba inscrito en esta ponencia.',
  }
}

export interface ErrorPuerta extends MensajePuerta {
  /** Código del error del backend (`TALK_FULL`, `ATTENDANCE_ALREADY_REGISTERED`…). */
  codigo: string
  /** `NAMES_REQUIRED`: el DNI no trajo nombres, hay que escribirlos. */
  pideNombres: boolean
  campos: Record<string, string>
}

/** Error de `check-in` o del alta manual listo para mostrar. */
export function errorDePuerta(error: unknown): ErrorPuerta {
  const e = aErrorApi(error)
  const base = { codigo: e.code, pideNombres: false, campos: e.fields ?? {} }
  switch (e.code) {
    case 'NAMES_REQUIRED':
      return { ...base, tono: 'aviso', titulo: 'No se encontraron los nombres del DNI', detalle: 'Escribe los nombres y apellidos y vuelve a registrar.', pideNombres: true }
    case 'TALK_FULL':
      return { ...base, tono: 'error', titulo: 'Sin cupos', detalle: e.message }
    case 'ATTENDANCE_ALREADY_REGISTERED':
      return { ...base, tono: 'aviso', titulo: 'Ya registrada', detalle: e.message }
    case 'VALIDATION_ERROR':
      return { ...base, tono: 'error', titulo: 'Documento no válido', detalle: Object.values(e.fields ?? {}).join(' · ') || e.message }
    default:
      return { ...base, tono: 'error', titulo: 'No se pudo registrar', detalle: e.message }
  }
}

// ─── Enlace entre pantallas ───

/** Enlace a la lista de inscripciones filtrada por una ponencia. */
export function enlaceInscripciones(ponenciaId: number): string {
  return `/ponencias-especializadas/inscripciones?ponenciaId=${ponenciaId}`
}
