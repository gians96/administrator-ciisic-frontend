import type { CodigoEstado, Permiso } from '~/types/api'

/** Consulta de permisos de la cuenta (`auth.puede`). */
type Puede = (permiso: Permiso) => boolean

/** Botones del detalle de una inscripción. */
export interface AccionesInscripcion {
  /** Descargar el PDF (`inscripciones.ver`, que ya exige la página). */
  verCredencial: boolean
  reenviarCredencial: boolean
  enRevision: boolean
  rechazar: boolean
  aprobar: boolean
  cancelar: boolean
}

/**
 * Acciones según el estado y los permisos: validar (en revisión, rechazar, aprobar) con
 * `inscripciones.validar`; cancelar exige además `inscripciones.cancelar` (el backend responde
 * `STATUS_NOT_ALLOWED` sin él); reenviar la credencial de una aprobada con `credenciales.reenviar`.
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
