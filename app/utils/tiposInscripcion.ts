// ============================================================================
// TIPOS DE INSCRIPCIÓN: disponibilidad (spec 016 del backend), modalidad de asistencia (spec 018) y
// cuerpo del formulario (funciones puras)
// ============================================================================
import type { Caracteristica, Categoria, DisponiblePara, ModalidadAsistencia, TipoInscripcion } from '~/types/api'
import { modalidadDe } from '~/utils/modalidad'

export const OPCIONES_DISPONIBILIDAD: readonly { valor: DisponiblePara, etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos (comunidad UNDC y externos)' },
  { valor: 'INSTITUCIONAL', etiqueta: 'Solo comunidad UNDC' },
  { valor: 'EXTERNOS', etiqueta: 'Solo externos (no se muestra a la comunidad UNDC)' },
]

/** Modalidad de asistencia del tipo (no la modalidad de pago de la inscripción). */
export const OPCIONES_MODALIDAD: readonly { valor: ModalidadAsistencia, etiqueta: string }[] = [
  { valor: 'PRESENCIAL', etiqueta: 'Presencial' },
  { valor: 'VIRTUAL', etiqueta: 'Virtual (participa a distancia)' },
]

/** Quién es «comunidad UNDC»: la misma condición que da el precio institucional en esa categoría. */
export function ayudaDisponibilidad(esEstudiantil: boolean): string {
  return esEstudiantil
    ? 'Comunidad UNDC = estudiante verificado con su correo institucional; los demás son externos.'
    : 'Comunidad UNDC = correo del dominio institucional del evento (@undc.edu.pe); los demás son externos.'
}

/** Ayuda del campo «Modalidad»: qué cambia (y qué no) al elegir cada una. */
export function ayudaModalidad(modalidad: ModalidadAsistencia): string {
  return modalidad === 'VIRTUAL'
    ? 'La persona participa a distancia. El tipo se marca como «Virtual» en el panel, la credencial y el correo de aprobación; el precio y la verificación de estudiante siguen siendo los de la categoría. Para una tarifa única, usa el mismo precio regular y UNDC.'
    : 'La persona asiste al evento (lo habitual). Los tipos virtuales se marcan como «Virtual» en el panel, la credencial y el correo de aprobación.'
}

/** Ayuda del campo «Precio UNDC / institucional» según a quién se ofrece el tipo y su modalidad. */
export function ayudaPrecioUndc(disponiblePara: DisponiblePara, modalidad: ModalidadAsistencia): string {
  if (disponiblePara === 'EXTERNOS') return 'No aplica: este tipo no se ofrece a la comunidad UNDC.'
  if (modalidad === 'VIRTUAL') return 'Tarifa única: iguálalo al precio regular. Con 0, la comunidad UNDC se inscribe gratis.'
  return '0 = gratis para la comunidad UNDC.'
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
  /** Un tipo que el backend aún no devuelve con modalidad (anterior a la spec 018) parte de `PRESENCIAL`. */
  modalidad: ModalidadAsistencia
  activo: boolean
  orden: number | ''
}

/**
 * Formulario de un tipo nuevo (con el nombre de la categoría y el siguiente orden) o el de un tipo que
 * se edita. Precios `null` (sin `pagos.ver`) quedan en 0: el formulario no los envía (`preciosOcultos`).
 * La modalidad ausente, `null` o desconocida parte de `PRESENCIAL`.
 */
export function formularioDeTipo(tipo: TipoInscripcion | null | undefined, categoria: Pick<Categoria, 'nombre' | 'tipos'>): FormularioTipo {
  return {
    codigo: tipo?.codigo ?? '',
    nombre: tipo?.nombre ?? categoria.nombre,
    etiqueta: tipo?.etiqueta ?? '',
    descripcion: tipo?.descripcion ?? '',
    precio: tipo?.precio ?? 0,
    precioInstitucional: tipo?.precioInstitucional ?? 0,
    disponiblePara: tipo?.disponiblePara ?? 'TODOS',
    modalidad: modalidadDe(tipo?.modalidad),
    activo: tipo?.activo ?? true,
    orden: tipo?.orden ?? categoria.tipos.length + 1,
  }
}

export type ResultadoCuerpoTipo =
  | { ok: true, body: Record<string, unknown> }
  | { ok: false, errores: Record<string, string> }

const vacio = (valor: unknown) => valor === '' || valor === null || valor === undefined || Number.isNaN(Number(valor))

/**
 * Tarifa única de un tipo virtual (p. ej. S/ 30 y S/ 30): al elegir «Virtual», si el precio UNDC sigue
 * en el valor de fábrica (0 o vacío) se precarga con el regular. Si la persona ya escribió otro valor,
 * no se toca. Devuelve el precio UNDC que debe quedar en el formulario.
 */
export function precioUndcAlElegirVirtual(form: Pick<FormularioTipo, 'precio' | 'precioInstitucional'>): number | '' {
  const sinEscribir = form.precioInstitucional === '' || form.precioInstitucional === 0
  return sinEscribir && !vacio(form.precio) ? Number(form.precio) : form.precioInstitucional
}

/** Se ofrece «Igualar al precio regular»: tipo virtual que sí tiene precio UNDC y los dos precios difieren. */
export function sePuedeIgualarPrecioUndc(form: Pick<FormularioTipo, 'modalidad' | 'disponiblePara' | 'precio' | 'precioInstitucional'>): boolean {
  return form.modalidad === 'VIRTUAL'
    && form.disponiblePara !== 'EXTERNOS'
    && !vacio(form.precio)
    && Number(form.precio) !== Number(form.precioInstitucional)
}

/**
 * Cuerpo de `POST /registration-categories/:id/types` y `PUT /registration-types/:id`.
 * - Un precio vacío es un error (antes viajaba como 0, y 0 es «gratis»).
 * - «Solo externos» no usa el precio UNDC: se envía igual al regular para cumplir `precioInstitucional <= precio`.
 * - Sin `pagos.ver` (`preciosOcultos`) no se envían precios: el backend conserva los actuales.
 * - `modalidad` viaja siempre (también sin `pagos.ver`: no es un precio); un backend anterior a la
 *   spec 018 la ignora.
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
      modalidad: modalidadDe(form.modalidad),
      activo: form.activo,
      orden: Number(form.orden) || 0,
      caracteristicas: caracteristicas.filter((c) => c.text.trim()).map((c) => ({ icon: c.icon.trim() || 'heroicons:check', text: c.text.trim() })),
    },
  }
}
