// Tipos de la API administrativa de backend-ciisic
// (contratos en backend-ciisic/specs/002…015/contracts).

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
  /** Credenciales de la API de certificados de la UNDC (spec 015); falta con el backend anterior. */
  certificadosUndc?: CertificadosUndcSistema
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

// ─── Certificados (backend-ciisic spec 015, `contracts/api-certificados.md`) ───

/** Ciclo: PENDIENTE → (generar) PREPARADO → (subir firmado) EN_FIRMA | FIRMADO; cualquiera → ANULADO. */
export type EstadoCertificado = 'PENDIENTE' | 'PREPARADO' | 'EN_FIRMA' | 'FIRMADO' | 'ANULADO'

/** Cuántos certificados hay en cada estado (`meta.resumen` del listado, con los demás filtros). */
export type ResumenEstados = Record<EstadoCertificado, number>

/** Persona del staff que hizo algo (`creadoPor`, `emitidoPor`…). */
export interface PersonaStaffRef {
  id: number
  nombres: string
  apellidos: string
}

/** `GET /certificate-types`: PARTICIPANTE, ORGANIZADOR, PONENTE y los que se agreguen (no se borran). */
export interface TipoCertificado {
  id: number
  /** `^[A-Z][A-Z0-9_]{1,39}$`; no cambia. */
  codigo: string
  nombre: string
  /** Lo que estampa el campo `TIPO`. */
  textoImpreso: string
  activo: boolean
  orden: number
}

/** `GET /certificate-fonts`. */
export interface FuenteCertificado {
  codigo: string
  nombre: string
}

export type TipoCampoPlantilla = 'NOMBRE' | 'TIPO' | 'CODIGO' | 'QR' | 'FECHA_EMISION' | 'HORAS' | 'EVENTO' | 'DOCUMENTO' | 'DETALLE' | 'TEXTO'
export type AlineacionCampo = 'IZQUIERDA' | 'CENTRO' | 'DERECHA'
export type CapitalizacionCampo = 'ORIGINAL' | 'MAYUSCULAS' | 'TITULO'
export type FormatoFechaCampo = 'LARGO' | 'CORTO'

/**
 * Campo de una plantilla, en puntos PDF absolutos de la página (origen abajo a la izquierda). En el
 * texto, `y` es la línea base de la primera línea; en el QR, la esquina inferior izquierda. El backend
 * guarda los campos normalizados (sin nulos y con las medidas a centésimas de pt).
 */
export interface CampoPlantilla {
  /** `^[A-Za-z0-9_-]{1,40}$`, único en la plantilla. */
  id: string
  tipo: TipoCampoPlantilla
  /** 1 o 2. */
  pagina: number
  x: number
  y: number
  /** Texto: ancho de la caja `[x, x + ancho]`; sin él, `x` es el ancla según la alineación. */
  ancho?: number | null
  /** Solo QR: 36–300 pt (por defecto 90). */
  lado?: number | null
  /** Código de `/certificate-fonts` (por defecto `MONTSERRAT`). */
  fuente?: string | null
  /** 4–200 pt (por defecto 12). */
  tamano?: number | null
  /** Con `ancho`: tamaño al que puede reducirse (no supera a `tamano`). */
  tamanoMinimo?: number | null
  /** `#rrggbb` (por defecto `#000000`). */
  color?: string | null
  alineacion?: AlineacionCampo | null
  capitalizacion?: CapitalizacionCampo | null
  /** 1–10 (por defecto 1). */
  lineasMax?: number | null
  /** 0,8–3 (por defecto 1,2). */
  interlineado?: number | null
  /** ≤500; obligatorio en `TEXTO`; en los demás reemplaza al valor. Admite marcadores (`{nombre}`…). */
  texto?: string | null
  formatoFecha?: FormatoFechaCampo | null
}

/** Plantilla de un evento: PDF de diseño (1–2 páginas, ≤5 MB) con sus campos. */
export interface PlantillaCertificado {
  id: number
  eventoId: number
  nombre: string
  archivoOriginal: string
  tamanoBytes: number
  paginas: number
  anchoPt: number
  altoPt: number
  campos: CampoPlantilla[]
  horasPorDefecto: number | null
  /** 1–5: con menos firmas el certificado queda `EN_FIRMA`. */
  firmasRequeridas: number
  /** Sube al cambiar los campos o el diseño; el editor la envía al guardar (`409 TEMPLATE_CHANGED`). */
  version: number
  activa: boolean
  totalCertificados: number
  /** Tiene certificados: no se borra (`409 TEMPLATE_IN_USE`), se desactiva. */
  enUso: boolean
  creadoPor: PersonaStaffRef | null
  creadoEn: string
  actualizadoEn: string
}

/** Aviso del estampado (vista previa y generación): el PDF se genera igual. */
export interface AvisoEstampado {
  /** `id` del campo, o `null` si es del documento. */
  campo: string | null
  /** `GLIFO_RESPALDO`, `GLIFO_FALTANTE`, `DESBORDA`, `PAGINA_INEXISTENTE`, `FUENTE_DESCONOCIDA`, `FUENTE_SIN_SUBCONJUNTO`, `URL_VERIFICACION_NO_CONFIGURADA`, `MAS_AVISOS`. */
  codigo: string
  mensaje: string
}

/** Elemento de `GET /events/:eventId/certificates` (y base del detalle). */
export interface Certificado {
  id: number
  eventoId: number
  /** Correlativo en el evento (no se reutiliza). */
  numero: number
  /** `<PREFIJO>-<AÑO>-<NNNNNN>-<XXXXXX>`, fijo desde la emisión. */
  codigo: string
  /** Se fija en la primera generación; `null` hasta entonces. */
  codigoImpreso: string | null
  estado: EstadoCertificado
  tipo: { id: number, codigo: string, nombre: string, textoImpreso: string }
  /** `null` si la plantilla se borró. */
  plantilla: { id: number, nombre: string, version: number, firmasRequeridas: number } | null
  plantillaVersion: number | null
  /** La plantilla cambió después de generarlo (no se regenera solo). */
  plantillaDesactualizada: boolean
  participanteId: number
  inscripcionId: number | null
  ponenciaId: string | null
  nombreImpreso: string
  tipoDocumento: string
  /** Completo solo con `certificados.gestionar` (si no, `****1234`). */
  numeroDocumento: string
  detalle: string | null
  horas: number | null
  /** `AAAA-MM-DD`. */
  fechaEmision: string
  tieneGenerado: boolean
  tieneFirmado: boolean
  generadoEn: string | null
  descargadoParaFirmarEn: string | null
  firmasDetectadas: number
  firmadoEn: string | null
  anuladoEn: string | null
  creadoEn: string
  actualizadoEn: string
}

/** `PREFIJO`: generado vigente con firmas agregadas; `METADATOS`: reescrito con el `Subject` vigente; `FORZADO`: aceptado a mano. */
export type CoincidenciaFirmado = 'PREFIJO' | 'METADATOS' | 'FORZADO'

/** Firma que verificó en el firmado vigente (CN del certificado; sin cadena de confianza). */
export interface FirmanteCertificado {
  nombre: string
  emisor: string
  serie: string
  validoDesde: string | null
  validoHasta: string | null
  fechaFirma: string | null
}

/** `GET /certificates/:id`. */
export interface CertificadoDetalle extends Certificado {
  evento: { id: number, codigo: string, nombreCorto: string }
  urlVerificacion: string | null
  coincidencia: CoincidenciaFirmado | null
  motivoForzado: string | null
  /** `[]` sin firmado. */
  firmantes: FirmanteCertificado[]
  motivoAnulacion: string | null
  codigoExterno: string | null
  registroExterno: string | null
  registroExternoError: string | null
  registradoExternoEn: string | null
  emitidoPor: PersonaStaffRef | null
  editadoPor: PersonaStaffRef | null
  firmadoCargadoPor: PersonaStaffRef | null
  anuladoPor: PersonaStaffRef | null
}

/** `meta` del listado de certificados. */
export interface MetaCertificados extends Meta {
  resumen: ResumenEstados
}

// Emisión (`certificados.gestionar`)

/** Aviso de una emisión (`CORREO_CONSERVADO`: la persona ya estaba registrada con otro correo). */
export interface AvisoEmision {
  codigo: string
  mensaje: string
}

/** Persona nueva o existente (por documento) de la emisión individual: reglas del alta de participantes. */
export interface PersonaEmision {
  tipoDocumento: 'dni' | 'ce'
  numeroDocumento: string
  correo: string
  nombres?: string
  apellidos?: string
  celular?: string
}

/** `POST /events/:eventId/certificates`: exactamente uno de `participanteId` o `persona`. */
export interface CuerpoEmisionIndividual {
  participanteId?: number
  persona?: PersonaEmision
  tipoCodigo: string
  plantillaId: number
  /** UUID: distingue dos certificados del mismo tipo para la misma persona. */
  ponenciaId?: string | null
  horas?: number | null
  detalle?: string | null
  fechaEmision?: string
}

export interface ResultadoEmisionIndividual {
  certificado: Certificado
  participante: { id: number, nuevo: boolean }
  avisos: AvisoEmision[]
}

/** `POST /events/:eventId/certificates/from-inscriptions` (inscritos aprobados). */
export interface CuerpoDesdeInscripciones {
  tipoCodigo: string
  plantillaId: number
  horas?: number | null
  fechaEmision?: string
  filtro?: {
    tipoInscripcionIds?: number[]
    /** Sin `asistenciaMinima` → `422 VALIDATION_ERROR`. */
    actividadIds?: number[]
    /** 0–100: % de actividades con asistencia no anulada. */
    asistenciaMinima?: number | null
  }
  simular?: boolean
}

export type ResultadoCandidato = 'CREAR' | 'YA_EMITIDO' | 'EXCLUIDO'

export interface MuestraCandidato {
  inscripcionId: number
  participanteId: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  /** `null` sin filtro de asistencia. */
  asistencia: { marcadas: number, total: number, porcentaje: number } | null
  resultado: ResultadoCandidato
}

export type ResultadoDesdeInscripciones =
  | { simular: true, candidatos: number, crear: number, yaEmitidos: number, excluidos: number, muestra: MuestraCandidato[] }
  | { simular: false, candidatos: number, creados: number, yaEmitidos: number, excluidos: number }

/** Fila de `POST /events/:eventId/certificates/import` (1–300 por solicitud). */
export interface FilaImportacion {
  tipoDocumento: string
  numeroDocumento: string
  correo: string
  nombres?: string
  apellidos?: string
  detalle?: string
  /** Vacío: las horas de la plantilla. */
  horas?: number | null
}

export interface CuerpoImportacion {
  tipoCodigo: string
  plantillaId: number
  fechaEmision?: string
  filas: FilaImportacion[]
  simular?: boolean
}

export type ResultadoFilaImportacion = 'CREAR' | 'CREADO' | 'YA_EMITIDO' | 'ERROR'

export interface FilaResultadoImportacion {
  /** Posición (1-based) en las filas de **esta** solicitud. */
  fila: number
  resultado: ResultadoFilaImportacion
  /** `id: null` para una persona nueva al simular. */
  participante: { id: number | null, nuevo: boolean } | null
  /** `INVALID_ROW`, `DUPLICATE_ROW`, `EMAIL_IN_USE`, `NAMES_REQUIRED`, `LOOKUP_LIMIT` o el aviso `CORREO_CONSERVADO`. */
  codigo: string | null
  mensaje: string | null
}

export interface ResultadoImportacion {
  simular: boolean
  resumen: { total: number, porCrear: number, creados: number, yaEmitidos: number, errores: number }
  filas: FilaResultadoImportacion[]
}

// Generación y firmados (`certificados.operar`)

export type ResultadoGeneracionCertificado = 'GENERADO' | 'OMITIDO' | 'ERROR'

export interface CertificadoProcesado {
  id: number
  codigo: string
  resultado: ResultadoGeneracionCertificado
  estado: EstadoCertificado
  avisos: AvisoEstampado[]
  /** `CERTIFICATE_NOT_FOUND`, `TEMPLATE_REQUIRED`, `TEMPLATE_FILE_MISSING`, `CERTIFICATE_CHANGED`, `GENERATION_FAILED`. */
  codigoError: string | null
  mensaje: string | null
}

/** `POST /events/:eventId/certificates/generate` (`{ ids }` 1–10 o `{ pendientes: true, despuesDeId }`). */
export interface ResultadoGeneracion {
  procesados: CertificadoProcesado[]
  restantes: number
  /** Cursor para la siguiente tanda de pendientes; `null` con `ids`. */
  ultimoId: number | null
  hayMas: boolean
}

export type ResultadoCargaArchivo =
  | 'FIRMADO' | 'PARCIAL' | 'SIN_FIRMA' | 'NO_COINCIDE' | 'NO_ENCONTRADO' | 'OTRO_EVENTO'
  | 'ANULADO' | 'YA_FIRMADO' | 'DUPLICADO' | 'INVALIDO'

export interface ResumenCargaFirmados {
  firmados: number
  parciales: number
  sinFirma: number
  noCoincide: number
  noEncontrados: number
  otroEvento: number
  anulados: number
  yaFirmados: number
  duplicados: number
  invalidos: number
}

export interface DetalleCargaFirmado {
  archivo: string
  resultado: ResultadoCargaArchivo
  certificadoId: number | null
  codigo: string | null
  estado: EstadoCertificado | null
  firmas: number | null
  firmasRequeridas: number | null
  coincidencia: 'PREFIJO' | 'METADATOS' | null
  codigoError: string | null
  mensaje: string | null
}

/** `POST /events/:eventId/certificates/signed` (tanda de hasta 10 PDF y 25 MB). */
export interface ResultadoCargaFirmados {
  resumen: ResumenCargaFirmados
  detalle: DetalleCargaFirmado[]
}

/** `PUT /certificates/:id/signed` (uno, sin emparejar por nombre). */
export interface ResultadoFirmadoIndividual {
  id: number
  codigo: string
  estado: EstadoCertificado
  firmasDetectadas: number
  firmasRequeridas: number
  coincidencia: CoincidenciaFirmado
  firmantes: FirmanteCertificado[]
  firmadoEn: string | null
}

/** `DELETE /certificates/:id/signed`. */
export interface ResultadoQuitarFirmado {
  id: number
  codigo: string
  estado: EstadoCertificado
}

/** `POST /certificates/:id/annul`. */
export interface ResultadoAnulacion {
  id: number
  codigo: string
  estado: 'ANULADO'
  anuladoEn: string
  motivoAnulacion: string
}

// Configuración

export type ProveedorCertificados = 'LOCAL' | 'UNDC'

/** `GET|PUT /certificate-settings` (`certificados.gestionar`). */
export interface ConfiguracionCertificados {
  proveedor: ProveedorCertificados
  /** `^[A-Z0-9]{2,20}$`. */
  prefijo: string
  /** Sin confirmar no se descarga para firmar (`409 PROVIDER_NOT_CONFIRMED`). */
  proveedorConfirmado: boolean
  /** `<url_panel>/verificar`; `null` sin la URL del panel en Sistema (no se genera). */
  urlVerificacionBase: string | null
  ejemploCodigo: string
  ejemploUrlVerificacion: string | null
  /** Hay certificados con el código en un PDF: el prefijo ya no cambia. */
  prefijoBloqueado: boolean
  certificadosGenerados: number
  certificadosConOtroPrefijo: number
  proveedores: Array<{ codigo: ProveedorCertificados, nombre: string, disponible: boolean }>
  undc: { credencialesConfiguradas: boolean, disponible: boolean }
  actualizadoEn: string | null
}

/** `certificadosUndc` de `GET /settings` (Sistema, solo Owner). El secreto nunca vuelve completo. */
export interface CertificadosUndcSistema {
  url: string | null
  usuario: string | null
  secretoEnmascarado: string | null
  timeoutMs: number
  configurada: boolean
  disponible: boolean
  ultimoEstado: 'OK' | 'ERROR' | null
  ultimoError: string | null
  ultimaPruebaEn: string | null
}

// Verificación pública y portal

/**
 * Verificación pública (`/api/publico/certificados/:codigo` → `/api/v1/public/certificates/:codigo`):
 * solo FIRMADO (`VALIDO`) o `ANULADO`. Nunca lleva documento, correo, motivo ni PDF.
 */
export interface VerificacionCertificado {
  codigo: string
  estado: 'VALIDO' | 'ANULADO'
  titular: string
  tipo: string
  evento: { nombre: string, fechaInicio: string, fechaFin: string }
  fechaEmision: string
  horas: number | null
  /** `null` en un anulado que nunca se firmó. */
  firmadoEn: string | null
  /** Solo en los anulados. */
  anuladoEn?: string | null
}

/** Elemento de `GET /me/certificates`: solo los FIRMADO propios. */
export interface CertificadoPortal {
  id: number
  codigoImpreso: string
  evento: { codigo: string, nombre: string, nombreCorto: string, fechaInicio: string, fechaFin: string }
  tipo: { codigo: string, nombre: string }
  fechaEmision: string
  horas: number | null
  detalle: string | null
  firmadoEn: string
  urlVerificacion: string | null
}
