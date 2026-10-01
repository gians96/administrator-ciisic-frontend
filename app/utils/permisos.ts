import type { AccesoPanel, AlcanceRol, CodigoRol, Permiso, PermisoElegible, Usuario } from '~/types/api'

/**
 * Permisos del staff (spec 013 del backend). El panel decide menús, páginas y botones **por permiso**;
 * este es el único archivo que menciona los códigos de rol (`ETIQUETAS_ROL`, `tonoRol` y el respaldo de
 * `accesoDeSesion` para sesiones sin `acceso`).
 */

/** Nombre visible de cada permiso (mismo texto que `ETIQUETAS_PERMISO` del backend). */
export const ETIQUETAS_PERMISO: Readonly<Record<Permiso, string>> = {
  'sistema.configurar': 'Configurar el sistema (Google, API_UNDC, legacy)',
  'administradores.gestionar': 'Gestionar el equipo y los administradores',
  'eventos.configurar': 'Configurar eventos, tipos, actividades e integraciones',
  'eventos.eliminar': 'Eliminar eventos',
  'catalogos.configurar': 'Configurar catálogos',
  'correo.configurar': 'Configurar credenciales de correo',
  'consultas_dni.gestionar': 'Consultas DNI y su pool de tokens',
  'participantes.gestionar': 'Crear y editar participantes',
  'inscripciones.eliminar': 'Eliminar inscripciones',
  'inscripciones.cancelar': 'Cancelar inscripciones',
  'inscripciones.cortesia': 'Registrar inscripciones de cortesía',
  'legacy.usar': 'Usar las rutas de la versión anterior',
  'certificados.gestionar': 'Gestionar tipos, plantillas, emisión, anulación y proveedor de certificados',

  'resumen.ver': 'Ver el resumen del evento',
  'inscripciones.ver': 'Ver inscritos (nombre, documento, correo y celular)',
  'inscripciones.exportar': 'Exportar inscritos a CSV',
  'credenciales.reenviar': 'Reenviar la credencial por correo',
  'pagos.ver': 'Ver montos, pagos y vouchers',
  'inscripciones.validar': 'Aprobar, rechazar o poner en revisión',
  'asistencia.ver': 'Ver la asistencia',
  'asistencia.exportar': 'Exportar la asistencia',
  'asistencia.marcar': 'Marcar asistencia',
  'asistencia.anular': 'Anular una asistencia marcada',
  'asistencia.fuera_horario': 'Marcar asistencia fuera del horario de la actividad',
  'ponencias.ver': 'Ver y descargar ponencias',
  'mensajes.ver': 'Ver mensajes de contacto',
  'mensajes.eliminar': 'Eliminar mensajes de contacto',
  'certificados.ver': 'Ver certificados y descargar los firmados',
  'certificados.operar': 'Generar, descargar para firmar y subir certificados firmados',
}

/** Catálogo completo, en el orden del backend. */
export const PERMISOS = Object.keys(ETIQUETAS_PERMISO) as Permiso[]

export function esPermiso(valor: unknown): valor is Permiso {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(ETIQUETAS_PERMISO, valor)
}

/** Un permiso implica otros (`DEPENDENCIAS` del backend); el backend las aplica al guardar. */
export const DEPENDENCIAS: Readonly<Partial<Record<Permiso, readonly Permiso[]>>> = {
  'inscripciones.exportar': ['inscripciones.ver'],
  'credenciales.reenviar': ['inscripciones.ver'],
  'pagos.ver': ['inscripciones.ver'],
  'inscripciones.validar': ['pagos.ver'],
  'asistencia.exportar': ['asistencia.ver'],
  'asistencia.marcar': ['asistencia.ver'],
  'asistencia.anular': ['asistencia.ver'],
  'asistencia.fuera_horario': ['asistencia.marcar'],
  'mensajes.eliminar': ['mensajes.ver'],
  'certificados.operar': ['certificados.ver'],
}

type Dependencias = Readonly<Partial<Record<Permiso, readonly Permiso[]>>>

/** Dependencias a partir de `permisosElegibles` de `GET /roles` (cada uno con su `implica`). */
export function dependenciasDe(elegibles: readonly PermisoElegible[]): Dependencias {
  return Object.fromEntries(elegibles.filter((elegible) => elegible.implica?.length).map((elegible) => [elegible.codigo, elegible.implica]))
}

/**
 * Permisos marcados más los que implican, hasta el punto fijo (casillas de la Comisión), en el orden
 * del catálogo. Ignora códigos desconocidos.
 */
export function conDependencias(permisos: Iterable<string>, dependencias: Dependencias = DEPENDENCIAS): Permiso[] {
  const resultado = new Set<Permiso>()
  const pendientes = [...permisos].filter(esPermiso)
  while (pendientes.length) {
    const permiso = pendientes.pop() as Permiso
    if (resultado.has(permiso)) continue
    resultado.add(permiso)
    for (const implicado of dependencias[permiso] ?? []) pendientes.push(implicado)
  }
  return PERMISOS.filter((permiso) => resultado.has(permiso))
}

/**
 * Permisos marcados que obligan a mantener `permiso` (p. ej. `asistencia.ver` lo exige
 * `asistencia.marcar`): su casilla no se puede desmarcar mientras la lista no esté vacía.
 */
export function requeridoPor(permiso: Permiso, marcados: readonly Permiso[], dependencias: Dependencias = DEPENDENCIAS): Permiso[] {
  return marcados.filter((otro) => otro !== permiso && conDependencias([otro], dependencias).includes(permiso))
}

// ─── Roles: solo etiquetas y tono (nunca lógica de acceso) ───

export const ETIQUETAS_ROL: Readonly<Record<CodigoRol, string>> = {
  SUPERADMIN: 'Owner',
  ADMIN: 'Administrador del sistema',
  TESORERO: 'Tesorero',
  COMISION: 'Comisión tecnológica',
}

/** Nombre visible del rol; un código desconocido muestra el nombre que envió el backend. */
export function etiquetaRol(codigo: string | null | undefined, nombre?: string | null): string {
  return (codigo && ETIQUETAS_ROL[codigo as CodigoRol]) || nombre || '—'
}

export type TonoRol = 'warn' | 'brand' | 'info' | 'neutral'

const TONOS_ROL: Readonly<Record<CodigoRol, TonoRol>> = {
  SUPERADMIN: 'warn',
  ADMIN: 'brand',
  TESORERO: 'info',
  COMISION: 'neutral',
}

/** Tono del `AppBadge` del rol. */
export function tonoRol(codigo: string | null | undefined): TonoRol {
  return (codigo && TONOS_ROL[codigo as CodigoRol]) || 'neutral'
}

// ─── Acceso de la sesión ───

/** Cuenta sin permisos ni eventos. */
export const SIN_ACCESO: Readonly<AccesoPanel> = Object.freeze({ alcance: 'EVENTO', permisos: [], eventoIds: [], perfilParticipante: false })

/**
 * Cuenta por evento sin eventos asignados (p. ej. se borró su único evento): el backend le envía los
 * permisos de su rol, pero no puede ejercerlos en ningún evento (y no tiene permisos globales).
 */
export function sinEventosAsignados(acceso: AccesoPanel | null | undefined): boolean {
  return acceso?.alcance === 'EVENTO' && !acceso.eventoIds?.length
}

/** Algún permiso de la lista (O). Sin acceso o con la lista vacía, `false`. */
export function tienePermiso(acceso: AccesoPanel | null | undefined, permiso: Permiso | readonly Permiso[]): boolean {
  if (!acceso) return false
  const buscados: readonly Permiso[] = typeof permiso === 'string' ? [permiso] : permiso
  return buscados.some((p) => acceso.permisos.includes(p))
}

/** Acceso por rol para sesiones sin `acceso` (respuestas anteriores a la spec 013). */
function accesoPorRol(codigo: unknown): AccesoPanel {
  if (codigo === 'SUPERADMIN') return { alcance: 'GLOBAL', permisos: [...PERMISOS], eventoIds: null, perfilParticipante: false }
  if (codigo === 'ADMIN') return { alcance: 'GLOBAL', permisos: PERMISOS.filter((p) => p !== 'sistema.configurar'), eventoIds: null, perfilParticipante: false }
  return { ...SIN_ACCESO, permisos: [], eventoIds: [] }
}

function esAlcance(valor: unknown): valor is AlcanceRol {
  return valor === 'GLOBAL' || valor === 'EVENTO'
}

/**
 * Acceso de la cuenta de staff a partir del usuario de la sesión: `usuario.acceso` normalizado
 * (permisos conocidos, ids de evento válidos). Sin `acceso`, se deduce del rol: Owner todos,
 * Administrador todos menos `sistema.configurar`, cualquier otro ninguno.
 */
export function accesoDeSesion(usuario: Pick<Usuario, 'rolCodigo' | 'acceso'> | null | undefined): AccesoPanel {
  if (!usuario) return { ...SIN_ACCESO, permisos: [], eventoIds: [] }
  const acceso: unknown = usuario.acceso
  if (!acceso || typeof acceso !== 'object' || !Array.isArray((acceso as AccesoPanel).permisos)) return accesoPorRol(usuario.rolCodigo)
  const { alcance, permisos, eventoIds, perfilParticipante } = acceso as Record<string, unknown>
  const global = esAlcance(alcance) ? alcance === 'GLOBAL' : eventoIds === null
  return {
    alcance: global ? 'GLOBAL' : 'EVENTO',
    permisos: (permisos as unknown[]).filter(esPermiso),
    eventoIds: global ? null : (Array.isArray(eventoIds) ? eventoIds.filter((id): id is number => Number.isSafeInteger(id) && (id as number) > 0) : []),
    perfilParticipante: perfilParticipante === true,
  }
}

// ─── Menú y página de inicio ───

export interface ItemMenu {
  to: string
  label: string
  icon: string
  permiso: Permiso
}

export interface SeccionMenu {
  titulo: string
  items: ItemMenu[]
}

/** Escáner de asistencia a pantalla completa (cámara, lector USB o DNI). */
export const RUTA_ESCANER = '/escanear'

/** Menú completo; cada página exige el mismo permiso en su `definePageMeta({ permiso })`. */
export const MENU: readonly SeccionMenu[] = [
  {
    titulo: 'Congreso',
    items: [
      { to: '/', label: 'Resumen', icon: 'heroicons:squares-2x2', permiso: 'resumen.ver' },
      { to: '/inscripciones', label: 'Inscripciones', icon: 'heroicons:clipboard-document-check', permiso: 'inscripciones.ver' },
      { to: '/asistencia', label: 'Asistencia', icon: 'heroicons:qr-code', permiso: 'asistencia.ver' },
      { to: RUTA_ESCANER, label: 'Escanear asistencia', icon: 'heroicons:camera', permiso: 'asistencia.marcar' },
      { to: '/ponencias', label: 'Ponencias', icon: 'heroicons:document-text', permiso: 'ponencias.ver' },
      { to: '/mensajes', label: 'Mensajes', icon: 'heroicons:envelope', permiso: 'mensajes.ver' },
      { to: '/certificados', label: 'Certificados', icon: 'heroicons:academic-cap', permiso: 'certificados.ver' },
    ],
  },
  {
    titulo: 'Configuración',
    items: [
      { to: '/eventos', label: 'Eventos', icon: 'heroicons:calendar-days', permiso: 'eventos.configurar' },
      { to: '/tipos-inscripcion', label: 'Tipos de inscripción', icon: 'heroicons:tag', permiso: 'eventos.configurar' },
      { to: '/consultas', label: 'Consultas DNI', icon: 'heroicons:identification', permiso: 'consultas_dni.gestionar' },
      { to: '/participantes', label: 'Participantes', icon: 'heroicons:users', permiso: 'participantes.gestionar' },
      { to: '/correo', label: 'Correo', icon: 'heroicons:paper-airplane', permiso: 'correo.configurar' },
      { to: '/administradores', label: 'Equipo y administradores', icon: 'heroicons:shield-check', permiso: 'administradores.gestionar' },
      { to: '/sistema', label: 'Sistema', icon: 'heroicons:cog-8-tooth', permiso: 'sistema.configurar' },
    ],
  },
]

/** Página para una cuenta sin ninguna sección del panel. */
export const RUTA_SIN_ACCESO = '/sin-acceso'

/**
 * Secciones con los ítems permitidos; las que quedan vacías se ocultan. Una cuenta por evento sin
 * eventos no tiene ninguna (va a `/sin-acceso`).
 */
export function menuPara(acceso: AccesoPanel | null | undefined): SeccionMenu[] {
  if (sinEventosAsignados(acceso)) return []
  return MENU
    .map((seccion) => ({ titulo: seccion.titulo, items: seccion.items.filter((item) => tienePermiso(acceso, item.permiso)) }))
    .filter((seccion) => seccion.items.length > 0)
}

/** Permisos que solo acompañan a `asistencia.marcar`: el que implica y la opción de marcar fuera de horario. */
const ACOMPANAN_MARCAR: readonly Permiso[] = ['asistencia.ver', 'asistencia.fuera_horario']

/**
 * La cuenta solo marca asistencia: tiene `asistencia.marcar` y ningún otro permiso aparte de los que lo
 * acompañan (`asistencia.ver`, `asistencia.fuera_horario`).
 */
export function soloMarcaAsistencia(acceso: AccesoPanel | null | undefined): boolean {
  if (!acceso || !tienePermiso(acceso, 'asistencia.marcar')) return false
  return acceso.permisos.every((permiso) => permiso === 'asistencia.marcar' || ACOMPANAN_MARCAR.includes(permiso))
}

/**
 * Primera página permitida en el orden del menú. Una cuenta cuyo único permiso operativo es
 * `asistencia.marcar` empieza en el escáner; una cuenta por evento que además hace otras cosas y marca
 * asistencia (la Comisión con más permisos) empieza en Asistencia. Sin ninguna (o una cuenta por evento
 * sin eventos), `/sin-acceso`.
 */
export function inicioPara(acceso: AccesoPanel | null | undefined): string {
  const items = menuPara(acceso).flatMap((seccion) => seccion.items)
  const escaner = items.find((item) => item.to === RUTA_ESCANER)
  if (escaner && soloMarcaAsistencia(acceso)) return escaner.to
  const asistencia = items.find((item) => item.permiso === 'asistencia.ver')
  if (asistencia && acceso?.alcance === 'EVENTO' && tienePermiso(acceso, 'asistencia.marcar')) return asistencia.to
  return items[0]?.to ?? RUTA_SIN_ACCESO
}
