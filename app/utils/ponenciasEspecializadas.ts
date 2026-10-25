import { aErrorApi } from '~/utils/errores'
import { esCorreoDeAcceso, normalizarCorreo } from '~/utils/codigoAcceso'
import { hoyEnLima } from '~/utils/tokensAcceso'
import { origenLanding } from '~/utils/delegaciones'
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
export type MotivoCancelacion = 'STAFF' | 'CAMBIO_EN_PUERTA' | 'SIN_CONGRESO'

export interface PonenteEspecializado {
  nombre: string
  bio: string | null
  foto: string | null
  externo: boolean
}

/** Cuántos ponentes se pueden sumar al principal en un mismo tema (backend spec 032). */
export const MAXIMO_COPONENTES = 3

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
  /** Total vigente (presenciales y virtuales). */
  inscritos: number
  /** Solo los presenciales ocupan el cupo (backend spec 030); un backend anterior no los envía. */
  inscritosPresenciales?: number
  inscritosVirtuales?: number
  asistentes: number
  cuposDisponibles: number | null
  ponente: PonenteEspecializado
  /** Los demás ponentes de un tema compartido (backend spec 032); un backend anterior no lo envía. */
  coponentes?: PonenteEspecializado[]
  publicada: boolean
  orden: number
}

/** Todos los ponentes del tema: el principal y, si lo comparten, los demás. */
export function ponentesDeLaPonencia(ponencia: Pick<PonenciaEspecializada, 'ponente' | 'coponentes'>): PonenteEspecializado[] {
  return [ponencia.ponente, ...(ponencia.coponentes ?? [])]
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
  /** Validada con una inscripción aprobada al congreso (backend spec 030); ausente en un backend anterior. */
  validada?: boolean
  modoAsistencia?: Modalidad
  congreso?: CongresoDeInscripcion | null
  asistente: AsistentePonencia
  ponencia: Pick<PonenciaEspecializada, 'id' | 'tema' | 'fecha' | 'horaInicio' | 'horaFin' | 'ambiente' | 'modalidad'>
  registradoPor: { id: number, nombres: string, apellidos: string } | null
  asistenciaPor: { id: number, nombres: string, apellidos: string } | null
}

/** Estado **actual** de la inscripción al congreso con la que se validó una inscripción a ponencia. */
export interface CongresoDeInscripcion {
  estado: string
  tipo: string | null
  categoria: string | null
}

/** Respuesta de `GET|PUT events/:id/specialized-talks/access`. */
export interface AccesoPonencias {
  /** Encendido, se inscribe cualquiera solo con su documento; apagado, solo congresistas con el pago aprobado. */
  accesoLibre: boolean
}

/** Respuesta de `POST /specialized-talks/:id/check-in`. */
export interface ResultadoPuerta {
  id: number
  inscripcionNueva: boolean
  asistioEn: string
  esFueraDeHorario: boolean
  validada?: boolean
  modoAsistencia?: Modalidad
  asistente: AsistentePonencia
  ponencia: { id: number, tema: string, ambiente: string, cupo: number | null, inscritos: number, presenciales?: number, virtuales?: number, asistentes: number }
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

/** Modo de asistencia al congreso (presencial u en línea). */
export function etiquetaModo(modo: string | null | undefined): string {
  return modo === 'VIRTUAL' ? 'Virtual' : 'Presencial'
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
  if (motivo === 'SIN_CONGRESO') return 'Cancelada: sin inscripción aprobada al congreso'
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

type ConConteo = Pick<PonenciaEspecializada, 'cupo' | 'inscritos' | 'inscritosPresenciales' | 'inscritosVirtuales'>

/** Inscritos que ocupan aforo: solo los presenciales (un backend anterior no los separa y cuenta todos). */
export function presenciales(ponencia: Pick<PonenciaEspecializada, 'inscritos' | 'inscritosPresenciales'>): number {
  return ponencia.inscritosPresenciales ?? ponencia.inscritos
}

/** «14 / 20» (presenciales sobre el cupo) o «14 · sin límite»; los virtuales no ocupan aforo y se suman aparte: «14 / 20 · +3 virtuales». */
export function textoCupo(ponencia: ConConteo): string {
  const base = ponencia.cupo === null ? `${presenciales(ponencia)} · sin límite` : `${presenciales(ponencia)} / ${ponencia.cupo}`
  const virtuales = ponencia.inscritosVirtuales ?? 0
  return virtuales > 0 ? `${base} · +${virtuales} virtual${virtuales === 1 ? '' : 'es'}` : base
}

export type TonoCupo = 'ok' | 'warn' | 'error' | 'neutral'

/** Aforo presencial lleno = error; desde el 80 % = aviso. Sin límite = neutro. */
export function tonoCupo(ponencia: ConConteo): TonoCupo {
  if (ponencia.cupo === null) return 'neutral'
  const ocupados = presenciales(ponencia)
  if (ocupados >= ponencia.cupo) return 'error'
  return ocupados / ponencia.cupo >= 0.8 ? 'warn' : 'ok'
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

/** Un ponente del formulario (el principal va en los campos `ponente*` de `FormPonencia`; los demás, aquí). */
export interface FormPonente {
  nombre: string
  bio: string
  foto: string
  externo: boolean
}

export function ponenteVacio(): FormPonente {
  return { nombre: '', bio: '', foto: '', externo: false }
}

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
  /** Los demás ponentes del tema, hasta `MAXIMO_COPONENTES`; vacío = lo dicta una sola persona. */
  coponentes: FormPonente[]
  publicada: boolean
  orden: string
}

export function formularioPonencia(ponencia?: PonenciaEspecializada | null): FormPonencia {
  if (!ponencia) {
    return {
      tema: '', fecha: '', horaInicio: '12:00', duracionMin: '45', ambiente: '', modalidad: 'PRESENCIAL', esGratuita: true, precio: '', cupo: '',
      ponenteNombre: '', ponenteBio: '', ponenteFoto: '', ponenteExterno: false, coponentes: [], publicada: true, orden: '0',
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
    coponentes: (ponencia.coponentes ?? []).map((p) => ({ nombre: p.nombre, bio: p.bio ?? '', foto: p.foto ?? '', externo: p.externo })),
    publicada: ponencia.publicada,
    orden: String(ponencia.orden),
  }
}

const ENTERO = /^\d+$/

/** Ruta del sitio (`/images/…`, sin `..`) o URL https: lo único que el backend acepta como foto. */
function esFotoDelPonente(foto: string): boolean {
  return (/^\/(?!\/)[\w./-]+$/.test(foto) && !foto.includes('..')) || /^https:\/\/\S+$/i.test(foto)
}

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
  if (foto && !esFotoDelPonente(foto)) errores['ponente.foto'] = 'Usa una ruta del sitio (/images/…) o una URL https.'
  if (form.coponentes.length > MAXIMO_COPONENTES) errores.coponentes = `Un tema admite hasta ${MAXIMO_COPONENTES} ponentes adicionales.`
  form.coponentes.forEach((coponente, i) => {
    if (coponente.nombre.trim().length < 2) errores[`coponentes[${i}].nombre`] = 'Escribe el nombre del ponente.'
    const fotoCoponente = coponente.foto.trim()
    if (fotoCoponente && !esFotoDelPonente(fotoCoponente)) errores[`coponentes[${i}].foto`] = 'Usa una ruta del sitio (/images/…) o una URL https.'
  })
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
    // Siempre se envía: la lista reemplaza a la guardada y `[]` deja el tema con un solo ponente
    coponentes: form.coponentes.map((p) => ({ nombre: p.nombre.trim(), bio: p.bio.trim() || null, foto: p.foto.trim() || null, externo: p.externo })),
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
  /** `si`: validadas con el congreso; `no`: sin validar. */
  validacion: string
  /** Modo de asistencia (presencial o virtual); no es la `modalidad` de la ponencia. */
  modo: string
  q: string
  page: number
}

export const FILTROS_PONENCIA_VACIOS: Readonly<FiltrosInscripcionesPonencia> = Object.freeze({
  ponenciaId: '', fecha: '', modalidad: '', estado: '', asistencia: '', procedencia: '', origen: '', validacion: '', modo: '', q: '', page: 1,
})

const CLAVES_FILTRO = ['ponenciaId', 'fecha', 'modalidad', 'estado', 'asistencia', 'procedencia', 'origen', 'validacion', 'modo', 'q'] as const

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
    validacion: opcion(query.validacion, ['si', 'no']),
    modo: opcion(query.modo, ['PRESENCIAL', 'VIRTUAL']),
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

// ─── Validación con el congreso ───

/** Textos de la confirmación al encender o apagar el acceso libre del evento. */
export function textoCambioAcceso(encender: boolean): { titulo: string, mensaje: string, confirmar: string } {
  return encender
    ? {
        titulo: 'Encender el acceso libre',
        mensaje: 'Cualquier persona podrá inscribirse a las ponencias solo con su documento, sin comprobar su inscripción al congreso ni el pago. Toma efecto de inmediato en la landing, el alta manual y la puerta.',
        confirmar: 'Encender acceso libre',
      }
    : {
        titulo: 'Exigir la inscripción al congreso',
        mensaje: 'Solo podrán inscribirse a las ponencias quienes tengan su inscripción al congreso con el pago aprobado (DNI y correo en la landing; DNI en el panel y la puerta). Quienes ya se inscribieron libremente quedan «Sin validar». Toma efecto de inmediato.',
        confirmar: 'Exigir congreso',
      }
}

export interface EtiquetaValidacion {
  texto: string
  tono: 'brand' | 'info' | 'warn' | 'error'
  detalle: string
}

/**
 * Cómo se ve una inscripción respecto al congreso (backend spec 030): validada con su modo, sin validar
 * (acceso libre o anterior a la validación) o validada pero con un pago que ya no está aprobado. Un backend
 * anterior no envía `validada`: no se marca nada.
 */
export function etiquetaValidacion(inscripcion: Pick<InscripcionPonencia, 'validada' | 'modoAsistencia' | 'congreso'>): EtiquetaValidacion | null {
  if (inscripcion.validada === undefined) return null
  if (!inscripcion.validada) return { texto: 'Sin validar', tono: 'warn', detalle: 'No se comprobó una inscripción aprobada al congreso.' }
  const modo = etiquetaModo(inscripcion.modoAsistencia)
  const congreso = inscripcion.congreso
  if (congreso && congreso.estado !== 'APROBADO') {
    return { texto: `${modo} · pago no vigente`, tono: 'error', detalle: `La inscripción al congreso está ${congreso.estado.toLowerCase().replace('_', ' ')}: revisa si debe seguir inscrito.` }
  }
  const tipo = congreso?.tipo ? ` · ${congreso.tipo}` : ''
  return { texto: modo, tono: inscripcion.modoAsistencia === 'VIRTUAL' ? 'info' : 'brand', detalle: `Congresista aprobado${tipo}` }
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
  const virtual = resultado.modoAsistencia === 'VIRTUAL'
  if (virtual) partes.push('Congresista virtual: asiste en línea y no ocupa aforo.')
  const conAviso = resultado.inscripcionNueva || resultado.liberadas.length > 0 || resultado.esFueraDeHorario || virtual
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
    case 'CONGRESS_REGISTRATION_NOT_FOUND':
      return { ...base, tono: 'error', titulo: 'No está inscrito al congreso', detalle: e.message }
    case 'CONGRESS_PAYMENT_PENDING':
      return { ...base, tono: 'error', titulo: 'Pago del congreso pendiente', detalle: e.message }
    case 'CONGRESS_REGISTRATION_REJECTED':
      return { ...base, tono: 'error', titulo: 'Inscripción al congreso rechazada', detalle: e.message }
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

// ─── Enlace público del aforo (backend spec 036) ───

/** Página oculta de la landing que muestra el aforo, los inscritos presenciales y la asistencia por tema. */
export const RUTA_AFORO_LANDING = '/aforo-ponencias'

/**
 * `<landing>/aforo-ponencias#<token>`: el token va tras el `#` para que el navegador no lo envíe a ningún servidor (ni en
 * `Referer`); la página de la landing lo lee de ahí. El origen es el de la landing (`origenLanding`, que en desarrollo es el 3000).
 */
export function urlEnlaceAforo(token: string, origen: string = origenLanding()): string {
  return `${origen.replace(/\/+$/, '')}${RUTA_AFORO_LANDING}#${token}`
}

/** Texto listo para pegar en WhatsApp o en un correo junto con el enlace. */
export function mensajeEnlaceAforo(url: string, evento?: string | null): string {
  const nombre = evento?.trim() ? ` del ${evento.trim()}` : ''
  return `Aforo de las ponencias especializadas${nombre}: inscritos, cupos libres y asistencia de cada tema, actualizado cada minuto.\n${url}\nEs de uso restringido: no lo publiques.`
}

// ─── Resumen por persona, cancelación y comunicado (backend spec 031) ───

/** Cómo está la persona en el congreso hoy: es lo que decide si puede asistir a las ponencias. */
export type SituacionCongreso = 'APROBADO' | 'PAGO_PENDIENTE' | 'RECHAZADO' | 'NO_INSCRITO'

export interface InscripcionCongresoResumen {
  estado: string
  tipo: string | null
  categoria: string | null
  modo: Modalidad
}

export interface PersonaResumen {
  asistenteId: number
  asistente: AsistentePonencia
  /** Inscripciones vigentes a ponencias. */
  ponencias: number
  asistencias: number
  /** Todas sus inscripciones vigentes se validaron con el congreso al registrarse. */
  validada: boolean
  /** Último comunicado enviado (ISO) o `null`. */
  avisadoEn: string | null
  situacion: SituacionCongreso
  congreso: InscripcionCongresoResumen | null
  /** Acceso libre o congreso con el pago aprobado. */
  puede: boolean
}

export interface TotalesResumen {
  personas: number
  inscripciones: number
  pueden: number
  noPueden: number
  porSituacion: Record<SituacionCongreso, number>
  sinValidar: number
  avisadas: number
}

export interface MetaResumen {
  page: number
  pageSize: number
  total: number
  accesoLibre: boolean
  /** Totales de todo el evento (no dependen de los filtros). */
  resumen: TotalesResumen
}

export const SITUACIONES_CONGRESO: ReadonlyArray<{ valor: SituacionCongreso, etiqueta: string, tono: 'ok' | 'warn' | 'error' | 'neutral', detalle: string }> = [
  { valor: 'NO_INSCRITO', etiqueta: 'No inscrito al congreso', tono: 'error', detalle: 'No tiene inscripción al congreso con ese documento.' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazado o cancelado', tono: 'error', detalle: 'Su inscripción al congreso fue rechazada o cancelada.' },
  { valor: 'PAGO_PENDIENTE', etiqueta: 'Pago en revisión', tono: 'warn', detalle: 'Está inscrito al congreso pero el pago aún no se aprueba.' },
  { valor: 'APROBADO', etiqueta: 'Pago aprobado', tono: 'ok', detalle: 'Inscrito al congreso con el pago aprobado.' },
]

export function situacionDeResumen(situacion: string): (typeof SITUACIONES_CONGRESO)[number] {
  return SITUACIONES_CONGRESO.find((s) => s.valor === situacion) ?? { valor: 'NO_INSCRITO', etiqueta: situacion, tono: 'neutral', detalle: '' }
}

/** Una persona con acceso libre «puede» aunque no esté en el congreso: se dice para no confundir. */
export function textoPuede(persona: Pick<PersonaResumen, 'puede' | 'situacion'>): string {
  if (!persona.puede) return 'No puede'
  return persona.situacion === 'APROBADO' ? 'Puede' : 'Puede (acceso libre)'
}

export interface FiltrosResumen {
  situacion: string
  /** `si`: puede asistir; `no`: no puede. */
  puede: string
  /** `si`: validada con el congreso; `no`: sin validar. */
  validacion: string
  /** Modo con el que entró al congreso. */
  modo: string
  /** `si`: ya recibió el comunicado; `no`: aún no. */
  aviso: string
  q: string
  page: number
}

export const FILTROS_RESUMEN_VACIOS: Readonly<FiltrosResumen> = Object.freeze({
  situacion: '', puede: '', validacion: '', modo: '', aviso: '', q: '', page: 1,
})

const CLAVES_RESUMEN = ['situacion', 'puede', 'validacion', 'modo', 'aviso', 'q'] as const

/** Lee los filtros desde la query de la ruta (valores inválidos se ignoran). */
export function filtrosResumenDesdeQuery(query: Record<string, unknown>): FiltrosResumen {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '')
  const opcion = (valor: unknown, permitidos: readonly string[]) => (permitidos.includes(texto(valor)) ? texto(valor) : '')
  const page = Number(texto(query.page))
  return {
    situacion: opcion(query.situacion, SITUACIONES_CONGRESO.map((s) => s.valor)),
    puede: opcion(query.puede, ['si', 'no']),
    validacion: opcion(query.validacion, ['si', 'no']),
    modo: opcion(query.modo, ['PRESENCIAL', 'VIRTUAL']),
    aviso: opcion(query.aviso, ['si', 'no']),
    q: texto(query.q).slice(0, 100),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

/** Parámetros no vacíos para la API, la descarga o la URL. */
export function parametrosResumen(filtros: FiltrosResumen, incluirPagina = true): Record<string, string> {
  const params: Record<string, string> = {}
  for (const clave of CLAVES_RESUMEN) {
    const valor = filtros[clave].trim()
    if (valor) params[clave] = valor
  }
  if (incluirPagina && filtros.page > 1) params.page = String(filtros.page)
  return params
}

export function hayFiltrosResumen(filtros: FiltrosResumen): boolean {
  return CLAVES_RESUMEN.some((clave) => filtros[clave].trim() !== '')
}

/** Ruta de la descarga en Excel con los mismos filtros de la pantalla. */
export function rutaDescargaResumen(eventoId: number, filtros: FiltrosResumen): string {
  const consulta = new URLSearchParams(parametrosResumen(filtros, false)).toString()
  return `events/${eventoId}/specialized-talk-attendees/export${consulta ? `?${consulta}` : ''}`
}

/** Hasta cuántas personas admite una sola cancelación o aviso (tope del backend). */
export const MAXIMO_POR_ENVIO = 100

/** Solo se cancela o avisa a quien hoy no puede asistir. */
export function esSeleccionable(persona: Pick<PersonaResumen, 'puede'>): boolean {
  return !persona.puede
}

/** Marca o desmarca a las personas en la selección (por `asistenteId`) sin tocar a las demás. Solo se marca a quien es seleccionable. */
export function alternarSeleccion(seleccion: Readonly<Record<number, PersonaResumen>>, personas: readonly PersonaResumen[], marcada: boolean): Record<number, PersonaResumen> {
  const ids = new Set(personas.map((p) => p.asistenteId))
  const resto = Object.fromEntries(Object.entries(seleccion).filter(([id]) => !ids.has(Number(id))))
  if (!marcada) return resto
  return { ...resto, ...Object.fromEntries(personas.filter(esSeleccionable).map((p) => [p.asistenteId, p])) }
}

export function conCorreo(persona: Pick<PersonaResumen, 'asistente'>): boolean {
  return Boolean(persona.asistente.correo?.trim())
}

export type ModoComunicado = 'cancelar' | 'avisar'

export interface Comunicado {
  asunto: string
  mensaje: string
}

/**
 * Texto propuesto del comunicado (el staff lo edita). `{nombre}` se reemplaza en el servidor por el primer nombre
 * de cada persona; las líneas en blanco separan párrafos.
 */
export function comunicadoPropuesto(modo: ModoComunicado, evento: string | null | undefined): Comunicado {
  const nombre = evento?.trim() || 'el congreso'
  if (modo === 'cancelar') {
    return {
      asunto: 'Tu inscripción a las ponencias especializadas fue cancelada',
      mensaje: [
        'Hola {nombre},',
        `Las ponencias especializadas de ${nombre} son solo para quienes tienen su inscripción al congreso con el pago aprobado. No encontramos una inscripción aprobada a tu nombre, por eso cancelamos tu inscripción a las ponencias especializadas.`,
        'Si ya te inscribiste al congreso y pagaste, o crees que se trata de un error, responde este correo con tu DNI y tu constancia de pago para revisarlo. Cuando tu pago esté aprobado podrás volver a inscribirte a las ponencias.',
        'Gracias por tu interés.',
      ].join('\n\n'),
    }
  }
  return {
    asunto: 'Para asistir a las ponencias especializadas necesitas tu inscripción al congreso',
    mensaje: [
      'Hola {nombre},',
      `Las ponencias especializadas de ${nombre} son solo para quienes tienen su inscripción al congreso con el pago aprobado. No encontramos una inscripción aprobada a tu nombre, por lo que no podrás asistir a las ponencias en que te inscribiste.`,
      'Si ya pagaste el congreso o crees que se trata de un error, responde este correo con tu DNI y tu constancia de pago para revisarlo. Si aún no te inscribes al congreso, hazlo en la página del evento.',
      'Gracias por tu interés.',
    ].join('\n\n'),
  }
}

export interface FormComunicado extends Comunicado {
  /** Solo al cancelar: enviar o no el comunicado por correo. */
  notificar: boolean
}

export function validarComunicado(form: FormComunicado, modo: ModoComunicado): Record<string, string> {
  const errores: Record<string, string> = {}
  if (modo === 'avisar' || form.notificar) {
    if (!form.asunto.trim()) errores.asunto = 'Escribe el asunto del correo.'
    else if (form.asunto.trim().length > 150) errores.asunto = 'El asunto admite hasta 150 caracteres.'
    if (!form.mensaje.trim()) errores.mensaje = 'Escribe el mensaje del comunicado.'
    else if (form.mensaje.trim().length > 3000) errores.mensaje = 'El mensaje admite hasta 3000 caracteres.'
  }
  return errores
}

/** Cuerpo de `POST …/specialized-talk-attendees/cancel` o `/notify`. */
export function cuerpoComunicado(modo: ModoComunicado, ids: readonly number[], form: FormComunicado): Record<string, unknown> {
  const comunicado = { asunto: form.asunto.trim(), mensaje: form.mensaje.trim() }
  if (modo === 'avisar') return { asistenteIds: [...ids], ...comunicado }
  return form.notificar ? { asistenteIds: [...ids], notificar: true, ...comunicado } : { asistenteIds: [...ids], notificar: false }
}

export interface AvisosEnviados {
  enviados: number
  sinCorreo: number
  fallidos: number
  sinCredencial: boolean
}

export interface OmitidaDelResumen {
  asistenteId: number
  motivo: 'NO_ENCONTRADA' | 'PUEDE_ASISTIR' | 'YA_ASISTIO'
}

/** Respuesta de `cancel` y `notify` (`inscripciones` solo viene al cancelar). */
export interface ResultadoComunicado {
  personas: number
  inscripciones?: number
  omitidas: OmitidaDelResumen[]
  avisos: AvisosEnviados | null
}

const MOTIVOS_OMITIDA: Readonly<Record<OmitidaDelResumen['motivo'], string>> = {
  NO_ENCONTRADA: 'ya no tiene inscripciones vigentes',
  PUEDE_ASISTIR: 'ahora sí puede asistir (su pago ya está aprobado)',
  YA_ASISTIO: 'ya asistió a una ponencia',
}

/** Líneas para mostrar el resultado: qué se hizo, a cuántos se les avisó y a quién se omitió y por qué. */
export function resumenDeResultado(modo: ModoComunicado, resultado: ResultadoComunicado): Array<{ tono: 'ok' | 'warn' | 'error', texto: string }> {
  const lineas: Array<{ tono: 'ok' | 'warn' | 'error', texto: string }> = []
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  if (modo === 'cancelar') {
    const inscripciones = resultado.inscripciones ?? 0
    const verbo = inscripciones === 1 ? 'Se canceló' : 'Se cancelaron'
    lineas.push(resultado.personas
      ? { tono: 'ok', texto: `${verbo} ${plural(inscripciones, 'inscripción', 'inscripciones')} de ${plural(resultado.personas, 'persona', 'personas')}.` }
      : { tono: 'warn', texto: 'No se canceló ninguna inscripción.' })
  }
  const avisos = resultado.avisos
  if (avisos) {
    if (avisos.sinCredencial) lineas.push({ tono: 'error', texto: 'No hay una credencial de correo activa: no se envió ningún correo. Configúrala en Correo o copia el texto y avísales por otro medio.' })
    else if (avisos.enviados) lineas.push({ tono: 'ok', texto: `Correo enviado a ${plural(avisos.enviados, 'persona', 'personas')}.` })
    if (avisos.sinCorreo) lineas.push({ tono: 'warn', texto: `${plural(avisos.sinCorreo, 'persona no tiene', 'personas no tienen')} correo registrado: avísales por otro medio.` })
    if (avisos.fallidos) lineas.push({ tono: 'error', texto: `No se pudo enviar el correo a ${plural(avisos.fallidos, 'persona', 'personas')}. La cancelación sí se guardó; puedes reintentar con «Solo avisar».` })
  }
  for (const motivo of Object.keys(MOTIVOS_OMITIDA) as Array<OmitidaDelResumen['motivo']>) {
    const cuantas = resultado.omitidas.filter((o) => o.motivo === motivo).length
    if (cuantas) lineas.push({ tono: 'warn', texto: `Se omitió a ${plural(cuantas, 'persona', 'personas')}: ${MOTIVOS_OMITIDA[motivo]}.` })
  }
  return lineas
}

/** Nombres para el aviso previo: los primeros y «y N más». */
export function listaDeNombres(nombres: readonly string[], maximo = 5): string {
  if (nombres.length <= maximo) return nombres.join(', ')
  return `${nombres.slice(0, maximo).join(', ')} y ${nombres.length - maximo} más`
}
