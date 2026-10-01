import type { ErrorPropagado, RespaldoError } from './respuestas-auth'

/**
 * Verificación pública de certificados (backend-ciisic spec 015, `GET /api/v1/public/certificates/:codigo`):
 * funciones puras del BFF `server/api/publico/certificados/[codigo].get.ts`. El código se normaliza como
 * en el backend; uno con otro formato responde 404 sin consultarlo. De la respuesta solo pasan los
 * campos públicos (nunca documento, correo, motivo de anulación ni el PDF).
 */

/** `<PREFIJO>-<AÑO>-<NNNNNN>-<XXXXXX>` (Crockford: sin I, L, O ni U en la parte aleatoria). */
export const REGEX_CODIGO_VERIFICACION = /^([A-Z0-9]{2,20})-(\d{4})-(\d{6})-([0-9A-HJKMNP-TV-Z]{6})$/

/** Consultas por minuto y por IP que acepta el BFF (el backend admite 30). */
export const MAXIMO_VERIFICACIONES_POR_MINUTO = 20

/**
 * Código escrito o leído del QR: sin espacios alrededor, en mayúsculas y con O→0, I/L→1 en la parte
 * aleatoria (`normalizarCodigo` del backend). `null` si no tiene el formato.
 */
export function codigoParaVerificar(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 60) return null
  const texto = valor.trim().toUpperCase()
  const m = /^([A-Z0-9]{2,20})-(\d{4})-(\d{6})-([0-9A-Z]{6})$/.exec(texto)
  if (!m) return null
  const aleatorio = (m[4] as string).replace(/O/g, '0').replace(/[IL]/g, '1')
  const codigo = `${m[1]}-${m[2]}-${m[3]}-${aleatorio}`
  return REGEX_CODIGO_VERIFICACION.test(codigo) ? codigo : null
}

/** Datos públicos de un certificado firmado (`VALIDO`) o anulado. */
export interface VerificacionPublica {
  codigo: string
  estado: 'VALIDO' | 'ANULADO'
  titular: string
  tipo: string
  evento: { nombre: string, fechaInicio: string, fechaFin: string }
  fechaEmision: string
  horas: number | null
  firmadoEn: string | null
  anuladoEn?: string | null
}

function objetoDe(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null
}

const texto = (valor: unknown): string | null => (typeof valor === 'string' ? valor : null)

/**
 * Solo los campos públicos de la respuesta del backend (`{ success, data }`), o `null` si no tiene la
 * forma esperada. Cualquier otro dato que llegue (documento, correo, motivo…) se descarta.
 */
export function verificacionPublicaDe(respuesta: unknown): VerificacionPublica | null {
  const datos = objetoDe(objetoDe(respuesta)?.data)
  const evento = objetoDe(datos?.evento)
  if (!datos || !evento) return null
  const codigo = texto(datos.codigo)
  const estado = datos.estado
  const titular = texto(datos.titular)
  const tipo = texto(datos.tipo)
  const fechaEmision = texto(datos.fechaEmision)
  if (!codigo || (estado !== 'VALIDO' && estado !== 'ANULADO') || titular === null || tipo === null || !fechaEmision) return null
  const horas = typeof datos.horas === 'number' && Number.isFinite(datos.horas) ? datos.horas : null
  return {
    codigo,
    estado,
    titular,
    tipo,
    evento: { nombre: texto(evento.nombre) ?? '', fechaInicio: texto(evento.fechaInicio) ?? '', fechaFin: texto(evento.fechaFin) ?? '' },
    fechaEmision,
    horas,
    firmadoEn: texto(datos.firmadoEn),
    ...(estado === 'ANULADO' ? { anuladoEn: texto(datos.anuladoEn) } : {}),
  }
}

/** Respaldo sin backend o con uno anterior a la 015 (la ruta no existe): la página lo muestra como «pronto disponible». */
export const RESPALDO_VERIFICACION: Readonly<RespaldoError> = Object.freeze({
  code: 'CERTIFICATE_VERIFICATION_UNAVAILABLE',
  message: 'La verificación de certificados no está disponible en este momento. Intenta más tarde.',
})

/** Código con otro formato: el mismo 404 que el backend, sin consultarlo. */
export function errorCodigoNoEncontrado(): ErrorPropagado {
  return {
    statusCode: 404,
    data: { success: false, code: 'CERTIFICATE_NOT_FOUND', message: 'No encontramos un certificado firmado con ese código.' },
    reintentarEnSegundos: null,
  }
}

/** Demasiadas consultas desde la IP (límite del BFF). */
export function errorLimiteVerificacion(reintentarEnSegundos: number): ErrorPropagado {
  return {
    statusCode: 429,
    data: {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Hiciste muchas consultas seguidas. Espera un momento y vuelve a intentarlo.',
      fields: { reintentarEnSegundos: String(reintentarEnSegundos) },
    },
    reintentarEnSegundos,
  }
}
