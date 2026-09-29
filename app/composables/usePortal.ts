import type { NitroFetchOptions } from 'nitropack'
import { aErrorApi } from '~/utils/errores'

/**
 * Cliente del portal del inscrito. Las llamadas pasan por el BFF (`/api/portal/**` →
 * `/api/v1/me/**`), que agrega el JWT de la cookie httpOnly. Si la sesión ya no vale, vuelve al login.
 */
export function usePortal() {
  async function portal<T>(ruta: string, opciones: NitroFetchOptions<string> = {}): Promise<T> {
    try {
      return await $fetch<T>(`/api/portal/${ruta.replace(/^\/+/, '')}`, opciones)
    } catch (error) {
      const e = aErrorApi(error)
      if (e.status === 401) {
        useAuthStore().limpiar()
        await navigateTo({ path: '/login', query: e.code === 'SESSION_INVALIDATED' ? { motivo: e.code } : {} })
      }
      throw error
    }
  }

  /** URL del BFF para descargar un archivo del portal (credencial PDF). */
  function urlPortal(ruta: string): string {
    return `/api/portal/${ruta.replace(/^\/+/, '')}`
  }

  return { portal, urlPortal }
}
