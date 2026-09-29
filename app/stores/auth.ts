import { defineStore } from 'pinia'
import type { Sesion, TipoSesion } from '~/types/api'
import { leerSesion } from '~/utils/sesion'

/** La respuesta no trae una sesión reconocible (no debería ocurrir con el BFF). */
function sesionDe(respuesta: unknown): Sesion {
  const sesion = leerSesion(respuesta)
  if (sesion) return sesion
  throw Object.assign(new Error('Respuesta de sesión inesperada'), {
    status: 502,
    data: { code: 'ERROR', message: 'El servidor respondió de forma inesperada. Intenta nuevamente.' },
  })
}

/** Sesión del panel: administrador (panel completo) o inscrito (portal «Mis inscripciones»). */
export const useAuthStore = defineStore('auth', () => {
  const sesion = ref<Sesion | null>(null)
  const verificado = ref(false)

  const tipo = computed<TipoSesion | null>(() => sesion.value?.tipo ?? null)
  const usuario = computed(() => (sesion.value?.tipo === 'ADMIN' ? sesion.value.usuario : null))
  const participante = computed(() => (sesion.value?.tipo === 'PARTICIPANTE' ? sesion.value.participante : null))
  const esSuperAdmin = computed(() => usuario.value?.rolCodigo === 'SUPERADMIN')
  const esParticipante = computed(() => tipo.value === 'PARTICIPANTE')

  function establecer(nueva: Sesion | null) {
    sesion.value = nueva
    verificado.value = true
  }

  async function cargarSesion(): Promise<boolean> {
    try {
      establecer(leerSesion(await $fetch('/api/auth/session')))
    } catch {
      establecer(null)
    }
    return Boolean(sesion.value)
  }

  async function login(correo: string, contrasena: string): Promise<TipoSesion> {
    const nueva = sesionDe(await $fetch('/api/auth/login', { method: 'POST', body: { correo, contrasena } }))
    establecer(nueva)
    return nueva.tipo
  }

  /** Canjea la credencial (ID token) de Google por la sesión; devuelve el perfil con el que se entró. */
  async function loginGoogle(credential: string): Promise<TipoSesion> {
    const nueva = sesionDe(await $fetch('/api/auth/google', { method: 'POST', body: { credential } }))
    establecer(nueva)
    return nueva.tipo
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    limpiar()
  }

  function limpiar() {
    establecer(null)
  }

  return { sesion, verificado, tipo, usuario, participante, esSuperAdmin, esParticipante, cargarSesion, login, loginGoogle, logout, limpiar }
})
