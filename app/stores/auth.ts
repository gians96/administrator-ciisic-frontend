import { defineStore } from 'pinia'
import type { Usuario } from '~/types/api'

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<Usuario | null>(null)
  const verificado = ref(false)

  const esSuperAdmin = computed(() => usuario.value?.rolCodigo === 'SUPERADMIN')

  async function cargarSesion(): Promise<boolean> {
    try {
      const sesion = await $fetch<{ authenticated: boolean, user: Usuario | null }>('/api/auth/session')
      usuario.value = sesion.authenticated ? sesion.user : null
    } catch {
      usuario.value = null
    } finally {
      verificado.value = true
    }
    return Boolean(usuario.value)
  }

  async function login(correo: string, contrasena: string) {
    const respuesta = await $fetch<{ usuario: Usuario }>('/api/auth/login', { method: 'POST', body: { correo, contrasena } })
    usuario.value = respuesta.usuario
    verificado.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    limpiar()
  }

  function limpiar() {
    usuario.value = null
    verificado.value = true
  }

  return { usuario, verificado, esSuperAdmin, cargarSesion, login, logout, limpiar }
})
