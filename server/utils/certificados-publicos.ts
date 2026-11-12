import type { ErrorPropagado, RespaldoError } from './respuestas-auth'

/**
 * Consultas públicas de certificados (backend spec 015): `/api/publico/certificados/*`, sin sesión. El DNI llega y
 * se reenvía en el **cuerpo** de un `POST` (nunca en una URL); el código del certificado sí va en la URL: es el
 * enlace que recibe la persona y solo abre ese certificado.
 */

/** DNI de la consulta: 7 u 8 dígitos (el backend completa el cero que Excel come). */
export function documentoCertificado(valor: unknown): string | null {
  const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor).replace(/\s+/g, '') : ''
  return /^\d{7,8}$/.test(texto) ? texto : null
}

/** Código del certificado: letras y dígitos, de 4 a 40 (distingue mayúsculas). */
export function codigoCertificado(valor: unknown): string | null {
  const texto = typeof valor === 'string' ? valor.trim() : ''
  return /^[A-Za-z0-9]{4,40}$/.test(texto) ? texto : null
}

/** Mismo aviso para un DNI o un código inválido y uno sin certificados. */
export const CERTIFICADO_NO_ENCONTRADO: ErrorPropagado = {
  statusCode: 404,
  data: { success: false, code: 'CERTIFICATE_NOT_FOUND', message: 'No encontramos certificados con esos datos.' },
  reintentarEnSegundos: null,
}

export const RESPALDO_CERTIFICADOS: RespaldoError = {
  code: 'CERTIFICATES_UNAVAILABLE',
  message: 'No se pudo consultar los certificados en este momento. Intenta nuevamente en unos minutos.',
}
