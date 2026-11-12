import type { Meta } from '~/types/api'

/**
 * Certificados (backend-ciisic spec 015, fase 1): los certificados se arman y firman fuera del sistema. Se importa
 * el Excel (DNI + código) y luego se suben los PDF firmados, que se llaman `<código>[R][R][R].pdf` (cada firma
 * agrega un `[R]`). Desde aquí se envían por correo y cada persona los consulta con su DNI o con su enlace.
 */

export type SituacionCertificado = 'FALTA_PDF' | 'POR_ENTREGAR' | 'ENTREGADO' | 'ANULADO'

export interface CertificadoStaff {
  id: number
  codigo: string
  tipo: string
  estado: 'SIN_ARCHIVO' | 'LISTO' | 'ANULADO'
  situacion: SituacionCertificado
  nombre: string
  documento: string
  correo: string
  celular: string | null
  participanteId: number
  conInscripcion: boolean
  observacion: string | null
  tieneArchivo: boolean
  firmasDetectadas: number
  bytesArchivo: number | null
  subidoEn: string | null
  enviadoEn: string | null
  envioError: string | null
  anuladoEn: string | null
  motivoAnulacion: string | null
  creadoEn: string
}

export interface ResumenCertificados {
  total: number
  faltaPdf: number
  porEntregar: number
  entregados: number
  anulados: number
  sinInscripcion: number
  pagadosSinCertificado: number
}

export type MetaCertificados = Meta & { resumen: ResumenCertificados }

export interface PagadoSinCertificado {
  inscripcionId: number
  participanteId: number
  nombre: string
  documento: string
  correo: string
  tipoInscripcion: string | null
}

export const SITUACIONES_CERTIFICADO: Record<SituacionCertificado, { etiqueta: string, tono: 'ok' | 'warn' | 'info' | 'error' | 'neutral', ayuda: string }> = {
  FALTA_PDF: { etiqueta: 'Falta PDF firmado', tono: 'warn', ayuda: 'Está en el Excel, pero aún no se sube su PDF firmado.' },
  POR_ENTREGAR: { etiqueta: 'Listo para entregar', tono: 'info', ayuda: 'Tiene su PDF firmado; falta enviárselo por correo.' },
  ENTREGADO: { etiqueta: 'Entregado', tono: 'ok', ayuda: 'Se le envió por correo con el PDF adjunto.' },
  ANULADO: { etiqueta: 'Anulado', tono: 'error', ayuda: 'No sale en la consulta pública ni en su portal.' },
}

// ─── Filtros ────────────────────────────────────────────────────────────────

export type VistaCertificados = 'certificados' | 'pagados'

export interface FiltrosCertificados {
  vista: VistaCertificados
  situacion: SituacionCertificado | ''
  q: string
  sinInscripcion: boolean
  page: number
}

export const FILTROS_CERTIFICADOS_VACIOS: Readonly<FiltrosCertificados> = Object.freeze({ vista: 'certificados', situacion: '', q: '', sinInscripcion: false, page: 1 })

const texto = (valor: unknown) => (typeof valor === 'string' ? valor : Array.isArray(valor) && typeof valor[0] === 'string' ? valor[0] : '')

export function filtrosCertificadosDesdeQuery(query: Record<string, unknown>): FiltrosCertificados {
  const situacion = texto(query.situacion)
  const pagina = Number(texto(query.page))
  return {
    vista: texto(query.vista) === 'pagados' ? 'pagados' : 'certificados',
    situacion: situacion in SITUACIONES_CERTIFICADO ? situacion as SituacionCertificado : '',
    q: texto(query.q).slice(0, 100),
    sinInscripcion: texto(query.sinInscripcion) === 'true',
    page: Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1,
  }
}

/** Query de la URL y de la API (sin valores vacíos). */
export function parametrosCertificados(filtros: FiltrosCertificados, conPagina = true): Record<string, string | number> {
  const parametros: Record<string, string | number> = {}
  if (filtros.vista === 'pagados') parametros.vista = 'pagados'
  if (filtros.situacion && filtros.vista === 'certificados') parametros.situacion = filtros.situacion
  if (filtros.q.trim()) parametros.q = filtros.q.trim()
  if (filtros.sinInscripcion && filtros.vista === 'certificados') parametros.sinInscripcion = 'true'
  if (conPagina && filtros.page > 1) parametros.page = filtros.page
  return parametros
}

/** Lo que va a la API (la vista decide la ruta, no es un parámetro). */
export function parametrosApi(filtros: FiltrosCertificados, conPagina = true): Record<string, string | number> {
  const { vista: _vista, ...resto } = parametrosCertificados(filtros, conPagina)
  return resto
}

export function hayFiltrosCertificados(filtros: FiltrosCertificados): boolean {
  return Boolean(filtros.situacion || filtros.q.trim() || filtros.sinInscripcion)
}

// ─── Archivos ───────────────────────────────────────────────────────────────

/** Mismo formato que el backend: letras y dígitos, de 4 a 40, distingue mayúsculas. */
export const REGEX_CODIGO_CERTIFICADO = /^[A-Za-z0-9]{4,40}$/

/**
 * Código del certificado a partir del nombre del PDF (igual que el backend, para mostrarlo antes de subir).
 * `1GUdLMfaPT[R][R][R].pdf` → `1GUdLMfaPT`; `null` si no se reconoce.
 */
export function codigoDeNombreArchivo(nombre: string): string | null {
  let base = String(nombre ?? '').replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  if (!/\.pdf$/i.test(base)) return null
  base = base.replace(/\.pdf$/i, '')
  let anterior = ''
  while (anterior !== base) {
    anterior = base
    base = base
      .replace(/\s*\(\d{1,3}\)\s*$/, '')
      .replace(/\s*-\s*copia\s*$/i, '')
      .replace(/\s*\[[A-Za-z]{1,3}\]\s*$/, '')
      .trim()
  }
  return REGEX_CODIGO_CERTIFICADO.test(base) ? base : null
}

/** PDF por petición y tamaño máximo de cada uno (los mismos topes del backend). */
export const PDF_POR_TANDA = 10
export const MAX_BYTES_PDF = 10 * 1024 * 1024

export type ResultadoArchivo =
  | 'ASOCIADO' | 'REEMPLAZADO' | 'YA_TENIA' | 'TIENE_OTRO' | 'NO_ENCONTRADO' | 'ANULADO' | 'NOMBRE_INVALIDO' | 'NO_ES_PDF' | 'DUPLICADO'
  /** Lo marca el panel: el archivo no se envió (pesa demasiado o la tanda falló). */
  | 'NO_ENVIADO'

export interface DetalleArchivo {
  archivo: string
  codigo: string | null
  resultado: ResultadoArchivo
  certificadoId: number | null
  nombre: string | null
  firmas: number
  mensaje?: string
}

export const RESULTADOS_ARCHIVO: Record<ResultadoArchivo, { etiqueta: string, tono: 'ok' | 'warn' | 'error' | 'neutral' }> = {
  ASOCIADO: { etiqueta: 'Asociado', tono: 'ok' },
  REEMPLAZADO: { etiqueta: 'Reemplazado', tono: 'ok' },
  YA_TENIA: { etiqueta: 'Ya lo tenía', tono: 'neutral' },
  TIENE_OTRO: { etiqueta: 'Ya tiene otro PDF', tono: 'warn' },
  NO_ENCONTRADO: { etiqueta: 'Código no está en el Excel', tono: 'error' },
  ANULADO: { etiqueta: 'Certificado anulado', tono: 'warn' },
  NOMBRE_INVALIDO: { etiqueta: 'Nombre sin código', tono: 'error' },
  NO_ES_PDF: { etiqueta: 'No es un PDF', tono: 'error' },
  DUPLICADO: { etiqueta: 'Repetido en esta carga', tono: 'warn' },
  NO_ENVIADO: { etiqueta: 'No se subió', tono: 'error' },
}

/** Parte la lista en tandas de `tamano`. */
export function enTandas<T>(items: readonly T[], tamano = PDF_POR_TANDA): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < items.length; i += tamano) tandas.push(items.slice(i, i + tamano))
  return tandas
}

// ─── Importación ────────────────────────────────────────────────────────────

export type ResultadoFila = 'CREAR' | 'CREADO' | 'ACTUALIZAR' | 'ACTUALIZADO' | 'SIN_CAMBIOS' | 'ERROR'

export interface FilaImportada {
  fila: number
  documento: string
  nombre: string
  codigo: string
  tipo: string
  resultado: ResultadoFila
  conInscripcion: boolean
  personaNueva: boolean
  mensaje: string | null
}

export interface ResultadoImportacion {
  simulado: boolean
  resumen: { total: number, crear: number, actualizar: number, sinCambios: number, errores: number, sinInscripcion: number, personasNuevas: number }
  filas: FilaImportada[]
}

export const RESULTADOS_FILA: Record<ResultadoFila, { etiqueta: string, tono: 'ok' | 'info' | 'neutral' | 'error' }> = {
  CREAR: { etiqueta: 'Se registrará', tono: 'info' },
  CREADO: { etiqueta: 'Registrado', tono: 'ok' },
  ACTUALIZAR: { etiqueta: 'Se actualizará', tono: 'info' },
  ACTUALIZADO: { etiqueta: 'Actualizado', tono: 'ok' },
  SIN_CAMBIOS: { etiqueta: 'Sin cambios', tono: 'neutral' },
  ERROR: { etiqueta: 'Error', tono: 'error' },
}

// ─── Enlaces públicos ───────────────────────────────────────────────────────

/** Enlace directo al certificado (página pública del panel). */
export function enlaceCertificado(origen: string, codigo: string): string {
  return `${origen.replace(/\/+$/, '')}/certificado/${codigo}`
}

export function enlaceConsulta(origen: string): string {
  return `${origen.replace(/\/+$/, '')}/consulta-certificados`
}

// ─── Consulta pública ───────────────────────────────────────────────────────

export interface CertificadoPublico {
  codigo: string
  tipo: string
  titular: string
  evento: { nombre: string, nombreCorto: string, fechaInicio: string, fechaFin: string }
  emitidoEn: string | null
}

export interface ConsultaCertificados {
  titular: string
  certificados: CertificadoPublico[]
}

/** «ASISTENTE» → «Asistente». */
export function tipoLegible(tipo: string): string {
  const limpio = tipo.trim().toLowerCase()
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : 'Certificado'
}

/** DNI que acepta la consulta: solo dígitos, 7 u 8 (el backend completa el cero que Excel come). */
export function documentoConsulta(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  return /^\d{7,8}$/.test(digitos) ? digitos : null
}

// ─── Resultado del envío por correo ─────────────────────────────────────────

export interface LineaEnvioCertificados {
  tono: 'ok' | 'warn' | 'error'
  texto: string
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Líneas del resultado del envío de certificados (las tandas las arma `enviarPorTandas` de `enviosMasivos`). */
export function resumenEnvioCertificados(
  envio: { resultado: { enviados: number, yaEnviados: number, noElegibles: number, fallidos: number, porCredencial?: Array<{ nombre: string, enviados: number }> }, corte: { tipo: string } | null },
  mensajeDeError: string | null,
): LineaEnvioCertificados[] {
  const { resultado, corte } = envio
  const lineas: LineaEnvioCertificados[] = []
  lineas.push(resultado.enviados
    ? { tono: 'ok', texto: `Certificado enviado a ${plural(resultado.enviados, 'persona', 'personas')}.` }
    : { tono: 'warn', texto: 'No se envió ningún certificado.' })
  if (resultado.porCredencial?.length) lineas.push({ tono: 'ok', texto: `Salieron por ${resultado.porCredencial.map(tramo => `${tramo.nombre} (${tramo.enviados})`).join(' y ')}.` })
  if (resultado.yaEnviados) lineas.push({ tono: 'warn', texto: `Se omitió a ${plural(resultado.yaEnviados, 'persona', 'personas')} que ya lo habían recibido.` })
  if (resultado.noElegibles) lineas.push({ tono: 'warn', texto: `Se omitieron ${plural(resultado.noElegibles, 'certificado', 'certificados')} sin PDF firmado o anulados.` })
  if (resultado.fallidos) lineas.push({ tono: 'error', texto: `No se pudo enviar a ${plural(resultado.fallidos, 'persona', 'personas')}: siguen «Listos para entregar» para reintentar.` })
  if (corte?.tipo === 'error') lineas.push({ tono: 'error', texto: `Se cortó el envío${mensajeDeError ? `: ${mensajeDeError.replace(/[.\s]+$/, '')}` : ''}. Lo que faltó sigue sin entregar.` })
  if (corte?.tipo === 'agotado') lineas.push({ tono: 'error', texto: 'No quedan envíos en ninguna credencial de correo activa y se cortó el envío. Revisa los créditos en Correo.' })
  if (corte?.tipo === 'sin-salida') lineas.push({ tono: 'error', texto: 'Ninguno de los últimos correos salió, así que se cortó el envío. Revisa la credencial de correo y vuelve a intentarlo.' })
  if (corte?.tipo === 'detenido') lineas.push({ tono: 'warn', texto: 'Detuviste el envío. Lo que faltó sigue sin entregar.' })
  return lineas
}
