import type { KitEstado } from '~/types/api'
import { nombreCompleto } from '~/utils/formato'
import { esVirtual, modalidadDe } from '~/utils/modalidad'

/**
 * Entrega del kit en la puerta (spec 037 del backend; spec 028 del panel). El kit es de la **inscripción** (uno
 * por persona en todo el congreso, no uno por actividad): el tipo dice si lo incluye (`tipo.incluyeKit`, también
 * los planes de las delegaciones) y el escáner, la pantalla Asistencia y el detalle de la inscripción dejan marcar
 * que ya se entregó (con la hora y quién) y deshacerlo. Todo es tolerante: con un backend anterior no llega `kit` y
 * nada de esto se muestra.
 */

/**
 * `ENTREGADO`: ya se entregó (aunque el tipo ya no lo incluya); `PENDIENTE`: el tipo lo incluye y falta entregarlo;
 * `SIN_KIT`: tipo presencial sin kit; `NO_APLICA`: nada que mostrar (backend anterior, virtual o cortesía sin tipo).
 */
export type EstadoKit = 'ENTREGADO' | 'PENDIENTE' | 'SIN_KIT' | 'NO_APLICA'

/** Respuesta de `PUT|DELETE /inscriptions/:id/kit`. */
export interface ResultadoKit {
  inscripcionId: number
  kit: KitEstado
}

/** `GET /events/:id/kits/summary`: aprobados presenciales con kit, cuántos se entregaron y cuántos faltan. */
export interface ResumenKits {
  conKit: number
  entregados: number
  pendientes: number
}

/** Ruta (relativa al BFF) de la entrega del kit de una inscripción: `PUT` entrega y `DELETE` deshace. */
export const rutaKit = (inscripcionId: number): string => `inscriptions/${inscripcionId}/kit`

/** El `kit` que envía el backend, o `null` si falta o no tiene la forma esperada (backend anterior). */
export function kitDe(valor: unknown): KitEstado | null {
  if (!valor || typeof valor !== 'object') return null
  const kit = valor as Partial<KitEstado>
  if (typeof kit.entregado !== 'boolean' || typeof kit.incluye !== 'boolean') return null
  return {
    incluye: kit.incluye,
    entregado: kit.entregado,
    entregadoEn: typeof kit.entregadoEn === 'string' ? kit.entregadoEn : null,
    entregadoPor: kit.entregadoPor && typeof kit.entregadoPor === 'object' ? kit.entregadoPor : null,
  }
}

/**
 * Estado del kit de una inscripción. `tipo` es el de la inscripción (`null` = cortesía sin tipo): sin tipo o con un
 * tipo virtual que no entregó, no hay nada que decir del kit.
 */
export function estadoKit(kit: KitEstado | null | undefined, tipo: { modalidad?: unknown } | null | undefined): EstadoKit {
  if (!kit) return 'NO_APLICA'
  if (kit.entregado) return 'ENTREGADO'
  if (kit.incluye) return 'PENDIENTE'
  if (!tipo || esVirtual(tipo)) return 'NO_APLICA'
  return 'SIN_KIT'
}

/** Rótulo grande para quien entrega en la puerta («CON KIT»); `NO_APLICA`, vacío. */
export const ROTULO_KIT: Readonly<Record<EstadoKit, string>> = {
  ENTREGADO: 'KIT ENTREGADO',
  PENDIENTE: 'CON KIT',
  SIN_KIT: 'SIN KIT',
  NO_APLICA: '',
}

/** Texto corto para tablas e insignias; `NO_APLICA`, vacío. */
export const TEXTO_KIT: Readonly<Record<EstadoKit, string>> = {
  ENTREGADO: 'Kit entregado',
  PENDIENTE: 'Con kit · pendiente',
  SIN_KIT: 'Sin kit',
  NO_APLICA: '',
}

/** Tono de la insignia de cada estado (los de `AppBadge`). */
export const TONO_KIT: Readonly<Record<EstadoKit, 'ok' | 'warn' | 'neutral'>> = {
  ENTREGADO: 'ok',
  PENDIENTE: 'warn',
  SIN_KIT: 'neutral',
  NO_APLICA: 'neutral',
}

const ZONA_LIMA = 'America/Lima'
const formatoDiaLima = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_LIMA, year: 'numeric', month: '2-digit', day: '2-digit' })
const formatoHoraLima = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_LIMA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const formatoDiaCorto = new Intl.DateTimeFormat('es-PE', { timeZone: ZONA_LIMA, day: 'numeric', month: 'short' })

/**
 * «a las 10:32» si fue hoy (hora de Lima); si no, con la fecha («el 26 oct a las 10:32»): el kit pudo entregarse otro
 * día. Un instante inválido o ausente, cadena vacía.
 */
export function cuandoKit(entregadoEn: string | null | undefined, ahora: Date = new Date()): string {
  if (!entregadoEn) return ''
  const instante = new Date(entregadoEn)
  if (Number.isNaN(instante.getTime())) return ''
  const hora = formatoHoraLima.format(instante)
  if (formatoDiaLima.format(instante) === formatoDiaLima.format(ahora)) return `a las ${hora}`
  return `el ${formatoDiaCorto.format(instante).replace('.', '')} a las ${hora}`
}

/** «Entregado a las 10:32 · por Rosa Quispe»; sin entrega (o sin hora), cadena vacía. */
export function textoEntregaKit(kit: KitEstado | null | undefined, ahora: Date = new Date()): string {
  if (!kit?.entregado) return ''
  const cuando = cuandoKit(kit.entregadoEn, ahora)
  const quien = kit.entregadoPor ? ` · por ${nombreCompleto(kit.entregadoPor)}` : ''
  return `Entregado${cuando ? ` ${cuando}` : ''}${quien}`
}

/** Se ofrece «Entregar kit»: el tipo lo incluye y aún no se entregó. */
export function puedeEntregarKit(kit: KitEstado | null | undefined): boolean {
  return Boolean(kit?.incluye) && !kit?.entregado
}

/** Se ofrece «Deshacer entrega»: ya se entregó (se puede deshacer aunque el tipo ya no incluya kit). */
export function puedeDeshacerKit(kit: KitEstado | null | undefined): boolean {
  return Boolean(kit?.entregado)
}

/** Pregunta antes de deshacer: vuelve a quedar pendiente y se pierde la hora de la entrega. */
export function mensajeDeshacerKit(nombre: string, kit: KitEstado | null | undefined): string {
  const entrega = textoEntregaKit(kit)
  return `¿Deshacer la entrega del kit de ${nombre}?${entrega ? ` (${entrega})` : ''} Vuelve a quedar pendiente y se podrá entregar después.`
}

/** «35 entregados · 12 pendientes de 47»; sin kits que entregar, cadena vacía. */
export function textoResumenKits(resumen: ResumenKits | null | undefined): string {
  if (!resumen || !(resumen.conKit > 0)) return ''
  return `${resumen.entregados} entregados · ${resumen.pendientes} pendientes de ${resumen.conKit}`
}

/** El resumen que llegó del backend, o `null` si no tiene la forma esperada (backend anterior: la ruta responde 404). */
export function resumenKitsDe(valor: unknown): ResumenKits | null {
  if (!valor || typeof valor !== 'object') return null
  const { conKit, entregados, pendientes } = valor as Partial<ResumenKits>
  if (![conKit, entregados, pendientes].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  return { conKit: conKit as number, entregados: entregados as number, pendientes: pendientes as number }
}

// ─── Editor de tipos: la etiqueta y el código dicen una cosa y la bandera otra ───

/** El código termina en `_con_kit` o la etiqueta es «CON KIT» (como las del evento): el tipo parece llevar kit. */
export function diceConKit(codigo: string, etiqueta: string): boolean {
  return /(^|_)con_kit$/i.test(codigo.trim()) || /^con\s+kit$/i.test(etiqueta.trim())
}

/** El código termina en `_sin_kit` o la etiqueta es «SIN KIT»: el tipo parece no llevar kit. */
export function diceSinKit(codigo: string, etiqueta: string): boolean {
  return /(^|_)sin_kit$/i.test(codigo.trim()) || /^sin\s+kit$/i.test(etiqueta.trim())
}

/**
 * Aviso bajo el interruptor «Incluye kit» cuando la etiqueta o el código dicen otra cosa (en la puerta manda el
 * interruptor, no el texto). Un tipo virtual no lleva kit y no se avisa. Sin incoherencia, `null`.
 */
export function avisoKitIncoherente(form: { codigo: string, etiqueta: string, modalidad: unknown, incluyeKit: boolean }): string | null {
  if (modalidadDe(form.modalidad) === 'VIRTUAL') return null
  if (!form.incluyeKit && diceConKit(form.codigo, form.etiqueta) && !diceSinKit(form.codigo, form.etiqueta)) {
    return 'El código o la etiqueta dicen «CON KIT», pero «Incluye kit» está apagado: en la puerta saldrá «Sin kit» y no se podrá marcar su entrega.'
  }
  if (form.incluyeKit && diceSinKit(form.codigo, form.etiqueta) && !diceConKit(form.codigo, form.etiqueta)) {
    return 'El código o la etiqueta dicen «SIN KIT», pero «Incluye kit» está encendido: en la puerta saldrá «Con kit» y se pedirá entregarlo.'
  }
  return null
}

export const AYUDA_INCLUYE_KIT = 'El tipo incluye el kit de merchandising: en la puerta, el escáner y la pantalla Asistencia avisan «Con kit» y dejan marcar su entrega (con la hora y quién), y deshacerla. Un tipo virtual no lleva kit. Es retroactivo: se lee del tipo en vivo.'

/**
 * El backend ya envía `incluyeKit` (spec 037): al menos un tipo de las categorías lo trae. Un backend anterior lo
 * descartaría en silencio y la entrega del kit no tendría efecto. Sin tipos no se puede saber: se asume que sí.
 */
export function backendSinKit(categorias: readonly { tipos: readonly { incluyeKit?: unknown }[] }[]): boolean {
  const tipos = categorias.flatMap((categoria) => categoria.tipos)
  return tipos.length > 0 && tipos.every((tipo) => tipo.incluyeKit === undefined)
}

/** Se pidió encender «Incluye kit» y el tipo guardado que devolvió el backend no lo tiene: un backend anterior lo descartó sin avisar. */
export function kitNoGuardado(enviado: unknown, guardado: { incluyeKit?: unknown } | null | undefined): boolean {
  return Boolean(guardado) && enviado === true && guardado?.incluyeKit !== true
}

export const AVISO_SERVIDOR_SIN_KIT = 'El servidor aún no admite el kit (spec 037 del backend): este tipo no lo incluiría. Despliega primero el backend.'
export const AVISO_KIT_NO_GUARDADO = 'El tipo se guardó sin «Incluye kit»: el servidor aún no admite el kit (spec 037 del backend). Despliega primero el backend y vuelve a encenderlo en este tipo.'

/**
 * Confirmación antes de cambiar «Incluye kit» en un tipo que ya tiene inscripciones: se lee del tipo en vivo, así que el
 * cambio reclasifica de golpe a todos los inscritos (quién recibe kit en la puerta). `null` si no hace falta.
 */
export function avisoCambioKit(
  actual: { incluyeKit?: boolean, totalInscripciones?: number } | null | undefined,
  nuevo: boolean,
): string | null {
  const total = Number(actual?.totalInscripciones ?? 0)
  if (!actual || !(total > 0) || (actual.incluyeKit === true) === nuevo) return null
  const personas = total === 1 ? '1 inscripción' : `${total} inscripciones`
  return `Este tipo ya tiene ${personas}. ${nuevo ? 'Encender' : 'Apagar'} «Incluye kit» cambia de inmediato quién recibe kit en la puerta (${nuevo ? 'todas pasarían a «Con kit»' : 'todas pasarían a «Sin kit»'}); las entregas ya marcadas se conservan. ¿Guardar así?`
}
