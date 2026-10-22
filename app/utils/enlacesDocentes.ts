import type { EnlaceAsesor, EnlaceCiclo, TipoSeguimiento } from '~/types/api'

/**
 * Enlaces públicos por docente (spec 017 del panel; backend 026) y por ciclo (spec 018; backend 027). El enlace es
 * `<origen del panel>/seguimiento#<token>` (docente) o `<origen>/seguimiento/ciclo#<token>` (ciclo): el token va
 * tras el `#` para que ni el navegador ni los proxies lo envíen a un servidor (no queda en registros de acceso ni
 * en `Referer`). Lógica pura de la gestión y del mensaje.
 */

export const RUTA_SEGUIMIENTO = '/seguimiento'
export const RUTA_SEGUIMIENTO_CICLO = '/seguimiento/ciclo'

/** Token de un enlace: 43 caracteres base64url (256 bits), como los emite el backend. */
export const REGEX_TOKEN_ENLACE = /^[A-Za-z0-9_-]{43}$/

export function urlEnlaceDocente(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, '')}${RUTA_SEGUIMIENTO}#${token}`
}

export function urlEnlaceCiclo(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, '')}${RUTA_SEGUIMIENTO_CICLO}#${token}`
}

/** Qué vista abre una ruta: `/seguimiento/ciclo` (con o sin barra final) es la del ciclo; cualquier otra, la del docente. */
export function tipoDeSeguimiento(ruta: string): TipoSeguimiento {
  return ruta.replace(/\/+$/, '') === RUTA_SEGUIMIENTO_CICLO ? 'ciclo' : 'asesor'
}

/** Token del `#` de la URL (con o sin la almohadilla), o `null` si falta o no tiene el formato. */
export function tokenDelHash(hash: string | null | undefined): string | null {
  const token = (hash ?? '').replace(/^#/, '').trim()
  return REGEX_TOKEN_ENLACE.test(token) ? token : null
}

export type EstadoEnlace = 'SIN_ENLACE' | 'SIN_ABRIR' | 'ABIERTO'

/** Sin enlace, enlace que el docente aún no abrió, o enlace ya abierto alguna vez. */
export function estadoDelEnlace(enlace: Pick<EnlaceAsesor | EnlaceCiclo, 'token' | 'ultimoAcceso'> | null | undefined): EstadoEnlace {
  if (!enlace?.token) return 'SIN_ENLACE'
  return enlace.ultimoAcceso ? 'ABIERTO' : 'SIN_ABRIR'
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

/** «Hace 5 min», «hace 3 h», «hace 2 días» o la fecha si pasó más de una semana; «nunca» sin dato. */
export function haceCuanto(iso: string | null | undefined, ahora: number = Date.now()): string {
  if (!iso) return 'nunca'
  const fecha = Date.parse(iso)
  if (Number.isNaN(fecha)) return 'nunca'
  const diferencia = Math.max(0, ahora - fecha)
  if (diferencia < MINUTO) return 'hace instantes'
  if (diferencia < HORA) return `hace ${Math.floor(diferencia / MINUTO)} min`
  if (diferencia < DIA) return `hace ${Math.floor(diferencia / HORA)} h`
  if (diferencia < 7 * DIA) {
    const dias = Math.floor(diferencia / DIA)
    return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  }
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' })
}

/** Texto listo para enviar al docente (WhatsApp o correo) con su enlace. */
export function mensajeParaDocente(nombre: string, url: string, evento?: string | null): string {
  const paraEvento = evento ? ` del ${evento}` : ''
  return [
    `Estimado(a) ${nombre.trim()}:`,
    `Este es su enlace personal para ver cómo van las inscripciones y pagos de sus estudiantes${paraEvento}. Se actualiza en tiempo real y puede descargar su lista en Excel o PDF.`,
    url,
    'Es de uso personal: por favor no lo comparta. Si lo necesita nuevamente o cree que otra persona lo tiene, solicítelo a la organización.',
  ].join('\n\n')
}

/** Texto listo para enviar a quien recibe el enlace de un ciclo (WhatsApp o correo). */
export function mensajeParaCiclo(ciclo: string, url: string, evento?: string | null): string {
  const paraEvento = evento ? ` del ${evento}` : ''
  return [
    'Hola:',
    `Este es el enlace para ver cómo van las inscripciones y pagos de los estudiantes del ciclo ${ciclo.trim()}${paraEvento}. Se actualiza en tiempo real y se puede descargar la lista en Excel o PDF.`,
    url,
    'Es de uso restringido: por favor no lo comparta. Si lo necesita nuevamente o cree que otra persona lo tiene, solicítelo a la organización.',
  ].join('\n\n')
}

/**
 * Enlace de WhatsApp (`wa.me`) para un celular peruano: 9 dígitos que empiezan en 9 (se antepone el 51) o
 * con el 51 ya puesto. Cualquier otro número, o vacío, no genera enlace (`null`).
 */
export function urlWhatsapp(celular: string | null | undefined, texto?: string): string | null {
  const digitos = (celular ?? '').replace(/\D/g, '')
  const numero = /^9\d{8}$/.test(digitos) ? `51${digitos}` : /^519\d{8}$/.test(digitos) ? digitos : null
  if (!numero) return null
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
