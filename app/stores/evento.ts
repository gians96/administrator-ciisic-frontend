import { defineStore } from 'pinia'
import type { EventoListado, Respuesta } from '~/types/api'

/** Evento seleccionado por cuenta: `panel_evento_seleccionado:<id del usuario>`. */
const PREFIJO_CLAVE = 'panel_evento_seleccionado'

function claveDe(usuarioId: number | null): string | null {
  return usuarioId ? `${PREFIJO_CLAVE}:${usuarioId}` : null
}

function leerGuardado(usuarioId: number | null): number | null {
  const clave = claveDe(usuarioId)
  if (!clave) return null
  try {
    // Clave anterior (una por navegador) como respaldo: se valida contra los eventos de la cuenta
    const valor = Number(localStorage.getItem(clave) ?? localStorage.getItem(PREFIJO_CLAVE))
    return Number.isSafeInteger(valor) && valor > 0 ? valor : null
  } catch {
    return null
  }
}

/**
 * Eventos de la cuenta y el evento sobre el que trabaja el panel (recordado por cuenta y navegador).
 * Las cuentas por evento reciben solo sus eventos (vista reducida); con la lista vacía no hay evento
 * seleccionado. Al cambiar de cuenta o cerrar sesión se vacía (`limpiar`, desde el store de sesión).
 */
export const useEventoStore = defineStore('evento', () => {
  const eventos = ref<EventoListado[]>([])
  const seleccionadoId = ref<number | null>(null)
  const cargando = ref(false)
  const cargado = ref(false)
  /** Cuenta para la que se cargó la lista (otra cuenta en el mismo navegador la vuelve a pedir). */
  const cargadoPara = ref<number | null>(null)

  /** Cambia al vaciar la lista: una carga anterior que llega tarde se descarta. */
  let generacion = 0
  /** Carga en curso (dos pantallas que piden la lista a la vez comparten la petición). */
  let enCurso: { usuarioId: number | null, promesa: Promise<void> } | null = null

  const seleccionado = computed(() => eventos.value.find((evento) => evento.id === seleccionadoId.value) ?? null)

  /** Vacía la lista y el evento elegido (otra cuenta o sin sesión). */
  function limpiar() {
    generacion++
    enCurso = null
    eventos.value = []
    seleccionadoId.value = null
    cargando.value = false
    cargado.value = false
    cargadoPara.value = null
  }

  async function pedir(usuarioId: number | null): Promise<void> {
    const deEstaCarga = generacion
    cargando.value = true
    try {
      const { api } = useApi()
      const respuesta = await api<Respuesta<EventoListado[]>>('events')
      if (deEstaCarga !== generacion) return
      eventos.value = respuesta.data
      const valido = (id: number | null) => id !== null && eventos.value.some((evento) => evento.id === id)
      if (!valido(seleccionadoId.value)) {
        const guardado = leerGuardado(usuarioId)
        seleccionadoId.value = valido(guardado)
          ? guardado
          : (eventos.value.find((evento) => evento.esPrincipal) ?? eventos.value[0])?.id ?? null
      }
      cargado.value = true
      cargadoPara.value = usuarioId
    } finally {
      if (deEstaCarga === generacion) cargando.value = false
    }
  }

  async function cargar(forzar = false): Promise<void> {
    const usuarioId = useAuthStore().usuario?.id ?? null
    const mismaCuenta = cargadoPara.value === usuarioId
    if (cargado.value && mismaCuenta && !forzar) return
    if (!forzar && enCurso?.usuarioId === usuarioId) return enCurso.promesa
    if (!mismaCuenta) limpiar()
    const actual = { usuarioId, promesa: pedir(usuarioId) }
    enCurso = actual
    try {
      await actual.promesa
    } finally {
      if (enCurso === actual) enCurso = null
    }
  }

  /** Vuelve a pedir los eventos (p. ej. tras un 403 `EVENT_NOT_ASSIGNED` o un cambio de asignaciones). */
  function recargar() {
    return cargar(true)
  }

  function seleccionar(id: number) {
    seleccionadoId.value = id
    const clave = claveDe(useAuthStore().usuario?.id ?? null)
    if (!clave) return
    try { localStorage.setItem(clave, String(id)) } catch { /* almacenamiento no disponible */ }
  }

  return { eventos, seleccionadoId, seleccionado, cargando, cargado, cargar, recargar, seleccionar, limpiar }
})
