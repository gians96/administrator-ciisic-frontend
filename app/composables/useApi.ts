import type { NitroFetchOptions } from 'nitropack'
import { aErrorApi } from '~/utils/errores'

type Opciones = NitroFetchOptions<string> & { silenciar401?: boolean }

/**
 * Cliente de la API administrativa. Todas las llamadas pasan por el BFF (`/api/backend/**`),
 * que agrega el JWT desde la cookie httpOnly. Si la sesión expiró, redirige al login.
 */
export function useApi() {
  async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
    try {
      return await $fetch<T>(`/api/backend/${ruta.replace(/^\/+/, '')}`, opciones as NitroFetchOptions<string>)
    } catch (error) {
      const e = aErrorApi(error)
      if (e.status === 401 && !opciones.silenciar401) {
        useAuthStore().limpiar()
        await navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } })
      }
      throw error
    }
  }

  /** URL del BFF para abrir archivos (voucher, credencial, CSV) en otra pestaña. */
  function urlArchivo(ruta: string): string {
    return `/api/backend/${ruta.replace(/^\/+/, '')}`
  }

  return { api, urlArchivo }
}
