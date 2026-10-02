// Tipos de la API administrativa de backend-ciisic
// (contratos en backend-ciisic/specs/002…013/contracts).

export type CodigoEstado = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO'
export type EstadoEvento = 'BORRADOR' | 'PUBLICADO' | 'FINALIZADO' | 'ARCHIVADO'
export type Proveedor = 'DECOLECTA' | 'APIPERU'
export type PeriodoRenovacion = 'DIARIO' | 'MENSUAL' | 'ANUAL' | 'NINGUNO'

export interface Respuesta<T> {
  success: boolean
  data: T
  meta?: Meta
}

export interface Meta {
  page: number
  pageSize: number
  total: number
}

// ─── Roles y permisos del staff (spec 013 del backend) ───

/**
 * Código del rol. Se muestran como «Owner», «Administrador del sistema», «Tesorero» y «Comisión
 * tecnológica» (`ETIQUETAS_ROL` en `app/utils/permisos.ts`). El panel decide por permisos, nunca por
 * el código del rol.
 */
export type CodigoRol = 'SUPERADMIN' | 'ADMIN' | 'TESORERO' | 'COMISION'

/** `GLOBAL`: todos los eventos (Owner y Administrador); `EVENTO`: solo los eventos asignados. */
export type AlcanceRol = 'GLOBAL' | 'EVENTO'

/** Catálogo de permisos (`backend-ciisic/src/core/permisos.ts`). */
export type Permiso =
  // Globales: solo Owner y Administrador del sistema
  | 'sistema.configurar'
  | 'administradores.gestionar'
  | 'eventos.configurar'
  | 'eventos.eliminar'
  | 'catalogos.configurar'
  | 'correo.configurar'
  | 'consultas_dni.gestionar'
  | 'participantes.gestionar'
  | 'inscripciones.eliminar'
  | 'inscripciones.cancelar'
  | 'inscripciones.cortesia'
  | 'legacy.usar'
  | 'certificados.gestionar'
  // Por evento: las cuentas con alcance `EVENTO` los ejercen solo en sus eventos
  | 'resumen.ver'
  | 'inscripciones.ver'
  | 'inscripciones.exportar'
  | 'credenciales.reenviar'
  | 'pagos.ver'
  | 'inscripciones.validar'
  | 'asistencia.ver'
  | 'asistencia.exportar'
  | 'asistencia.marcar'
  | 'asistencia.anular'
  | 'asistencia.fuera_horario'
  | 'ponencias.ver'
  | 'mensajes.ver'
  | 'mensajes.eliminar'
  | 'certificados.ver'
  | 'certificados.operar'

/** Acceso efectivo de la cuenta (`usuario.acceso` de la sesión, el login y Google). */
export interface AccesoPanel {
  alcance: AlcanceRol
  /** Permisos efectivos (con sus dependencias), ordenados. */
  permisos: Permiso[]
  /** Eventos asignados; `null` en las cuentas globales (todos los eventos). */
  eventoIds: number[] | null
  /** Hay un inscrito con el mismo correo (el cambio al portal llega con la spec 014). */
  perfilParticipante: boolean
}

/** Permiso que se puede marcar para una cuenta de la Comisión (`GET /roles`). */
export interface PermisoElegible {
  codigo: Permiso
  nombre: string
  /** Permisos que se agregan al marcarlo. */
  implica: Permiso[]
}

/** Rol que la cuenta puede asignar (`GET /roles`). */
export interface RolAsignable {
  id: number
  codigo: CodigoRol
  nombre: string
  alcance: AlcanceRol
  /** Permisos fijos del rol (la Comisión no tiene: son los elegidos para cada cuenta). */
  permisos: Permiso[]
  /** Solo la Comisión. */
  permisosElegibles?: PermisoElegible[]
  /** Solo la Comisión. */
  permisosPorDefecto?: Permiso[]
}

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  correo: string
  rolId: number
  rolCodigo: CodigoRol
  rolNombre: string
  /** Falta en respuestas anteriores a la spec 013: se deduce del rol (`accesoDeSesion`). */
  acceso?: AccesoPanel
}

// ─── Sesión: administrador o inscrito (portal «Mis inscripciones») ───

export type TipoSesion = 'ADMIN' | 'PARTICIPANTE'

/** Inscrito que entró con Google al portal. */
export interface ParticipanteSesion {
  id: number
  nombres: string
  apellidos: string
  correo: string
}

export type Sesion = { tipo: 'ADMIN', usuario: Usuario } | { tipo: 'PARTICIPANTE', participante: ParticipanteSesion }

export interface Banco { codigo: string, nombre: string, numeroCuenta: string, cci?: string | null }
/** `qrArchivo`: imagen subida al backend (tiene prioridad); `qrUrl`: dirección externa o de la landing. */
export interface Billetera { codigo: string, nombre: string, telefono: string, qrUrl?: string | null, qrArchivo?: string | null }
export interface DatosPago { titular?: string | null, bancos?: Banco[], billeteras?: Billetera[] }

/**
 * Campos de `GET /events` que recibe toda cuenta. Las cuentas por evento reciben solo sus eventos con
 * esta vista reducida: sin descripción, contacto, `dominioInstitucional`, `remitenteNombre`,
 * `asuntoAprobacion`, credencial de correo, `totalInscripciones` ni fechas de registro, y `datosPago`
 * solo con `pagos.ver`.
 */
export interface EventoResumido {
  id: number
  codigo: string
  nombre: string
  nombreCorto: string
  sede: string | null
  fechaInicio: string
  fechaFin: string
  inscripcionesInicio: string | null
  inscripcionesFin: string | null
  inscripcionesAbiertas: boolean
  estado: EstadoEvento
  esPrincipal: boolean
  logoArchivo?: string | null
  /** Solo con `pagos.ver` (en la vista completa, siempre). */
  datosPago?: DatosPago | null
}

/** Evento completo: `GET /events/:id` y `GET /events` de las cuentas con `eventos.configurar`. */
export interface Evento extends EventoResumido {
  descripcion: string | null
  dominioInstitucional: string
  correoContacto: string | null
  telefonoContacto: string | null
  remitenteNombre: string | null
  asuntoAprobacion: string | null
  datosPago: DatosPago | null
  /** Credencial de correo propia; `null` = usa la predeterminada. */
  credencialCorreoId?: number | null
  credencialCorreo?: { id: number, nombre: string, remitenteCorreo: string } | null
  totalInscripciones?: number
  creadoEn: string
  actualizadoEn: string
}

/**
 * Elemento de `GET /events` (la lista del store de eventos): la vista reducida y, solo si la cuenta
 * tiene `eventos.configurar`, los demás campos del evento completo. Las pantallas por evento solo
 * deben leer los de `EventoResumido`.
 */
export type EventoListado = EventoResumido & Partial<Omit<Evento, keyof EventoResumido>>

export interface Caracteristica { icon: string, text: string }

/**
 * A quién se ofrece un tipo (spec 016 del backend): a todos, solo a la comunidad UNDC (quien recibe
 * el precio institucional) o solo a los externos.
 */
export type DisponiblePara = 'TODOS' | 'INSTITUCIONAL' | 'EXTERNOS'

export interface TipoInscripcion {
  id: number
  categoriaId: number
  codigo: string
  nombre: string
  etiqueta: string | null
  descripcion: string | null
  caracteristicas: Caracteristica[] | null
  /** `null` sin `pagos.ver`. */
  precio: number | null
  /** `null` sin `pagos.ver`. */
  precioInstitucional: number | null
  /** Ausente con un backend anterior a la spec 016: equivale a `TODOS`. */
  disponiblePara?: DisponiblePara
  activo: boolean
  orden: number
  totalInscripciones?: number
}

export interface Categoria {
  id: number
  eventoId: number
  codigo: string
  nombre: string
  descripcion: string | null
  caracteristicas: Caracteristica[] | null
  /** `null` sin `pagos.ver` (o sin tipos). */
  precioDesde: number | null
  esEstudiantil: boolean
  orden: number
  tipos: TipoInscripcion[]
}

export interface EstadoRef { id?: number, codigo: CodigoEstado, nombre: string }

export interface ParticipanteRef {
  id: number
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidos: string
  correo: string
  celular: string
  /** Solo en `participants` (listado y detalle); las inscripciones no lo traen. */
  googleVinculado?: boolean
  googleVinculadoEn?: string | null
}

/** Tipo de cuenta según el correo (reglas fijas del backend: en `undc.edu.pe`, parte local numérica = estudiante). */
export type TipoCuentaCorreo = 'ESTUDIANTE' | 'PERSONAL' | 'EXTERNO'

/** Verificación del correo con Google al inscribirse (`verificacion.correo` del detalle). */
export interface VerificacionCorreo {
  verificado: boolean
  detalle: { metodo: 'GOOGLE', tipoCuenta: TipoCuentaCorreo, hd: string | null, verificadoEn: string } | null
}

export interface InscripcionFila {
  id: number
  creadoEn: string
  participante: ParticipanteRef
  tipoInscripcion: { id: number, nombre: string, etiqueta: string | null, categoria: string } | null
  clasificacion: { id: number, nombre: string } | null
  estado: EstadoRef
  /** Sin `pagos.ver`: `monto`, `modalidadPago`, `numeroOperacion` y `fechaPago` en `null` y `tieneVoucher: false`. */
  monto: number | null
  modalidadPago: string | null
  numeroOperacion: string | null
  fechaPago: string | null
  tieneVoucher: boolean
  esEstudianteUndc: boolean
  esCorreoVerificado?: boolean
  revisadoEn: string | null
}

export interface VerificacionDetalle {
  esEstudianteUndc?: boolean
  motivo?: string | null
  codigoEstudiante?: string | null
  carrera?: string | null
  matriculadoSemestreActivo?: boolean | null
  criterio?: string | null
  verificadoEn?: string
}

export interface InscripcionDetalle {
  id: number
  eventoId: number
  evento: { id: number, codigo: string, nombreCorto: string }
  creadoEn: string
  actualizadoEn: string
  participante: ParticipanteRef
  /** `precio` y `precioInstitucional` en `null` sin `pagos.ver`. */
  tipoInscripcion: {
    id: number, codigo: string, nombre: string, etiqueta: string | null, precio: number | null, precioInstitucional: number | null
    categoria: { id: number, codigo: string, nombre: string, esEstudiantil: boolean }
  } | null
  clasificacion: { id: number, nombre: string } | null
  estado: EstadoRef
  /** Sin `pagos.ver` llega con las mismas claves en `null` y `tieneVoucher: false`. */
  pago: {
    monto: number | null, descuento: number | null, tieneDescuento: boolean | null, modalidad: string | null, banco: string | null
    tipoOperacion: string | null, billeteraDigital: string | null, numeroOperacion: string | null, fechaPago: string | null, tieneVoucher: boolean
    voucherMime: string | null
  }
  verificacion: {
    esEstudianteUndc: boolean, esCorreoInstitucional: boolean, codigoEstudiante: string | null, detalle: VerificacionDetalle | null
    correo?: VerificacionCorreo
  }
  revision: {
    motivoRechazo: string | null
    revisadoPor: { id: number, nombres: string, apellidos: string } | null
    revisadoEn: string | null
    credencialEnviadaEn: string | null
  }
  credencialEnviada?: boolean | null
}

/** Sin `pagos.ver` los montos llegan en `null` (los conteos se conservan). */
export interface ResumenEvento {
  totales: {
    inscripciones: number, pendientes: number, enRevision: number, aprobadas: number, rechazadas: number, canceladas: number
    montoAprobado: number | null, montoPendiente: number | null, estudiantesUndc: number
  }
  porEstado: Array<{ codigo: CodigoEstado, nombre: string, total: number, monto: number | null }>
  porTipo: Array<{ tipoInscripcionId: number, nombre: string, etiqueta: string | null, categoria: string, total: number, aprobadas: number, montoAprobado: number | null }>
  porDia: Array<{ fecha: string, total: number }>
}

export interface Actividad {
  id: number
  eventoId: number
  nombre: string
  fecha: string
  horaInicio: string
  horaFin: string
  totalAsistencias?: number
}

export interface TokenConsulta {
  id: number
  proveedor: Proveedor
  nombre: string
  tokenEnmascarado: string
  limiteConsultas: number | null
  consultasUsadas: number
  consultasRestantes: number | null
  porcentajeUso: number | null
  periodoRenovacion: PeriodoRenovacion
  fechaRenovacion: string | null
  prioridad: number
  estado: 'ACTIVO' | 'AGOTADO' | 'INVALIDO'
  activo: boolean
  disponible: boolean
  ultimoError: string | null
  ultimoUsoEn: string | null
  agotadoEn: string | null
}

export interface UsoConsultas {
  desde: string
  porDia: Array<{ fecha: string } & Record<string, number | string>>
  porToken: Array<{ tokenConsultaId: number | null, nombre: string, proveedor: string | null, resultados: Record<string, number> }>
}

export interface RegistroConsulta {
  id: number
  creadoEn: string
  numero: string
  proveedor: Proveedor | null
  token: string | null
  resultado: string
  codigoHttp: number | null
  duracionMs: number | null
  origen: string
  detalle: string | null
}

export interface Integracion {
  id: number
  eventoId: number
  tipo: 'DEPORTES_FI'
  nombre: string
  urlBase: string
  tokenEnmascarado: string
  activo: boolean
  ultimoEstado: 'OK' | 'ERROR' | null
  ultimoError: string | null
  ultimaSincronizacionEn: string | null
}

export interface ResumenDeportes {
  event: { id: number, name: string, startDate: string, endDate: string }
  currency: string
  teams: { total: number, pending: number, approved: number, rejected: number, cancelled: number }
  participants: { total: number }
  /** Sin `pagos.ver` los montos llegan en `null` (también `cost`, `validatedAmount` y `pendingAmount`). */
  payments: { validated: { count: number, amount: number | null }, pending: { count: number, amount: number | null }, rejected: { count: number, amount: number | null } }
  byDiscipline: Array<{ disciplineId: number, name: string, participantType: string, isPaid: boolean, cost: number | null, teams: { total: number, approved: number, pending: number }, validatedAmount: number | null, pendingAmount: number | null }>
  byParticipantType: Array<{ participantType: string, teams: number, validatedAmount: number | null, pendingAmount: number | null }>
  generatedAt: string
}

export interface ResumenSemana {
  evento: { id: number, codigo: string, nombreCorto: string }
  /** Montos en `null` sin `pagos.ver`. */
  congreso: { inscripcionesTotales: number, inscripcionesAprobadas: number, montoAprobado: number | null, montoPendiente: number | null }
  deportes: Array<{ integracionId: number, nombre: string, ok: boolean, resumen: ResumenDeportes | null, error: string | null }>
  totales: { recaudadoCongreso: number | null, recaudadoDeportes: number | null, recaudadoTotal: number | null, pendienteDeportes: number | null }
}

export interface Ponencia {
  id: string
  titulo: string
  autorPrincipal: { firstName: string, lastName: string, university: string }
  coautores: Array<{ firstName: string, lastName: string, university: string }>
  archivoOriginal: string
  tamanoBytes: number
  creadoEn: string
}

export interface MensajeContacto {
  id: number
  eventoId: number | null
  nombres: string
  apellidos: string
  correo: string
  asunto: string
  mensaje: string
  leido: boolean
  creadoEn: string
}

export interface Administrador {
  id: number
  nombres: string
  apellidos: string
  correo: string
  rolId: number
  rolCodigo: CodigoRol
  rolNombre: string
  activo: boolean
  /** `false`: entra solo con Google. */
  tieneContrasena?: boolean
  googleVinculado?: boolean
  googleVinculadoEn?: string | null
  /** `null` si el rol es desconocido. */
  alcance?: AlcanceRol | null
  /** Eventos asignados (Tesorero y Comisión). */
  eventos?: Array<{ id: number, nombreCorto: string }>
  /** Permisos guardados de la cuenta (solo la Comisión tiene). */
  permisos?: Permiso[]
  creadoEn: string
  actualizadoEn?: string
}

export interface Clasificacion { id: number, nombre: string }

// ─── Correo (Brevo) ───

export interface CredencialCorreo {
  id: number
  proveedor: 'BREVO'
  nombre: string
  /** `••••abcd`: la API key completa nunca vuelve del backend. */
  apiKeyEnmascarada: string
  remitenteCorreo: string
  remitenteNombre: string | null
  esPredeterminada: boolean
  activo: boolean
  ultimoEstado: 'OK' | 'ERROR' | null
  ultimoError: string | null
  ultimaPruebaEn: string | null
  ultimoEnvioEn: string | null
  eventos: Array<{ id: number, codigo: string, nombreCorto: string }>
  creadoEn: string
  actualizadoEn: string
}

/** Plan de la cuenta Brevo (`tipo` y `tipoCreditos` llegan como los reporta Brevo: `free`, `sendLimit`…). */
export interface PlanBrevo { tipo: string, creditos: number | null, tipoCreditos: string | null }

export interface PruebaCredencialCorreo {
  ok: boolean
  cuenta?: { correo: string | null, empresa: string | null, planes: PlanBrevo[] }
  error?: string
  credencial: CredencialCorreo
}

export interface EnvioPruebaCorreo {
  ok: boolean
  error?: string
  credencial: CredencialCorreo
}

// ─── Tokens de acceso por evento (landing → backend) ───

export type EstadoTokenAcceso = 'ACTIVO' | 'REVOCADO' | 'EXPIRADO'

export interface TokenAcceso {
  id: number
  eventoId: number
  nombre: string
  /** Primeros caracteres del token (`ciisic_AbCd`); el valor completo solo llega al crearlo. */
  prefijo: string
  estado: EstadoTokenAcceso
  ultimoUsoEn: string | null
  expiraEn: string | null
  revocadoEn: string | null
  creadoPor: { id: number, nombres: string, apellidos: string } | null
  creadoEn: string
}

/** Respuesta del alta: única vez que el backend devuelve el token en claro. */
export interface TokenAccesoCreado extends TokenAcceso {
  token: string
}

// ─── Configuración del sistema (`sistema.configurar`, solo Owner) ───

export interface ConfiguracionSistema {
  undcApi: {
    url: string | null
    /** `••••9f3a`: la API key nunca vuelve completa del backend. */
    apiKeyEnmascarada: string | null
    timeoutMs: number
    /** Hay URL y API key guardadas. */
    configurada: boolean
    ultimoEstado: 'OK' | 'ERROR' | null
    ultimoError: string | null
    ultimaPruebaEn: string | null
  }
  /** El client ID no es secreto (no hace falta client secret). */
  google: { clientId: string | null, configurado: boolean }
  /** Origen público del panel; la landing lo usa para `/login` y «Ver mi inscripción». */
  urlPanel: string | null
  /** Rutas del backend que usa la landing anterior (sin token de acceso). */
  rutasLegacy: { activas: boolean }
  actualizadoPor: { id: number, nombres: string, apellidos: string } | null
  actualizadoEn: string
}

export interface PruebaUndcApi {
  ok: boolean
  mensaje: string
  codigoHttp: number | null
  latenciaMs: number
  configuracion: ConfiguracionSistema
}
