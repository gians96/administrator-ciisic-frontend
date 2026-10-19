import type { ModalidadAsistencia } from '~/types/api'

/**
 * Modalidad de asistencia del tipo de inscripción (spec 012 del panel, spec 018 del backend). No es la
 * modalidad de pago (`modalidadPago` en `app/utils/formato.ts`) ni el «fotocheck virtual» del portal.
 * Todo lo que llega del backend es tolerante: ausente, `null` o desconocida = `PRESENCIAL`.
 */

export const MODALIDADES_ASISTENCIA: readonly ModalidadAsistencia[] = ['PRESENCIAL', 'VIRTUAL']

const ETIQUETAS_MODALIDAD: Readonly<Record<ModalidadAsistencia, string>> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
}

/** Lugar que se muestra en el portal en lugar de la sede cuando la inscripción es virtual. */
export const LUGAR_VIRTUAL = 'Modalidad virtual'

/**
 * Texto neutro de lo que sigue a una inscripción virtual: cómo se entrega el acceso a la transmisión
 * aún no está definido por la organización, así que no se promete ningún medio, enlace ni certificado.
 */
export const INDICACIONES_VIRTUAL = 'La organización te compartirá las indicaciones para conectarte a la transmisión del congreso.'

/** La modalidad de un valor del backend: solo `'VIRTUAL'` es virtual; cualquier otra cosa, presencial. */
export function modalidadDe(valor: unknown): ModalidadAsistencia {
  return valor === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL'
}

/** El tipo (o la inscripción con su tipo) es virtual. Sin tipo (p. ej. una cortesía sin tipo), no. */
export function esVirtual(tipo: { modalidad?: unknown } | null | undefined): boolean {
  return modalidadDe(tipo?.modalidad) === 'VIRTUAL'
}

/** «Presencial» o «Virtual»; un valor ausente o desconocido es «Presencial». */
export function etiquetaModalidad(valor: unknown): string {
  return ETIQUETAS_MODALIDAD[modalidadDe(valor)]
}

/**
 * Etiqueta del tipo para su insignia (CON KIT, SIN KIT…). En un tipo virtual se omite la que solo dice
 * «VIRTUAL»: ya sale la insignia «Virtual» y no se repite.
 */
export function etiquetaDeInsignia(tipo: { etiqueta?: string | null, modalidad?: unknown } | null | undefined): string | null {
  const etiqueta = tipo?.etiqueta
  if (!etiqueta) return null
  return esVirtual(tipo) && etiqueta.trim().toUpperCase() === 'VIRTUAL' ? null : etiqueta
}

/**
 * El backend ya envía la modalidad de asistencia (spec 018): al menos un tipo de las categorías la trae.
 * Un backend anterior no la envía ni entiende el filtro `?modalidad=` (lo ignoraría sin avisar), así que
 * el listado de inscripciones solo ofrece ese filtro cuando es `true`. Sin tipos no se puede saber: `false`.
 */
export function backendConModalidad(categorias: readonly { tipos: readonly { modalidad?: unknown }[] }[]): boolean {
  return categorias.some((categoria) => categoria.tipos.some((tipo) => tipo.modalidad !== undefined))
}
