import type { CredencialCorreo, PlanBrevo, ProveedorCorreo } from '~/types/api'
import { numero } from '~/utils/formato'

// ─── Proveedor: Brevo (API key) o Gmail por SMTP (contraseña de aplicación) ───

export const PROVEEDORES_CORREO: ReadonlyArray<{ valor: ProveedorCorreo, nombre: string }> = [
  { valor: 'BREVO', nombre: 'Brevo (API key)' },
  { valor: 'GMAIL_SMTP', nombre: 'Gmail (SMTP con contraseña de aplicación)' },
]

export function nombreProveedor(proveedor: ProveedorCorreo | undefined): string {
  return proveedor === 'GMAIL_SMTP' ? 'Gmail' : 'Brevo'
}

/** Cómo se llama el secreto que guarda cada proveedor. */
export function nombreSecreto(proveedor: ProveedorCorreo | undefined): string {
  return proveedor === 'GMAIL_SMTP' ? 'contraseña de aplicación' : 'API key'
}

/** Google las muestra en 4 grupos de 4 letras separados por espacios; el backend las guarda sin espacios y en minúsculas. */
export function normalizarClaveAplicacion(valor: string): string {
  return valor.replace(/\s+/g, '').toLowerCase()
}

const CLAVE_APLICACION = /^[a-z]{16}$/

export function esClaveAplicacionValida(valor: string): boolean {
  return CLAVE_APLICACION.test(normalizarClaveAplicacion(valor))
}

/** Credencial tal como la referencia un evento (`credencialCorreo` del detalle). */
export interface CredencialCorreoRef { id: number, nombre?: string, remitenteCorreo?: string }

export interface FormularioCredencialCorreo {
  proveedor: ProveedorCorreo
  nombre: string
  apiKey: string
  remitenteCorreo: string
  remitenteNombre: string
  esPredeterminada: boolean
  activo: boolean
}

/** Nombres legibles de las claves de `fields` (errores de validación del backend). */
export const ETIQUETAS_CAMPOS_CREDENCIAL: Readonly<Record<string, string>> = {
  proveedor: 'Proveedor',
  nombre: 'Nombre',
  apiKey: 'API key o contraseña',
  remitenteCorreo: 'Correo del remitente',
  remitenteNombre: 'Nombre del remitente',
  esPredeterminada: 'Predeterminada',
  activo: 'Activa',
  correo: 'Correo destino',
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function esCorreoValido(valor: string): boolean {
  return CORREO.test(valor.trim())
}

/** Insignia del último estado (lo actualizan las pruebas y los envíos reales). */
export function estadoCredencialCorreo(credencial: Pick<CredencialCorreo, 'ultimoEstado'>): { texto: string, tono: 'ok' | 'error' | 'neutral' } {
  if (credencial.ultimoEstado === 'OK') return { texto: 'Último estado: OK', tono: 'ok' }
  if (credencial.ultimoEstado === 'ERROR') return { texto: 'Último estado: error', tono: 'error' }
  return { texto: 'Sin probar', tono: 'neutral' }
}

/** Remitente como lo verá el destinatario: `Nombre <correo>` o solo el correo. */
export function remitenteCredencial(credencial: Pick<CredencialCorreo, 'remitenteCorreo' | 'remitenteNombre'>): string {
  const nombre = credencial.remitenteNombre?.trim()
  return nombre ? `${nombre} <${credencial.remitenteCorreo}>` : credencial.remitenteCorreo
}

const TIPOS_PLAN_BREVO: Readonly<Record<string, string>> = {
  free: 'Gratuito',
  payAsYouGo: 'Pago por uso',
  subscription: 'Suscripción',
  reseller: 'Revendedor',
  sms: 'SMS',
}

const TIPOS_CREDITO_BREVO: Readonly<Record<string, string>> = {
  sendLimit: 'envíos disponibles',
}

function unidadCreditosBrevo(tipoCreditos: string | null): string {
  if (!tipoCreditos) return 'créditos'
  return TIPOS_CREDITO_BREVO[tipoCreditos] ?? `créditos (${tipoCreditos})`
}

/** `{ tipo: 'free', creditos: 300, tipoCreditos: 'sendLimit' }` → `Gratuito: 300 envíos disponibles`. */
export function describirPlanBrevo(plan: PlanBrevo): string {
  const tipo = TIPOS_PLAN_BREVO[plan.tipo] ?? (plan.tipo || 'Plan')
  if (plan.creditos === null) return `${tipo}: sin datos de créditos`
  return `${tipo}: ${numero(plan.creditos)} ${unidadCreditosBrevo(plan.tipoCreditos)}`
}

type Ordenable = Pick<CredencialCorreo, 'esPredeterminada' | 'activo' | 'nombre'> & { prioridad?: number }

/**
 * Predeterminada primero y luego el orden de respaldo (`prioridad`, el mismo con el que el backend prueba
 * las credenciales); con un backend anterior, que no la envía, las activas y por nombre.
 */
export function ordenarCredencialesCorreo<T extends Ordenable>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) =>
    Number(b.esPredeterminada) - Number(a.esPredeterminada)
    || (a.prioridad !== undefined && b.prioridad !== undefined ? a.prioridad - b.prioridad : Number(b.activo) - Number(a.activo))
    || a.nombre.localeCompare(b.nombre, 'es'))
}

/** El backend conoce el orden de respaldo y el envío por Gmail (spec 041): todas las credenciales traen `prioridad`. */
export function hayPrioridades(lista: readonly Pick<CredencialCorreo, 'prioridad'>[]): boolean {
  return lista.length > 0 && lista.every((credencial) => typeof credencial.prioridad === 'number')
}

export type DireccionOrden = 'arriba' | 'abajo'

/**
 * Ids de **todas** las credenciales en el orden nuevo al mover una de respaldo un lugar, o `null` si no se
 * puede. La predeterminada es siempre la primera y no se mueve (para cambiarla se marca otra), y nada
 * pasa por encima de ella.
 */
export function ordenTrasMover(ordenadas: readonly Pick<CredencialCorreo, 'id' | 'esPredeterminada'>[], id: number, direccion: DireccionOrden): number[] | null {
  const indice = ordenadas.findIndex((credencial) => credencial.id === id)
  const destino = direccion === 'arriba' ? indice - 1 : indice + 1
  if (indice < 0 || ordenadas[indice]!.esPredeterminada || destino < 0 || destino >= ordenadas.length || ordenadas[destino]!.esPredeterminada) return null
  const ids = ordenadas.map((credencial) => credencial.id)
  const movido = ids[indice]!
  ids[indice] = ids[destino]!
  ids[destino] = movido
  return ids
}

// ─── Créditos de envío (backend spec 042) ───

/** Cuánto vale una revisión de créditos: el backend vuelve a preguntar a Brevo pasado este tiempo. */
export const VIGENCIA_CREDITOS_MS = 5 * 60 * 1000

type ConCreditos = Pick<CredencialCorreo, 'creditosDisponibles'>

/** El backend informa créditos (spec 042): alguna credencial trae `creditosDisponibles`. */
export function hayCreditos(lista: readonly ConCreditos[]): boolean {
  return lista.some((credencial) => credencial.creditosDisponibles !== undefined)
}

/** Sin envíos disponibles según la última revisión (Brevo; Gmail no informa créditos). */
export function sinCreditos(credencial: ConCreditos): boolean {
  return credencial.creditosDisponibles === 0
}

/** Insignia de los envíos que le quedan; `null` si no aplica (Gmail) o el backend aún no los informa. */
export function estadoCreditos(credencial: Pick<CredencialCorreo, 'proveedor' | 'creditosDisponibles'>): { texto: string, tono: 'ok' | 'warn' | 'error' | 'neutral' } | null {
  const creditos = credencial.creditosDisponibles
  if (credencial.proveedor === 'GMAIL_SMTP' || creditos === undefined) return null
  if (creditos === null) return { texto: 'Créditos sin revisar', tono: 'neutral' }
  if (creditos === 0) return { texto: 'Sin créditos', tono: 'error' }
  return { texto: `${numero(creditos)} envíos`, tono: creditos <= 20 ? 'warn' : 'ok' }
}

/** `hace 3 min`, `hace 2 h`, `hace 1 d`. */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  const marca = iso ? Date.parse(iso) : Number.NaN
  if (Number.isNaN(marca)) return 'sin revisar'
  const minutos = Math.floor((ahora - marca) / 60_000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.floor(horas / 24)} d`
}

/** `295 envíos disponibles · revisado hace 3 min`; `null` si no se sabe (nunca revisada, Gmail o backend anterior). */
export function textoCreditos(credencial: Pick<CredencialCorreo, 'proveedor' | 'creditosDisponibles' | 'creditosVerificadosEn'>, ahora = Date.now()): string | null {
  const creditos = credencial.creditosDisponibles
  if (credencial.proveedor === 'GMAIL_SMTP' || creditos === undefined || creditos === null) return null
  const cuanto = creditos === 0 ? 'Sin envíos disponibles' : `${numero(creditos)} envíos disponibles`
  return `${cuanto} · revisado ${haceCuanto(credencial.creditosVerificadosEn, ahora)}`
}

type Enviable = Ordenable & ConCreditos & Pick<CredencialCorreo, 'id'>

/** Credencial por la que salen los correos ahora: la primera activa, en orden de prioridad, que no esté sin créditos. */
export function credencialEnUso<T extends Enviable>(lista: readonly T[]): T | null {
  return ordenarCredencialesCorreo(lista).find((credencial) => credencial.activo && !sinCreditos(credencial)) ?? null
}

/** Sin ninguna con envíos (alerta) o con credenciales por delante que se saltan (informativo); `null` si todo está bien. */
export function avisoCreditos(lista: readonly (Ordenable & ConCreditos)[]): { tono: 'alerta' | 'info', texto: string } | null {
  const activas = ordenarCredencialesCorreo(lista).filter((credencial) => credencial.activo)
  if (!activas.length) return null
  const enUso = activas.find((credencial) => !sinCreditos(credencial))
  if (!enUso) {
    return { tono: 'alerta', texto: 'Ninguna credencial activa tiene envíos disponibles: los correos no saldrán hasta que Brevo renueve el cupo (el plan gratuito se renueva cada día) o agregues otra credencial, por ejemplo Gmail.' }
  }
  const saltadas = activas.slice(0, activas.indexOf(enUso))
  if (!saltadas.length) return null
  return { tono: 'info', texto: `Sin envíos disponibles: ${saltadas.map((credencial) => `«${credencial.nombre}»`).join(', ')}. Los correos salen por «${enUso.nombre}», la primera con envíos.` }
}

/** Si hay credenciales de Brevo activas cuya revisión de créditos falta o venció: la pantalla las revisa sola al abrirse. */
export function necesitaRevisarCreditos(lista: readonly Pick<CredencialCorreo, 'proveedor' | 'activo' | 'creditosDisponibles' | 'creditosVerificadosEn'>[], ahora = Date.now()): boolean {
  return lista.some((credencial) => {
    if (!credencial.activo || credencial.proveedor !== 'BREVO' || credencial.creditosDisponibles === undefined) return false
    const revisada = credencial.creditosVerificadosEn ? Date.parse(credencial.creditosVerificadosEn) : Number.NaN
    return Number.isNaN(revisada) || ahora - revisada > VIGENCIA_CREDITOS_MS
  })
}

/** `ANGEL: 295 · Gianmarcos: 0`, para el aviso tras revisar. */
export function resumenCreditos(lista: readonly Pick<CredencialCorreo, 'nombre' | 'proveedor' | 'activo' | 'creditosDisponibles'>[]): string {
  return lista
    .filter((credencial) => credencial.activo && credencial.proveedor === 'BREVO' && typeof credencial.creditosDisponibles === 'number')
    .map((credencial) => `${credencial.nombre}: ${numero(credencial.creditosDisponibles)}`)
    .join(' · ')
}

// ─── Reparto de un envío masivo (backend spec 044) ───

export interface TramoDeReparto {
  id: number
  nombre: string
  envios: number
  /** La credencial no informa cuántos envíos le quedan (Gmail, o Brevo sin revisar): se le asigna el resto. */
  sinLimite: boolean
}

export interface RepartoPrevisto {
  reparto: TramoDeReparto[]
  /** Cuántos quedarían sin enviar porque no hay envíos para todos. */
  sinCubrir: number
}

/**
 * Cómo se repartirían `personas` correos entre las credenciales: la misma cadena que el backend (la del evento primero y luego
 * las activas por prioridad), saltando las que no tienen envíos; cada una de Brevo aporta los que le quedan y una que no informa
 * créditos recibe todo lo que falte. Es una **estimación** (el servidor decide y vuelve a revisar): sirve para avisar antes de enviar.
 */
export function repartoPrevisto(personas: number, lista: readonly (Enviable & Pick<CredencialCorreo, 'proveedor'>)[], credencialDelEventoId: number | null = null): RepartoPrevisto {
  const activas = ordenarCredencialesCorreo(lista).filter((credencial) => credencial.activo && !sinCreditos(credencial))
  const propia = credencialDelEventoId === null ? undefined : activas.find((credencial) => credencial.id === credencialDelEventoId)
  const cadena = propia ? [propia, ...activas.filter((credencial) => credencial.id !== propia.id)] : activas
  const reparto: TramoDeReparto[] = []
  let faltan = Math.max(0, personas)
  for (const credencial of cadena) {
    if (faltan <= 0) break
    const limite = credencial.proveedor === 'BREVO' && typeof credencial.creditosDisponibles === 'number' ? credencial.creditosDisponibles : null
    if (limite === null) {
      reparto.push({ id: credencial.id, nombre: credencial.nombre, envios: faltan, sinLimite: true })
      faltan = 0
      break
    }
    const usa = Math.min(faltan, limite)
    if (usa > 0) {
      reparto.push({ id: credencial.id, nombre: credencial.nombre, envios: usa, sinLimite: false })
      faltan -= usa
    }
  }
  return { reparto, sinCubrir: faltan }
}

/** Frase del reparto («320 correos: 295 por ANGEL y 25 por LORENA») y su tono; alerta si no alcanza. `null` sin personas. */
export function textoReparto(personas: number, previsto: RepartoPrevisto): { tono: 'info' | 'alerta', texto: string } | null {
  if (personas <= 0) return null
  const { reparto, sinCubrir } = previsto
  if (!reparto.length) return { tono: 'alerta', texto: 'Ninguna credencial de correo activa tiene envíos disponibles: el envío se rechazará. Revisa los créditos en Correo.' }
  const partes = reparto.map((tramo) => `${numero(tramo.envios)} por ${tramo.nombre}${tramo.sinLimite ? ' (sin cupo conocido)' : ''}`)
  const unidas = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0]!
  if (sinCubrir > 0) {
    return {
      tono: 'alerta',
      texto: `Solo hay envíos para ${numero(personas - sinCubrir)} de ${numero(personas)} (${unidas}): ${sinCubrir === 1 ? 'el último quedaría' : `los últimos ${numero(sinCubrir)} quedarían`} sin enviar. Agrega otra credencial o espera a que se renueve el cupo.`,
    }
  }
  const quien = reparto.length === 1 ? `todos por ${reparto[0]!.nombre}${reparto[0]!.sinLimite ? ' (sin cupo conocido)' : ''}` : unidas
  return { tono: 'info', texto: `${numero(personas)} ${personas === 1 ? 'correo' : 'correos'}: ${quien}.` }
}

/** Aviso cuando hay una sola credencial activa: si se agota, no sale ningún correo. `null` en los demás casos. */
export function avisoSinRespaldo(lista: readonly Pick<CredencialCorreo, 'activo' | 'proveedor'>[]): string | null {
  const activas = lista.filter((credencial) => credencial.activo)
  if (activas.length !== 1) return null
  const limite = activas[0]!.proveedor === 'GMAIL_SMTP' ? 'Gmail permite unos 500 envíos al día (2000 en Google Workspace)' : 'el plan gratuito de Brevo da 300 envíos al día'
  return `Solo hay una credencial activa: ${limite} y, al agotarse, no saldrán correos. Agrega otra como respaldo y se usará sola cuando esta falle.`
}

/** Nombres cortos de los eventos que usan la credencial. */
export function eventosDeCredencial(credencial: Pick<CredencialCorreo, 'eventos'>): string {
  return credencial.eventos.map((evento) => evento.nombreCorto).join(', ')
}

export function formularioCredencialCorreo(credencial?: CredencialCorreo | null, esPrimera = false, proveedor: ProveedorCorreo = 'BREVO'): FormularioCredencialCorreo {
  return {
    proveedor: credencial?.proveedor ?? proveedor,
    nombre: credencial?.nombre ?? '',
    apiKey: '',
    remitenteCorreo: credencial?.remitenteCorreo ?? '',
    remitenteNombre: credencial?.remitenteNombre ?? '',
    esPredeterminada: credencial ? credencial.esPredeterminada : esPrimera,
    activo: credencial?.activo ?? true,
  }
}

/**
 * Validación en el navegador con las mismas reglas del backend (nombre 2–120, API key ≥ 10, contraseña de
 * aplicación de Gmail de 16 letras) y las mismas claves que `fields`, para dar los mensajes en español antes de enviar.
 */
export function validarCredencialCorreo(form: FormularioCredencialCorreo, original?: CredencialCorreo | null): Record<string, string> {
  const errores: Record<string, string> = {}
  const nombre = form.nombre.trim()
  const apiKey = form.apiKey.trim()
  if (!nombre) errores.nombre = 'Ingresa un nombre para reconocer la credencial.'
  else if (nombre.length < 2) errores.nombre = 'El nombre debe tener al menos 2 caracteres.'
  if (form.proveedor === 'GMAIL_SMTP') {
    if (!original && !apiKey) errores.apiKey = 'Pega la contraseña de aplicación de Google.'
    else if (apiKey && !esClaveAplicacionValida(apiKey)) errores.apiKey = 'La contraseña de aplicación tiene 16 letras (puedes pegarla con sus espacios).'
    else if (original && !apiKey && form.remitenteCorreo.trim() !== original.remitenteCorreo) errores.apiKey = 'Cambiaste la cuenta de Gmail: pega también su contraseña de aplicación.'
  } else if (!original && !apiKey) errores.apiKey = 'Pega la API key de Brevo.'
  else if (apiKey && apiKey.length < 10) errores.apiKey = 'La API key parece incompleta (mínimo 10 caracteres).'
  if (!form.remitenteCorreo.trim()) errores.remitenteCorreo = 'Ingresa el correo del remitente.'
  else if (!esCorreoValido(form.remitenteCorreo)) errores.remitenteCorreo = 'Ingresa un correo válido.'
  if (form.esPredeterminada && !form.activo && !original?.esPredeterminada) errores.activo = 'Una credencial predeterminada debe estar activa.'
  return errores
}

/** Aviso no bloqueante: Brevo tiene claves SMTP (`xsmtpsib-`) y de API (`xkeysib-`); se necesita la de API. */
export function avisoApiKeyBrevo(apiKey: string): string | null {
  return apiKey.trim().startsWith('xsmtpsib-')
    ? 'Parece una clave SMTP. Se necesita una clave de API de Brevo (empieza con xkeysib-).'
    : null
}

/**
 * Cuerpo para el backend. Alta: todos los campos (`esPredeterminada` solo si se marcó; la primera
 * credencial queda predeterminada de todas formas). Edición (PUT parcial): solo lo que cambió; la
 * API key solo si se escribió, `remitenteNombre` vacío se borra (`null`) y `esPredeterminada` solo
 * se envía como `true` (para quitarla se marca otra).
 */
export function cuerpoCredencialCorreo(form: FormularioCredencialCorreo, original?: CredencialCorreo | null): Record<string, unknown> {
  const nombre = form.nombre.trim()
  const apiKey = form.proveedor === 'GMAIL_SMTP' ? normalizarClaveAplicacion(form.apiKey) : form.apiKey.trim()
  const remitenteCorreo = form.remitenteCorreo.trim()
  const remitenteNombre = form.remitenteNombre.trim()

  if (!original) {
    return {
      // Solo Gmail lo envía: un backend anterior descartaría `proveedor` y guardaría la contraseña como API key de Brevo
      ...(form.proveedor === 'GMAIL_SMTP' ? { proveedor: form.proveedor } : {}),
      nombre,
      apiKey,
      remitenteCorreo,
      ...(remitenteNombre ? { remitenteNombre } : {}),
      ...(form.esPredeterminada ? { esPredeterminada: true } : {}),
      activo: form.activo,
    }
  }

  const cuerpo: Record<string, unknown> = {}
  if (nombre !== original.nombre) cuerpo.nombre = nombre
  if (apiKey) cuerpo.apiKey = apiKey
  if (remitenteCorreo !== original.remitenteCorreo) cuerpo.remitenteCorreo = remitenteCorreo
  if (remitenteNombre !== (original.remitenteNombre ?? '')) cuerpo.remitenteNombre = remitenteNombre || null
  if (form.activo !== original.activo) cuerpo.activo = form.activo
  if (form.esPredeterminada && !original.esPredeterminada) cuerpo.esPredeterminada = true
  return cuerpo
}

/** Texto de confirmación al eliminar. */
export function mensajeEliminarCredencial(credencial: CredencialCorreo): string {
  const secreto = credencial.proveedor === 'GMAIL_SMTP' ? 'La contraseña de aplicación guardada' : 'La API key guardada'
  const partes = [`¿Eliminar «${credencial.nombre}»? ${secreto} se descarta y no se puede deshacer.`]
  if (credencial.eventos.length) partes.push(`La usan: ${eventosDeCredencial(credencial)}; pasarán a usar la credencial predeterminada.`)
  if (credencial.esPredeterminada) partes.push('Es la predeterminada: otra credencial activa pasará a serlo.')
  return partes.join(' ')
}

/** Texto de confirmación al desactivar, o `null` si no afecta a ningún evento. */
export function mensajeDesactivarCredencial(credencial: CredencialCorreo): string | null {
  if (!credencial.eventos.length && !credencial.esPredeterminada) return null
  const partes = [`Mientras «${credencial.nombre}» esté inactiva no se usará para enviar correos.`]
  if (credencial.eventos.length) partes.push(`La usan: ${eventosDeCredencial(credencial)}.`)
  if (credencial.esPredeterminada) partes.push('Es la predeterminada: marca otra como predeterminada para los eventos que no eligen credencial.')
  return partes.join(' ')
}

// ─── Selector del formulario del evento ───

export interface OpcionCredencialCorreo { id: number, etiqueta: string }

/** `Brevo congreso · congreso@undc.edu.pe`. */
export function etiquetaCredencialCorreo(credencial: CredencialCorreoRef): string {
  if (!credencial.nombre) return `Credencial #${credencial.id}`
  return credencial.remitenteCorreo ? `${credencial.nombre} · ${credencial.remitenteCorreo}` : credencial.nombre
}

/**
 * Opciones del selector: credenciales activas y, si el evento tiene asignada una inactiva o que no
 * aparece en la lista, también esa (para no perder el valor sin que el usuario lo decida).
 */
export function opcionesCredencialEvento(credenciales: readonly CredencialCorreo[], actual: CredencialCorreoRef | null): OpcionCredencialCorreo[] {
  const opciones = ordenarCredencialesCorreo(credenciales.filter((credencial) => credencial.activo))
    .map((credencial) => ({ id: credencial.id, etiqueta: `${etiquetaCredencialCorreo(credencial)}${credencial.esPredeterminada ? ' (predeterminada)' : ''}` }))
  if (actual && !opciones.some((opcion) => opcion.id === actual.id)) {
    const registrada = credenciales.find((credencial) => credencial.id === actual.id)
    opciones.push({ id: actual.id, etiqueta: `${etiquetaCredencialCorreo(registrada ?? actual)} ${registrada ? '(inactiva)' : '(actual)'}` })
  }
  return opciones
}

/** Texto de la opción `null`: indica cuál es hoy la predeterminada. */
export function etiquetaUsarPredeterminada(credenciales: readonly CredencialCorreo[]): string {
  const predeterminada = credenciales.find((credencial) => credencial.esPredeterminada && credencial.activo)
  return predeterminada ? `Usar la predeterminada (${etiquetaCredencialCorreo(predeterminada)})` : 'Usar la predeterminada'
}

/** Credencial del evento en solo lectura (Admin). */
export function describirCredencialEvento(credencial: CredencialCorreoRef | null | undefined): string {
  return credencial ? etiquetaCredencialCorreo(credencial) : 'Usar la predeterminada'
}
