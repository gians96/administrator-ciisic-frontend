import type { NitroFetchOptions } from 'nitropack'
import { guardarArchivo, leerCuerpoDeError, nombreDeArchivo } from '~/utils/descargas'
import { aErrorApi } from '~/utils/errores'
import { reaccionAError, redireccionPara, rutaLoginTrasCierre } from '~/utils/sesion'

type Opciones = NitroFetchOptions<string> & { silenciar401?: boolean }

/** Evita reacciones anidadas (la recarga de eventos también usa `api`). */
let reaccionEnCurso: Promise<void> | null = null

/**
 * Relee el acceso y, si la página actual ya no está permitida, lleva a la que corresponda; si la
 * sesión se cerró, al login. Si el backend no responde, se conserva todo como está.
 * - Tras un 403 `FORBIDDEN`/`EVENT_NOT_ASSIGNED`: como máximo cada 15 s y recargando los eventos.
 * - `forzar`: tras un 403 de un permiso concreto (`releerAcceso`), sin esperar el intervalo.
 */
async function reaccionarAccesoCambiado(forzar: boolean, recargarEventos: boolean): Promise<void> {
  const auth = useAuthStore()
  const router = useRouter()
  const lectura = await auth.refrescarAcceso(forzar)
  if (lectura === 'CERRADA') {
    await navigateTo(rutaLoginTrasCierre('', router.currentRoute.value.fullPath))
    return
  }
  if (lectura === 'NO_DISPONIBLE') return
  if (recargarEventos) await useEventoStore().recargar().catch(() => undefined)
  const ruta = router.currentRoute.value
  if (!auth.tipo) return
  const destino = redireccionPara(auth.tipo, ruta.meta, auth.acceso, ruta.path)
  if (destino && destino !== ruta.path) await navigateTo(destino)
}

function iniciarReaccion(forzar: boolean, recargarEventos: boolean): Promise<void> {
  reaccionEnCurso = reaccionarAccesoCambiado(forzar, recargarEventos).catch(() => undefined).finally(() => { reaccionEnCurso = null })
  return reaccionEnCurso
}

/**
 * Cliente de la API administrativa. Todas las llamadas pasan por el BFF (`/api/backend/**`),
 * que agrega el JWT desde la cookie httpOnly. Si la sesión expiró o se invalidó (401), va al login
 * explicando el motivo; si el backend niega el permiso o el evento (403 `FORBIDDEN`,
 * `EVENT_NOT_ASSIGNED`), relee el acceso y sale de la página si ya no está permitida. En todos los
 * casos el error se relanza para que la pantalla lo muestre.
 */
export function useApi() {
  /** Reacciona al error de una llamada (login, releer acceso); quien llama lo relanza para mostrarlo. */
  async function alFallar(error: unknown, silenciar401?: boolean): Promise<void> {
    const e = aErrorApi(error)
    const reaccion = reaccionAError(e, silenciar401)
    if (reaccion === 'LOGIN') {
      useAuthStore().limpiar()
      await navigateTo(rutaLoginTrasCierre(e.code, useRouter().currentRoute.value.fullPath))
    } else if (reaccion === 'RELEER_ACCESO' && !reaccionEnCurso) {
      await iniciarReaccion(false, true)
    }
  }

  async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
    try {
      return await $fetch<T>(`/api/backend/${ruta.replace(/^\/+/, '')}`, opciones as NitroFetchOptions<string>)
    } catch (error) {
      await alFallar(error, opciones.silenciar401)
      throw error
    }
  }

  /**
   * Descarga un archivo del backend (Excel, PDF) y lo entrega al navegador con el nombre que envía el
   * servidor (`respaldo` si no trae uno). Se hace con `$fetch` en blob y no con un enlace directo para que un
   * error (sin padrón, sesión vencida, límite de descargas) se muestre con su mensaje y no como el JSON del
   * backend en otra pestaña.
   */
  async function descargar(ruta: string, respaldo: string): Promise<void> {
    const { archivo, cabeceras } = await pedirArchivo(ruta)
    guardarArchivo(archivo, nombreDeArchivo(cabeceras.get('content-disposition'), respaldo))
  }

  /** Pide un archivo en blob; un error se relee (su JSON llega como `Blob`) y reacciona como cualquier llamada. */
  async function pedirArchivo(ruta: string): Promise<{ archivo: Blob, cabeceras: Headers }> {
    const respuesta = await $fetch.raw<Blob>(`/api/backend/${ruta.replace(/^\/+/, '')}`, { responseType: 'blob', retry: 0 }).catch(async (error: unknown) => {
      await leerCuerpoDeError(error)
      await alFallar(error)
      throw error
    })
    const archivo: unknown = respuesta._data
    if (!(archivo instanceof Blob)) throw Object.assign(new Error('Respuesta sin archivo'), { status: 502 })
    return { archivo, cabeceras: respuesta.headers }
  }

  /**
   * Lee un archivo del backend (voucher) para mostrarlo en pantalla sin guardarlo ni abrir otra pestaña. Con
   * `$fetch` y no con `<img src>` para conocer su tipo real y mostrar el mensaje de un error (`VOUCHER_NOT_FOUND`).
   */
  async function leerArchivo(ruta: string): Promise<Blob> {
    return (await pedirArchivo(ruta)).archivo
  }

  /**
   * Tras un 403 de negocio que indica que se le quitó un permiso concreto (`STATUS_NOT_ALLOWED`,
   * `OUT_OF_HOURS_NOT_ALLOWED`): relee el acceso ya (sin el intervalo de 15 s) para ocultar la acción;
   * si la sesión se cerró, va al login.
   */
  function releerAcceso(): Promise<void> {
    return reaccionEnCurso ?? iniciarReaccion(true, false)
  }

  /** URL del BFF para abrir archivos (voucher, credencial, CSV) en otra pestaña. */
  function urlArchivo(ruta: string): string {
    return `/api/backend/${ruta.replace(/^\/+/, '')}`
  }

  return { api, descargar, leerArchivo, urlArchivo, releerAcceso }
}
