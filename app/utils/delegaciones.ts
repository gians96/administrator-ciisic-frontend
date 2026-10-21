// ============================================================================
// DELEGACIONES: tarifa por persona, carga masiva y enlace público (funciones puras)
// ============================================================================

import type { Delegacion, EstadoPagoDelegacion, ModalidadAsistencia, TarifaDelegacionesAdmin } from '~/types/api'

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

/**
 * Origen de la landing en producción. El panel (`admin-ciisic.episundc.pe`) y la landing viven en dominios
 * distintos, así que el link del delegado no puede salir del origen del panel. Cámbialo si la landing cambia de
 * dominio (p. ej. con otro evento).
 */
export const ORIGEN_LANDING_CONFIGURADO: string = 'https://ciisic-viii.episundc.pe'

/**
 * Origen público para el link de la delegación. En desarrollo el panel corre en 3001 y la landing en 3000;
 * en cualquier otro caso se usa `ORIGEN_LANDING_CONFIGURADO` (y, si se vacía, el del propio panel).
 */
export function origenLanding(): string {
  if (typeof window !== 'undefined' && window.location.port === '3001') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:3000`
  }
  if (ORIGEN_LANDING_CONFIGURADO) return ORIGEN_LANDING_CONFIGURADO.replace(/\/+$/, '')
  return typeof window === 'undefined' ? '' : window.location.origin
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

// ─── Tarifa del evento y de cada delegación (backend spec 024) ───

/** Valor de un campo numérico del formulario: `''` mientras está vacío (`v-model.number`). */
export type Cifra = number | ''

export const MIN_INTEGRANTES_MAXIMO = 1000

const esCifra = (valor: Cifra): valor is number => typeof valor === 'number' && Number.isFinite(valor)
/** Los precios se guardan con hasta dos decimales. */
const tieneCentavos = (valor: number) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6

/** Tarifa que usa el alta y el estimado: la virtual solo se ofrece si su tipo existe y está activo. */
export function tarifaDeAdmin(tarifa: TarifaDelegacionesAdmin): TarifaDelegaciones {
  return {
    minIntegrantes: tarifa.minIntegrantes,
    precioEstandar: tarifa.presencial.precioEstandar,
    precioPromocional: tarifa.presencial.precioPromocional,
    virtual: tarifa.virtual?.activo ? { precio: tarifa.virtual.precio } : null,
  }
}

/** Lo que edita el staff en «Editar tarifa». `precioVirtual` y `virtualActivo` solo cuentan si la virtual se ofrece. */
export interface FormularioTarifa {
  minIntegrantes: Cifra
  precioEstandar: Cifra
  precioPromocional: Cifra
  precioVirtual: Cifra
  virtualActivo: boolean
  aplicarAExistentes: boolean
}

export function formularioDeTarifa(tarifa: TarifaDelegacionesAdmin): FormularioTarifa {
  return {
    minIntegrantes: tarifa.minIntegrantes,
    precioEstandar: tarifa.presencial.precioEstandar,
    precioPromocional: tarifa.presencial.precioPromocional,
    precioVirtual: tarifa.virtual?.precio ?? PRECIO_VIRTUAL_POR_DEFECTO,
    virtualActivo: tarifa.virtual?.activo ?? false,
    aplicarAExistentes: false,
  }
}

function errorDePrecio(valor: Cifra): string | null {
  if (!esCifra(valor) || valor < 0) return 'Escribe un precio válido (0 o más).'
  return tieneCentavos(valor) ? null : 'Usa hasta dos decimales.'
}

function errorDeMinimo(valor: Cifra): string | null {
  return esCifra(valor) && Number.isInteger(valor) && valor >= 1 && valor <= MIN_INTEGRANTES_MAXIMO
    ? null
    : `Escribe un número entero de 1 a ${MIN_INTEGRANTES_MAXIMO}.`
}

/** Errores por campo del formulario de la tarifa (vacío si es válido). Los mismos límites que el backend. */
export function validarTarifa(form: FormularioTarifa): Record<string, string> {
  const errores: Record<string, string> = {}
  const minimo = errorDeMinimo(form.minIntegrantes)
  if (minimo) errores.minIntegrantes = minimo
  const estandar = errorDePrecio(form.precioEstandar)
  if (estandar) errores.precioEstandar = estandar
  const promocional = errorDePrecio(form.precioPromocional)
  if (promocional) errores.precioPromocional = promocional
  else if (!estandar && esCifra(form.precioEstandar) && esCifra(form.precioPromocional) && form.precioPromocional > form.precioEstandar) {
    errores.precioPromocional = 'El precio promocional no puede ser mayor que el estándar.'
  }
  if (form.virtualActivo) {
    const virtual = errorDePrecio(form.precioVirtual)
    if (virtual) errores.precioVirtual = virtual
  }
  return errores
}

/**
 * Cuerpo del `PUT events/:id/delegations/tarifa` con **solo lo que cambió**; `null` si no hay nada que guardar.
 * Sin tipo virtual (`actual.virtual === null`) el precio virtual solo se envía al encender la modalidad, porque
 * enviarlo crea el tipo. Se asume el formulario ya validado (`validarTarifa`).
 */
export function cuerpoTarifa(form: FormularioTarifa, actual: TarifaDelegacionesAdmin): Record<string, number | boolean> | null {
  const cuerpo: Record<string, number | boolean> = {}
  if (esCifra(form.minIntegrantes) && form.minIntegrantes !== actual.minIntegrantes) cuerpo.minIntegrantes = form.minIntegrantes
  if (esCifra(form.precioEstandar) && form.precioEstandar !== actual.presencial.precioEstandar) cuerpo.precioEstandar = form.precioEstandar
  if (esCifra(form.precioPromocional) && form.precioPromocional !== actual.presencial.precioPromocional) cuerpo.precioPromocional = form.precioPromocional
  if (actual.virtual) {
    if (esCifra(form.precioVirtual) && form.precioVirtual !== actual.virtual.precio) cuerpo.precioVirtual = form.precioVirtual
    if (form.virtualActivo !== actual.virtual.activo) cuerpo.virtualActivo = form.virtualActivo
  } else if (form.virtualActivo && esCifra(form.precioVirtual)) {
    cuerpo.virtualActivo = true
    cuerpo.precioVirtual = form.precioVirtual
  }
  if (form.aplicarAExistentes) cuerpo.aplicarAExistentes = true
  return Object.keys(cuerpo).length ? cuerpo : null
}

/** Mensaje tras guardar la tarifa: cuántas delegaciones recibieron la copia, si se pidió. */
export function textoTarifaGuardada(delegacionesActualizadas: number, aplicoAExistentes: boolean): string {
  if (!aplicoAExistentes) return 'Tarifa guardada. Rige para las delegaciones nuevas; las ya creadas conservan la suya.'
  if (!delegacionesActualizadas) return 'Tarifa guardada. Ninguna delegación existente estaba sin integrantes ni vouchers.'
  return `Tarifa guardada y aplicada a ${delegacionesActualizadas} delegación(es) sin integrantes ni vouchers.`
}

/** Valores de la tarifa del evento para una modalidad (lo que copia una delegación al crearse o al cambiar de modalidad). */
export function tarifaParaModalidad(modalidad: ModalidadAsistencia, tarifa: TarifaDelegaciones): Pick<FormularioTarifaDelegacion, 'minIntegrantes' | 'precioEstandar' | 'precioPromocional'> {
  if (modalidad === 'VIRTUAL') {
    const precio = tarifa.virtual?.precio ?? PRECIO_VIRTUAL_POR_DEFECTO
    return { minIntegrantes: tarifa.minIntegrantes, precioEstandar: precio, precioPromocional: precio }
  }
  return { minIntegrantes: tarifa.minIntegrantes, precioEstandar: tarifa.precioEstandar, precioPromocional: tarifa.precioPromocional }
}

/** Tarifa de una delegación en «Tarifa de esta delegación». En virtual `precioEstandar` es el precio único por persona. */
export interface FormularioTarifaDelegacion {
  modalidad: ModalidadAsistencia
  minIntegrantes: Cifra
  precioEstandar: Cifra
  precioPromocional: Cifra
}

type TarifaDeDelegacion = Pick<Delegacion, 'modalidad' | 'minIntegrantes' | 'precioEstandar' | 'precioPromocional'>

export function formularioDeTarifaDelegacion(delegacion: TarifaDeDelegacion): FormularioTarifaDelegacion {
  return {
    modalidad: delegacion.modalidad,
    minIntegrantes: delegacion.minIntegrantes,
    precioEstandar: delegacion.precioEstandar,
    precioPromocional: delegacion.precioPromocional,
  }
}

/** Errores por campo de la tarifa de una delegación; la virtual solo valida su precio único (y el mínimo, que no se usa). */
export function validarTarifaDelegacion(form: FormularioTarifaDelegacion): Record<string, string> {
  const errores: Record<string, string> = {}
  const minimo = errorDeMinimo(form.minIntegrantes)
  if (minimo) errores.minIntegrantes = minimo
  const estandar = errorDePrecio(form.precioEstandar)
  if (estandar) errores.precioEstandar = estandar
  if (form.modalidad === 'PRESENCIAL') {
    const promocional = errorDePrecio(form.precioPromocional)
    if (promocional) errores.precioPromocional = promocional
    else if (!estandar && esCifra(form.precioEstandar) && esCifra(form.precioPromocional) && form.precioPromocional > form.precioEstandar) {
      errores.precioPromocional = 'El precio promocional no puede ser mayor que el estándar.'
    }
  }
  return errores
}

/**
 * Cuerpo del `PUT delegations/:id` con la tarifa que cambió (`null` si no cambió nada). Al cambiar la modalidad se
 * envían también las tres cifras del formulario (ya precargadas con la tarifa de esa modalidad). En virtual el
 * promocional es siempre igual al estándar: no hay escalas.
 */
export function cuerpoTarifaDelegacion(form: FormularioTarifaDelegacion, actual: TarifaDeDelegacion): Record<string, string | number> | null {
  const cambiaModalidad = form.modalidad !== actual.modalidad
  const promocional = form.modalidad === 'VIRTUAL' ? form.precioEstandar : form.precioPromocional
  const cuerpo: Record<string, string | number> = {}
  if (cambiaModalidad) cuerpo.modalidad = form.modalidad
  if (esCifra(form.minIntegrantes) && (cambiaModalidad || form.minIntegrantes !== actual.minIntegrantes)) cuerpo.minIntegrantes = form.minIntegrantes
  if (esCifra(form.precioEstandar) && (cambiaModalidad || form.precioEstandar !== actual.precioEstandar)) cuerpo.precioEstandar = form.precioEstandar
  if (esCifra(promocional) && (cambiaModalidad || promocional !== actual.precioPromocional)) cuerpo.precioPromocional = promocional
  return Object.keys(cuerpo).length ? cuerpo : null
}

/** La delegación cobra distinto de la tarifa del evento (un convenio): se marca en el detalle. */
export function esTarifaDeConvenio(delegacion: TarifaDeDelegacion, tarifa: TarifaDelegaciones): boolean {
  const evento = tarifaParaModalidad(delegacion.modalidad, tarifa)
  if (delegacion.modalidad === 'VIRTUAL') return delegacion.precioEstandar !== evento.precioEstandar
  return delegacion.minIntegrantes !== evento.minIntegrantes
    || delegacion.precioEstandar !== evento.precioEstandar
    || delegacion.precioPromocional !== evento.precioPromocional
}
