import type { Actividad } from '~/types/api'
import type { ErrorApi } from '~/utils/errores'
import { interpretarLectura, type LecturaQr } from '~/utils/lecturaQr'

/**
 * Asistencia (spec 013 del backend, con el QR del fotocheck de la spec 014): cuerpo de la marca,
 * método, textos del registro y lo que necesita el escáner (`/escanear`): actividad en curso,
 * resultado de cada lectura, señales y errores de la cámara. Las páginas deciden con permisos qué se
 * muestra (`asistencia.marcar`, `asistencia.anular`, `asistencia.fuera_horario`, `asistencia.exportar`).
 */

/** Cómo se marcó (`QR_LEGADO` lo asigna solo el servidor: QR anterior y rutas de la versión anterior). */
export type MetodoAsistencia = 'QR' | 'QR_LEGADO' | 'DOCUMENTO' | 'MANUAL'

/** Persona de una marca; `numeroDocumento` llega enmascarado (`****5678`) sin `inscripciones.ver`. */
export interface PersonaAsistencia {
  id: number
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidos: string
}

/** Fila de `GET /activities/:id/attendances` (sin las anuladas). */
export interface AsistenciaFila {
  id: number
  registradoEn: string
  /** `null` en las marcas anteriores a la spec 013. */
  metodo: MetodoAsistencia | null
  esFueraDeHorario: boolean
  /** `null` en las marcas anteriores a la spec 013. */
  registradoPor: { id: number, nombres: string, apellidos: string } | null
  participante: PersonaAsistencia
}

/** Aviso de la marca (spec 014): `QR_LEGADO` se registró con el QR anterior (verificar el DNI y la foto). */
export type AlertaAsistencia = 'QR_LEGADO'

/** Tipo de inscripción de la marca (`null` si la inscripción no tiene). */
export interface TipoInscripcionMarca {
  nombre: string
  etiqueta: string | null
}

/**
 * Respuesta de `POST /activities/:id/attendances`. `alerta`, `participante.foto` e `inscripcion` son de
 * la spec 014: el backend 013 no los envía.
 */
export interface MarcaAsistencia {
  id: number
  registradoEn: string
  metodo: MetodoAsistencia
  esFueraDeHorario: boolean
  alerta?: AlertaAsistencia | null
  participante: PersonaAsistencia & {
    /** Hay una foto guardada (no comprueba el archivo); se pide con `GET /inscriptions/:id/photo`. */
    foto?: { tiene: boolean }
  }
  inscripcion?: { id: number, tipoInscripcion: TipoInscripcionMarca | null }
}

export const ETIQUETAS_METODO: Readonly<Record<MetodoAsistencia, string>> = {
  QR: 'QR',
  QR_LEGADO: 'QR (versión anterior)',
  DOCUMENTO: 'Documento',
  MANUAL: 'Manual',
}

/** Nombre visible del método; sin método (marcas antiguas), «—». */
export function etiquetaMetodo(metodo: string | null | undefined): string {
  if (!metodo) return '—'
  return ETIQUETAS_METODO[metodo as MetodoAsistencia] ?? metodo
}

/** `qr`: el lector (o la persona) escribe el código de la credencial; `dni`: número de documento. */
export type ModoLectura = 'qr' | 'dni'

/** `''`: cualquier tipo (el backend lo pide si dos inscritos comparten el número). */
export type TipoDocumentoMarca = '' | 'dni' | 'ce'

export const TIPOS_DOCUMENTO_MARCA: ReadonlyArray<{ valor: TipoDocumentoMarca, nombre: string }> = [
  { valor: '', nombre: 'Cualquiera' },
  { valor: 'dni', nombre: 'DNI' },
  { valor: 'ce', nombre: 'Carné de extranjería (CE)' },
]

export interface FormMarca {
  modo: ModoLectura
  valor: string
  tipoDocumento: TipoDocumentoMarca
  fueraDeHorario: boolean
}

/** Cuerpo de `POST /activities/:id/attendances`: exactamente uno de `codigo`, `participanteId` o `numeroDocumento`. */
export interface CuerpoMarca {
  /** QR del fotocheck (spec 014): 10 caracteres en mayúsculas. */
  codigo?: string
  /** QR anterior (id del participante): lo único que entiende el backend 013. */
  participanteId?: number
  numeroDocumento?: string
  tipoDocumento?: 'dni' | 'ce'
  fueraDeHorario: boolean
  metodo: 'QR' | 'DOCUMENTO'
}

/** Mismo formato que valida el backend (`registrarAsistenciaSchema`). */
const REGEX_DOCUMENTO = /^[A-Za-z0-9]{8,12}$/

export const MENSAJE_QR_NO_VALIDO = 'No es el QR de un fotocheck ni de una credencial del congreso. Vuelve a escanear o registra con el documento.'

/**
 * Cuerpo de una lectura del QR: `{ codigo }` (fotocheck de la spec 014, método `QR`) o
 * `{ participanteId, metodo: 'QR' }` (QR anterior: el backend 014 lo guarda como `QR_LEGADO` y el 013
 * lo entiende como siempre).
 */
export function cuerpoLectura(lectura: LecturaQr, fueraDeHorario: boolean): CuerpoMarca {
  return 'codigo' in lectura
    ? { codigo: lectura.codigo, fueraDeHorario, metodo: 'QR' }
    : { participanteId: lectura.participanteId, fueraDeHorario, metodo: 'QR' }
}

/**
 * Cuerpo de `POST /activities/:id/attendances`: en modo QR lo leído se interpreta con
 * `interpretarLectura` (código de 10 caracteres o QR anterior; otra cosa es «QR no válido» y no se
 * envía); en modo DNI el documento con `metodo: 'DOCUMENTO'` y el tipo solo si se eligió (resuelve
 * `AMBIGUOUS_DOCUMENT`). «Fuera de horario» solo viaja si la cuenta tiene `asistencia.fuera_horario`.
 */
export function cuerpoMarca(form: FormMarca, permiteFueraDeHorario: boolean): { body: CuerpoMarca } | { error: string } {
  const texto = form.valor.trim()
  const fueraDeHorario = permiteFueraDeHorario && form.fueraDeHorario
  if (!texto) return { error: form.modo === 'qr' ? 'Escanea o escribe el código del fotocheck o de la credencial.' : 'Escribe el número de documento.' }
  if (form.modo === 'qr') {
    const lectura = interpretarLectura(texto)
    if (!lectura) return { error: `QR no válido. ${MENSAJE_QR_NO_VALIDO}` }
    return { body: cuerpoLectura(lectura, fueraDeHorario) }
  }
  if (!REGEX_DOCUMENTO.test(texto)) return { error: 'El documento debe tener de 8 a 12 letras o números, sin espacios.' }
  return {
    body: {
      numeroDocumento: texto,
      ...(form.tipoDocumento ? { tipoDocumento: form.tipoDocumento } : {}),
      fueraDeHorario,
      metodo: 'DOCUMENTO',
    },
  }
}

/**
 * Tras un error se conserva lo escrito solo para elegir el tipo de documento (`AMBIGUOUS_DOCUMENT`
 * en modo DNI). En modo QR siempre se limpia: el lector escribe a continuación y mezclaría códigos.
 */
export function conservarValorTrasError(modo: ModoLectura, codigo: string): boolean {
  return modo === 'dni' && codigo === 'AMBIGUOUS_DOCUMENT'
}

export const TITULO_QR_LEGADO = 'QR antiguo: verifica el DNI'

/** Mensaje de una marca registrada (el documento se muestra tal cual llega, enmascarado o no). */
export function textoMarca(marca: Pick<MarcaAsistencia, 'esFueraDeHorario' | 'participante' | 'alerta'>): string {
  const { participante } = marca
  const nombre = `${participante.nombres} ${participante.apellidos}`.trim()
  const documento = `${participante.tipoDocumento.toUpperCase()} ${participante.numeroDocumento}`.trim()
  const prefijo = marca.alerta === 'QR_LEGADO' ? `⚠ ${TITULO_QR_LEGADO} ·` : '✓'
  return `${prefijo} ${nombre} · ${documento}${marca.esFueraDeHorario ? ' · fuera de horario' : ''}`
}

/** Id positivo de un parámetro de la URL (`?evento=`, `?actividad=`); cualquier otro valor, `null`. */
export function idDeConsulta(valor: unknown): number | null {
  const id = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : Number.NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Actividad que se elige al cargar las del evento: la del enlace (`?actividad=`) si es de este evento;
 * si no, la primera. `ajena`: el enlace pedía una actividad de otro evento (se avisa en lugar de
 * cambiar de actividad sin decir nada).
 */
export function actividadInicial(actividades: ReadonlyArray<{ id: number }>, pedida: number | null): { id: number | null, ajena: boolean } {
  const encontrada = pedida !== null && actividades.some((actividad) => actividad.id === pedida)
  return { id: encontrada ? pedida : actividades[0]?.id ?? null, ajena: pedida !== null && !encontrada }
}

// ─── Horario de registro de una actividad (hora de Lima, como el backend) ───

/** Se puede marcar desde 30 min antes de `horaInicio` (`TOLERANCIA_ANTES_MINUTOS` del backend). */
export const TOLERANCIA_ANTES_MINUTOS = 30

const ZONA_LIMA = 'America/Lima'
const formatoDiaLima = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_LIMA, year: 'numeric', month: '2-digit', day: '2-digit' })
const formatoHoraLima = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_LIMA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

type HorarioActividad = Pick<Actividad, 'fecha' | 'horaInicio' | 'horaFin'>

/** Fecha `YYYY-MM-DD` en Lima de un instante. */
export function fechaLima(instante: Date): string {
  return formatoDiaLima.format(instante)
}

/** Hora `HH:mm` en Lima de un instante. */
export function horaLima(instante: Date): string {
  return formatoHoraLima.format(instante)
}

/** Instante de una fecha y hora de Lima (UTC-5, sin horario de verano); formato inválido → `null`. */
function instanteLima(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null
  const instante = new Date(`${fecha}T${hora}:00-05:00`)
  return Number.isNaN(instante.getTime()) ? null : instante
}

function limitesActividad(actividad: HorarioActividad): { fecha: string, inicio: Date, desde: Date, fin: Date } | null {
  const fecha = String(actividad.fecha ?? '').slice(0, 10)
  const inicio = instanteLima(fecha, String(actividad.horaInicio ?? '').slice(0, 5))
  const fin = instanteLima(fecha, String(actividad.horaFin ?? '').slice(0, 5))
  if (!inicio || !fin) return null
  return { fecha, inicio, desde: new Date(inicio.getTime() - TOLERANCIA_ANTES_MINUTOS * 60_000), fin }
}

/** `ABIERTA`: se puede marcar ahora; `PROXIMA`: todavía no; `CERRADA`: ya pasó. */
export type EstadoVentana = 'ABIERTA' | 'PROXIMA' | 'CERRADA'

export interface VentanaActividad {
  estado: EstadoVentana
  /** La actividad es hoy (hora de Lima). */
  hoy: boolean
  /** Desde qué hora se puede marcar (`HH:mm`, 30 min antes del inicio). */
  desde: string
  /** Hasta qué hora (`HH:mm`, el fin de la actividad). */
  hasta: string
}

/**
 * Horario de registro de la actividad, con la misma regla que el backend: el día de la actividad, de
 * 30 min antes de `horaInicio` hasta `horaFin` (fuera de él, `OUTSIDE_WINDOW` salvo con
 * `asistencia.fuera_horario`). Fecha u horas inválidas → `null`.
 */
export function ventanaActividad(actividad: HorarioActividad, ahora: Date = new Date()): VentanaActividad | null {
  const limites = limitesActividad(actividad)
  if (!limites) return null
  const hoyLima = fechaLima(ahora)
  const hoy = hoyLima === limites.fecha
  const t = ahora.getTime()
  const estado: EstadoVentana = hoy && t >= limites.desde.getTime() && t <= limites.fin.getTime()
    ? 'ABIERTA'
    : limites.fecha > hoyLima || (hoy && t < limites.desde.getTime()) ? 'PROXIMA' : 'CERRADA'
  return { estado, hoy, desde: horaLima(limites.desde), hasta: horaLima(limites.fin) }
}

/** Texto del horario de registro para el escáner. */
export function textoVentana(ventana: VentanaActividad): string {
  if (ventana.estado === 'ABIERTA') return `Registro abierto hasta las ${ventana.hasta}`
  if (ventana.estado === 'PROXIMA') return ventana.hoy ? `El registro abre a las ${ventana.desde}` : `El registro abre el día de la actividad, a las ${ventana.desde}`
  return ventana.hoy ? `El registro cerró a las ${ventana.hasta}` : 'La actividad ya pasó'
}

/**
 * Actividad en curso para el escáner: la que tiene el registro abierto ahora (si se cruzan dos, la de
 * inicio más cercano) o, si no, la próxima de hoy. Ninguna → `null`.
 */
export function actividadEnCurso(actividades: ReadonlyArray<HorarioActividad & { id: number }>, ahora: Date = new Date()): number | null {
  const t = ahora.getTime()
  const hoy = fechaLima(ahora)
  let abierta: { id: number, distancia: number } | null = null
  let proxima: { id: number, desde: number } | null = null
  for (const actividad of actividades) {
    const limites = limitesActividad(actividad)
    if (!limites || limites.fecha !== hoy) continue
    if (t >= limites.desde.getTime() && t <= limites.fin.getTime()) {
      const distancia = Math.abs(limites.inicio.getTime() - t)
      if (!abierta || distancia < abierta.distancia) abierta = { id: actividad.id, distancia }
    } else if (t < limites.desde.getTime() && (!proxima || limites.desde.getTime() < proxima.desde)) {
      proxima = { id: actividad.id, desde: limites.desde.getTime() }
    }
  }
  return abierta?.id ?? proxima?.id ?? null
}

/**
 * Actividad que elige el escáner al cargar las del evento: la del enlace (`?actividad=`) si es de este
 * evento, la que ya estaba elegida si sigue en la lista, la que está en curso o la próxima de hoy
 * (`actividadEnCurso`) y, si no, la primera. `ajena`: el enlace pedía una actividad de otro evento.
 */
export function actividadParaEscaner(
  actividades: ReadonlyArray<HorarioActividad & { id: number }>,
  opciones: { pedida: number | null, anterior: number | null, ahora?: Date },
): { id: number | null, ajena: boolean } {
  const existe = (id: number | null): id is number => id !== null && actividades.some((actividad) => actividad.id === id)
  if (existe(opciones.pedida)) return { id: opciones.pedida, ajena: false }
  const ajena = opciones.pedida !== null
  if (existe(opciones.anterior)) return { id: opciones.anterior, ajena }
  return { id: actividadEnCurso(actividades, opciones.ahora) ?? actividades[0]?.id ?? null, ajena }
}

/** Estado que comparten el layout `escaner` (selector de actividad) y la página `/escanear` (`useState`). */
export const ESTADO_ESCANER = 'asistencia:escaner'

export interface EstadoEscaner {
  /** Evento de las actividades cargadas. */
  eventoId: number | null
  actividades: Actividad[]
  actividadId: number | null
  cargando: boolean
}

export function estadoEscanerInicial(): EstadoEscaner {
  return { eventoId: null, actividades: [], actividadId: null, cargando: false }
}

// ─── Resultado de una lectura del escáner ───

/** Verde (registrada), ámbar (registrada con aviso, o ya estaba) o rojo (no se registró). */
export type TonoResultado = 'exito' | 'alerta' | 'error'

export interface ResultadoLectura {
  tono: TonoResultado
  titulo: string
  /** Detalle: qué hacer o el mensaje del backend (con la hora, la fecha o el horario). */
  mensaje: string | null
  persona: {
    nombre: string
    /** Tipo y número, tal cual llega (completo con `inscripciones.ver`). */
    documento: string
    tipoInscripcion: string | null
    /** Inscripción cuya foto se muestra (`GET /inscriptions/:id/photo`); `null` sin foto (o con el 013). */
    fotoInscripcionId: number | null
  } | null
  fueraDeHorario: boolean
  /** Se cierra solo tras estos ms; `null`: espera a que el operador continúe. */
  cierraEnMs: number | null
  /** Error pasajero (red o servidor): se ofrece reintentar la misma lectura. */
  reintentable: boolean
}

export const CIERRE_EXITO_MS = 2500
export const CIERRE_YA_REGISTRADA_MS = 4000
export const CIERRE_QR_NO_VALIDO_MS = 3000

/** «ESTUDIANTES · CON KIT»; sin tipo, `null`. */
export function nombreTipoInscripcion(tipo: TipoInscripcionMarca | null | undefined): string | null {
  if (!tipo?.nombre) return null
  return tipo.etiqueta ? `${tipo.nombre} · ${tipo.etiqueta}` : tipo.nombre
}

/**
 * Resultado de una marca registrada: verde, o ámbar con `alerta: 'QR_LEGADO'` (el QR anterior es un id
 * secuencial y se puede falsificar: se verifica el DNI y la foto). La foto solo si la hay.
 */
export function resultadoDeMarca(marca: MarcaAsistencia): ResultadoLectura {
  const { participante } = marca
  const persona = {
    nombre: `${participante.nombres} ${participante.apellidos}`.trim(),
    documento: `${participante.tipoDocumento.toUpperCase()} ${participante.numeroDocumento}`.trim(),
    tipoInscripcion: nombreTipoInscripcion(marca.inscripcion?.tipoInscripcion),
    fotoInscripcionId: participante.foto?.tiene && marca.inscripcion ? marca.inscripcion.id : null,
  }
  if (marca.alerta === 'QR_LEGADO') {
    return {
      tono: 'alerta',
      titulo: TITULO_QR_LEGADO,
      mensaje: 'Se registró con el QR anterior. Pide el DNI y compáralo con este documento y la foto; recuérdale usar el fotocheck de su portal.',
      persona,
      fueraDeHorario: marca.esFueraDeHorario,
      cierraEnMs: null,
      reintentable: false,
    }
  }
  return { tono: 'exito', titulo: 'Asistencia registrada', mensaje: null, persona, fueraDeHorario: marca.esFueraDeHorario, cierraEnMs: CIERRE_EXITO_MS, reintentable: false }
}

/** Título corto de cada rechazo (el detalle es el mensaje de `app/utils/errores.ts` o del backend). */
const TITULOS_ERROR: Readonly<Record<string, string>> = {
  CODE_NOT_FOUND: 'QR no reconocido',
  CODE_OTHER_EVENT: 'Credencial de otro evento',
  PARTICIPANT_NOT_FOUND: 'No está inscrita en este evento',
  NOT_APPROVED: 'Inscripción no aprobada',
  OUTSIDE_WINDOW: 'Fuera del horario',
  LEGACY_QR_NOT_ALLOWED: 'QR antiguo no válido',
  AMBIGUOUS_DOCUMENT: 'Elige el tipo de documento',
  OUT_OF_HOURS_NOT_ALLOWED: 'Sin permiso fuera de horario',
  MANUAL_NOT_ALLOWED: 'Sin permiso',
  FORBIDDEN: 'Sin permiso',
  EVENT_NOT_ASSIGNED: 'Evento no asignado',
  ACTIVITY_NOT_FOUND: 'La actividad ya no existe',
  RATE_LIMITED: 'Demasiadas lecturas',
}

/** El backend 013 no conoce `{ codigo }` (responde 422 `VALIDATION_ERROR`): no emite esos QR. */
export const MENSAJE_CODIGO_SIN_SOPORTE = 'El servidor aún no reconoce el QR del fotocheck. Registra a la persona con su documento.'

/**
 * Resultado de una marca rechazada: rojo con el mensaje del error, salvo `ATTENDANCE_ALREADY_REGISTERED`
 * (ámbar: ya estaba, con la hora). Un `{ codigo }` rechazado por validación es el backend 013. Los
 * errores de red o del servidor se pueden reintentar.
 */
export function resultadoDeError(error: Pick<ErrorApi, 'status' | 'code' | 'message'>, lectura: LecturaQr | null = null): ResultadoLectura {
  const base = { persona: null, fueraDeHorario: false }
  if (error.code === 'ATTENDANCE_ALREADY_REGISTERED') {
    return { ...base, tono: 'alerta', titulo: 'Ya estaba registrada', mensaje: error.message, cierraEnMs: CIERRE_YA_REGISTRADA_MS, reintentable: false }
  }
  if (error.code === 'VALIDATION_ERROR' && lectura && 'codigo' in lectura) {
    return { ...base, tono: 'error', titulo: 'QR no reconocido', mensaje: MENSAJE_CODIGO_SIN_SOPORTE, cierraEnMs: null, reintentable: false }
  }
  return {
    ...base,
    tono: 'error',
    titulo: TITULOS_ERROR[error.code] ?? 'No se registró',
    mensaje: error.message,
    cierraEnMs: null,
    reintentable: esErrorPasajero(error.status),
  }
}

/** Sin red, error del servidor o demasiadas lecturas (429): la misma lectura se puede reintentar. */
export function esErrorPasajero(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}

/**
 * El resultado espera «Continuar»: el aviso ámbar del QR anterior (verificar el DNI y la foto). No se
 * cierra tocando el fondo, con Escape ni con una lectura nueva (la cámara se pausa y lo que lea el lector
 * USB espera en la cola).
 */
export function esperaContinuar(resultado: Pick<ResultadoLectura, 'tono' | 'cierraEnMs'>): boolean {
  return resultado.tono === 'alerta' && resultado.cierraEnMs === null
}

/** La cámara se pausa mientras se ve un resultado que no se cierra solo (error o aviso del QR anterior). */
export function pausaLaCamara(resultado: Pick<ResultadoLectura, 'cierraEnMs'> | null): boolean {
  return resultado !== null && resultado.cierraEnMs === null
}

/** Lo leído no es un QR del congreso: no se llama al backend. */
export function resultadoQrNoValido(): ResultadoLectura {
  return { tono: 'error', titulo: 'QR no válido', mensaje: MENSAJE_QR_NO_VALIDO, persona: null, fueraDeHorario: false, cierraEnMs: CIERRE_QR_NO_VALIDO_MS, reintentable: false }
}

/**
 * Lectura que no se registró porque llegaron demasiadas seguidas (cola llena): queda en la lista en rojo,
 * con su señal, sin tapar el resultado que se está viendo.
 */
export function resultadoNoProcesada(): ResultadoLectura {
  return {
    tono: 'error',
    titulo: 'No procesada',
    mensaje: 'Llegaron demasiadas lecturas seguidas: vuelve a escanear.',
    persona: null,
    fueraDeHorario: false,
    cierraEnMs: CIERRE_QR_NO_VALIDO_MS,
    reintentable: false,
  }
}

/** Qué se leyó, para la lista de lecturas (`Código K7Q2M9X4TB`, `QR anterior 100`). */
export function describirLectura(lectura: LecturaQr): string {
  return 'codigo' in lectura ? `Código ${lectura.codigo}` : `QR anterior ${lectura.participanteId}`
}

/** Una de las últimas lecturas del escáner. */
export interface RegistroLectura {
  id: number
  /** Instante (ms) de la lectura. */
  instante: number
  tono: TonoResultado
  titulo: string
  detalle: string
  actividad: string | null
}

export const MAXIMO_RECIENTES = 10

/** Entrada de la lista: la persona si se identificó; si no, lo leído o el mensaje. */
export function registroDeResultado(
  resultado: ResultadoLectura,
  datos: { id: number, instante: number, leido: string | null, actividad: string | null },
): RegistroLectura {
  const { persona } = resultado
  return {
    id: datos.id,
    instante: datos.instante,
    tono: resultado.tono,
    titulo: resultado.titulo,
    detalle: persona ? `${persona.nombre} · ${persona.documento}` : datos.leido ?? resultado.mensaje ?? '',
    actividad: datos.actividad,
  }
}

/** La lista con `registro` primero, como mucho `maximo` (las 10 últimas). */
export function agregarRegistro<T>(lista: readonly T[], registro: T, maximo: number = MAXIMO_RECIENTES): T[] {
  return [registro, ...lista].slice(0, Math.max(0, maximo))
}

// ─── Señales del resultado (vibración y pitido) ───

export interface Senal {
  /** Patrón de `navigator.vibrate` (ms). */
  vibracion: number[]
  /** Pitidos seguidos (Web Audio). */
  tonos: ReadonlyArray<{ frecuencia: number, duracionMs: number }>
}

export const SENALES: Readonly<Record<TonoResultado, Senal>> = {
  exito: { vibracion: [90], tonos: [{ frecuencia: 1320, duracionMs: 120 }] },
  alerta: { vibracion: [100, 80, 100], tonos: [{ frecuencia: 740, duracionMs: 120 }, { frecuencia: 740, duracionMs: 120 }] },
  error: { vibracion: [300, 100, 300], tonos: [{ frecuencia: 220, duracionMs: 380 }] },
}

/** Pausa entre dos pitidos seguidos. */
export const PAUSA_TONOS_MS = 80

// ─── Cámara ───

/**
 * wasm de ZXing (decodifica el QR) servido por el propio panel y no desde un CDN: funciona en la red del
 * evento y no envía nada a terceros. Es la copia de `zxing-wasm/dist/reader/zxing_reader.wasm` de la
 * versión que trae `vue-qrcode-reader` (`bun run escaner:wasm`; una prueba verifica versión y bytes).
 */
export const RUTA_WASM_ZXING = '/zxing-wasm/1.1.3/zxing_reader.wasm'

/** `locateFile` de `setZXingModuleOverrides`: el wasm desde el panel; lo demás, como lo pida ZXing. */
export function ubicarArchivoZxing(ruta: string, prefijo: string): string {
  return ruta.endsWith('.wasm') ? RUTA_WASM_ZXING : prefijo + ruta
}

/** Antes de pedir la cámara: sin HTTPS (o localhost) o sin `getUserMedia` no hay cámara. */
export type ProblemaCamara = 'INSEGURO' | 'SIN_SOPORTE'

export function problemaCamara(entorno: { seguro: boolean, conGetUserMedia: boolean }): ProblemaCamara | null {
  if (!entorno.seguro) return 'INSEGURO'
  if (!entorno.conGetUserMedia) return 'SIN_SOPORTE'
  return null
}

const SIN_PERMISO = 'No se dio permiso para usar la cámara. Permítelo en el navegador (el ícono junto a la dirección de la página) y pulsa «Reintentar».'
const SIN_CAMARA = 'No se encontró una cámara en este dispositivo.'
const OCUPADA = 'La cámara está ocupada por otra aplicación o pestaña. Ciérrala y pulsa «Reintentar».'
const INSEGURO = 'La cámara solo funciona con una conexión segura: abre el panel con su dirección https://.'
const SIN_SOPORTE = 'Este navegador no permite usar la cámara. Abre el panel en Chrome (Android) o Safari (iPhone); los navegadores dentro de otras aplicaciones (WhatsApp, Facebook, Instagram) no la permiten.'

/** Mensaje por `name` del error de `getUserMedia` o de `vue-qrcode-reader`. */
const MENSAJES_CAMARA: Readonly<Record<string, string>> = {
  NotAllowedError: SIN_PERMISO,
  PermissionDeniedError: SIN_PERMISO,
  SecurityError: SIN_PERMISO,
  NotFoundError: SIN_CAMARA,
  DevicesNotFoundError: SIN_CAMARA,
  OverconstrainedError: SIN_CAMARA,
  NotReadableError: OCUPADA,
  TrackStartError: OCUPADA,
  AbortError: OCUPADA,
  InsecureContextError: INSEGURO,
  NotSupportedError: INSEGURO,
  StreamApiNotSupportedError: SIN_SOPORTE,
  StreamLoadTimeoutError: 'La cámara no respondió a tiempo. Pulsa «Reintentar»; en iPhone abre el panel en Safari, no desde un acceso directo de la pantalla de inicio.',
}

/** Qué pasó con la cámara y qué hacer (el lector USB y el DNI siguen disponibles). */
export function mensajeErrorCamara(error: unknown): string {
  const nombre = error && typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string' ? (error as { name: string }).name : ''
  return Object.prototype.hasOwnProperty.call(MENSAJES_CAMARA, nombre)
    ? MENSAJES_CAMARA[nombre] as string
    : 'No se pudo iniciar la cámara. Pulsa «Reintentar» o registra con el lector USB o el documento.'
}

export function mensajeProblemaCamara(problema: ProblemaCamara): string {
  return problema === 'INSEGURO' ? INSEGURO : SIN_SOPORTE
}
