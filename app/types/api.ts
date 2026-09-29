// Tipos de la API administrativa de backend-ciisic
// (contratos en backend-ciisic/specs/002…005/contracts).

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

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  correo: string
  rolId: number
  rolCodigo: 'SUPERADMIN' | 'ADMIN'
  rolNombre: string
}

export interface Banco { codigo: string, nombre: string, numeroCuenta: string, cci?: string | null }
export interface Billetera { codigo: string, nombre: string, telefono: string, qrUrl?: string | null }
export interface DatosPago { titular?: string | null, bancos?: Banco[], billeteras?: Billetera[] }

export interface Evento {
  id: number
  codigo: string
  nombre: string
  nombreCorto: string
  descripcion: string | null
  sede: string | null
  fechaInicio: string
  fechaFin: string
  inscripcionesInicio: string | null
  inscripcionesFin: string | null
  inscripcionesAbiertas: boolean
  estado: EstadoEvento
  esPrincipal: boolean
  dominioInstitucional: string
  correoContacto: string | null
  telefonoContacto: string | null
  remitenteNombre: string | null
  asuntoAprobacion: string | null
  datosPago: DatosPago | null
  totalInscripciones?: number
  creadoEn: string
  actualizadoEn: string
}

export interface Caracteristica { icon: string, text: string }

export interface TipoInscripcion {
  id: number
  categoriaId: number
  codigo: string
  nombre: string
  etiqueta: string | null
  descripcion: string | null
  caracteristicas: Caracteristica[] | null
  precio: number
  precioInstitucional: number
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
}

export interface InscripcionFila {
  id: number
  creadoEn: string
  participante: ParticipanteRef
  tipoInscripcion: { id: number, nombre: string, etiqueta: string | null, categoria: string } | null
  clasificacion: { id: number, nombre: string } | null
  estado: EstadoRef
  monto: number
  modalidadPago: string | null
  numeroOperacion: string
  fechaPago: string | null
  tieneVoucher: boolean
  esEstudianteUndc: boolean
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
  tipoInscripcion: {
    id: number, codigo: string, nombre: string, etiqueta: string | null, precio: number, precioInstitucional: number
    categoria: { id: number, codigo: string, nombre: string, esEstudiantil: boolean }
  } | null
  clasificacion: { id: number, nombre: string } | null
  estado: EstadoRef
  pago: {
    monto: number, descuento: number, tieneDescuento: boolean, modalidad: string | null, banco: string | null
    tipoOperacion: string | null, billeteraDigital: string | null, numeroOperacion: string, fechaPago: string | null, tieneVoucher: boolean
    voucherMime: string | null
  }
  verificacion: { esEstudianteUndc: boolean, esCorreoInstitucional: boolean, codigoEstudiante: string | null, detalle: VerificacionDetalle | null }
  revision: {
    motivoRechazo: string | null
    revisadoPor: { id: number, nombres: string, apellidos: string } | null
    revisadoEn: string | null
    credencialEnviadaEn: string | null
  }
  credencialEnviada?: boolean | null
}

export interface ResumenEvento {
  totales: {
    inscripciones: number, pendientes: number, enRevision: number, aprobadas: number, rechazadas: number, canceladas: number
    montoAprobado: number, montoPendiente: number, estudiantesUndc: number
  }
  porEstado: Array<{ codigo: CodigoEstado, nombre: string, total: number, monto: number }>
  porTipo: Array<{ tipoInscripcionId: number, nombre: string, etiqueta: string | null, categoria: string, total: number, aprobadas: number, montoAprobado: number }>
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
  payments: { validated: { count: number, amount: number }, pending: { count: number, amount: number }, rejected: { count: number, amount: number } }
  byDiscipline: Array<{ disciplineId: number, name: string, participantType: string, isPaid: boolean, cost: number, teams: { total: number, approved: number, pending: number }, validatedAmount: number, pendingAmount: number }>
  byParticipantType: Array<{ participantType: string, teams: number, validatedAmount: number, pendingAmount: number }>
  generatedAt: string
}

export interface ResumenSemana {
  evento: { id: number, codigo: string, nombreCorto: string }
  congreso: { inscripcionesTotales: number, inscripcionesAprobadas: number, montoAprobado: number, montoPendiente: number }
  deportes: Array<{ integracionId: number, nombre: string, ok: boolean, resumen: ResumenDeportes | null, error: string | null }>
  totales: { recaudadoCongreso: number, recaudadoDeportes: number, recaudadoTotal: number, pendienteDeportes: number }
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
  rolCodigo: 'SUPERADMIN' | 'ADMIN'
  rolNombre: string
  activo: boolean
  creadoEn: string
}

export interface Clasificacion { id: number, nombre: string }
