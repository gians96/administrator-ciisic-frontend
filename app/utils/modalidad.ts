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
 * Un backend anterior no la envía ni entiende el filtro `?modalidad=` (lo ignoraría sin avisar). Sin tipos
 * no se puede saber: `false`. El editor de tipos lo usa (`backendSinModalidad`) para avisar que un tipo
 * «Virtual» se guardaría presencial; el filtro del listado pide además un tipo virtual (`hayTiposVirtuales`).
 */
export function backendConModalidad(categorias: readonly { tipos: readonly { modalidad?: unknown }[] }[]): boolean {
  return categorias.some((categoria) => categoria.tipos.some((tipo) => tipo.modalidad !== undefined))
}

/**
 * Algún tipo de las categorías es virtual. Es lo que justifica mostrar el filtro «Modalidad» del listado:
 * mientras no exista un tipo virtual (aunque el backend ya sea el de la spec 018) el filtro siempre
 * devolvería lo mismo o nada. Un tipo virtual implica además que el backend sí envía la modalidad.
 */
export function hayTiposVirtuales(categorias: readonly { tipos: readonly { modalidad?: unknown }[] }[]): boolean {
  return categorias.some((categoria) => categoria.tipos.some((tipo) => esVirtual(tipo)))
}

/**
 * Hay tipos cargados y ninguno trae `modalidad`: el backend es anterior a la spec 018. Su validación
 * descarta en silencio la clave `modalidad`, así que un tipo guardado como «Virtual» quedaría presencial.
 * Sin tipos no se puede saber (un evento nuevo): `false`.
 */
export function backendSinModalidad(categorias: readonly { tipos: readonly { modalidad?: unknown }[] }[]): boolean {
  return categorias.some((categoria) => categoria.tipos.length > 0) && !backendConModalidad(categorias)
}

/**
 * Se pidió guardar el tipo como `VIRTUAL` y la respuesta del backend (el tipo guardado) no es virtual: un
 * backend anterior a la spec 018 lo guardó presencial sin avisar. Sin respuesta no se puede saber: `false`.
 */
export function modalidadVirtualNoGuardada(enviada: unknown, guardado: { modalidad?: unknown } | null | undefined): boolean {
  return Boolean(guardado) && modalidadDe(enviada) === 'VIRTUAL' && !esVirtual(guardado)
}

/** Advertencia bajo el selector «Modalidad» cuando se elige «Virtual» contra un backend sin la spec 018. */
export const AVISO_SERVIDOR_SIN_MODALIDAD = 'El servidor aún no admite la modalidad virtual (spec 018 del backend): este tipo se guardaría como presencial. Despliega primero el backend.'

/** Aviso tras guardar un tipo «Virtual» que el backend dejó presencial. */
export const AVISO_MODALIDAD_NO_GUARDADA = 'El tipo se guardó como PRESENCIAL: el servidor aún no admite la modalidad virtual (spec 018 del backend). Despliega primero el backend y vuelve a elegir «Virtual» en este tipo.'
