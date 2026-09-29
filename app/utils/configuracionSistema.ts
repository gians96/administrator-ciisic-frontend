import type { ConfiguracionSistema, PruebaUndcApi } from '~/types/api'
import type { ErrorApi } from '~/utils/errores'
import { fechaHoraLima, nombreCompleto, numero } from '~/utils/formato'

/** Mismas reglas que valida el backend. */
export const TIMEOUT_MINIMO_MS = 1000
export const TIMEOUT_MAXIMO_MS = 30000
const API_KEY_MINIMO = 10
const API_KEY_MAXIMO = 500
export const FORMATO_CLIENT_ID_GOOGLE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/
/** Tiempo de espera del backend cuando aún no hay configuración. */
const TIMEOUT_POR_DEFECTO_MS = 8000

/** Campos del PUT parcial de `settings`. */
export type CampoSistema = 'undcApiUrl' | 'undcApiKey' | 'undcApiTimeoutMs' | 'googleClientId' | 'urlPanel' | 'rutasLegacyActivas'
/** Cada tarjeta de la página guarda solo sus campos. */
export type TarjetaSistema = 'undc' | 'google' | 'panel' | 'legacy'

export const CAMPOS_POR_TARJETA: Readonly<Record<TarjetaSistema, readonly CampoSistema[]>> = {
  undc: ['undcApiUrl', 'undcApiKey', 'undcApiTimeoutMs'],
  google: ['googleClientId'],
  panel: ['urlPanel'],
  legacy: ['rutasLegacyActivas'],
}

/** Nombres legibles de las claves de `fields` (errores de validación del backend). */
export const ETIQUETAS_CAMPOS_SISTEMA: Readonly<Record<string, string>> = {
  undcApiUrl: 'URL de API_UNDC',
  undcApiKey: 'API key de API_UNDC',
  undcApiTimeoutMs: 'Tiempo de espera',
  googleClientId: 'Client ID de Google',
  urlPanel: 'URL del panel',
  rutasLegacyActivas: 'Rutas de la landing anterior',
}

export const AVISO_DESACTIVAR_LEGACY = 'La landing anterior dejará de poder inscribir: sus formularios de inscripción y contacto recibirán «ruta retirada» (410). '
  + 'Desactívalas cuando la landing de cada evento ya use la API del sitio con su token de acceso.'

export interface FormularioSistema {
  undcApiUrl: string
  /** Write-only: vacío = conservar la actual. */
  undcApiKey: string
  /** «Quitar key»: envía `undcApiKey: null`. */
  quitarUndcApiKey: boolean
  /** `v-model.number` deja `''` si el campo queda vacío. */
  undcApiTimeoutMs: number | string
  googleClientId: string
  urlPanel: string
  rutasLegacyActivas: boolean
}

const CAMPOS_FORMULARIO: Readonly<Record<TarjetaSistema, ReadonlyArray<keyof FormularioSistema>>> = {
  undc: ['undcApiUrl', 'undcApiKey', 'quitarUndcApiKey', 'undcApiTimeoutMs'],
  google: ['googleClientId'],
  panel: ['urlPanel'],
  legacy: ['rutasLegacyActivas'],
}

/** Formulario a partir del GET (la API key nunca se precarga). */
export function formularioSistema(config?: ConfiguracionSistema | null): FormularioSistema {
  return {
    undcApiUrl: config?.undcApi.url ?? '',
    undcApiKey: '',
    quitarUndcApiKey: false,
    undcApiTimeoutMs: config?.undcApi.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS,
    googleClientId: config?.google.clientId ?? '',
    urlPanel: config?.urlPanel ?? '',
    rutasLegacyActivas: config?.rutasLegacy.activas ?? true,
  }
}

/** Reinicia solo los campos de la tarjeta con los valores de `config` (los de las otras tarjetas se conservan). */
export function reiniciarTarjeta(form: FormularioSistema, config: ConfiguracionSistema, tarjeta: TarjetaSistema): void {
  const nuevo = formularioSistema(config)
  Object.assign(form, Object.fromEntries(CAMPOS_FORMULARIO[tarjeta].map((campo) => [campo, nuevo[campo]])))
}

// ─── Validación ───

function esHostLocal(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

/** Origen (`https://host:puerto`) de una URL, o `null` si no es una URL http(s) válida. */
export function origenDe(valor: string | null | undefined): string | null {
  const texto = valor?.trim()
  if (!texto) return null
  try {
    const url = new URL(texto)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

/** Error de una URL con las reglas del backend (https; http solo hacia localhost), o `null`. Vacía es válida: se borra. */
export function errorUrl(valor: string): string | null {
  const texto = valor.trim()
  if (!texto) return null
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return 'Ingresa la URL completa, con https:// al inicio.'
  }
  if (url.username || url.password) return 'La URL no debe incluir usuario ni contraseña.'
  if (url.protocol === 'https:') return null
  if (url.protocol === 'http:' && esHostLocal(url.hostname.replace(/^\[|\]$/g, '').toLowerCase())) return null
  return 'Usa https (http solo se permite para localhost).'
}

export function errorTimeout(valor: number | string): string | null {
  const texto = String(valor).trim()
  const ms = Number(texto)
  if (!texto || !Number.isInteger(ms) || ms < TIMEOUT_MINIMO_MS || ms > TIMEOUT_MAXIMO_MS) {
    return `Ingresa un número entero entre ${TIMEOUT_MINIMO_MS} y ${TIMEOUT_MAXIMO_MS} ms (1 a 30 segundos).`
  }
  return null
}

export function errorClientIdGoogle(valor: string): string | null {
  const texto = valor.trim()
  if (!texto || FORMATO_CLIENT_ID_GOOGLE.test(texto)) return null
  return 'El client ID tiene la forma 123456789012-abc123….apps.googleusercontent.com (Google Cloud → Credenciales).'
}

/** Validación en el navegador con las claves de `fields` del backend (mensajes en español antes de enviar). */
export function validarSistema(form: FormularioSistema): Record<string, string> {
  const errores: Record<string, string> = {}
  const url = errorUrl(form.undcApiUrl)
  if (url) errores.undcApiUrl = url
  const apiKey = form.undcApiKey.trim()
  if (!form.quitarUndcApiKey && apiKey) {
    if (apiKey.length < API_KEY_MINIMO) errores.undcApiKey = `La API key parece incompleta (mínimo ${API_KEY_MINIMO} caracteres).`
    else if (apiKey.length > API_KEY_MAXIMO) errores.undcApiKey = `La API key no puede superar ${API_KEY_MAXIMO} caracteres.`
  }
  const timeout = errorTimeout(form.undcApiTimeoutMs)
  if (timeout) errores.undcApiTimeoutMs = timeout
  const clientId = errorClientIdGoogle(form.googleClientId)
  if (clientId) errores.googleClientId = clientId
  const urlPanel = errorUrl(form.urlPanel)
  if (urlPanel) errores.urlPanel = urlPanel
  return errores
}

/** Errores de validación que corresponden a la tarjeta. */
export function erroresDeTarjeta(errores: Readonly<Record<string, string>>, tarjeta: TarjetaSistema): Record<string, string> {
  return Object.fromEntries(Object.entries(errores).filter(([campo]) => (CAMPOS_POR_TARJETA[tarjeta] as readonly string[]).includes(campo)))
}

/**
 * Errores de campo tras un PUT fallido: `fields` del backend o, para `INVALID_URL` y `HOST_NOT_ALLOWED`
 * (que no traen `fields`), el mensaje junto a la URL de la tarjeta.
 */
export function erroresDeGuardado(error: Pick<ErrorApi, 'code' | 'message' | 'fields'>, tarjeta: TarjetaSistema): Record<string, string> {
  if (error.fields && Object.keys(error.fields).length) return { ...error.fields }
  const campoUrl = tarjeta === 'undc' ? 'undcApiUrl' : tarjeta === 'panel' ? 'urlPanel' : null
  if (campoUrl && (error.code === 'INVALID_URL' || error.code === 'HOST_NOT_ALLOWED')) return { [campoUrl]: error.message }
  return {}
}

// ─── Cuerpo del PUT (parcial) ───

function sinBarraFinal(valor: string): string {
  return valor.replace(/\/+$/, '')
}

/**
 * PUT parcial: solo lo que cambió respecto del GET. Textos vacíos se envían como `null` (borrar). La API
 * key es write-only: se envía solo si se escribió una nueva, o `null` con «Quitar key».
 */
export function cuerpoSistema(form: FormularioSistema, original: ConfiguracionSistema): Partial<Record<CampoSistema, unknown>> {
  const cuerpo: Partial<Record<CampoSistema, unknown>> = {}
  const url = form.undcApiUrl.trim()
  if (sinBarraFinal(url) !== sinBarraFinal(original.undcApi.url ?? '')) cuerpo.undcApiUrl = url || null
  const apiKey = form.undcApiKey.trim()
  if (form.quitarUndcApiKey) {
    if (original.undcApi.apiKeyEnmascarada) cuerpo.undcApiKey = null
  } else if (apiKey) {
    cuerpo.undcApiKey = apiKey
  }
  const timeout = Number(String(form.undcApiTimeoutMs).trim())
  if (timeout !== original.undcApi.timeoutMs) cuerpo.undcApiTimeoutMs = timeout
  const clientId = form.googleClientId.trim()
  if (clientId !== (original.google.clientId ?? '')) cuerpo.googleClientId = clientId || null
  const urlPanel = form.urlPanel.trim()
  if (sinBarraFinal(urlPanel) !== sinBarraFinal(original.urlPanel ?? '')) cuerpo.urlPanel = urlPanel || null
  if (form.rutasLegacyActivas !== original.rutasLegacy.activas) cuerpo.rutasLegacyActivas = form.rutasLegacyActivas
  return cuerpo
}

/** Cuerpo del PUT con solo los campos de la tarjeta. */
export function cuerpoDeTarjeta(form: FormularioSistema, original: ConfiguracionSistema, tarjeta: TarjetaSistema): Partial<Record<CampoSistema, unknown>> {
  const cuerpo = cuerpoSistema(form, original)
  return Object.fromEntries(CAMPOS_POR_TARJETA[tarjeta].filter((campo) => campo in cuerpo).map((campo) => [campo, cuerpo[campo]]))
}

export function hayCambiosEnTarjeta(form: FormularioSistema, original: ConfiguracionSistema, tarjeta: TarjetaSistema): boolean {
  return Object.keys(cuerpoDeTarjeta(form, original, tarjeta)).length > 0
}

/** Confirmación para cambios que dejan sin servicio a alguien, o `null` si no hace falta. */
export function confirmacionCambiosSistema(cuerpo: Partial<Record<CampoSistema, unknown>>): string | null {
  const avisos: string[] = []
  if (cuerpo.undcApiUrl === null || cuerpo.undcApiKey === null) {
    avisos.push('Sin la URL o sin la API key de API_UNDC no se podrá verificar a los estudiantes UNDC al inscribirse.')
  }
  if (cuerpo.googleClientId === null) {
    avisos.push('Sin client ID nadie podrá entrar con Google (ni administradores ni inscritos) y la landing no podrá verificar correos con Google.')
  }
  if (cuerpo.rutasLegacyActivas === false) avisos.push(AVISO_DESACTIVAR_LEGACY)
  return avisos.length ? avisos.join(' ') : null
}

// ─── Presentación ───

/** Insignia de la conexión con API_UNDC. */
export function estadoUndcApi(undcApi: Pick<ConfiguracionSistema['undcApi'], 'configurada' | 'ultimoEstado'>): { texto: string, tono: 'ok' | 'error' | 'warn' | 'neutral' } {
  if (!undcApi.configurada) return { texto: 'Sin configurar', tono: 'warn' }
  if (undcApi.ultimoEstado === 'OK') return { texto: 'Conectada', tono: 'ok' }
  if (undcApi.ultimoEstado === 'ERROR') return { texto: 'Con error', tono: 'error' }
  return { texto: 'Sin probar', tono: 'neutral' }
}

export function codigoHttpPrueba(prueba: Pick<PruebaUndcApi, 'codigoHttp'>): string {
  return prueba.codigoHttp === null ? 'Sin respuesta' : String(prueba.codigoHttp)
}

export function latenciaPrueba(prueba: Pick<PruebaUndcApi, 'latenciaMs'>): string {
  return `${numero(Math.max(0, Math.round(prueba.latenciaMs)))} ms`
}

/**
 * «Orígenes autorizados de JavaScript» a registrar en el client ID de Google: el de este panel y el de la
 * URL del panel configurada (sin repetir). El de cada landing se agrega aparte.
 */
export function origenesAutorizados(origenActual: string | null | undefined, urlPanel: string | null | undefined): string[] {
  return [...new Set([origenDe(origenActual), origenDe(urlPanel)].filter((origen): origen is string => Boolean(origen)))]
}

/** Aviso si la URL del panel trae una ruta: el backend guarda solo el origen. */
export function avisoUrlPanel(valor: string): string | null {
  const texto = valor.trim()
  const origen = origenDe(texto)
  if (!origen || errorUrl(texto)) return null
  return sinBarraFinal(texto) === origen ? null : `Se guardará solo el origen: ${origen}`
}

/** «Actualizado por Ana Quispe el 29 set. 2026, 10:30 a. m.» */
export function describirActualizacion(config: Pick<ConfiguracionSistema, 'actualizadoPor' | 'actualizadoEn'>): string {
  const fecha = fechaHoraLima(config.actualizadoEn)
  return config.actualizadoPor ? `Actualizado por ${nombreCompleto(config.actualizadoPor)} el ${fecha}` : `Actualizado el ${fecha}`
}
