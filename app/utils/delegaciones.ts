// ============================================================================
// DELEGACIONES: tarifa por persona, carga masiva y enlace público (funciones puras)
// ============================================================================

import type { EstadoPagoDelegacion, ModalidadAsistencia } from '~/types/api'

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

/** Excel pierde el cero inicial de un DNI: un número de 7 dígitos se completa a 8 (07969419). */
export function normalizarDni(numero: string): string {
  const limpio = numero.trim()
  return /^\d{7}$/.test(limpio) ? `0${limpio}` : limpio
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

    const [documentoLeido, primerNombre, segundo, tercero, cuarto] = campos
    const numeroDocumento = normalizarDni(documentoLeido ?? '')
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

// ─── Convenio (backend spec 023): modalidad, estimado en vivo y vouchers ───


export const PRECIO_VIRTUAL_POR_DEFECTO = 30

export const ETIQUETA_MODALIDAD: Record<ModalidadAsistencia, string> = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual' }

export interface TarifaDelegaciones {
  minIntegrantes: number
  precioEstandar: number
  precioPromocional: number
  /** `null` mientras el evento no tenga el tipo `delegacion_virtual`. */
  virtual: { precio: number } | null
}

export interface EstimadoGrupo {
  precioUnitario: number
  total: number
  /** Cuántos faltan para la tarifa promocional; `null` si ya aplica o no hay escala. */
  faltan: number | null
}

/**
 * Lo que costará un grupo de `integrantes` según la modalidad: presencial paga el estándar y, desde el
 * mínimo, el promocional; virtual paga una tarifa única. Es un estimado: el servidor calcula el monto.
 */
export function estimarGrupo(modalidad: ModalidadAsistencia, integrantes: number, tarifa: TarifaDelegaciones): EstimadoGrupo {
  const cantidad = Math.max(0, Math.trunc(integrantes) || 0)
  if (modalidad === 'VIRTUAL') {
    const precio = tarifa.virtual?.precio ?? PRECIO_VIRTUAL_POR_DEFECTO
    return { precioUnitario: precio, total: montoDelegacion(precio, cantidad), faltan: null }
  }
  const unitario = precioUnitarioDelegacion(tarifa.precioEstandar, tarifa.precioPromocional, tarifa.minIntegrantes, cantidad)
  const faltan = tarifa.precioPromocional < tarifa.precioEstandar && cantidad < tarifa.minIntegrantes ? tarifa.minIntegrantes - cantidad : null
  return { precioUnitario: unitario, total: montoDelegacion(unitario, cantidad), faltan }
}

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPagoDelegacion, string> = {
  PENDIENTE: 'Por revisar',
  VERIFICADO: 'Verificado',
  RECHAZADO: 'Rechazado',
}

export const TONO_ESTADO_PAGO: Record<EstadoPagoDelegacion, 'warn' | 'ok' | 'error'> = {
  PENDIENTE: 'warn',
  VERIFICADO: 'ok',
  RECHAZADO: 'error',
}

export const BANCOS = ['bcp', 'bbva', 'interbank', 'scotiabank', 'banco de la nación', 'otro'] as const
export const BILLETERAS = ['yape', 'plin', 'otro'] as const

/** Máximo de vouchers por envío (igual que el backend). */
export const MAX_VOUCHERS_POR_ENVIO = 6
export const VOUCHER_MAX_BYTES = 5 * 1024 * 1024
export const VOUCHER_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp'

/** Un voucher del formulario del panel, con su archivo. */
export interface PagoFormulario {
  modalidadPago: 'banco' | 'billetera'
  banco: string
  tipoOperacion: 'directo' | 'interbancario' | ''
  billeteraDigital: string
  numeroOperacion: string
  fechaPago: string
  monto: number | ''
  archivo: File | null
}

export function pagoVacio(): PagoFormulario {
  return { modalidadPago: 'billetera', banco: 'bcp', tipoOperacion: 'directo', billeteraDigital: 'yape', numeroOperacion: '', fechaPago: '', monto: '', archivo: null }
}

const VOUCHER_EXTENSIONES = /\.(pdf|jpe?g|png|webp)$/i

/** Errores de un voucher por campo (vacío si es válido). `hoy` es `AAAA-MM-DD` en hora de Lima. */
export function validarPago(pago: PagoFormulario, hoy: string): Record<string, string> {
  const errores: Record<string, string> = {}
  if (pago.numeroOperacion.trim().length < 3) errores.numeroOperacion = 'Ingresa el número de operación.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pago.fechaPago)) errores.fechaPago = 'Ingresa la fecha del pago.'
  else if (pago.fechaPago > hoy) errores.fechaPago = 'La fecha de pago no puede ser futura.'
  if (!(Number(pago.monto) > 0)) errores.monto = 'Ingresa el monto del voucher.'
  if (!pago.archivo) errores.archivo = 'Adjunta el voucher.'
  else if (!VOUCHER_EXTENSIONES.test(pago.archivo.name)) errores.archivo = 'Solo PDF, JPG, PNG o WebP.'
  else if (pago.archivo.size > VOUCHER_MAX_BYTES) errores.archivo = 'El voucher no debe superar los 5 MB.'
  else if (!pago.archivo.size) errores.archivo = 'El archivo está vacío.'
  return errores
}

/** Cuerpo multipart de `POST /delegations/:id/payments`: `pagos` (JSON) y un archivo por pago en `vouchers`. */
export function formularioPagos(pagos: PagoFormulario[]): FormData {
  const cuerpo = new FormData()
  cuerpo.append('pagos', JSON.stringify(pagos.map((pago) => ({
    modalidadPago: pago.modalidadPago,
    ...(pago.modalidadPago === 'banco' ? { banco: pago.banco || null, tipoOperacion: pago.tipoOperacion || null } : { billeteraDigital: pago.billeteraDigital || null }),
    numeroOperacion: pago.numeroOperacion.trim(),
    fechaPago: pago.fechaPago,
    monto: Number(pago.monto),
  }))))
  for (const pago of pagos) if (pago.archivo) cuerpo.append('vouchers', pago.archivo, pago.archivo.name)
  return cuerpo
}

/** Texto del saldo: lo que falta, lo que sobra o que está al día. */
export function textoSaldo(saldo: number): string {
  if (Math.abs(saldo) < 0.005) return 'Pagado'
  return saldo > 0 ? `Falta pagar ${saldo.toFixed(2)}` : `Se declaró ${Math.abs(saldo).toFixed(2)} de más`
}

const formatoFechaLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Hoy (`AAAA-MM-DD`) en hora de Lima, igual que el backend al validar que el pago no sea futuro. */
export function hoyLima(ahora: Date = new Date()): string {
  return formatoFechaLima.format(ahora)
}

/** Fila editable de integrante (formulario): la fila validada es `FilaParticipanteDelegacion`. */
export interface FilaEditable extends FilaParticipanteDelegacion {
  /** Clave estable para `v-for`. */
  clave: number
  /** Mensaje de la última consulta DNI (vacío si se completó). */
  aviso: string
  buscando: boolean
}

let contadorFilas = 0

export function filaVacia(): FilaEditable {
  contadorFilas += 1
  return { clave: contadorFilas, tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', aviso: '', buscando: false }
}

/** Una fila está en blanco si no tiene ningún dato (se ignora al enviar). */
export function filaEnBlanco(fila: FilaParticipanteDelegacion): boolean {
  return !fila.numeroDocumento.trim() && !fila.nombres.trim() && !fila.apellidos.trim() && !fila.correo.trim() && !fila.celular.trim()
}

/** Las filas con datos, limpias y listas para enviar al backend. */
export function filasParaEnviar(filas: FilaEditable[]): FilaParticipanteDelegacion[] {
  return filas.filter((fila) => !filaEnBlanco(fila)).map((fila) => ({
    tipoDocumento: fila.tipoDocumento,
    numeroDocumento: fila.tipoDocumento === 'dni' ? normalizarDni(fila.numeroDocumento).toUpperCase() : fila.numeroDocumento.trim().toUpperCase(),
    nombres: fila.nombres.trim(),
    apellidos: fila.apellidos.trim(),
    correo: fila.correo.trim().toLowerCase(),
    celular: fila.celular.trim(),
  }))
}

/** Tarifa por modalidad a partir de los tipos de la categoría `DELEGACIONES` del evento. */
export function tarifaDeTipos(tipos: ReadonlyArray<{ codigo: string, precio: number | null, activo: boolean }>): TarifaDelegaciones {
  const precio = (codigo: string) => tipos.find((tipo) => tipo.activo && tipo.codigo === codigo)?.precio ?? null
  const virtual = precio('delegacion_virtual')
  return {
    minIntegrantes: MIN_INTEGRANTES_POR_DEFECTO,
    precioEstandar: precio('delegacion_general') ?? PRECIO_ESTANDAR_POR_DEFECTO,
    precioPromocional: precio('delegacion_grupal') ?? PRECIO_PROMOCIONAL_POR_DEFECTO,
    virtual: virtual === null ? null : { precio: virtual },
  }
}
