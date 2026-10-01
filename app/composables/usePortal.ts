import type { NitroFetchOptions } from 'nitropack'
import { leerCuerpoDeError, nombreDeArchivo } from '~/utils/descargas'
import { aErrorApi } from '~/utils/errores'
import { datosDeImagen } from '~/utils/fotocheck'
import { reaccionPortalAError, redireccionPara, rutaLoginTrasCierre } from '~/utils/sesion'

/**
 * Cliente del portal del inscrito. Las llamadas pasan por el BFF (`/api/portal/**` →
 * `/api/v1/me/**`), que agrega el JWT de la cookie httpOnly. Si la sesión ya no vale (vence a las 12 h
 * y no se renueva), vuelve al login explicando el motivo y con `redirect` a la página actual; si la
 * cookie ya no es de participante (403 `FORBIDDEN_PROFILE`), relee la sesión y va a donde corresponda.
 * Las secciones que el backend aún no tiene responden 404/405: `esNoDisponible` (`app/utils/portal.ts`).
 */
export function usePortal() {
  /** Reacción común a los errores del portal; el error se relanza siempre. */
  async function reaccionar(error: unknown): Promise<void> {
    // Con `responseType: 'blob'` el cuerpo del error también es un Blob: se lee para conocer su `code`
    await leerCuerpoDeError(error)
    const e = aErrorApi(error)
    const reaccion = reaccionPortalAError(e)
    if (reaccion === 'LOGIN') {
      useAuthStore().limpiar()
      await navigateTo(rutaLoginTrasCierre(e.code, useRouter().currentRoute.value.fullPath))
    } else if (reaccion === 'RELEER_SESION') {
      const auth = useAuthStore()
      const ruta = useRouter().currentRoute.value
      const lectura = await auth.refrescarAcceso(true)
      if (lectura === 'CERRADA') {
        await navigateTo(rutaLoginTrasCierre('', ruta.fullPath))
      } else if (lectura === 'VIGENTE' && auth.tipo) {
        const destino = redireccionPara(auth.tipo, ruta.meta, auth.acceso, ruta.path)
        if (destino && destino !== ruta.path) await navigateTo(destino)
      }
    }
  }

  async function portal<T>(ruta: string, opciones: NitroFetchOptions<string> = {}): Promise<T> {
    try {
      return await $fetch<T>(urlPortal(ruta), opciones)
    } catch (error) {
      await reaccionar(error)
      throw error
    }
  }

  /** URL del BFF de una ruta del portal; `''` es el perfil (`/me`). */
  function urlPortal(ruta: string): string {
    const relativa = ruta.replace(/^\/+/, '')
    return relativa ? `/api/portal/${relativa}` : '/api/portal'
  }

  /**
   * Descarga un archivo del portal (la credencial PDF) con el nombre que envía el backend. Los errores
   * (`503 PDF_BUSY`, `409 NOT_APPROVED`, la sesión vencida…) se relanzan con su `code` para mostrarlos;
   * un 401 ya lleva al login.
   */
  async function descargar(ruta: string, respaldo: string): Promise<void> {
    // Sin el reintento inmediato de ofetch (503/409/429): el de `PDF_BUSY` lo decide quien descarga
    const respuesta = await $fetch.raw<Blob>(urlPortal(ruta), { responseType: 'blob', retry: 0 }).catch(async (error: unknown) => {
      await reaccionar(error)
      throw error
    })
    const archivo: unknown = respuesta._data
    if (!(archivo instanceof Blob)) throw Object.assign(new Error('Respuesta sin archivo'), { status: 502 })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(archivo)
    enlace.download = nombreDeArchivo(respuesta.headers.get('content-disposition'), respaldo)
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    // Safari necesita que la URL siga viva un momento después del clic
    setTimeout(() => URL.revokeObjectURL(enlace.href), 30_000)
  }

  /**
   * Foto del participante (`GET /me/photo`) en `data:`, para mostrarla y guardarla con el fotocheck. Sin
   * foto (404 `PHOTO_NOT_FOUND`, o la ruta en un backend anterior) devuelve `null`; los demás errores se
   * relanzan.
   */
  async function fotoEnDatos(): Promise<string | null> {
    try {
      const foto = await portal<Blob>('photo', { responseType: 'blob' })
      return datosDeImagen(new Uint8Array(await foto.arrayBuffer()), foto.type)
    } catch (error) {
      if (aErrorApi(error).status === 404) return null
      throw error
    }
  }

  return { portal, urlPortal, descargar, fotoEnDatos }
}
