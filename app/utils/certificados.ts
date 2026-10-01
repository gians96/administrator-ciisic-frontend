import type {
  Certificado,
  DetalleCargaFirmado,
  EstadoCertificado,
  ResultadoCargaArchivo,
  ResultadoCargaFirmados,
  ResumenCargaFirmados,
  ResumenEstados,
} from '~/types/api'
import { aErrorApi } from '~/utils/errores'

/**
 * Certificados del staff (backend-ciisic spec 015, `contracts/api-certificados.md`): estados y sus
 * acciones, el código del certificado (misma regex que el backend), tandas de la carga de firmados,
 * resumen de sus resultados, cabeceras del ZIP por partes y reintentos de las tandas.
 */

// ─── Estados ───

export const ESTADOS_CERTIFICADO: readonly EstadoCertificado[] = ['PENDIENTE', 'PREPARADO', 'EN_FIRMA', 'FIRMADO', 'ANULADO']

export const ETIQUETAS_ESTADO_CERTIFICADO: Readonly<Record<EstadoCertificado, string>> = {
  PENDIENTE: 'Pendiente',
  PREPARADO: 'Preparado',
  EN_FIRMA: 'En firma',
  FIRMADO: 'Firmado',
  ANULADO: 'Anulado',
}

/** Qué significa cada estado (KPIs y ayuda de la tabla). */
export const DESCRIPCIONES_ESTADO_CERTIFICADO: Readonly<Record<EstadoCertificado, string>> = {
  PENDIENTE: 'Emitido: falta generar su PDF.',
  PREPARADO: 'PDF generado: listo para descargar y firmar.',
  EN_FIRMA: 'Tiene algunas de las firmas requeridas: faltan las demás.',
  FIRMADO: 'Firmado: el participante lo ve y lo descarga en su portal.',
  ANULADO: 'Anulado: no vale, no sale en el portal y la verificación lo muestra anulado.',
}

/** Tono del `AppBadge`. */
export type TonoCertificado = 'brand' | 'neutral' | 'ok' | 'warn' | 'error' | 'info'

export const TONOS_ESTADO_CERTIFICADO: Readonly<Record<EstadoCertificado, TonoCertificado>> = {
  PENDIENTE: 'neutral',
  PREPARADO: 'info',
  EN_FIRMA: 'warn',
  FIRMADO: 'ok',
  ANULADO: 'error',
}

function esEstadoCertificado(valor: unknown): valor is EstadoCertificado {
  return typeof valor === 'string' && (ESTADOS_CERTIFICADO as readonly string[]).includes(valor)
}

/** Nombre visible del estado; uno desconocido se muestra tal cual. */
export function etiquetaEstadoCertificado(estado: string | null | undefined): string {
  return esEstadoCertificado(estado) ? ETIQUETAS_ESTADO_CERTIFICADO[estado] : (estado || '—')
}

export function tonoEstadoCertificado(estado: string | null | undefined): TonoCertificado {
  return esEstadoCertificado(estado) ? TONOS_ESTADO_CERTIFICADO[estado] : 'neutral'
}

/** Resumen con todos los estados en 0. */
export function resumenEstadosVacio(): ResumenEstados {
  return { PENDIENTE: 0, PREPARADO: 0, EN_FIRMA: 0, FIRMADO: 0, ANULADO: 0 }
}

/** `meta.resumen` del listado con los cinco estados (los que falten o no sean números, en 0). */
export function resumenEstadosDe(meta: unknown): ResumenEstados {
  const resumen = (meta && typeof meta === 'object' ? (meta as { resumen?: unknown }).resumen : null) as Record<string, unknown> | null
  const salida = resumenEstadosVacio()
  if (!resumen || typeof resumen !== 'object') return salida
  for (const estado of ESTADOS_CERTIFICADO) {
    const valor = resumen[estado]
    if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) salida[estado] = valor
  }
  return salida
}

/**
 * Acciones que el **estado** admite (el contrato, «Ciclo de vida»); los permisos los decide la página
 * con `auth.puede`:
 * - editar: PENDIENTE o PREPARADO (vuelve a PENDIENTE);
 * - borrar: un PENDIENTE que nunca se generó (sin código impreso); los demás se anulan;
 * - generar: PENDIENTE;
 * - descargar para firmar: el generado de un PREPARADO o el firmado parcial de un EN_FIRMA;
 * - subir firmado: PREPARADO o EN_FIRMA; reemplazar firmado: FIRMADO (solo `gestionar`);
 * - quitar firmado: EN_FIRMA o FIRMADO; descargar firmado: FIRMADO;
 * - anular: cualquiera menos ANULADO.
 */
export interface AccionesCertificado {
  editar: boolean
  borrar: boolean
  generar: boolean
  descargarParaFirmar: boolean
  subirFirmado: boolean
  reemplazarFirmado: boolean
  quitarFirmado: boolean
  descargarFirmado: boolean
  anular: boolean
}

export function accionesCertificado(certificado: Pick<Certificado, 'estado' | 'codigoImpreso' | 'tieneGenerado' | 'tieneFirmado'>): AccionesCertificado {
  const { estado } = certificado
  return {
    editar: estado === 'PENDIENTE' || estado === 'PREPARADO',
    borrar: estado === 'PENDIENTE' && !certificado.codigoImpreso,
    generar: estado === 'PENDIENTE',
    descargarParaFirmar: (estado === 'PREPARADO' && certificado.tieneGenerado) || (estado === 'EN_FIRMA' && certificado.tieneFirmado),
    subirFirmado: estado === 'PREPARADO' || estado === 'EN_FIRMA',
    reemplazarFirmado: estado === 'FIRMADO',
    quitarFirmado: estado === 'EN_FIRMA' || estado === 'FIRMADO',
    descargarFirmado: estado === 'FIRMADO' && certificado.tieneFirmado,
    anular: estado !== 'ANULADO',
  }
}

// ─── Código del certificado (`src/api/certificate/codigos/codigo.ts` del backend) ───

/** `<PREFIJO>-<AÑO>-<NNNNNN>-<XXXXXX>` (Crockford, sin I, L, O ni U), p. ej. `CIISIC-2026-000123-7KQ2XM`. */
export const REGEX_CODIGO_CERTIFICADO = /^([A-Z0-9]{2,20})-(\d{4})-(\d{6})-([0-9A-HJKMNP-TV-Z]{6})$/
/** Prefijo de la configuración. */
export const REGEX_PREFIJO_CERTIFICADO = /^[A-Z0-9]{2,20}$/
/** Código en cualquier parte de un nombre de archivo (tolera `[R]`, `_firmado`, `-signed`, minúsculas). */
const CODIGO_EN_TEXTO = /(?<![A-Z0-9])([A-Z0-9]{2,20})-(\d{4})-(\d{6})-([0-9A-HJKMNP-TV-Z]{6})/i

export function esCodigoCertificado(valor: unknown): valor is string {
  return typeof valor === 'string' && REGEX_CODIGO_CERTIFICADO.test(valor)
}

/** Prefijo escrito en la configuración: sin espacios alrededor y en mayúsculas (como lo guarda el backend). */
export function normalizarPrefijoCertificado(texto: string): string {
  return String(texto ?? '').trim().toUpperCase()
}

export function esPrefijoCertificado(valor: unknown): boolean {
  return typeof valor === 'string' && REGEX_PREFIJO_CERTIFICADO.test(valor)
}

/**
 * Código escrito por una persona (verificación): sin espacios, en mayúsculas y con las confusiones de
 * Crockford corregidas en la parte aleatoria (O→0, I/L→1), igual que `normalizarCodigo` del backend.
 * `null` si no tiene el formato.
 */
export function normalizarCodigoCertificado(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 60) return null
  const texto = valor.trim().toUpperCase()
  const m = /^([A-Z0-9]{2,20})-(\d{4})-(\d{6})-([0-9A-Z]{6})$/.exec(texto)
  if (!m) return null
  const aleatorio = (m[4] as string).replace(/O/g, '0').replace(/[IL]/g, '1')
  const codigo = `${m[1]}-${m[2]}-${m[3]}-${aleatorio}`
  return REGEX_CODIGO_CERTIFICADO.test(codigo) ? codigo : null
}

/**
 * Código dentro de un nombre de archivo (`CIISIC-2026-000123-7KQ2XM [R].pdf`,
 * `cert_ciisic-2026-000123-7kq2xm_firmado.pdf`…), en mayúsculas, o `null`: la misma regla que
 * `extraerCodigo` del backend, para mostrar el emparejamiento antes de subir. Con `prefijo` se prueba
 * primero ese prefijo exacto (así `certCIISIC-…` también se reconoce). Solo cuenta el nombre base.
 */
export function codigoDeArchivo(nombreArchivo: string, prefijo?: string | null): string | null {
  const nombre = String(nombreArchivo ?? '').split(/[\\/]/).pop() ?? ''
  if (prefijo && REGEX_PREFIJO_CERTIFICADO.test(prefijo)) {
    const exacto = new RegExp(`${prefijo}-(\\d{4})-(\\d{6})-([0-9A-HJKMNP-TV-Z]{6})`, 'i').exec(nombre)
    if (exacto) return `${prefijo}-${exacto[1]}-${exacto[2]}-${(exacto[3] as string).toUpperCase()}`
  }
  const m = CODIGO_EN_TEXTO.exec(nombre)
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}`.toUpperCase() : null
}

/** Emparejamiento por nombre que verá el backend (si no hay código, empareja por el `Subject` del PDF). */
export interface EmparejamientoArchivo {
  nombre: string
  codigo: string | null
  /** Otro archivo anterior de la lista tiene el mismo código (el backend lo marcaría `DUPLICADO`). */
  repetido: boolean
}

export function emparejarPorNombre(nombres: readonly string[], prefijo?: string | null): EmparejamientoArchivo[] {
  const vistos = new Set<string>()
  return nombres.map((nombre) => {
    const codigo = codigoDeArchivo(nombre, prefijo)
    const repetido = codigo !== null && vistos.has(codigo)
    if (codigo) vistos.add(codigo)
    return { nombre, codigo, repetido }
  })
}

// ─── Carga de firmados en tandas ───

/** Archivos por solicitud (`POST /events/:eventId/certificates/signed`). */
export const MAX_ARCHIVOS_POR_TANDA = 10
/** Bytes de PDF por tanda que envía el panel (el backend admite 25 MB por solicitud). */
export const MAX_BYTES_POR_TANDA = 10 * 1024 * 1024
/** Un firmado de más de 10 MB lo rechaza el backend (`413`). */
export const MAX_BYTES_FIRMADO = 10 * 1024 * 1024

export interface TandaArchivos<T> {
  archivos: T[]
  bytes: number
  /** El único archivo de la tanda pasa de `maxBytes`: no conviene enviarlo (se informa como rechazado). */
  excedido: boolean
}

export interface OpcionesTandaArchivos {
  maxArchivos?: number
  maxBytes?: number
}

/**
 * Parte los archivos en tandas de como mucho `maxArchivos` (10) y `maxBytes` (10 MB), en el orden en
 * que llegan. Un archivo más grande que `maxBytes` va solo en su tanda, marcada `excedido`.
 */
export function partirPorTamano<T extends { size: number }>(archivos: readonly T[], opciones: OpcionesTandaArchivos = {}): TandaArchivos<T>[] {
  const maxArchivos = Math.max(1, Math.floor(opciones.maxArchivos ?? MAX_ARCHIVOS_POR_TANDA))
  const maxBytes = Math.max(1, opciones.maxBytes ?? MAX_BYTES_POR_TANDA)
  const tandas: TandaArchivos<T>[] = []
  let actual: TandaArchivos<T> | null = null
  for (const archivo of archivos) {
    const tamano = Math.max(0, archivo.size || 0)
    if (tamano > maxBytes) {
      actual = null
      tandas.push({ archivos: [archivo], bytes: tamano, excedido: true })
      continue
    }
    if (!actual || actual.archivos.length >= maxArchivos || actual.bytes + tamano > maxBytes) {
      actual = { archivos: [], bytes: 0, excedido: false }
      tandas.push(actual)
    }
    actual.archivos.push(archivo)
    actual.bytes += tamano
  }
  return tandas
}

// ─── Resultados de la carga de firmados ───

export const RESULTADOS_CARGA: readonly ResultadoCargaArchivo[] = [
  'FIRMADO', 'PARCIAL', 'SIN_FIRMA', 'NO_COINCIDE', 'NO_ENCONTRADO', 'OTRO_EVENTO', 'ANULADO', 'YA_FIRMADO', 'DUPLICADO', 'INVALIDO',
]

export const ETIQUETAS_RESULTADO_CARGA: Readonly<Record<ResultadoCargaArchivo, string>> = {
  FIRMADO: 'Firmado',
  PARCIAL: 'Firma parcial',
  SIN_FIRMA: 'Sin firma',
  NO_COINCIDE: 'No coincide',
  NO_ENCONTRADO: 'No encontrado',
  OTRO_EVENTO: 'De otro evento',
  ANULADO: 'Anulado',
  YA_FIRMADO: 'Ya estaba firmado',
  DUPLICADO: 'Duplicado',
  INVALIDO: 'Archivo no válido',
}

export const TONOS_RESULTADO_CARGA: Readonly<Record<ResultadoCargaArchivo, TonoCertificado>> = {
  FIRMADO: 'ok',
  PARCIAL: 'warn',
  SIN_FIRMA: 'error',
  NO_COINCIDE: 'error',
  NO_ENCONTRADO: 'error',
  OTRO_EVENTO: 'error',
  ANULADO: 'neutral',
  YA_FIRMADO: 'neutral',
  DUPLICADO: 'neutral',
  INVALIDO: 'error',
}

/** Clave del `resumen` que cuenta cada resultado. */
export const CLAVE_RESUMEN_CARGA: Readonly<Record<ResultadoCargaArchivo, keyof ResumenCargaFirmados>> = {
  FIRMADO: 'firmados',
  PARCIAL: 'parciales',
  SIN_FIRMA: 'sinFirma',
  NO_COINCIDE: 'noCoincide',
  NO_ENCONTRADO: 'noEncontrados',
  OTRO_EVENTO: 'otroEvento',
  ANULADO: 'anulados',
  YA_FIRMADO: 'yaFirmados',
  DUPLICADO: 'duplicados',
  INVALIDO: 'invalidos',
}

/** Texto de cada contador en singular y plural (`textoResumenCarga`). */
const TEXTOS_RESUMEN_CARGA: Readonly<Record<keyof ResumenCargaFirmados, readonly [string, string]>> = {
  firmados: ['firmado', 'firmados'],
  parciales: ['con firma parcial', 'con firma parcial'],
  sinFirma: ['sin firma', 'sin firma'],
  noCoincide: ['no coincide', 'no coinciden'],
  noEncontrados: ['no encontrado', 'no encontrados'],
  otroEvento: ['de otro evento', 'de otro evento'],
  anulados: ['anulado', 'anulados'],
  yaFirmados: ['ya firmado', 'ya firmados'],
  duplicados: ['duplicado', 'duplicados'],
  invalidos: ['no válido', 'no válidos'],
}

export function resumenCargaVacio(): ResumenCargaFirmados {
  return { firmados: 0, parciales: 0, sinFirma: 0, noCoincide: 0, noEncontrados: 0, otroEvento: 0, anulados: 0, yaFirmados: 0, duplicados: 0, invalidos: 0 }
}

/** Reporte vacío para ir acumulando las tandas. */
export function cargaVacia(): ResultadoCargaFirmados {
  return { resumen: resumenCargaVacio(), detalle: [] }
}

/** Suma una tanda al reporte acumulado (devuelve uno nuevo; no modifica los anteriores). */
export function acumularCarga(acumulado: ResultadoCargaFirmados, tanda: ResultadoCargaFirmados): ResultadoCargaFirmados {
  const resumen = { ...acumulado.resumen }
  for (const clave of Object.keys(resumen) as (keyof ResumenCargaFirmados)[]) {
    const valor = tanda.resumen?.[clave]
    if (typeof valor === 'number' && Number.isFinite(valor)) resumen[clave] += valor
  }
  return { resumen, detalle: [...acumulado.detalle, ...(tanda.detalle ?? [])] }
}

/**
 * Archivo que el panel no envía (más de 10 MB, no es PDF, no se pudo leer del ZIP…): queda en el
 * reporte como `INVALIDO` con su motivo, igual que los que rechaza el backend.
 */
export function detalleRechazadoLocal(archivo: string, codigoError: string, mensaje: string): DetalleCargaFirmado {
  return {
    archivo,
    resultado: 'INVALIDO',
    certificadoId: null,
    codigo: null,
    estado: null,
    firmas: null,
    firmasRequeridas: null,
    coincidencia: null,
    codigoError,
    mensaje,
  }
}

/** Agrega al reporte un resultado del panel (`detalleRechazadoLocal`) y lo cuenta en el resumen. */
export function agregarDetalleCarga(acumulado: ResultadoCargaFirmados, detalle: DetalleCargaFirmado): ResultadoCargaFirmados {
  const resumen = { ...acumulado.resumen }
  resumen[CLAVE_RESUMEN_CARGA[detalle.resultado]] += 1
  return { resumen, detalle: [...acumulado.detalle, detalle] }
}

/** El archivo quedó cargado (`FIRMADO` o `PARCIAL`). */
export function esCargaAceptada(detalle: Pick<DetalleCargaFirmado, 'resultado'>): boolean {
  return detalle.resultado === 'FIRMADO' || detalle.resultado === 'PARCIAL'
}

/** Filtro «no emparejados / con problemas» del reporte: todo lo que no quedó cargado. */
export function cargasNoAceptadas(detalle: readonly DetalleCargaFirmado[]): DetalleCargaFirmado[] {
  return detalle.filter((item) => !esCargaAceptada(item))
}

/** «3 firmados · 1 con firma parcial · 2 no coinciden» (solo los contadores en uso). */
export function textoResumenCarga(resumen: ResumenCargaFirmados): string {
  const partes = (Object.keys(TEXTOS_RESUMEN_CARGA) as (keyof ResumenCargaFirmados)[])
    .filter((clave) => (resumen[clave] ?? 0) > 0)
    .map((clave) => {
      const cantidad = resumen[clave]
      const [singular, plural] = TEXTOS_RESUMEN_CARGA[clave]
      return `${cantidad} ${cantidad === 1 ? singular : plural}`
    })
  return partes.length ? partes.join(' · ') : 'Ningún archivo procesado'
}

// ─── ZIP por partes (`GET /events/:eventId/certificates/zip`) ───

/** Cabeceras `X-Zip-*` de una parte (el BFF es del mismo origen: el navegador las lee). */
export interface ParteZip {
  /** Certificados del filtro en este momento (todas las partes). */
  total: number | null
  /** Certificados de esta parte. */
  certificados: number | null
  /** PDF incluidos (los que faltan en disco no van). */
  archivos: number | null
  desde: number | null
  hasta: number | null
  restantes: number | null
  /** `despuesDe` de la parte siguiente; `null` si no hay más. */
  siguiente: number | null
  hayMas: boolean
}

interface Cabeceras {
  get: (nombre: string) => string | null
}

function enteroDeCabecera(valor: string | null): number | null {
  if (valor === null || !/^\s*\d+\s*$/.test(valor)) return null
  const numero = Number(valor)
  return Number.isSafeInteger(numero) ? numero : null
}

export function parteZipDeCabeceras(cabeceras: Cabeceras): ParteZip {
  const siguiente = enteroDeCabecera(cabeceras.get('x-zip-siguiente'))
  return {
    total: enteroDeCabecera(cabeceras.get('x-zip-total')),
    certificados: enteroDeCabecera(cabeceras.get('x-zip-certificados')),
    archivos: enteroDeCabecera(cabeceras.get('x-zip-archivos')),
    desde: enteroDeCabecera(cabeceras.get('x-zip-desde')),
    hasta: enteroDeCabecera(cabeceras.get('x-zip-hasta')),
    restantes: enteroDeCabecera(cabeceras.get('x-zip-restantes')),
    siguiente,
    // Sin cursor no se puede pedir la parte siguiente
    hayMas: cabeceras.get('x-zip-hay-mas')?.trim().toLowerCase() === 'true' && siguiente !== null,
  }
}

// ─── Reintentos de las tandas (generar, subir firmados, importar, ZIP) ───

/** 503 por cola llena en el backend: se libera en segundos (`Retry-After: 5`). */
export const CODIGOS_OCUPADO: readonly string[] = ['PDF_BUSY', 'GENERATION_BUSY', 'SIGNED_UPLOAD_BUSY']
/** Reintentos seguidos de una misma tanda antes de detenerse. */
export const MAX_REINTENTOS_TANDA = 6
/** Espera si el backend no envía `Retry-After` (503 ocupado · 429). */
export const ESPERA_OCUPADO_S = 5
export const ESPERA_LIMITE_S = 15
/** Tope de una espera (un `Retry-After` exagerado no deja la pantalla colgada). */
export const ESPERA_MAXIMA_S = 60

export type DecisionTanda =
  | { accion: 'REINTENTAR', esperaMs: number }
  | { accion: 'DETENER', motivo: 'SESION' | 'PERMISO' | 'ERROR' }

/**
 * Qué hace el bucle de tandas ante un error: 401 (sesión) y 403 (permiso o evento) detienen sin
 * reintentar —`useApi`/`useSubida` ya llevan al login o releen el acceso—; un 503 de cola llena
 * (`CODIGOS_OCUPADO`) o un 429 se reintentan tras `Retry-After` (o la espera por defecto), hasta
 * `MAX_REINTENTOS_TANDA` veces seguidas (`intento` = reintentos ya hechos). Cualquier otro error detiene
 * (la tanda se puede reanudar: todas las rutas son idempotentes).
 */
export function decisionTrasErrorTanda(error: unknown, reintentarEnSegundos: number | null, intento: number): DecisionTanda {
  const { status, code } = aErrorApi(error)
  if (status === 401) return { accion: 'DETENER', motivo: 'SESION' }
  if (status === 403) return { accion: 'DETENER', motivo: 'PERMISO' }
  const ocupado = status === 503 && CODIGOS_OCUPADO.includes(code)
  const limitado = status === 429
  if ((ocupado || limitado) && intento < MAX_REINTENTOS_TANDA) {
    const segundos = reintentarEnSegundos && reintentarEnSegundos > 0 ? reintentarEnSegundos : (ocupado ? ESPERA_OCUPADO_S : ESPERA_LIMITE_S)
    return { accion: 'REINTENTAR', esperaMs: Math.min(segundos, ESPERA_MAXIMA_S) * 1000 }
  }
  return { accion: 'DETENER', motivo: 'ERROR' }
}

// ─── Compatibilidad con el backend anterior a la 015 ───

/** Mensaje de las pantallas de certificados mientras el backend no tenga la spec 015. */
export const MENSAJE_CERTIFICADOS_PRONTO = 'Los certificados estarán disponibles pronto: el servidor aún no tiene esta función.'

/**
 * El backend aún no tiene las rutas de certificados (imagen anterior a la 015): `405`, o `404` de ruta
 * inexistente (`NOT_FOUND` «Ruta no encontrada», o sin código). No cuentan los 404 de negocio
 * (`CERTIFICATE_NOT_FOUND`, `TEMPLATE_NOT_FOUND`…) ni el `NOT_FOUND` del resolutor por evento («El
 * registro solicitado no existe.»): la pantalla muestra «pronto disponible» en lugar de un error.
 */
export function certificadosNoDisponibles(error: unknown): boolean {
  const { status, code, message } = aErrorApi(error)
  if (status === 405) return true
  if (status !== 404) return false
  if (code === 'ERROR') return true
  return code === 'NOT_FOUND' && !/registro solicitado/i.test(message)
}
