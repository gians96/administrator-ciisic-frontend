// ============================================================================
// DELEGACIONES: tarifa por persona, carga masiva y enlace público (funciones puras)
// ============================================================================

export const MIN_INTEGRANTES_POR_DEFECTO = 10
export const PRECIO_ESTANDAR_POR_DEFECTO = 60
export const PRECIO_PROMOCIONAL_POR_DEFECTO = 50

/** Tarifa por persona: la promocional en cuanto la delegación alcanza el mínimo. */
export function precioUnitarioDelegacion(precioEstandar: number, precioPromocional: number, minIntegrantes: number, totalIntegrantes: number): number {
  return totalIntegrantes >= minIntegrantes ? precioPromocional : precioEstandar
}

/** Costo total de la delegación con la tarifa vigente. */
export function montoDelegacion(precioUnitario: number, totalIntegrantes: number): number {
  return Math.round(precioUnitario * totalIntegrantes * 100) / 100
}

export interface FilaParticipanteDelegacion {
  tipoDocumento: 'dni' | 'ce'
  numeroDocumento: string
  nombres: string
  apellidos: string
  correo: string
  celular: string
}

export interface ResultadoCargaDelegacion {
  filas: FilaParticipanteDelegacion[]
  errores: string[]
}

const SEPARADOR = /\s*[,;\t]\s*/
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CELULAR = /^\+?\d{9,15}$/

/** Reparte un nombre completo en nombres y apellidos (la última palabra es el apellido). */
function partirNombre(completo: string): { nombres: string, apellidos: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean)
  if (partes.length < 2) return { nombres: completo.trim(), apellidos: '' }
  return { nombres: partes.slice(0, -1).join(' '), apellidos: partes[partes.length - 1] ?? '' }
}

function esEncabezado(campos: string[]): boolean {
  return /^(dni|documento|doc|numero|número|nro\.?)$/i.test((campos[0] ?? '').trim())
}

/**
 * Lee una carga masiva (una persona por línea) con estos formatos:
 * - `DNI, Nombres, Apellidos, Correo, Celular`
 * - `DNI, Nombres, Apellidos, Correo`
 * - `DNI, Nombres completos, Correo` (la última palabra pasa a ser el apellido)
 * Acepta coma, punto y coma o tabulador. Ignora líneas vacías y una cabecera. Los errores se
 * informan con el número de línea para poder corregir el texto antes de enviarlo.
 */
export function parsearParticipantesDelegacion(texto: string): ResultadoCargaDelegacion {
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean)
  const filas: FilaParticipanteDelegacion[] = []
  const errores: string[] = []

  lineas.forEach((linea, indice) => {
    const campos = linea.split(SEPARADOR).map((campo) => campo.trim())
    if (indice === 0 && esEncabezado(campos)) return
    const numeroLinea = indice + 1
    if (campos.length < 3 || campos.length > 5) {
      errores.push(`Línea ${numeroLinea}: usa 3, 4 o 5 columnas separadas por coma.`)
      return
    }

    const [numeroDocumento, primerNombre, segundo, tercero, cuarto] = campos
    let nombres = primerNombre ?? ''
    let apellidos: string
    let correo: string
    let celular = ''
    if (campos.length === 3) {
      const partes = partirNombre(primerNombre ?? '')
      nombres = partes.nombres
      apellidos = partes.apellidos
      correo = segundo ?? ''
    } else if (campos.length === 4) {
      apellidos = segundo ?? ''
      correo = tercero ?? ''
    } else {
      apellidos = segundo ?? ''
      correo = tercero ?? ''
      celular = cuarto ?? ''
    }

    if (!numeroDocumento) errores.push(`Línea ${numeroLinea}: falta el documento.`)
    if (!nombres.trim()) errores.push(`Línea ${numeroLinea}: falta el nombre.`)
    if (!apellidos.trim()) errores.push(`Línea ${numeroLinea}: faltan los apellidos (puedes escribir el nombre completo en una sola columna).`)
    if (!CORREO.test(correo)) errores.push(`Línea ${numeroLinea}: el correo «${correo}» no es válido.`)
    if (celular && !CELULAR.test(celular)) errores.push(`Línea ${numeroLinea}: el celular «${celular}» no es válido.`)
    if (!numeroDocumento || !nombres.trim() || !apellidos.trim() || !CORREO.test(correo) || (celular && !CELULAR.test(celular))) return

    filas.push({
      tipoDocumento: /^\d{8}$/.test(numeroDocumento) ? 'dni' : 'ce',
      numeroDocumento,
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      correo: correo.toLowerCase(),
      celular,
    })
  })

  return { filas, errores }
}

/** Si el panel y la landing viven en dominios distintos, escribe aquí el de la landing. */
export const ORIGEN_LANDING_CONFIGURADO: string = ''

/**
 * Origen público para el link de la delegación. En desarrollo el panel corre en 3001 y la landing
 * en 3000; en producción se usa el mismo origen salvo que se configure `ORIGEN_LANDING_CONFIGURADO`.
 */
export function origenLanding(): string {
  if (ORIGEN_LANDING_CONFIGURADO) return ORIGEN_LANDING_CONFIGURADO.replace(/\/+$/, '')
  if (typeof window === 'undefined') return ''
  const { protocol, hostname, port } = window.location
  if (port === '3001') return `${protocol}//${hostname}:3000`
  return window.location.origin
}

/**
 * Link que abre el formulario de la delegación en la landing (`/delegaciones?delegacion=<código>`).
 * La página `/delegaciones` es la que lee el parámetro y precarga la delegación.
 */
export function enlaceInscripcionDelegacion(codigoLink: string, origen = origenLanding()): string {
  const base = origen.replace(/\/+$/, '')
  return `${base}/delegaciones?delegacion=${encodeURIComponent(codigoLink)}`
}
