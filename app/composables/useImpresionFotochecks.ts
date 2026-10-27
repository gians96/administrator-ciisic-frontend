/**
 * Impresión de los fotochecks con el diálogo del navegador (spec 030): monta todas las hojas solo mientras se imprime,
 * espera las fuentes y los logos, fija el tamaño de la hoja con `@page`, pone un título que el navegador usa como nombre
 * del PDF y lo deja todo como estaba al cerrar el diálogo (`afterprint`). Las reglas de impresión (`@media print`) solo
 * valen bajo la clase `imprimiendo-fotochecks` de `<html>`: no afectan a ninguna otra pantalla.
 */

/** Fuentes de la tarjeta: se piden antes de imprimir porque las hojas ocultas no las cargan solas. */
const FUENTES = ['800 16px Barlow', '700 16px Poppins', '600 16px Poppins']
export const CLASE_IMPRESION_FOTOCHECKS = 'imprimiendo-fotochecks'
const ID_ESTILO_PAGINA = 'fotochecks-pagina'

export interface OpcionesImpresionFotochecks {
  /** Hay algo que imprimir: personas elegidas y una rejilla que cabe en la hoja. */
  puedeImprimir: () => boolean
  /** Medidas de la hoja ya con la orientación, en cm. */
  hoja: () => { ancho: number, alto: number }
  /** Título del documento: el navegador lo propone como nombre del PDF. */
  titulo: () => string
  /** Letras que lleva lo impreso, para cargar también las variantes de la fuente que necesiten. */
  muestra: () => string
  /** Tras cerrar el diálogo de impresión, se haya impreso o no. */
  alTerminar: () => void
}

export function useImpresionFotochecks(opciones: OpcionesImpresionFotochecks) {
  const imprimiendo = ref(false)
  let tituloAnterior: string | null = null

  function preparar() {
    const { ancho, alto } = opciones.hoja()
    let estilo = document.getElementById(ID_ESTILO_PAGINA)
    if (!estilo) {
      estilo = document.createElement('style')
      estilo.id = ID_ESTILO_PAGINA
      document.head.appendChild(estilo)
    }
    estilo.textContent = `@page { size: ${ancho}cm ${alto}cm; margin: 0; }`
    tituloAnterior = document.title
    document.title = opciones.titulo()
    document.documentElement.classList.add(CLASE_IMPRESION_FOTOCHECKS)
    imprimiendo.value = true
  }

  function restaurar() {
    document.getElementById(ID_ESTILO_PAGINA)?.remove()
    document.documentElement.classList.remove(CLASE_IMPRESION_FOTOCHECKS)
    if (tituloAnterior !== null) document.title = tituloAnterior
    tituloAnterior = null
    imprimiendo.value = false
  }

  async function esperarRecursos() {
    const muestra = opciones.muestra() || 'ÁÉÍÓÚÑ'
    await Promise.all(FUENTES.map((fuente) => document.fonts.load(fuente, muestra).catch(() => undefined)))
    await document.fonts.ready
    const imagenes = new Map<string, HTMLImageElement>()
    document.querySelectorAll<HTMLImageElement>('.fotochecks-impresion img').forEach((imagen) => imagenes.set(imagen.currentSrc || imagen.src, imagen))
    await Promise.all([...imagenes.values()].map((imagen) => imagen.decode().catch(() => undefined)))
    await new Promise<void>((resolver) => requestAnimationFrame(() => resolver()))
  }

  async function imprimir() {
    if (imprimiendo.value || !opciones.puedeImprimir()) return
    preparar()
    await nextTick()
    try {
      await esperarRecursos()
    } catch {
      // Se imprime igual: lo peor es una fuente de respaldo
    }
    window.print()
  }

  /** Ctrl/Cmd+P o el menú del navegador sin pasar por el botón: se arma lo mismo (con menos garantías de que todo haya cargado). */
  function antesDeImprimir() {
    if (!imprimiendo.value && opciones.puedeImprimir()) preparar()
  }

  function alTerminarImpresion() {
    if (!imprimiendo.value) return
    restaurar()
    opciones.alTerminar()
  }

  function alTeclear(evento: KeyboardEvent) {
    if (!(evento.ctrlKey || evento.metaKey) || evento.altKey || evento.shiftKey || evento.key.toLowerCase() !== 'p') return
    if (!opciones.puedeImprimir()) return
    evento.preventDefault()
    void imprimir()
  }

  onMounted(() => {
    window.addEventListener('beforeprint', antesDeImprimir)
    window.addEventListener('afterprint', alTerminarImpresion)
    window.addEventListener('keydown', alTeclear)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeprint', antesDeImprimir)
    window.removeEventListener('afterprint', alTerminarImpresion)
    window.removeEventListener('keydown', alTeclear)
    if (imprimiendo.value) restaurar()
  })

  return { imprimiendo, imprimir }
}
