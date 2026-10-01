import { defineStore } from 'pinia'
import type { AccesoPanel, Permiso, Sesion, TipoSesion } from '~/types/api'
import { codigoSolicitadoDe, normalizarCorreo, type CodigoSolicitado } from '~/utils/codigoAcceso'
import { aErrorApi } from '~/utils/errores'
import { accesoDeSesion, tienePermiso } from '~/utils/permisos'
import { pideCodigoParaPortal } from '~/utils/portal'
import { lecturaTrasError, leerSesion, type LecturaSesion } from '~/utils/sesion'

/** Intervalo mínimo entre dos lecturas del acceso (`refrescarAcceso`). */
const INTERVALO_REFRESCO_MS = 15_000

/** La respuesta no trae una sesión reconocible (no debería ocurrir con el BFF). */
function sesionDe(respuesta: unknown): Sesion {
  const sesion = leerSesion(respuesta)
  if (sesion) return sesion
  throw Object.assign(new Error('Respuesta de sesión inesperada'), {
    status: 502,
    data: { code: 'ERROR', message: 'El servidor respondió de forma inesperada. Intenta nuevamente.' },
  })
}

/**
 * Resultado de `irAlPortal`: ya se está en el portal, o hay que confirmar con un código al correo de la
 * cuenta (entró con contraseña: `CODE_REQUIRED`).
 */
export type ResultadoIrAlPortal = 'PORTAL' | 'CODIGO_REQUERIDO'

/**
 * Sesión del panel: staff (pantallas según sus permisos) o inscrito (portal «Mis inscripciones»).
 * Menús, páginas y botones se deciden con `puede(permiso)`, nunca con el código del rol.
 */
export const useAuthStore = defineStore('auth', () => {
  const sesion = ref<Sesion | null>(null)
  const verificado = ref(false)
  /**
   * La última lectura de la sesión falló sin que el backend respondiera (503 o red): no se sabe si
   * sigue abierta. La primera lectura queda sin verificar y se reintenta en la siguiente navegación.
   */
  const noDisponible = ref(false)

  const tipo = computed<TipoSesion | null>(() => sesion.value?.tipo ?? null)
  const usuario = computed(() => (sesion.value?.tipo === 'ADMIN' ? sesion.value.usuario : null))
  const participante = computed(() => (sesion.value?.tipo === 'PARTICIPANTE' ? sesion.value.participante : null))
  const esParticipante = computed(() => tipo.value === 'PARTICIPANTE')
  /** Acceso del staff (sin sesión de staff: sin permisos). */
  const acceso = computed<AccesoPanel>(() => accesoDeSesion(usuario.value))

  /** La cuenta tiene el permiso (o alguno de la lista). */
  function puede(permiso: Permiso | readonly Permiso[]): boolean {
    return tienePermiso(acceso.value, permiso)
  }

  let ultimaLectura = 0
  let lecturaEnCurso: Promise<LecturaSesion> | null = null

  function establecer(nueva: Sesion | null) {
    const anterior = usuario.value?.id ?? null
    sesion.value = nueva
    verificado.value = true
    noDisponible.value = false
    // Otra cuenta (o ninguna) en la misma pestaña: los eventos y el evento elegido eran de la anterior
    if ((usuario.value?.id ?? null) !== anterior) useEventoStore().limpiar()
  }

  /** Lee la sesión del BFF. Solo un cierre confirmado la borra; si el backend no responde, se conserva. */
  async function leer(): Promise<LecturaSesion> {
    ultimaLectura = Date.now()
    try {
      establecer(leerSesion(await $fetch('/api/auth/session')))
      return sesion.value ? 'VIGENTE' : 'CERRADA'
    } catch (error) {
      const lectura = lecturaTrasError(error)
      if (lectura === 'CERRADA') establecer(null)
      else noDisponible.value = true
      return lectura
    }
  }

  /** Primera lectura de la sesión (middleware). */
  function cargarSesion(): Promise<LecturaSesion> {
    return leer()
  }

  /**
   * Vuelve a leer la sesión para conocer los permisos y eventos actuales (p. ej. tras un 403), como
   * máximo una vez cada 15 s. Si el BFF responde que no hay sesión, se cierra (`CERRADA`); si falla por
   * otra causa (backend caído: 503), se conserva la sesión actual (`NO_DISPONIBLE`). `forzar` (acción
   * explícita de la persona o un 403 de un permiso concreto) omite el intervalo.
   */
  async function refrescarAcceso(forzar = false): Promise<LecturaSesion> {
    if (lecturaEnCurso) return lecturaEnCurso
    if (!forzar && Date.now() - ultimaLectura < INTERVALO_REFRESCO_MS) {
      if (!sesion.value) return 'CERRADA'
      return noDisponible.value ? 'NO_DISPONIBLE' : 'VIGENTE'
    }
    lecturaEnCurso = leer().finally(() => { lecturaEnCurso = null })
    return lecturaEnCurso
  }

  async function login(correo: string, contrasena: string): Promise<TipoSesion> {
    const nueva = sesionDe(await $fetch('/api/auth/login', { method: 'POST', body: { correo, contrasena } }))
    establecer(nueva)
    ultimaLectura = Date.now()
    return nueva.tipo
  }

  /** Canjea la credencial (ID token) de Google por la sesión; devuelve el perfil con el que se entró. */
  async function loginGoogle(credential: string): Promise<TipoSesion> {
    const nueva = sesionDe(await $fetch('/api/auth/google', { method: 'POST', body: { credential } }))
    establecer(nueva)
    ultimaLectura = Date.now()
    return nueva.tipo
  }

  /**
   * Pide un código de acceso al portal para `correo` (spec 014). La respuesta es la misma exista o no
   * el correo; los errores (`CODE_COOLDOWN`, `RATE_LIMITED`, `CODE_LOGIN_UNAVAILABLE`…) se relanzan.
   */
  async function solicitarCodigo(correo: string): Promise<CodigoSolicitado> {
    return codigoSolicitadoDe(await $fetch('/api/auth/codigo', { method: 'POST', body: { correo: normalizarCorreo(correo) } }))
  }

  /** Canjea el código del correo por la sesión del portal (siempre de participante, 12 h). */
  async function verificarCodigo(correo: string, codigo: string): Promise<TipoSesion> {
    const nueva = sesionDe(await $fetch('/api/auth/codigo/verificar', { method: 'POST', body: { correo: normalizarCorreo(correo), codigo } }))
    establecer(nueva)
    ultimaLectura = Date.now()
    return nueva.tipo
  }

  /**
   * El staff pasa a su portal de participante (`acceso.perfilParticipante`). Si entró con contraseña (o
   * su inscripción tiene otra cuenta de Google) devuelve `CODIGO_REQUERIDO`: la pantalla pide el código
   * al correo de la cuenta (`solicitarCodigo` + `verificarCodigo`). Un 401 cierra la sesión; los demás
   * errores se relanzan (`mensajeCambioAPortal`).
   */
  async function irAlPortal(): Promise<ResultadoIrAlPortal> {
    try {
      const nueva = sesionDe(await $fetch('/api/auth/portal', { method: 'POST' }))
      establecer(nueva)
      ultimaLectura = Date.now()
      return 'PORTAL'
    } catch (error) {
      if (pideCodigoParaPortal(error)) return 'CODIGO_REQUERIDO'
      if (aErrorApi(error).status === 401) establecer(null)
      throw error
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    limpiar()
  }

  function limpiar() {
    establecer(null)
  }

  return {
    sesion, verificado, noDisponible, tipo, usuario, participante, esParticipante, acceso, puede,
    cargarSesion, refrescarAcceso, login, loginGoogle, solicitarCodigo, verificarCodigo, irAlPortal, logout, limpiar,
  }
})
