import type { Meta } from '~/types/api'
import { fechaHoraLima } from '~/utils/formato'

/**
 * Envíos masivos a los inscritos presenciales (spec 029; backend 039): el enlace de la credencial 3D (cada persona recibe el
 * suyo) y un mismo mensaje con el enlace a la inscripción de ponencias. Lógica pura de las dos pantallas.
 */
export type CanalEnvio = 'credencial' | 'ponencias'

export interface DestinatarioEnvio {
  id: number
  nombres: string
  apellidos: string
  tipoDocumento: string
  numeroDocumento: string
  correo: string
  tipo: { nombre: string, etiqueta: string | null } | null
  clasificacion: string | null
  /** Marca del canal: cuándo se le envió (`null` = aún no). */
  enviadoEn: string | null
}

export interface ResumenEnvio {
  total: number
  enviados: number
  pendientes: number
}

export type MetaEnvio = Meta & { resumen: ResumenEnvio }

/** Respuesta de `POST …/send`. */
export interface ResultadoEnvio {
  enviados: number
  /** Ya lo habían recibido (y no se pidió reenviar), o lo tomó otra cuenta al mismo tiempo. */
  yaEnviados: number
  /** No existen, no están aprobadas o no son presenciales. */
  noElegibles: number
  fallidos: number
}

export const RESULTADO_ENVIO_VACIO: Readonly<ResultadoEnvio> = Object.freeze({ enviados: 0, yaEnviados: 0, noElegibles: 0, fallidos: 0 })

/** El backend admite hasta 100 por petición; el panel manda tandas más chicas para ver el avance y no alargar cada petición. */
export const TAMANO_TANDA_ENVIO = 25

const SEGMENTO: Readonly<Record<CanalEnvio, string>> = {
  credencial: 'credential-links',
  ponencias: 'specialized-talk-invitations',
}

export type AccionEnvio = 'lista' | 'ids' | 'enviar' | 'probar'

/** Ruta del backend (sin `/api/v1`) para cada acción de un canal. */
export function rutaEnvio(eventoId: number, canal: CanalEnvio, accion: AccionEnvio): string {
  const base = `events/${eventoId}/${SEGMENTO[canal]}`
  if (accion === 'ids') return `${base}/ids`
  if (accion === 'enviar') return `${base}/send`
  if (accion === 'probar') return `${base}/test`
  return base
}

// ─── Filtros ────────────────────────────────────────────────────────────────

export interface FiltrosEnvio {
  q: string
  enviado: '' | 'si' | 'no'
  page: number
}

export const FILTROS_ENVIO_VACIOS: Readonly<FiltrosEnvio> = Object.freeze({ q: '', enviado: '', page: 1 })

const texto = (valor: unknown) => (Array.isArray(valor) ? valor[0] : valor)

/** Filtros desde la URL (compartible y sobrevive a recargar). */
export function filtrosEnvioDesdeQuery(query: Record<string, unknown>): FiltrosEnvio {
  const enviado = texto(query.enviado)
  const pagina = Number(texto(query.page))
  return {
    q: typeof texto(query.q) === 'string' ? String(texto(query.q)).trim().slice(0, 100) : '',
    enviado: enviado === 'si' || enviado === 'no' ? enviado : '',
    page: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  }
}

/** Parámetros de la consulta: solo lo que tiene valor (la URL queda corta). */
export function parametrosEnvio(filtros: FiltrosEnvio, conPagina = true): Record<string, string | number> {
  const parametros: Record<string, string | number> = {}
  if (filtros.q.trim()) parametros.q = filtros.q.trim()
  if (filtros.enviado) parametros.enviado = filtros.enviado
  if (conPagina && filtros.page > 1) parametros.page = filtros.page
  return parametros
}

export function hayFiltrosEnvio(filtros: FiltrosEnvio): boolean {
  return Boolean(filtros.q.trim() || filtros.enviado)
}

// ─── Selección ──────────────────────────────────────────────────────────────

/** Personas elegidas (también de otras páginas), por id de inscripción. */
export type SeleccionEnvio = Readonly<Record<number, true>>

/** Marca o desmarca a las personas indicadas sin tocar a las demás. */
export function alternarDestinatarios(seleccion: SeleccionEnvio, ids: readonly number[], marcada: boolean): SeleccionEnvio {
  const tocadas = new Set(ids)
  const resto = Object.fromEntries(Object.entries(seleccion).filter(([id]) => !tocadas.has(Number(id)))) as Record<number, true>
  return marcada ? { ...resto, ...seleccionDeIds(ids) } : resto
}

export function seleccionDeIds(ids: readonly number[]): SeleccionEnvio {
  return Object.fromEntries(ids.map(id => [id, true as const]))
}

export function idsElegidos(seleccion: SeleccionEnvio): number[] {
  return Object.keys(seleccion).map(Number)
}

export function todasMarcadas(seleccion: SeleccionEnvio, filas: ReadonlyArray<Pick<DestinatarioEnvio, 'id'>>): boolean {
  return filas.length > 0 && filas.every(fila => seleccion[fila.id])
}

// ─── Envío por tandas ───────────────────────────────────────────────────────

export function dividirEnTandas<T>(items: readonly T[], tamano = TAMANO_TANDA_ENVIO): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < items.length; i += Math.max(1, tamano)) tandas.push(items.slice(i, i + Math.max(1, tamano)))
  return tandas
}

export function sumarResultados(a: ResultadoEnvio, b: ResultadoEnvio): ResultadoEnvio {
  return {
    enviados: a.enviados + b.enviados,
    yaEnviados: a.yaEnviados + b.yaEnviados,
    noElegibles: a.noElegibles + b.noElegibles,
    fallidos: a.fallidos + b.fallidos,
  }
}

export interface ProgresoEnvio {
  /** Personas ya atendidas. */
  hechas: number
  total: number
}

export interface EnvioPorTandas {
  resultado: ResultadoEnvio
  /** Personas atendidas antes de terminar o cortar. */
  hechas: number
  /** Qué cortó el envío: un error de la petición o que la persona lo detuvo. */
  corte: { tipo: 'error', error: unknown } | { tipo: 'detenido' } | null
}

interface OpcionesEnvio {
  ids: readonly number[]
  tamano?: number
  /** Manda una tanda y devuelve lo que respondió el servidor. */
  enviar: (tanda: number[]) => Promise<ResultadoEnvio>
  alAvanzar?: (progreso: ProgresoEnvio) => void
  /** Se consulta entre tanda y tanda: `true` corta sin perder lo ya enviado. */
  detener?: () => boolean
}

/**
 * Envía en tandas, una a la vez y en orden. Si una petición falla (p. ej. falta la URL de la landing o se acabó la sesión) corta
 * ahí y devuelve lo logrado hasta ese punto: lo que no se envió sigue «sin enviar» y se puede reintentar. Nunca lanza.
 */
export async function enviarPorTandas(opciones: OpcionesEnvio): Promise<EnvioPorTandas> {
  let resultado: ResultadoEnvio = { ...RESULTADO_ENVIO_VACIO }
  let hechas = 0
  const total = opciones.ids.length
  opciones.alAvanzar?.({ hechas, total })
  for (const tanda of dividirEnTandas(opciones.ids, opciones.tamano)) {
    if (opciones.detener?.()) return { resultado, hechas, corte: { tipo: 'detenido' } }
    try {
      resultado = sumarResultados(resultado, await opciones.enviar(tanda))
    } catch (error) {
      return { resultado, hechas, corte: { tipo: 'error', error } }
    }
    hechas += tanda.length
    opciones.alAvanzar?.({ hechas, total })
  }
  return { resultado, hechas, corte: null }
}

export interface LineaResultado {
  tono: 'ok' | 'warn' | 'error'
  texto: string
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Líneas del resultado: a cuántas se les envió, a quién se omitió y por qué, y qué pasó si se cortó. */
export function resumenDeEnvio(envio: EnvioPorTandas, mensajeDeError: string | null): LineaResultado[] {
  const { resultado, corte } = envio
  const lineas: LineaResultado[] = []
  lineas.push(resultado.enviados
    ? { tono: 'ok', texto: `Correo enviado a ${plural(resultado.enviados, 'persona', 'personas')}.` }
    : { tono: 'warn', texto: 'No se envió ningún correo.' })
  if (resultado.yaEnviados) lineas.push({ tono: 'warn', texto: `Se omitió a ${plural(resultado.yaEnviados, 'persona', 'personas')} que ya lo habían recibido.` })
  if (resultado.noElegibles) lineas.push({ tono: 'warn', texto: `Se omitió a ${plural(resultado.noElegibles, 'persona', 'personas')} que ya no cumplen (no están aprobadas o no son presenciales).` })
  if (resultado.fallidos) lineas.push({ tono: 'error', texto: `No se pudo enviar a ${plural(resultado.fallidos, 'persona', 'personas')}: siguen como «Sin enviar» para reintentar.` })
  if (corte?.tipo === 'error') lineas.push({ tono: 'error', texto: `Se cortó el envío${mensajeDeError ? `: ${mensajeDeError}` : ''}. Lo que faltó sigue como «Sin enviar»: corrige el problema y vuelve a elegirlas.` })
  if (corte?.tipo === 'detenido') lineas.push({ tono: 'warn', texto: 'Detuviste el envío. Lo que faltó sigue como «Sin enviar».' })
  return lineas
}

// ─── Mensaje de las ponencias ───────────────────────────────────────────────

export interface MensajePonencias {
  asunto: string
  mensaje: string
}

export const LARGO_ASUNTO = { minimo: 3, maximo: 150 } as const
export const LARGO_MENSAJE = { minimo: 10, maximo: 3000 } as const

/**
 * Texto propuesto (el staff lo edita). Es el mismo para todas las personas: no se personaliza. El correo trae solo el botón
 * «Inscribirme a las ponencias» con el enlace; por eso el texto lo menciona sin escribir la dirección.
 */
export function mensajePonenciasPropuesto(evento: string | null | undefined): MensajePonencias {
  const nombre = evento?.trim() || 'el congreso'
  return {
    asunto: `Ya puedes inscribirte a las ponencias especializadas del ${nombre}`,
    mensaje: [
      'Hola,',
      `Ya están abiertas las inscripciones a las ponencias especializadas del ${nombre}. Como inscrito presencial con el pago aprobado, puedes elegir las que quieras; los cupos son limitados.`,
      'Entra con el botón de abajo, escribe tu DNI y el correo con el que te inscribiste al congreso, y elige tus ponencias. El día del evento tu asistencia se registra con tu DNI en la puerta.',
      'Te esperamos.',
    ].join('\n\n'),
  }
}

export function validarMensajePonencias(form: MensajePonencias): Record<string, string> {
  const errores: Record<string, string> = {}
  const asunto = form.asunto.trim()
  const mensaje = form.mensaje.trim()
  if (!asunto) errores.asunto = 'Escribe el asunto del correo.'
  else if (asunto.length < LARGO_ASUNTO.minimo) errores.asunto = `El asunto necesita al menos ${LARGO_ASUNTO.minimo} caracteres.`
  else if (asunto.length > LARGO_ASUNTO.maximo) errores.asunto = `El asunto admite hasta ${LARGO_ASUNTO.maximo} caracteres.`
  if (!mensaje) errores.mensaje = 'Escribe el mensaje.'
  else if (mensaje.length < LARGO_MENSAJE.minimo) errores.mensaje = `El mensaje necesita al menos ${LARGO_MENSAJE.minimo} caracteres.`
  else if (mensaje.length > LARGO_MENSAJE.maximo) errores.mensaje = `El mensaje admite hasta ${LARGO_MENSAJE.maximo} caracteres.`
  return errores
}

/** Cuerpo del envío y de la prueba (el servidor escapa el texto: nada de HTML ajeno). */
export function cuerpoMensajePonencias(form: MensajePonencias): MensajePonencias {
  return { asunto: form.asunto.trim(), mensaje: form.mensaje.trim() }
}

/** Párrafos del mensaje para la vista previa (las líneas en blanco los separan, igual que en el correo). */
export function parrafosDelMensaje(mensaje: string): string[] {
  return mensaje.split(/\n{2,}/).map(bloque => bloque.trim()).filter(Boolean)
}

export const TEXTO_BOTON_PONENCIAS = 'Inscribirme a las ponencias'

// ─── Presentación ───────────────────────────────────────────────────────────

export const TEXTOS_CANAL: Readonly<Record<CanalEnvio, { columna: string, enviado: string, sinEnviar: string }>> = {
  credencial: { columna: 'Enlace enviado', enviado: 'Ya recibieron su enlace', sinEnviar: 'Aún sin enlace' },
  ponencias: { columna: 'Mensaje enviado', enviado: 'Ya recibieron el mensaje', sinEnviar: 'Aún sin mensaje' },
}

/** «26 oct. 2026, 10:30 a. m.» o «—» si aún no se le envió. */
export function fechaDeEnvio(destinatario: Pick<DestinatarioEnvio, 'enviadoEn'>): string {
  return destinatario.enviadoEn ? fechaHoraLima(destinatario.enviadoEn) : '—'
}

/** Tipo y clasificación de la persona en una línea. */
export function tipoDelDestinatario(destinatario: Pick<DestinatarioEnvio, 'tipo' | 'clasificacion'>): string {
  const partes = [destinatario.tipo?.nombre, destinatario.tipo?.etiqueta, destinatario.clasificacion].filter((parte, i, todas): parte is string => Boolean(parte) && todas.indexOf(parte) === i)
  return partes.join(' · ') || 'Cortesía'
}
