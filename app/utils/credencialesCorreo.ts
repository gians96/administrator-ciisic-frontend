import type { CredencialCorreo, PlanBrevo } from '~/types/api'
import { numero } from '~/utils/formato'

/** Credencial tal como la referencia un evento (`credencialCorreo` del detalle). */
export interface CredencialCorreoRef { id: number, nombre?: string, remitenteCorreo?: string }

export interface FormularioCredencialCorreo {
  nombre: string
  apiKey: string
  remitenteCorreo: string
  remitenteNombre: string
  esPredeterminada: boolean
  activo: boolean
}

/** Nombres legibles de las claves de `fields` (errores de validación del backend). */
export const ETIQUETAS_CAMPOS_CREDENCIAL: Readonly<Record<string, string>> = {
  nombre: 'Nombre',
  apiKey: 'API key',
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

/** `{ tipo: 'free', creditos: 300, tipoCreditos: 'sendLimit' }` → `Gratuito: 300 envíos disponibles`. */
export function describirPlanBrevo(plan: PlanBrevo): string {
  const tipo = TIPOS_PLAN_BREVO[plan.tipo] ?? plan.tipo
  const unidad = TIPOS_CREDITO_BREVO[plan.tipoCreditos] ?? (plan.tipoCreditos ? `créditos (${plan.tipoCreditos})` : 'créditos')
  return `${tipo}: ${numero(plan.creditos)} ${unidad}`
}

/** Predeterminada primero, luego las activas y por nombre. */
export function ordenarCredencialesCorreo<T extends Pick<CredencialCorreo, 'esPredeterminada' | 'activo' | 'nombre'>>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) =>
    Number(b.esPredeterminada) - Number(a.esPredeterminada)
    || Number(b.activo) - Number(a.activo)
    || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Nombres cortos de los eventos que usan la credencial. */
export function eventosDeCredencial(credencial: Pick<CredencialCorreo, 'eventos'>): string {
  return credencial.eventos.map((evento) => evento.nombreCorto).join(', ')
}

export function formularioCredencialCorreo(credencial?: CredencialCorreo | null, esPrimera = false): FormularioCredencialCorreo {
  return {
    nombre: credencial?.nombre ?? '',
    apiKey: '',
    remitenteCorreo: credencial?.remitenteCorreo ?? '',
    remitenteNombre: credencial?.remitenteNombre ?? '',
    esPredeterminada: credencial ? credencial.esPredeterminada : esPrimera,
    activo: credencial?.activo ?? true,
  }
}

/** Validación en el navegador (el backend vuelve a validar). Usa las mismas claves que `fields`. */
export function validarCredencialCorreo(form: FormularioCredencialCorreo, original?: CredencialCorreo | null): Record<string, string> {
  const errores: Record<string, string> = {}
  if (!form.nombre.trim()) errores.nombre = 'Ingresa un nombre para reconocer la credencial.'
  if (!original && !form.apiKey.trim()) errores.apiKey = 'Pega la API key de Brevo.'
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
  const apiKey = form.apiKey.trim()
  const remitenteCorreo = form.remitenteCorreo.trim()
  const remitenteNombre = form.remitenteNombre.trim()

  if (!original) {
    return {
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
  const partes = [`¿Eliminar «${credencial.nombre}»? La API key guardada se descarta y no se puede deshacer.`]
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
