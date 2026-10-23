// ============================================================================
// CAMBIAR EL TIPO DE UNA INSCRIPCIÓN (spec 026 del panel; spec 035 del backend): quién ve el botón, las
// opciones del diálogo y los avisos antes de guardar (funciones puras)
// ============================================================================
import type { Categoria, InscripcionDetalle, Permiso, TipoInscripcion } from '~/types/api'
import { soles } from '~/utils/formato'
import { esVirtual, modalidadDe } from '~/utils/modalidad'

type Puede = (permiso: Permiso) => boolean

/**
 * «Cambiar tipo» es del Owner (`inscripciones.cambiar_tipo`) y no se ofrece a un integrante de una delegación:
 * su plan lo cambia Delegaciones (el backend responde `INSCRIPTION_IN_DELEGATION`).
 */
export function puedeCambiarTipo(detalle: Pick<InscripcionDetalle, 'delegacion'>, puede: Puede): boolean {
  return puede('inscripciones.cambiar_tipo') && !detalle.delegacion
}

/** «Nombre · etiqueta» del tipo, como se ve en el detalle de la inscripción. */
export function nombreDeTipo(tipo: Pick<TipoInscripcion, 'nombre' | 'etiqueta'>): string {
  return [tipo.nombre, tipo.etiqueta].filter(Boolean).join(' · ')
}

/**
 * El tipo en el selector: «Nombre · etiqueta · S/ 120.00 · Virtual · inactivo». El precio solo sale con
 * `pagos.ver` (sin él llega en `null`) y «Virtual» solo si la etiqueta no lo dice ya.
 */
export function etiquetaOpcionTipo(tipo: Pick<TipoInscripcion, 'nombre' | 'etiqueta' | 'precio' | 'modalidad' | 'activo'>, conPagos: boolean): string {
  const nombre = nombreDeTipo(tipo)
  const partes = [nombre]
  if (conPagos && tipo.precio !== null) partes.push(soles(tipo.precio))
  if (esVirtual(tipo) && !nombre.toLowerCase().includes('virtual')) partes.push('Virtual')
  if (!tipo.activo) partes.push('inactivo')
  return partes.join(' · ')
}

/** La categoría que contiene el tipo; `null` si no está en la lista (una cortesía sin tipo o el plan de una delegación). */
export function categoriaDelTipo(categorias: readonly Categoria[], tipoId: number | null | undefined): Categoria | null {
  if (!tipoId) return null
  return categorias.find((categoria) => categoria.tipos.some((tipo) => tipo.id === tipoId)) ?? null
}

/** El tipo elegido dentro de las categorías; `null` si no hay elección o ya no existe. */
export function tipoElegido(categorias: readonly Categoria[], tipoId: number | null | undefined): TipoInscripcion | null {
  if (!tipoId) return null
  for (const categoria of categorias) {
    const tipo = categoria.tipos.find((candidato) => candidato.id === tipoId)
    if (tipo) return tipo
  }
  return null
}

/**
 * Descuento que quedará tras el cambio, igual que el backend: precio de lista del tipo nuevo menos lo que
 * pagó, sin bajar de 0; una cortesía nunca lo tiene. `null` sin `pagos.ver` (los importes llegan en `null`).
 */
export function descuentoTrasCambio(detalle: Pick<InscripcionDetalle, 'pago'>, nuevo: Pick<TipoInscripcion, 'precio'>): number | null {
  const monto = detalle.pago.monto
  if (monto === null || nuevo.precio === null) return null
  if (detalle.pago.modalidad === 'cortesia') return 0
  return Math.max(0, Math.round((nuevo.precio - monto) * 100) / 100)
}

export interface AvisoCambio {
  tono: 'info' | 'warn'
  texto: string
}

/**
 * Lo que conviene saber antes de guardar: que el monto pagado no cambia (y si no coincide con el precio del tipo
 * nuevo), cómo queda el descuento, si cambia la modalidad de asistencia (y con ella las ponencias pendientes) y
 * que la credencial de una aprobada se actualiza sola pero no se envía. Sin elección o con el mismo tipo, nada.
 */
export function avisosDelCambio(detalle: InscripcionDetalle, nuevo: TipoInscripcion | null, conPagos: boolean): AvisoCambio[] {
  if (!nuevo || nuevo.id === detalle.tipoInscripcion?.id) return []
  const avisos: AvisoCambio[] = []
  const monto = detalle.pago.monto
  if (conPagos && monto !== null && nuevo.precio !== null && detalle.pago.modalidad !== 'cortesia') {
    const coincide = monto === nuevo.precio || monto === nuevo.precioInstitucional
    if (!coincide) {
      const institucional = nuevo.precioInstitucional !== null && nuevo.precioInstitucional !== nuevo.precio ? ` (${soles(nuevo.precioInstitucional)} con correo institucional)` : ''
      avisos.push({ tono: 'warn', texto: `Pagó ${soles(monto)} y el tipo elegido cuesta ${soles(nuevo.precio)}${institucional}. El monto pagado no se modifica.` })
    }
    const descuento = descuentoTrasCambio(detalle, nuevo) ?? 0
    const actual = detalle.pago.descuento ?? 0
    if (descuento !== actual) avisos.push({ tono: 'info', texto: `El descuento pasa de ${soles(actual)} a ${soles(descuento)} (se calcula contra el precio del tipo elegido).` })
  }
  const modo = modalidadDe(nuevo.modalidad)
  if (modo !== modalidadDe(detalle.tipoInscripcion?.modalidad)) {
    avisos.push(modo === 'VIRTUAL'
      ? { tono: 'info', texto: 'Pasa a asistir de forma virtual: sus inscripciones pendientes a ponencias especializadas también pasarán a virtual y liberarán su lugar en el aforo.' }
      : { tono: 'warn', texto: 'Pasa a asistir de forma presencial: sus inscripciones pendientes a ponencias especializadas ocuparán aforo presencial. Si alguna ya no tiene cupo, no se podrá guardar.' })
  }
  if (detalle.estado.codigo === 'APROBADO') {
    avisos.push({ tono: 'info', texto: 'Su credencial PDF pasará a mostrar el tipo nuevo. No se envía ningún correo: puedes reenviarla después.' })
  }
  return avisos
}

/** Texto del aviso al terminar: el tipo nuevo y lo que más cambió. */
export function mensajeTrasCambio(resultado: Pick<InscripcionDetalle, 'tipoInscripcion' | 'estado' | 'ponenciasActualizadas'>): string {
  const partes = [`Tipo actualizado a «${resultado.tipoInscripcion ? nombreDeTipo(resultado.tipoInscripcion) : 'sin tipo'}».`]
  const ponencias = resultado.ponenciasActualizadas ?? 0
  if (ponencias > 0) {
    partes.push(ponencias === 1 ? 'Se actualizó 1 inscripción a ponencias especializadas.' : `Se actualizaron ${ponencias} inscripciones a ponencias especializadas.`)
  }
  if (resultado.estado.codigo === 'APROBADO') partes.push('Su credencial ya muestra el tipo nuevo; reenvíala si la persona debe recibirla de nuevo.')
  return partes.join(' ')
}
