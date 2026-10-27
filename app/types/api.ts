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
  | 'inscripciones.cambiar_tipo'
  | 'legacy.usar'
  | 'certificados.gestionar'
  | 'especializadas.gestionar'
  | 'especializadas.enlace_aforo'
  | 'reportes.gestionar'
  | 'delegaciones.gestionar'
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
  | 'especializadas.ver'
  | 'especializadas.inscribir'
  | 'especializadas.asistencia'
  | 'reportes.ver'
  | 'reportes.exportar'
  | 'delegaciones.ver'
  | 'delegaciones.inscribir'

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

/**
 * Modalidad de asistencia del TIPO de inscripción (spec 018 del backend): presencial (la de siempre) o
 * virtual. Vive siempre dentro del objeto del tipo (`tipo.modalidad`, `tipoInscripcion.modalidad`),
 * nunca en la raíz de una inscripción: ahí `modalidadPago` / `pago.modalidad` es la modalidad de
 * **pago** (banco, billetera, cortesía). Tampoco es el «fotocheck virtual» del portal. Ausente, `null`
 * o desconocida equivale a `PRESENCIAL` (`modalidadDe` en `app/utils/modalidad.ts`).
 */
export type ModalidadAsistencia = 'PRESENCIAL' | 'VIRTUAL'

/**
 * Entrega del kit de una inscripción (spec 037 del backend): una vez por congreso. `incluye`: el tipo incluye
 * kit y es presencial. `entregado` y los datos de la entrega: la vigente (deshacerla los deja en `null`).
 * Ausente con un backend anterior: las pantallas se ven como antes, sin kit.
 */
export interface KitEstado {
  incluye: boolean
  entregado: boolean
  entregadoEn: string | null
  entregadoPor: { id: number, nombres: string, apellidos: string } | null
}

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
  /** Ausente con un backend anterior a la spec 018: equivale a `PRESENCIAL`. */
  modalidad?: ModalidadAsistencia
  /** Spec 020 del backend: el tipo no admite estudiantes UNDC. Ausente con un backend anterior: equivale a `false`. */
  excluyeEstudiantesUndc?: boolean
  /** Spec 037 del backend: el tipo incluye el kit que se entrega en la puerta. Ausente con un backend anterior: equivale a `false`. */
  incluyeKit?: boolean
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

// ─── Delegaciones (backend specs 021–023 y 029) ───

export interface DelegacionRepresentante {
  nombre: string | null
  email: string | null
  telefono: string | null
  tipoDocumento: 'dni' | 'ce' | null
  documento: string | null
}

export type EstadoPagoDelegacion = 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO'

/** Lo que debe el grupo, lo que declararon sus vouchers (sin los rechazados) y el saldo. */
export interface ResumenPagoDelegacion {
  totalAPagar: number
  declarado: number
  verificado: number
  /** Positivo: falta pagar; negativo: se declaró de más. */
  saldo: number
  cantidad: number
}

/** Un voucher de la delegación; el archivo se abre aparte (`delegations/:id/payments/:id/voucher`). */
export interface PagoDelegacion {
  id: number
  modalidadPago: 'banco' | 'billetera'
  banco: string | null
  billeteraDigital: string | null
  tipoOperacion: string | null
  numeroOperacion: string
  fechaPago: string | null
  monto: number
  estado: EstadoPagoDelegacion
  motivoRechazo: string | null
  revisadoEn: string | null
  creadoEn: string
}

/** Plan de una delegación (backend spec 029): un tipo de su categoría oculta. */
export type CodigoPlan = 'CON_KIT' | 'SIN_KIT' | 'VIRTUAL'

export interface PlanDelegacion {
  codigo: CodigoPlan
  tipoInscripcionId: number
  etiqueta: string | null
  modalidad: ModalidadAsistencia
  /** Apagado: no admite altas nuevas, pero quienes ya lo tienen lo conservan. */
  activo: boolean
  /** Sin `pagos.ver` los importes llegan en `null`. */
  precio: number | null
  /** `null` = sin escala: el plan cobra siempre su precio. */
  precioPromocional: number | null
  /** Lo que paga hoy cada integrante de este plan (con el promocional si el grupo ya llegó al mínimo). */
  precioUnitario: number | null
  integrantes: number
}

/** Cambios de un plan en `PUT delegations/:id/config` o en el alta; lo que no se envía se conserva. */
export interface CambiosPlan {
  activo?: boolean
  precio?: number
  precioPromocional?: number | null
}

export type CambiosPlanes = Partial<Record<CodigoPlan, CambiosPlan>>

export interface Delegacion {
  id: number
  eventoId: number
  nombre: string
  institucion: string | null
  /** Link del delegado. `null` si la cuenta no inscribe ni gestiona (p. ej. el Tesorero). */
  codigoLink: string | null
  /** Link individual (cada integrante se inscribe solo). `null` si está apagado o no se puede ver. */
  codigoInscripcion: string | null
  inscripcionIndividual: boolean
  /** Dominio de los correos de los integrantes que se inscriben por link (`unac.edu.pe`); `null` = cualquiera. */
  dominioCorreo: string | null
  representante: DelegacionRepresentante
  /** Integrantes activos desde los que los planes con precio promocional lo cobran. */
  minIntegrantes: number
  planes: PlanDelegacion[]
  /** Integrantes activos: los rechazados y cancelados no cuentan. */
  totalIntegrantes: number
  /** Sin `pagos.ver`: `null`. */
  montoTotal: number | null
  /** Cuántos faltan para el precio promocional; `null` si ningún plan lo tiene o ya aplica. */
  faltanParaPromocional: number | null
  pago: ResumenPagoDelegacion | null
  activo: boolean
  creadoEn: string
  actualizadoEn: string
}

export interface InscripcionDelegacion {
  id: number
  participante: ParticipanteRef
  estado: EstadoRef
  plan: CodigoPlan | null
  monto: number | null
  creadoEn: string
}

/** Detalle de una delegación, sus vouchers y todos sus integrantes. `registrados`/`omitidos` llegan al cargar una lista. */
export interface DelegacionDetalle extends Delegacion {
  pagos: PagoDelegacion[]
  inscripciones: InscripcionDelegacion[]
  registrados?: number
  omitidos?: number
  /** Solo al aprobar al grupo: las credenciales salen en segundo plano. */
  aprobadas?: number
  credencialesEnSegundoPlano?: number
}

/** Delegación de una inscripción (spec 022): en el listado solo van los datos del grupo. */
export interface DelegacionEnInscripcion {
  id: number
  nombre: string
  codigoLink: string
  totalIntegrantes: number
}

/** En el detalle se agrega el resumen de pagos (solo con `pagos.ver`, spec 013). */
export interface DelegacionEnDetalle extends DelegacionEnInscripcion {
  pago?: ResumenPagoDelegacion | null
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
  /** `modalidad` (de asistencia) falta con un backend anterior a la spec 018. */
  tipoInscripcion: { id: number, nombre: string, etiqueta: string | null, categoria: string, modalidad?: ModalidadAsistencia, incluyeKit?: boolean } | null
  /** Spec 037: el kit ya se entregó (cuándo y quién, en el detalle). Ausente con un backend anterior. */
  kitEntregado?: boolean
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
  /** Grupo de la delegación (spec 019); `null` en las inscripciones individuales. */
  delegacion: DelegacionEnInscripcion | null
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

/** Una corrección del tipo de la inscripción (spec 035 del backend). */
export interface CambioTipo {
  id: number
  creadoEn: string
  /** Texto del tipo que tenía («Tipo · etiqueta»; «Sin tipo» si no tenía). */
  anterior: string
  nuevo: string
  motivo: string | null
  /** `null` si la cuenta que lo hizo ya no existe. */
  realizadoPor: { id: number, nombres: string, apellidos: string } | null
}

export interface InscripcionDetalle {
  id: number
  eventoId: number
  evento: { id: number, codigo: string, nombreCorto: string }
  creadoEn: string
  actualizadoEn: string
  participante: ParticipanteRef
  /** `precio` y `precioInstitucional` en `null` sin `pagos.ver`; `modalidad` (de asistencia) falta con un backend anterior a la spec 018. */
  tipoInscripcion: {
    id: number, codigo: string, nombre: string, etiqueta: string | null, precio: number | null, precioInstitucional: number | null
    modalidad?: ModalidadAsistencia
    /** Spec 037: el tipo incluye kit. Ausente con un backend anterior. */
    incluyeKit?: boolean
    categoria: { id: number, codigo: string, nombre: string, esEstudiantil: boolean }
  } | null
  /** Entrega del kit (spec 037): si el tipo lo incluye y, si ya se entregó, cuándo y quién. Ausente con un backend anterior. */
  kit?: KitEstado
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
  /** Grupo de la delegación (spec 019); `null` en las inscripciones individuales. */
  delegacion: DelegacionEnDetalle | null
  revision: {
    motivoRechazo: string | null
    revisadoPor: { id: number, nombres: string, apellidos: string } | null
    revisadoEn: string | null
    credencialEnviadaEn: string | null
  }
  credencialEnviada?: boolean | null
  /**
   * Correcciones del tipo, de la más reciente a la más antigua (spec 035 del backend). Solo vienen en el
   * detalle y en la respuesta del cambio, no al cambiar el estado: ahí se conserva el que ya se tenía.
   * Ausente con un backend anterior.
   */
  cambiosTipo?: CambioTipo[]
  /** Solo en la respuesta de `PATCH …/type`: inscripciones a ponencias especializadas que pasaron al modo del tipo nuevo. */
  ponenciasActualizadas?: number
}

/** Una fila de `totales.porModalidad` (spec 018 del backend); `montoAprobado` en `null` sin `pagos.ver`. */
export interface ResumenModalidad {
  modalidad: ModalidadAsistencia
  inscripciones: number
  aprobadas: number
  montoAprobado: number | null
}

/**
 * Sin `pagos.ver` los montos llegan en `null` (los conteos se conservan). `totales.porModalidad` y
 * `porTipo[].modalidad` faltan con un backend anterior a la spec 018.
 */
export interface ResumenEvento {
  totales: {
    inscripciones: number, pendientes: number, enRevision: number, aprobadas: number, rechazadas: number, canceladas: number
    montoAprobado: number | null, montoPendiente: number | null, estudiantesUndc: number
    porModalidad?: ResumenModalidad[]
  }
  porEstado: Array<{ codigo: CodigoEstado, nombre: string, total: number, monto: number | null }>
  porTipo: Array<{
    tipoInscripcionId: number, nombre: string, etiqueta: string | null, categoria: string, total: number, aprobadas: number, montoAprobado: number | null
    modalidad?: ModalidadAsistencia
  }>
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

// ─── Correo (Brevo y Gmail por SMTP) ───

export type ProveedorCorreo = 'BREVO' | 'GMAIL_SMTP'

export interface CredencialCorreo {
  id: number
  /** Gmail (backend spec 041): la «API key» es la contraseña de aplicación y el remitente es la cuenta de Gmail. */
  proveedor: ProveedorCorreo
  nombre: string
  /** `••••abcd`: la API key (o contraseña de aplicación) completa nunca vuelve del backend. */
  apiKeyEnmascarada: string
  remitenteCorreo: string
  remitenteNombre: string | null
  esPredeterminada: boolean
  /** Orden de respaldo (1 = primera; la predeterminada siempre es la primera). Ausente en un backend anterior a la spec 041. */
  prioridad?: number
  /** Envíos que le quedan en Brevo en la última revisión; `null` = no se sabe (nunca se revisó o es Gmail). Ausente en un backend anterior a la spec 042. */
  creditosDisponibles?: number | null
  creditosVerificadosEn?: string | null
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
  /** Gmail: solo `correo` (la cuenta que inició sesión); sin planes. */
  cuenta?: { correo: string | null, empresa: string | null, planes: PlanBrevo[] }
  error?: string
  credencial: CredencialCorreo
}

export interface EnvioPruebaCorreo {
  ok: boolean
  /** Identificador con el que el proveedor confirmó que aceptó el correo (backend spec 042). */
  messageId?: string
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
  /** Origen público de la landing: de aquí salen el enlace de la credencial 3D y el de la inscripción a ponencias (backend spec 038). Ausente en un backend anterior. */
  urlLanding?: string | null
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

// ─── Seguimiento por asesor (spec 025 del backend, spec 016 del panel) ───

/** Pagó = inscripción aprobada; en revisión = voucher enviado sin validar; rechazado incluye lo cancelado. */
export type SituacionSeguimiento = 'PAGADO' | 'EN_REVISION' | 'RECHAZADO' | 'SIN_INSCRIPCION'

/** Filtro del listado: una situación o `NO_PAGADO` (todas menos `PAGADO`). */
export type FiltroSituacionSeguimiento = SituacionSeguimiento | 'NO_PAGADO'

export interface AsesorRef {
  id: number
  nombre: string
}

export interface SeccionRef {
  ciclo: string
  seccion: string
}

export interface ContadoresSeguimiento {
  alumnos: number
  pagaron: number
  enRevision: number
  rechazados: number
  sinInscripcion: number
  noPagaron: number
  /** `pagaron / alumnos` (0 a 1). */
  avance: number
  /** Suma de lo aprobado; `null` sin `pagos.ver`. */
  recaudado: number | null
}

export interface ResumenCiclo extends ContadoresSeguimiento {
  ciclo: string
}

export interface ResumenSeccion extends ContadoresSeguimiento, SeccionRef {
  turnos: string[]
  asesores: AsesorRef[]
}

export interface ResumenAsesor extends ContadoresSeguimiento {
  id: number
  nombre: string
  secciones: SeccionRef[]
}

/** Un curso de SIVIRENO (programación académica) con su docente (spec 025 del panel, 034 del backend). */
export interface CursoSeguimiento extends SeccionRef {
  id: number
  codigo: string
  nombre: string
  turno: string | null
  docente: AsesorRef | null
}

/** Un curso con cuántos de sus matriculados pagaron. */
export interface ResumenCurso extends ContadoresSeguimiento, CursoSeguimiento {}

export interface OpcionesSeguimiento {
  ciclos: string[]
  secciones: SeccionRef[]
  turnos: string[]
  asesores: AsesorRef[]
  /** Los cursos de SIVIRENO del padrón. Ausente en un backend anterior a la spec 034. */
  cursos?: CursoSeguimiento[]
}

export interface ResumenSeguimiento {
  semestre: string | null
  importadoEn: string | null
  generadoEn: string
  hayPadron: boolean
  /** `false` sin `pagos.ver`: montos, fechas de pago y recaudado llegan en `null`. */
  conPago: boolean
  opciones: OpcionesSeguimiento
  totales: ContadoresSeguimiento
  porCiclo: ResumenCiclo[]
  porSeccion: ResumenSeccion[]
  porAsesor: ResumenAsesor[]
  /** Los cursos de SIVIRENO con sus matriculados; vacío o ausente si el padrón viene del Excel o el backend es anterior a la spec 034. */
  porCurso?: ResumenCurso[]
  alumnosSinAsesor: number
}

/** Una sección en que cursa un alumno (spec 024 del panel, 033 del backend): con cuántos cursos lleva ahí y sus asesores. */
export interface SeccionAlumno extends SeccionRef {
  turno: string | null
  cursos: number
  asesores: AsesorRef[]
}

export interface AlumnoSeguimiento {
  id: number
  codigo: string
  documento: string
  nombre: string
  correo: string | null
  celular: string | null
  carrera: string
  /** Ciclo, turno y sección principales; con filtros, la primera dentro del alcance. */
  ciclo: string
  turno: string | null
  seccion: string
  /** Todas sus secciones (la principal primero). Ausente en un backend anterior a la spec 033. */
  secciones?: SeccionAlumno[]
  /** Sus cursos de SIVIRENO, cada uno con su docente; con filtros, solo los del alcance. Ausente en un backend anterior a la spec 034. */
  cursos?: CursoSeguimiento[]
  asesores: AsesorRef[]
  situacion: SituacionSeguimiento
  estadoInscripcion: CodigoEstado | null
  inscripcionId: number | null
  coincidencia: 'DOCUMENTO' | 'CODIGO' | 'CORREO' | null
  monto: number | null
  fechaPago: string | null
}

export interface ResultadoImportacionPadron {
  semestre: string
  estudiantes: number
  asesores: number
  secciones: number
  advertencias: string[]
  /** `false` en la simulación: no se guardó nada. */
  aplicado: boolean
  /** `true`: se conservaron los docentes, sus DNI y sus secciones; del Excel solo se usan los estudiantes. */
  asesoresConservados: boolean
}

// ─── Enlaces públicos por docente (spec 026 del backend, spec 017 del panel) ───

/** Enlace público de un asesor. `token` es la credencial: solo lo recibe quien tiene `reportes.gestionar`. */
export interface EnlaceAsesor {
  asesorId: number
  nombre: string
  /** `null`: el docente no tiene enlace. */
  token: string | null
  creadoEn: string | null
  ultimoAcceso: string | null
}

export interface ContadoresPublicos {
  alumnos: number
  pagaron: number
  enRevision: number
  rechazados: number
  sinInscripcion: number
  noPagaron: number
  avance: number
}

/** Un curso de SIVIRENO tal como lo ve quien consulta (spec 025 del panel, 034 del backend); en la vista del ciclo trae el docente. */
export interface CursoPublico {
  id: number
  codigo: string
  nombre: string
  ciclo: string
  seccion: string
  turno: string | null
  docente?: string | null
}

/** Un estudiante en la vista del docente: sin DNI, correo ni montos. */
export interface AlumnoDocente {
  nombre: string
  codigo: string
  ciclo: string
  seccion: string
  turno: string | null
  /** Etiquetas («VI-A1») de sus secciones dentro del alcance de quien mira, la primera es `ciclo`-`seccion`. Ausente en un backend anterior a la spec 033. */
  secciones?: string[]
  /** Sus cursos de SIVIRENO dentro del alcance de quien mira. Ausente en un backend anterior a la spec 034. */
  cursos?: CursoPublico[]
  celular: string | null
  situacion: SituacionSeguimiento
}

/** Lo que ve el docente con su enlace (`POST /api/publico/seguimiento`). */
export interface VistaDocente {
  asesor: { nombre: string }
  evento: { nombre: string, nombreCorto: string }
  semestre: string | null
  generadoEn: string
  totales: ContadoresPublicos
  secciones: Array<ContadoresPublicos & { ciclo: string, seccion: string, turnos: string[] }>
  /** Sus cursos de SIVIRENO con cuántos de sus matriculados pagaron. Ausente o vacío si el padrón no tiene cursos. */
  cursos?: Array<ContadoresPublicos & CursoPublico>
  alumnos: AlumnoDocente[]
}

// ─── Enlaces públicos por ciclo (spec 027 del backend, spec 018 del panel) ───

/** Enlace público de un ciclo. `token` es la credencial: solo lo recibe quien tiene `reportes.gestionar`. */
/** Enlace público del aforo de las ponencias especializadas (backend spec 036): uno por evento, solo del Owner. */
export interface EnlaceAforo {
  /** `null`: el evento no tiene enlace. */
  token: string | null
  creadoEn: string | null
  ultimoAcceso: string | null
}

export interface EnlaceCiclo {
  ciclo: string
  /** Estudiantes del ciclo en el padrón (0 si el ciclo ya no está en el padrón cargado). */
  alumnos: number
  /** `null`: el ciclo no tiene enlace. */
  token: string | null
  creadoEn: string | null
  ultimoAcceso: string | null
}

/** Un estudiante en la vista del ciclo: como el del docente pero sin celular (la ve más gente). */
export type AlumnoCiclo = Omit<AlumnoDocente, 'celular'>

/** Lo que se ve con el enlace de un ciclo (`POST /api/publico/seguimiento` con `tipo: 'ciclo'`). */
export interface VistaCiclo {
  ciclo: string
  evento: { nombre: string, nombreCorto: string }
  semestre: string | null
  generadoEn: string
  totales: ContadoresPublicos
  /** Cada sección con el nombre de sus asesores. */
  secciones: Array<ContadoresPublicos & { ciclo: string, seccion: string, turnos: string[], asesores: string[] }>
  /** Los cursos del ciclo con su docente y cuántos de sus matriculados pagaron. Ausente o vacío si el padrón no tiene cursos. */
  cursos?: Array<ContadoresPublicos & CursoPublico>
  alumnos: AlumnoCiclo[]
}

/** Quién abre la vista pública: el docente con su enlace (`/seguimiento`), un ciclo (`/seguimiento/ciclo`) o el docente con su DNI (`/docentes`). */
export type TipoSeguimiento = 'asesor' | 'ciclo' | 'documento'

// ─── Docentes y su DNI (spec 028 del backend, spec 019 del panel) ───

/** Un docente para administrarlo: su DNI y las secciones que atiende. El DNI solo lo recibe quien tiene `reportes.gestionar`. */
export interface DocenteAdmin {
  id: number
  nombre: string
  /** DNI de 8 dígitos; `null` si no se registró (sin él no puede usar la página común). */
  documento: string | null
  secciones: SeccionRef[]
  /** `true` si es un docente de SIVIRENO: sus secciones salen de sus cursos (solo se editan nombre y DNI). Ausente en un backend anterior a la spec 034. */
  desdeSivireno?: boolean
  /** Cursos de SIVIRENO que dicta. */
  cursos?: number
}

export interface ListaDocentes {
  asesores: DocenteAdmin[]
  /** Ciclos y secciones del padrón cargado: lo que se puede asignar. */
  secciones: SeccionRef[]
}

/** Cuántos estudiantes hay en cada situación (contadores del filtro de situación). */
export type ConteosSituacion = Record<'todos' | 'NO_PAGADO' | SituacionSeguimiento, number>
