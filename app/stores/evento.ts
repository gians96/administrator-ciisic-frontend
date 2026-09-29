import { defineStore } from 'pinia'
import type { Evento, Respuesta } from '~/types/api'

const CLAVE = 'panel_evento_seleccionado'

function leerGuardado(): number | null {
  try {
    const valor = Number(localStorage.getItem(CLAVE))
    return Number.isSafeInteger(valor) && valor > 0 ? valor : null
  } catch {
    return null
  }
}

/** Eventos disponibles y el evento sobre el que trabaja el panel (persistido por navegador). */
export const useEventoStore = defineStore('evento', () => {
  const eventos = ref<Evento[]>([])
  const seleccionadoId = ref<number | null>(null)
  const cargando = ref(false)
  const cargado = ref(false)

  const seleccionado = computed(() => eventos.value.find((evento) => evento.id === seleccionadoId.value) ?? null)

  async function cargar(forzar = false) {
    if (cargado.value && !forzar) return
    cargando.value = true
    try {
      const { api } = useApi()
      const respuesta = await api<Respuesta<Evento[]>>('events')
      eventos.value = respuesta.data
      const guardado = leerGuardado()
      const valido = (id: number | null) => id !== null && eventos.value.some((evento) => evento.id === id)
      if (!valido(seleccionadoId.value)) {
        seleccionadoId.value = valido(guardado)
          ? guardado
          : (eventos.value.find((evento) => evento.esPrincipal) ?? eventos.value[0])?.id ?? null
      }
      cargado.value = true
    } finally {
      cargando.value = false
    }
  }

  function seleccionar(id: number) {
    seleccionadoId.value = id
    try { localStorage.setItem(CLAVE, String(id)) } catch { /* almacenamiento no disponible */ }
  }

  return { eventos, seleccionadoId, seleccionado, cargando, cargado, cargar, seleccionar }
})
