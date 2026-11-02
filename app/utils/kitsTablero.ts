import type { Categoria, CodigoEstado, InscripcionFila } from '~/types/api'
import { nombreCompleto } from '~/utils/formato'
import { entregadoARevisar, kitDe, puedeDeshacerKit, puedeEntregarKit, situacionKitFila, type FiltroKit, type SituacionKitFila } from '~/utils/kit'

/**
 * Tablero de kits (spec 045 del backend; spec 035 del panel): qué incluye el kit, cuántos corresponden, a quién le falta
 * recibirlo y a quién ya se le entregó. El registro de la entrega es el de la spec 037 (escáner, Asistencia y detalle);
 * aquí solo se lee y se resume. Las cifras las calcula el servidor (las mismas del resumen de la puerta): el panel no
 * recalcula nada, solo valida la forma de lo que llega. Todo es tolerante: un backend anterior no tiene el tablero y la
 * pantalla lo dice.
 */

// ─── Respuesta de GET events/:id/kits/dashboard ───

/** `conKit`: aprobados con kit; `pendientes = conKit − entregados`; `porAprobar`: con kit y pago aún sin aprobar; `aRevisar`: entregados que hoy no corresponden. */
export interface TotalesKits {
  conKit: number
  entregados: number
  pendientes: number
  porAprobar: number
  aRevisar: number
}

export interface FilaTipoKits extends TotalesKits {
  /** `null`: cortesía sin tipo. */
  tipoInscripcionId: number | null
  nombre: string
  etiqueta: string | null
  categoria: { codigo: string, nombre: string } | null
  /** Los planes de una delegación llevan el id de su delegación; el resto, `null`. */
  delegacionId: number | null
}

/** Entregas de una hora (0–23) de un día de Lima. */
export interface EntregaPorHora {
  fecha: string
  hora: number
  total: number
}

export interface EntregadorKits {
  /** `null`: la cuenta que entregó ya no existe. */
  id: number | null
  nombres: string | null
  apellidos: string | null
  total: number
  ultimaEn: string
}

export interface TableroKits {
  totales: TotalesKits
  porTipo: FilaTipoKits[]
  entregas: EntregaPorHora[]
  porPersona: EntregadorKits[]
}

const CLAVES_CIFRAS = ['conKit', 'entregados', 'pendientes', 'porAprobar', 'aRevisar'] as const

const esObjeto = (valor: unknown): valor is Record<string, unknown> => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor)
const esNumero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor)
const conCifras = (valor: Record<string, unknown>) => CLAVES_CIFRAS.every((clave) => esNumero(valor[clave]))

/** El tablero que llegó del backend, o `null` si no tiene la forma esperada (un backend anterior responde 404). */
export function tableroKitsDe(valor: unknown): TableroKits | null {
  if (!esObjeto(valor) || !esObjeto(valor.totales) || !conCifras(valor.totales)) return null
  if (!Array.isArray(valor.porTipo) || !Array.isArray(valor.entregas) || !Array.isArray(valor.porPersona)) return null
  const totales = valor.totales
  return {
    totales: { conKit: totales.conKit as number, entregados: totales.entregados as number, pendientes: totales.pendientes as number, porAprobar: totales.porAprobar as number, aRevisar: totales.aRevisar as number },
    porTipo: valor.porTipo.filter((fila): fila is FilaTipoKits => esObjeto(fila) && typeof fila.nombre === 'string' && conCifras(fila)),
    entregas: valor.entregas.filter((entrega): entrega is EntregaPorHora => esObjeto(entrega) && typeof entrega.fecha === 'string' && esNumero(entrega.hora) && esNumero(entrega.total)),
    porPersona: valor.porPersona.filter((persona): persona is EntregadorKits => esObjeto(persona) && esNumero(persona.total) && typeof persona.ultimaEn === 'string'),
  }
}

export const AVISO_TABLERO_NO_DISPONIBLE = 'El tablero de kits aún no está disponible en el servidor (spec 045 del backend). Despliega primero el backend.'
export const AVISO_BACKEND_SIN_FILTRO_KIT = 'El servidor aún no filtra por kit (spec 045 del backend): esta lista no está filtrada. Despliega primero el backend.'

/** Se pidió filtrar por kit y las filas no traen `kit`: un backend anterior a la spec 045 ignoró el filtro y la lista no está filtrada. */
export function listaSinFiltrarPorKit(kit: string, filas: readonly Pick<InscripcionFila, 'kit'>[]): boolean {
  return kit !== '' && filas.length > 0 && filas.every((fila) => fila.kit === undefined)
}

// ─── Qué incluye el kit ───

/**
 * Contenido del kit oficial: espejo de `ciisic-undc-web/app/data/kit-items.ts` (lo que ven los inscritos en `/planes`).
 * Si cambia, se actualiza en los dos sitios.
 */
export const CONTENIDO_KIT = [
  { icon: 'heroicons:shopping-bag', titulo: 'Mochila oficial', detalle: 'Con el logo del VIII CIISIC.' },
  { icon: 'heroicons:beaker', titulo: 'Tomatodo oficial', detalle: 'Para acompañar las jornadas.' },
  { icon: 'heroicons:identification', titulo: 'Fotocheck con código QR', detalle: 'La acreditación, con cordón.' },
  { icon: 'heroicons:academic-cap', titulo: 'Certificado de 100 horas', detalle: 'Horas académicas del congreso.' },
] as const

// ─── Indicadores y vistas de la lista ───

/** Porcentaje entero de `parte` sobre `total` (sin total, 0). Nunca muestra 100 % mientras falte algo. */
export function porcentajeKits(parte: number, total: number): number {
  if (!(total > 0) || !(parte > 0)) return 0
  if (parte >= total) return 100
  return Math.min(99, Math.round((parte / total) * 100))
}

/** Qué lista muestra el tablero; cada indicador la elige. */
export type VistaKits = 'A_ENTREGAR' | 'ENTREGADOS' | 'PENDIENTES' | 'POR_APROBAR' | 'A_REVISAR'

export const VISTA_INICIAL: VistaKits = 'PENDIENTES'

/** Lo que se pide a `GET events/:id/inscriptions` para cada vista (`estado` vacío = sin filtro de estado). */
export interface ConsultaKits {
  kit: FiltroKit
  estado: '' | CodigoEstado
}

const CONSULTA_DE_VISTA: Readonly<Record<VistaKits, ConsultaKits>> = {
  A_ENTREGAR: { kit: 'CON_KIT', estado: 'APROBADO' },
  ENTREGADOS: { kit: 'ENTREGADO', estado: '' },
  PENDIENTES: { kit: 'PENDIENTE', estado: '' },
  POR_APROBAR: { kit: 'POR_APROBAR', estado: '' },
  A_REVISAR: { kit: 'REVISAR', estado: '' },
}

export const consultaDeVista = (vista: VistaKits): ConsultaKits => CONSULTA_DE_VISTA[vista]

export const TITULO_VISTA: Readonly<Record<VistaKits, string>> = {
  A_ENTREGAR: 'Aprobados con kit',
  ENTREGADOS: 'Kits entregados',
  PENDIENTES: 'Kits pendientes de entrega',
  POR_APROBAR: 'Con kit y pago por aprobar',
  A_REVISAR: 'Entregados a revisar',
}

/** Aclaración bajo el título de la lista; vacía si no hace falta. */
export function notaDeVista(vista: VistaKits, totales: TotalesKits | null | undefined): string {
  if (vista === 'ENTREGADOS' && totales && totales.aRevisar > 0) {
    return `Incluye ${totales.aRevisar === 1 ? '1 kit entregado que hoy no corresponde' : `${totales.aRevisar} kits entregados que hoy no corresponden`} (marcados «A revisar»): su inscripción dejó de estar aprobada o su tipo ya no incluye kit.`
  }
  if (vista === 'POR_APROBAR') return 'Todavía no se les puede entregar el kit: primero hay que aprobar su pago.'
  if (vista === 'A_REVISAR') return 'Ya recibieron el kit pero hoy no les corresponde. Si fue un error, se deshace desde el detalle de la inscripción.'
  return ''
}

export interface IndicadorKits {
  vista: VistaKits
  etiqueta: string
  valor: number
  detalle: string
  icon: string
  tono: 'brand' | 'ok' | 'warn' | 'error' | 'info' | 'neutral'
}

/** Las cinco tarjetas del tablero, en orden; cada una abre su lista. */
export function indicadoresKits(totales: TotalesKits): IndicadorKits[] {
  return [
    { vista: 'A_ENTREGAR', etiqueta: 'A entregar', valor: totales.conKit, detalle: 'Inscripciones aprobadas con kit', icon: 'heroicons:gift', tono: 'brand' },
    { vista: 'ENTREGADOS', etiqueta: 'Entregados', valor: totales.entregados, detalle: `${porcentajeKits(totales.entregados, totales.conKit)} % de los que corresponden`, icon: 'heroicons:check-badge', tono: 'ok' },
    { vista: 'PENDIENTES', etiqueta: 'Pendientes', valor: totales.pendientes, detalle: 'Aprobados a quienes aún no se les entrega', icon: 'heroicons:clock', tono: totales.pendientes > 0 ? 'warn' : 'ok' },
    { vista: 'POR_APROBAR', etiqueta: 'Pago por aprobar', valor: totales.porAprobar, detalle: 'Con kit, aún sin aprobar', icon: 'heroicons:banknotes', tono: 'info' },
    { vista: 'A_REVISAR', etiqueta: 'A revisar', valor: totales.aRevisar, detalle: 'Entregados que hoy no corresponden', icon: 'heroicons:exclamation-triangle', tono: totales.aRevisar > 0 ? 'error' : 'neutral' },
  ]
}

/** El evento tiene al menos un tipo que incluye kit (con eso el filtro «Kit» tiene sentido; un backend anterior no envía `incluyeKit`). */
export function hayTiposConKit(categorias: readonly Pick<Categoria, 'tipos'>[]): boolean {
  return categorias.some((categoria) => categoria.tipos.some((tipo) => tipo.incluyeKit === true))
}

// ─── Por tipo y delegación ───

/** El plan de una delegación (su categoría es oculta y lleva el id de la delegación). */
export function esFilaDeDelegacion(fila: Pick<FilaTipoKits, 'delegacionId'>): boolean {
  return fila.delegacionId !== null
}

/** «ESTUDIANTES · CON KIT»; sin etiqueta, solo el nombre. */
export function nombreFilaTipo(fila: Pick<FilaTipoKits, 'nombre' | 'etiqueta'>): string {
  return fila.etiqueta ? `${fila.nombre} · ${fila.etiqueta}` : fila.nombre
}

// ─── Ritmo de entrega (hora de Lima) ───

const formatoDiaLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
const formatoHoraLima = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** `YYYY-MM-DD` de hoy en Lima. */
export function hoyEnLimaKits(ahora: Date = new Date()): string {
  return formatoDiaLima.format(ahora)
}

/** «10:32» en hora de Lima. */
export function horaEnLimaKits(instante: Date = new Date()): string {
  return formatoHoraLima.format(instante)
}

/** Días con entregas (`YYYY-MM-DD`), del más antiguo al más reciente. */
export function diasConEntregas(entregas: readonly EntregaPorHora[]): string[] {
  return [...new Set(entregas.map((entrega) => entrega.fecha))].sort()
}

export function totalDelDia(entregas: readonly EntregaPorHora[], fecha: string): number {
  return entregas.filter((entrega) => entrega.fecha === fecha).reduce((suma, entrega) => suma + entrega.total, 0)
}

/** Día que se muestra al abrir: hoy si ya hubo entregas; si no, el último día con entregas (`null` si no hay ninguna). */
export function diaInicialDeEntregas(entregas: readonly EntregaPorHora[], hoy: string): string | null {
  const dias = diasConEntregas(entregas)
  return dias.includes(hoy) ? hoy : (dias.at(-1) ?? null)
}

/** Las horas de un día, desde la primera hasta la última con entregas (con ceros en medio): etiquetas «09:00» y cantidades. */
export function horasDelDia(entregas: readonly EntregaPorHora[], fecha: string): { etiquetas: string[], valores: number[] } {
  const delDia = entregas.filter((entrega) => entrega.fecha === fecha && entrega.hora >= 0 && entrega.hora <= 23)
  if (!delDia.length) return { etiquetas: [], valores: [] }
  const primera = Math.min(...delDia.map((entrega) => entrega.hora))
  const ultima = Math.max(...delDia.map((entrega) => entrega.hora))
  const etiquetas: string[] = []
  const valores: number[] = []
  for (let hora = primera; hora <= ultima; hora++) {
    etiquetas.push(`${String(hora).padStart(2, '0')}:00`)
    valores.push(delDia.filter((entrega) => entrega.hora === hora).reduce((suma, entrega) => suma + entrega.total, 0))
  }
  return { etiquetas, valores }
}

// ─── Quién entrega ───

export function nombreEntregador(persona: Pick<EntregadorKits, 'id' | 'nombres' | 'apellidos'>): string {
  return persona.id !== null && persona.nombres !== null ? nombreCompleto({ nombres: persona.nombres, apellidos: persona.apellidos ?? '' }) : 'Cuenta eliminada'
}

// ─── Filas de la lista ───

export interface EstadoFilaKit {
  situacion: SituacionKitFila
  /** Ya se entregó pero hoy no corresponde. */
  aRevisar: boolean
}

/** Dónde está el kit de una fila del listado (sin `kit`, un backend anterior: nada que mostrar). */
export function estadoFilaKit(fila: Pick<InscripcionFila, 'kit' | 'estado'>): EstadoFilaKit {
  const kit = kitDe(fila.kit)
  return { situacion: situacionKitFila(kit, fila.estado.codigo), aRevisar: entregadoARevisar(kit, fila.estado.codigo) }
}

/** «Entregar kit»: aprobada, con kit y sin entregar (en otro caso el backend responde `NOT_APPROVED` o `KIT_NOT_INCLUDED`). */
export function puedeEntregarEnLista(fila: Pick<InscripcionFila, 'kit' | 'estado'>): boolean {
  return fila.estado.codigo === 'APROBADO' && puedeEntregarKit(kitDe(fila.kit))
}

/** «Deshacer entrega»: ya se entregó (aunque hoy no corresponda). */
export function puedeDeshacerEnLista(fila: Pick<InscripcionFila, 'kit'>): boolean {
  return puedeDeshacerKit(kitDe(fila.kit))
}
