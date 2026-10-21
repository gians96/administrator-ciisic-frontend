import type { Respuesta } from '~/types/api'
import { mensajeConsultaDni, personaDeConsulta } from '~/utils/participantes'

export interface ResultadoDni {
  persona: { nombres: string, apellidos: string } | null
  /** Por qué no se completaron los nombres (vacío si se encontraron). */
  mensaje: string
}

/** Consulta de DNI (RENIEC) para completar nombres y apellidos; nunca lanza: devuelve el motivo. */
export function useDni() {
  const { api } = useApi()

  async function buscar(numero: string): Promise<ResultadoDni> {
    try {
      const respuesta = await api<Respuesta<unknown>>(`document-lookup/dni/${numero}`)
      const persona = personaDeConsulta(respuesta.data)
      return persona ? { persona, mensaje: '' } : { persona: null, mensaje: 'La consulta no devolvió nombres. Escríbelos.' }
    } catch (error) {
      return { persona: null, mensaje: mensajeConsultaDni(error) }
    }
  }

  return { buscar }
}
