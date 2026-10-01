import {
  cuerpoDeRespuesta,
  errorCancelado,
  errorDeConexion,
  errorDeSubida,
  esRespuestaExitosa,
  rutaBff,
} from '~/utils/subida'

export interface OpcionesSubida {
  /** `POST` (por defecto) o `PUT` (`/certificates/:id/signed`). */
  metodo?: 'POST' | 'PUT'
  /** Avance del envío del cuerpo: bytes enviados y total (el total incluye el armado del multipart). */
  alProgreso?: (enviados: number, total: number) => void
  /** Cancela la subida (rechaza con `AbortError`; ver `esCancelacion`). */
  senal?: AbortSignal
  /** No llevar al login ante un 401 (la pantalla lo maneja). */
  silenciar401?: boolean
}

/**
 * Subidas multipart del staff por XHR a `/api/backend/**` (el BFF agrega el JWT): a diferencia de
 * `$fetch`, informan el avance del envío y **nunca** se reintentan solas (una carga de firmados repetida
 * a ciegas competiría por el turno del backend; los reintentos los decide `useTandas`). El navegador
 * calcula el `Content-Length` del `FormData` (el backend lo exige) y agrega `Origin` (el BFF lo valida).
 * Responde el cuerpo JSON (`{ success, data }`) como `$fetch`; los errores tienen la forma de los de
 * `$fetch` y pasan por la misma reacción que `useApi` (401 → login; 403 → relee el acceso).
 */
export function useSubida() {
  const { reaccionar } = useApi()

  function enviar<T>(ruta: string, cuerpo: FormData, opciones: OpcionesSubida): Promise<T> {
    return new Promise<T>((resolver, rechazar) => {
      if (opciones.senal?.aborted) {
        rechazar(errorCancelado())
        return
      }
      const xhr = new XMLHttpRequest()
      const alCancelar = () => xhr.abort()
      const terminar = () => opciones.senal?.removeEventListener('abort', alCancelar)
      opciones.senal?.addEventListener('abort', alCancelar, { once: true })

      xhr.open(opciones.metodo ?? 'POST', rutaBff(ruta))
      xhr.responseType = 'text'
      xhr.setRequestHeader('Accept', 'application/json')
      if (opciones.alProgreso) {
        const alProgreso = opciones.alProgreso
        xhr.upload.addEventListener('progress', (evento) => {
          if (evento.lengthComputable) alProgreso(evento.loaded, evento.total)
        })
      }
      xhr.addEventListener('load', () => {
        terminar()
        const datos = cuerpoDeRespuesta(xhr.responseText)
        if (esRespuestaExitosa(xhr.status)) resolver(datos as T)
        else rechazar(errorDeSubida(xhr.status, datos, (nombre) => xhr.getResponseHeader(nombre)))
      })
      xhr.addEventListener('error', () => {
        terminar()
        rechazar(errorDeConexion())
      })
      xhr.addEventListener('abort', () => {
        terminar()
        rechazar(errorCancelado())
      })
      xhr.send(cuerpo)
    })
  }

  /** Sube `cuerpo` a la ruta del backend (`events/2/certificates/signed`) y devuelve su JSON. */
  async function subir<T>(ruta: string, cuerpo: FormData, opciones: OpcionesSubida = {}): Promise<T> {
    try {
      return await enviar<T>(ruta, cuerpo, opciones)
    } catch (error) {
      await reaccionar(error, opciones.silenciar401)
      throw error
    }
  }

  return { subir }
}
