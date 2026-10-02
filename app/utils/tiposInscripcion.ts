// ============================================================================
// TIPOS DE INSCRIPCIÓN: disponibilidad (spec 016 del backend) y cuerpo del formulario (funciones puras)
// ============================================================================
import type { Caracteristica, DisponiblePara } from '~/types/api'

export const OPCIONES_DISPONIBILIDAD: readonly { valor: DisponiblePara, etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos (comunidad UNDC y externos)' },
  { valor: 'INSTITUCIONAL', etiqueta: 'Solo comunidad UNDC' },
  { valor: 'EXTERNOS', etiqueta: 'Solo externos (no se muestra a la comunidad UNDC)' },
]

/** Quién es «comunidad UNDC»: la misma condición que da el precio institucional en esa categoría. */
export function ayudaDisponibilidad(esEstudiantil: boolean): string {
  return esEstudiantil
    ? 'Comunidad UNDC = estudiante verificado con su correo institucional; los demás son externos.'
    : 'Comunidad UNDC = correo del dominio institucional del evento (@undc.edu.pe); los demás son externos.'
}

/** Estado del formulario: un input numérico vacío queda en `''` (no en 0). */
export interface FormularioTipo {
  codigo: string
  nombre: string
  etiqueta: string
  descripcion: string
  precio: number | ''
  precioInstitucional: number | ''
  disponiblePara: DisponiblePara
  activo: boolean
  orden: number | ''
}

export type ResultadoCuerpoTipo =
  | { ok: true, body: Record<string, unknown> }
  | { ok: false, errores: Record<string, string> }

const vacio = (valor: unknown) => valor === '' || valor === null || valor === undefined || Number.isNaN(Number(valor))

/**
 * Cuerpo de `POST /registration-categories/:id/types` y `PUT /registration-types/:id`.
 * - Un precio vacío es un error (antes viajaba como 0, y 0 es «gratis»).
 * - «Solo externos» no usa el precio UNDC: se envía igual al regular para cumplir `precioInstitucional <= precio`.
 * - Sin `pagos.ver` (`preciosOcultos`) no se envían precios: el backend conserva los actuales.
 */
export function cuerpoTipo(form: FormularioTipo, caracteristicas: readonly Caracteristica[], opciones: { preciosOcultos: boolean }): ResultadoCuerpoTipo {
  const errores: Record<string, string> = {}
  const soloExternos = form.disponiblePara === 'EXTERNOS'
  if (!opciones.preciosOcultos) {
    if (vacio(form.precio)) errores.precio = 'Ingresa el precio regular.'
    if (!soloExternos && vacio(form.precioInstitucional)) {
      errores.precioInstitucional = 'Ingresa el precio UNDC o elige «Solo externos» en Disponible para.'
    }
  }
  if (Object.keys(errores).length) return { ok: false, errores }

  const precio = Number(form.precio)
  return {
    ok: true,
    body: {
      codigo: form.codigo.trim().toLowerCase(),
      nombre: form.nombre,
      etiqueta: form.etiqueta.trim() || null,
      descripcion: form.descripcion.trim() || null,
      ...(opciones.preciosOcultos ? {} : { precio, precioInstitucional: soloExternos ? precio : Number(form.precioInstitucional) }),
      disponiblePara: form.disponiblePara,
      activo: form.activo,
      orden: Number(form.orden) || 0,
      caracteristicas: caracteristicas.filter((c) => c.text.trim()).map((c) => ({ icon: c.icon.trim() || 'heroicons:check', text: c.text.trim() })),
    },
  }
}
