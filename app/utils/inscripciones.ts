import type { CodigoEstado, InscripcionDetalle, InscripcionFila, Permiso } from '~/types/api'

/** Consulta de permisos de la cuenta (`auth.puede`). */
type Puede = (permiso: Permiso) => boolean

/**
 * El tipo de una fila del listado a partir del detalle (spec 035 del backend): la fila lleva solo el código de la
 * categoría. Así la fila refleja un cambio de tipo hecho desde el detalle sin recargar la página.
 */
export function tipoDeFila(detalle: Pick<InscripcionDetalle, 'tipoInscripcion'>): InscripcionFila['tipoInscripcion'] {
  const tipo = detalle.tipoInscripcion
  if (!tipo) return null
  return { id: tipo.id, nombre: tipo.nombre, etiqueta: tipo.etiqueta, categoria: tipo.categoria.codigo, modalidad: tipo.modalidad }
}

/** Botones del detalle de una inscripción. */
export interface AccionesInscripcion {
  /** Descargar el PDF (`inscripciones.ver`, que ya exige la página). */
  verCredencial: boolean
  reenviarCredencial: boolean
  enRevision: boolean
  rechazar: boolean
  aprobar: boolean
  cancelar: boolean
  /** Borrar una rechazada o cancelada (solo el Owner tiene `inscripciones.eliminar`, spec 017 del backend). */
  eliminar: boolean
}

/** Estados que se pueden eliminar: los mismos que liberan el lugar para volver a inscribirse. */
const ESTADOS_ELIMINABLES: readonly CodigoEstado[] = ['RECHAZADO', 'CANCELADO']

/**
 * Acciones según el estado y los permisos: validar (en revisión, rechazar, aprobar) con
 * `inscripciones.validar`; cancelar exige además `inscripciones.cancelar` (el backend responde
 * `STATUS_NOT_ALLOWED` sin él); reenviar la credencial de una aprobada con `credenciales.reenviar`;
 * eliminar una rechazada o cancelada con `inscripciones.eliminar` (solo el Owner).
 */
export function accionesInscripcion(estado: CodigoEstado, puede: Puede): AccionesInscripcion {
  const aprobada = estado === 'APROBADO'
  const validar = puede('inscripciones.validar')
  return {
    verCredencial: aprobada,
    reenviarCredencial: aprobada && puede('credenciales.reenviar'),
    enRevision: validar && estado !== 'EN_REVISION' && !aprobada,
    rechazar: validar && estado !== 'RECHAZADO',
    aprobar: validar && !aprobada,
    cancelar: validar && puede('inscripciones.cancelar') && estado !== 'CANCELADO',
    eliminar: puede('inscripciones.eliminar') && ESTADOS_ELIMINABLES.includes(estado),
  }
}

/** Hay al menos un botón que mostrar. */
export function hayAcciones(acciones: AccionesInscripcion): boolean {
  return Object.values(acciones).some(Boolean)
}

/** Subtítulo del listado según lo que la cuenta puede hacer. */
export function descripcionInscripciones(puede: Puede): string {
  if (puede('inscripciones.validar')) return 'Revisa vouchers, aprueba o rechaza y reenvía credenciales.'
  if (puede('credenciales.reenviar')) return 'Consulta a los inscritos del evento y reenvía sus credenciales.'
  return 'Consulta a los inscritos del evento.'
}

/** Sin `pagos.ver` el backend no busca por número de operación. */
export function placeholderBusqueda(conPagos: boolean): string {
  return conPagos ? 'DNI, nombres, correo o nº de operación' : 'DNI, nombres o correo'
}
