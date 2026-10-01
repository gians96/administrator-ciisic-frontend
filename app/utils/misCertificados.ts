import { fechaDia } from '~/utils/formato'

/**
 * «Mis certificados» del portal (`GET /me/certificates`, backend-ciisic spec 015, aún en diseño): solo
 * los firmados. Hasta que el backend la tenga, la ruta responde 404 y la página muestra el estado vacío.
 * Los campos son opcionales porque el contrato no está cerrado.
 */

export interface CertificadoPortal {
  id: number
  codigoImpreso?: string | null
  evento?: { nombre?: string | null, nombreCorto?: string | null } | null
  tipo?: { nombre?: string | null } | string | null
  estado?: string | null
  fechaEmision?: string | null
  horas?: number | null
  descargable?: boolean
}

export const MENSAJE_SIN_CERTIFICADOS = 'Aquí verás tus certificados cuando estén firmados.'

/** Elementos con un id válido de la respuesta (cualquier otra forma: lista vacía). */
export function certificadosDe(datos: unknown): CertificadoPortal[] {
  if (!Array.isArray(datos)) return []
  return datos.filter((item): item is CertificadoPortal => Boolean(item) && typeof item === 'object' && Number.isSafeInteger((item as { id?: unknown }).id))
}

/** Nombre del tipo de certificado («Asistente», «Ponente»…), venga como texto u objeto. */
export function nombreTipoCertificado(tipo: CertificadoPortal['tipo']): string {
  if (typeof tipo === 'string') return tipo
  return tipo?.nombre ?? 'Certificado'
}

/** «Emitido el 30 oct. 2026 · 20 horas · Código ABC123» (solo lo que venga). */
export function detalleCertificado(certificado: Pick<CertificadoPortal, 'fechaEmision' | 'horas' | 'codigoImpreso'>): string {
  return [
    certificado.fechaEmision ? `Emitido el ${fechaDia(certificado.fechaEmision)}` : '',
    certificado.horas ? `${certificado.horas} ${certificado.horas === 1 ? 'hora' : 'horas'}` : '',
    certificado.codigoImpreso ? `Código ${certificado.codigoImpreso}` : '',
  ].filter(Boolean).join(' · ')
}
