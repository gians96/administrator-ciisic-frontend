// ============================================================================
// DELEGACIONES (backend spec 029): planes por delegación, carga masiva y links públicos (funciones puras)
// ============================================================================

import type { CambiosPlanes, CodigoPlan, EstadoPagoDelegacion, PagoDelegacion, PlanDelegacion } from '~/types/api'

/** Mínimo de integrantes con el que nace una delegación (desde ahí los planes con promocional lo cobran). */
export const MIN_INTEGRANTES_POR_DEFECTO = 10

/** Precio por persona de un plan: el promocional (si lo tiene) en cuanto la delegación alcanza el mínimo. */
export function precioUnitarioPlan(precio: number, precioPromocional: number | null, minIntegrantes: number, totalIntegrantes: number): number {
  return precioPromocional !== null && precioPromocional < precio && totalIntegrantes >= minIntegrantes ? precioPromocional : precio
}

/** Costo total con el precio por persona. */
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
  /** Plan del integrante; `''` mientras no se elige (el servidor asume el único plan activo). */
  plan: CodigoPlan | ''
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
 * informan con el número de línea para poder corregir el texto antes de enviarlo. El plan no viene en
 * el texto: quien pega la lista lo elige para todas las filas.
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
      plan: '',
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

/** Link del delegado en la landing (`/delegaciones?delegacion=<código>`): ve su grupo y agrega integrantes y vouchers. */
export function enlaceInscripcionDelegacion(codigoLink: string, origen = origenLanding()): string {
  const base = origen.replace(/\/+$/, '')
  return `${base}/delegaciones?delegacion=${encodeURIComponent(codigoLink)}`
}

/** Link individual en la landing (`/delegaciones?unirme=<código>`): cada integrante se inscribe solo. */
export function enlaceInscripcionIndividual(codigoInscripcion: string, origen = origenLanding()): string {
  const base = origen.replace(/\/+$/, '')
  return `${base}/delegaciones?unirme=${encodeURIComponent(codigoInscripcion)}`
}

// ─── Planes (backend spec 029) ───

/** Los tres planes de una delegación, en el orden en que se muestran. */
export const PLANES: ReadonlyArray<{ codigo: CodigoPlan, etiqueta: string, descripcion: string }> = [
  { codigo: 'CON_KIT', etiqueta: 'Con kit', descripcion: 'Presencial con kit de merchandising' },
  { codigo: 'SIN_KIT', etiqueta: 'Sin kit', descripcion: 'Presencial sin kit' },
  { codigo: 'VIRTUAL', etiqueta: 'Virtual', descripcion: 'Participación virtual' },
]

export const ETIQUETA_PLAN: Record<CodigoPlan, string> = { CON_KIT: 'Con kit', SIN_KIT: 'Sin kit', VIRTUAL: 'Virtual' }

export function esCodigoPlan(valor: unknown): valor is CodigoPlan {
  return valor === 'CON_KIT' || valor === 'SIN_KIT' || valor === 'VIRTUAL'
}

/** Planes que admiten integrantes nuevos (activos), en orden. */
export function planesActivos(planes: readonly PlanDelegacion[]): PlanDelegacion[] {
  return planes.filter((plan) => plan.activo)
}

/** Plan con el que se precarga una fila: el único activo; con varios, ninguno (hay que elegir). */
export function planPorDefecto(planes: readonly PlanDelegacion[]): CodigoPlan | '' {
  const activos = planesActivos(planes)
  return activos.length === 1 ? (activos[0]?.codigo ?? '') : ''
}

/** Resumen corto de lo que ofrece una delegación: «Con kit S/ 80.00 · Sin kit S/ 60.00». Sin precios (sin `pagos.ver`) solo los nombres. */
export function resumenPlanes(planes: readonly PlanDelegacion[]): string {
  return planesActivos(planes).map((plan) => (plan.precio === null ? ETIQUETA_PLAN[plan.codigo] : `${ETIQUETA_PLAN[plan.codigo]} S/ ${plan.precio.toFixed(2)}`)).join(' · ')
}

export interface EstimadoGrupo {
  /** Integrantes considerados. */
  integrantes: number
  total: number
  /** Cuántos faltan para el precio promocional; `null` si ningún plan lo tiene o ya aplica. */
  faltan: number | null
  /** Precio por persona de cada plan con ese total. */
  unitarios: Partial<Record<CodigoPlan, number>>
}

/**
 * Lo que costará un grupo según cuántos integrantes hay en cada plan. Es un estimado: el servidor calcula el
 * monto. Necesita los precios (`pagos.ver`); sin ellos devuelve `null`.
 */
export function estimarGrupo(planes: readonly PlanDelegacion[], cantidades: Partial<Record<CodigoPlan, number>>, minIntegrantes: number): EstimadoGrupo | null {
  if (planes.some((plan) => plan.precio === null)) return null
  const entero = (codigo: CodigoPlan) => Math.max(0, Math.trunc(cantidades[codigo] ?? 0))
  const integrantes = PLANES.reduce((suma, { codigo }) => suma + entero(codigo), 0)
  const unitarios: Partial<Record<CodigoPlan, number>> = {}
  let total = 0
  for (const plan of planes) {
    const unitario = precioUnitarioPlan(plan.precio ?? 0, plan.precioPromocional, minIntegrantes, integrantes)
    unitarios[plan.codigo] = unitario
    total += montoDelegacion(unitario, entero(plan.codigo))
  }
  const hayEscala = planes.some((plan) => plan.activo && plan.precioPromocional !== null && plan.precio !== null && plan.precioPromocional < plan.precio)
  return { integrantes, total: Math.round(total * 100) / 100, faltan: hayEscala && integrantes < minIntegrantes ? minIntegrantes - integrantes : null, unitarios }
}

/** Valor de un campo numérico del formulario: `''` mientras está vacío (`v-model.number`). */
export type Cifra = number | ''

export const MIN_INTEGRANTES_MAXIMO = 1000

const esCifra = (valor: Cifra): valor is number => typeof valor === 'number' && Number.isFinite(valor)
/** Los precios se guardan con hasta dos decimales. */
const tieneCentavos = (valor: number) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6

/** Lo que edita el staff de cada plan. `precioPromocional: ''` = sin escala. */
export interface FormularioPlan {
  activo: boolean
  precio: Cifra
  precioPromocional: Cifra
}

export type FormularioPlanes = Record<CodigoPlan, FormularioPlan>

/** Planes de una delegación nueva: los tres apagados y sin precio. */
export function planesVacios(): FormularioPlanes {
  return {
    CON_KIT: { activo: false, precio: '', precioPromocional: '' },
    SIN_KIT: { activo: false, precio: '', precioPromocional: '' },
    VIRTUAL: { activo: false, precio: '', precioPromocional: '' },
  }
}

/** Los planes de una delegación ya creada como los edita el formulario (sin `pagos.ver` los precios quedan vacíos). */
export function formularioDePlanes(planes: readonly PlanDelegacion[]): FormularioPlanes {
  const formulario = planesVacios()
  for (const plan of planes) {
    formulario[plan.codigo] = { activo: plan.activo, precio: plan.precio ?? '', precioPromocional: plan.precioPromocional ?? '' }
  }
  return formulario
}

function errorDePrecio(valor: Cifra): string | null {
  if (!esCifra(valor) || valor < 0) return 'Escribe un precio válido (0 o más).'
  return tieneCentavos(valor) ? null : 'Usa hasta dos decimales.'
}

export function errorDeMinimo(valor: Cifra): string | null {
  return esCifra(valor) && Number.isInteger(valor) && valor >= 1 && valor <= MIN_INTEGRANTES_MAXIMO
    ? null
    : `Escribe un número entero de 1 a ${MIN_INTEGRANTES_MAXIMO}.`
}

/**
 * Errores por campo de los planes (`CON_KIT.precio`, `SIN_KIT.precioPromocional`…; vacío si es válido), con los
 * mismos límites que el backend: un plan activo necesita precio mayor que cero y el promocional no supera al precio.
 */
export function validarPlanes(form: FormularioPlanes): Record<string, string> {
  const errores: Record<string, string> = {}
  for (const { codigo } of PLANES) {
    const plan = form[codigo]
    if (plan.precio !== '') {
      const error = errorDePrecio(plan.precio)
      if (error) errores[`${codigo}.precio`] = error
    }
    if (plan.activo && !(esCifra(plan.precio) && plan.precio > 0)) errores[`${codigo}.precio`] ??= 'Un plan activo necesita un precio mayor que cero.'
    if (plan.precioPromocional !== '') {
      const error = errorDePrecio(plan.precioPromocional)
      if (error) errores[`${codigo}.precioPromocional`] = error
      else if (esCifra(plan.precio) && esCifra(plan.precioPromocional) && plan.precioPromocional > plan.precio) {
        errores[`${codigo}.precioPromocional`] = 'El promocional no puede ser mayor que el precio.'
      }
    }
  }
  return errores
}

/**
 * Cuerpo de `planes` del alta: de cada plan con datos (activo o con precio), lo que escribió el staff. `null` si no
 * hay ninguno (los tres nacen apagados). Se asume el formulario ya validado.
 */
export function planesParaAlta(form: FormularioPlanes): CambiosPlanes | null {
  const cuerpo: CambiosPlanes = {}
  for (const { codigo } of PLANES) {
    const plan = form[codigo]
    if (!plan.activo && plan.precio === '') continue
    cuerpo[codigo] = {
      activo: plan.activo,
      ...(esCifra(plan.precio) ? { precio: plan.precio } : {}),
      ...(esCifra(plan.precioPromocional) ? { precioPromocional: plan.precioPromocional } : {}),
    }
  }
  return Object.keys(cuerpo).length ? cuerpo : null
}

/** Cuerpo de `planes` de `PUT delegations/:id/config` con **solo lo que cambió**; `null` si no cambió nada. */
export function cambiosDePlanes(form: FormularioPlanes, actuales: readonly PlanDelegacion[]): CambiosPlanes | null {
  const cuerpo: CambiosPlanes = {}
  for (const { codigo } of PLANES) {
    const plan = form[codigo]
    const actual = actuales.find((candidato) => candidato.codigo === codigo)
    const cambios: NonNullable<CambiosPlanes[CodigoPlan]> = {}
    if (plan.activo !== (actual?.activo ?? false)) cambios.activo = plan.activo
    if (esCifra(plan.precio) && plan.precio !== (actual?.precio ?? null)) cambios.precio = plan.precio
    const promocionalActual = actual?.precioPromocional ?? null
    if (esCifra(plan.precioPromocional) && plan.precioPromocional !== promocionalActual) cambios.precioPromocional = plan.precioPromocional
    if (plan.precioPromocional === '' && promocionalActual !== null) cambios.precioPromocional = null
    if (Object.keys(cambios).length) cuerpo[codigo] = cambios
  }
  return Object.keys(cuerpo).length ? cuerpo : null
}

// ─── Correo con dominio (backend spec 029) ───

/** Dominio normalizado como lo guarda el backend: minúsculas y sin arroba (`''` = sin filtro). */
export function normalizarDominio(texto: string): string {
  return texto.trim().toLowerCase().replace(/^@+/, '')
}

const DOMINIO = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/

export function errorDeDominio(texto: string): string | null {
  const dominio = normalizarDominio(texto)
  if (!dominio) return null
  return DOMINIO.test(dominio) && dominio.length <= 100 ? null : 'Escribe un dominio como unac.edu.pe.'
}

/** El correo está fuera del dominio de la delegación (el staff puede inscribirlo igual: solo es un aviso). */
export function correoFueraDeDominio(correo: string, dominio: string | null): boolean {
  if (!dominio || !correo.trim()) return false
  return !correo.trim().toLowerCase().endsWith(`@${dominio}`)
}

// ─── Vouchers ───

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

/** Medio con el que se pagó: «Banco bcp · directo» o «Billetera yape». */
export function medioDePago(pago: Pick<PagoDelegacion, 'modalidadPago' | 'banco' | 'tipoOperacion' | 'billeteraDigital'>): string {
  const medio = pago.modalidadPago === 'banco'
    ? `Banco ${pago.banco ?? ''}${pago.tipoOperacion ? ` · ${pago.tipoOperacion}` : ''}`
    : `Billetera ${pago.billeteraDigital ?? ''}`
  return medio.trim()
}

/** Cómo se muestra el archivo de un voucher: imagen, PDF u otro tipo (solo se ofrece abrirlo). */
export type TipoVoucher = 'imagen' | 'pdf' | 'otro'

export function tipoDeVoucher(mime: string | null | undefined): TipoVoucher {
  const tipo = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (tipo.startsWith('image/')) return 'imagen'
  return tipo === 'application/pdf' ? 'pdf' : 'otro'
}

/** Borrar un voucher: quien configura (`gestionar`) o revisa los pagos (`validar`), y nunca uno verificado (primero vuelve a pendiente). */
export function puedeEliminarVoucher(estado: EstadoPagoDelegacion, permisos: { gestionar: boolean, validar: boolean }): boolean {
  return (permisos.gestionar || permisos.validar) && estado !== 'VERIFICADO'
}

/** Posición del voucher en la lista y sus vecinos (el visor recorre los vouchers con Anterior y Siguiente). */
export function vecinosDeVoucher<T extends { id: number }>(pagos: readonly T[], id: number | null): { indice: number, anterior: T | null, siguiente: T | null } {
  const indice = id === null ? -1 : pagos.findIndex((pago) => pago.id === id)
  if (indice < 0) return { indice: -1, anterior: null, siguiente: null }
  return { indice, anterior: pagos[indice - 1] ?? null, siguiente: pagos[indice + 1] ?? null }
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

// ─── Integrantes ───

/** Fila editable de integrante (formulario): la fila validada es `FilaParticipanteDelegacion`. */
export interface FilaEditable extends FilaParticipanteDelegacion {
  /** Clave estable para `v-for`. */
  clave: number
  /** Mensaje de la última consulta DNI (vacío si se completó). */
  aviso: string
  buscando: boolean
}

let contadorFilas = 0

export function filaVacia(plan: CodigoPlan | '' = ''): FilaEditable {
  contadorFilas += 1
  return { clave: contadorFilas, tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', plan, aviso: '', buscando: false }
}

/** Una fila está en blanco si no tiene ningún dato (se ignora al enviar; el plan precargado no cuenta). */
export function filaEnBlanco(fila: Omit<FilaParticipanteDelegacion, 'plan'>): boolean {
  return !fila.numeroDocumento.trim() && !fila.nombres.trim() && !fila.apellidos.trim() && !fila.correo.trim() && !fila.celular.trim()
}

/** Las filas con datos, limpias y listas para enviar al backend. */
export function filasParaEnviar(filas: FilaEditable[]): Array<Omit<FilaParticipanteDelegacion, 'plan'> & { plan?: CodigoPlan }> {
  return filas.filter((fila) => !filaEnBlanco(fila)).map((fila) => ({
    tipoDocumento: fila.tipoDocumento,
    numeroDocumento: fila.tipoDocumento === 'dni' ? normalizarDni(fila.numeroDocumento).toUpperCase() : fila.numeroDocumento.trim().toUpperCase(),
    nombres: fila.nombres.trim(),
    apellidos: fila.apellidos.trim(),
    correo: fila.correo.trim().toLowerCase(),
    celular: fila.celular.trim(),
    ...(fila.plan ? { plan: fila.plan } : {}),
  }))
}

/** Cuántos integrantes hay por plan en las filas con datos (para el estimado). Sin plan elegido cuentan en `porDefecto`. */
export function cantidadesPorPlan(filas: readonly FilaEditable[], porDefecto: CodigoPlan | ''): Partial<Record<CodigoPlan, number>> {
  const cantidades: Partial<Record<CodigoPlan, number>> = {}
  for (const fila of filas) {
    if (filaEnBlanco(fila)) continue
    const plan = fila.plan || porDefecto
    if (plan) cantidades[plan] = (cantidades[plan] ?? 0) + 1
  }
  return cantidades
}
