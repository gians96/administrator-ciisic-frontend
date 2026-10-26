// ============================================================================
// TIPOS DE INSCRIPCIÓN: disponibilidad (spec 016 del backend), modalidad de asistencia (spec 018) y
// cuerpo del formulario (funciones puras)
// ============================================================================
import type { Caracteristica, Categoria, DisponiblePara, ModalidadAsistencia, TipoInscripcion } from '~/types/api'
import { soles } from '~/utils/formato'
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

/** Descripción del interruptor «No admitir estudiantes UNDC» (spec 020 del backend). */
export const AYUDA_EXCLUYE_ESTUDIANTES = 'Un estudiante UNDC (verificado o con correo de código @undc.edu.pe) no puede inscribirse en este tipo ni lo ve en la landing. Docentes, administrativos y externos sí. Solo frena inscripciones nuevas: las ya hechas no cambian, y las cortesías no aplican la regla.'

/**
 * El backend ya envía `excluyeEstudiantesUndc` (spec 020): al menos un tipo de las categorías lo trae.
 * Un backend anterior no lo envía y descarta en silencio la clave que manda el panel, así que el
 * interruptor no tendría efecto. Sin tipos no se puede saber: se asume que sí.
 */
export function backendSinExcluyeEstudiantes(categorias: readonly { tipos: readonly { excluyeEstudiantesUndc?: unknown }[] }[]): boolean {
  const tipos = categorias.flatMap((categoria) => categoria.tipos)
  return tipos.length > 0 && tipos.every((tipo) => tipo.excluyeEstudiantesUndc === undefined)
}

/**
 * Se pidió encender el interruptor y el tipo guardado que devolvió el backend no lo tiene: un backend
 * anterior a la spec 020 lo descartó sin avisar. Sin respuesta no se puede saber: `false`.
 */
export function excluyeEstudiantesNoGuardado(enviado: unknown, guardado: { excluyeEstudiantesUndc?: unknown } | null | undefined): boolean {
  return Boolean(guardado) && enviado === true && guardado?.excluyeEstudiantesUndc !== true
}

/** Advertencia bajo el interruptor cuando se enciende contra un backend sin la spec 020. */
export const AVISO_SERVIDOR_SIN_EXCLUYE = 'El servidor aún no admite esta opción (spec 020 del backend): no tendría efecto. Despliega primero el backend.'

/** Aviso tras guardar un tipo con el interruptor encendido que el backend dejó apagado. */
export const AVISO_EXCLUYE_NO_GUARDADO = 'El tipo se guardó sin «No admitir estudiantes UNDC»: el servidor aún no admite esta opción (spec 020 del backend). Despliega primero el backend y vuelve a encenderla en este tipo.'

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
  /** Spec 020: no admite estudiantes UNDC. Un tipo que el backend aún no devuelve con el campo parte de `false`. */
  excluyeEstudiantesUndc: boolean
  /** Spec 037: incluye el kit que se entrega en la puerta. Un tipo que el backend aún no devuelve con el campo parte de `false`. */
  incluyeKit: boolean
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
    excluyeEstudiantesUndc: tipo?.excluyeEstudiantesUndc === true,
    incluyeKit: tipo?.incluyeKit === true,
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

/** Lo que la precarga del precio UNDC cambió, para poder deshacerla al volver a «Presencial». */
export interface PrecargaPrecioUndc {
  antes: number | ''
  despues: number | ''
}

/**
 * Qué queda en el Precio UNDC al cambiar la «Modalidad» del formulario (`modalidad` es la ya elegida).
 * - «Virtual» en un tipo **nuevo** (`creando`): precarga con el precio regular si el UNDC sigue en el valor
 *   de fábrica (`precioUndcAlElegirVirtual`) y recuerda lo que había (`precarga`).
 * - «Virtual» al **editar** un tipo existente: no toca nada. Su Precio UNDC (incluso un 0 legítimo, «gratis
 *   para la comunidad UNDC») es un dato real; si la tarifa no es única, `avisoTarifaUnica` lo avisa al guardar.
 * - Volver a «Presencial»: si el Precio UNDC sigue siendo el que puso la precarga, restaura el anterior;
 *   si la persona lo cambió a mano, no se toca.
 */
export function precioUndcAlCambiarModalidad(
  modalidad: ModalidadAsistencia,
  form: Pick<FormularioTipo, 'precio' | 'precioInstitucional'>,
  estado: { creando: boolean, precarga: PrecargaPrecioUndc | null },
): { precioInstitucional: number | '', precarga: PrecargaPrecioUndc | null } {
  if (modalidad === 'VIRTUAL') {
    if (!estado.creando) return { precioInstitucional: form.precioInstitucional, precarga: null }
    const despues = precioUndcAlElegirVirtual(form)
    if (despues === form.precioInstitucional) return { precioInstitucional: despues, precarga: estado.precarga }
    return { precioInstitucional: despues, precarga: { antes: form.precioInstitucional, despues } }
  }
  const { precarga } = estado
  if (precarga && form.precioInstitucional === precarga.despues) return { precioInstitucional: precarga.antes, precarga: null }
  return { precioInstitucional: form.precioInstitucional, precarga: null }
}

/** Se ofrece «Igualar al precio regular»: tipo virtual que sí tiene precio UNDC y los dos precios difieren. */
export function sePuedeIgualarPrecioUndc(form: Pick<FormularioTipo, 'modalidad' | 'disponiblePara' | 'precio' | 'precioInstitucional'>): boolean {
  return form.modalidad === 'VIRTUAL'
    && form.disponiblePara !== 'EXTERNOS'
    && !vacio(form.precio)
    && Number(form.precio) !== Number(form.precioInstitucional)
}

/**
 * Confirmación antes de guardar un tipo virtual cuya tarifa no es única (precio regular distinto del
 * precio UNDC): la tarifa virtual del congreso es la misma para la comunidad UNDC y los externos, y un
 * Precio UNDC de 0 la deja gratis. No bloquea (el backend acepta el cuerpo): devuelve el texto de la
 * confirmación, o `null` si no hace falta. Sin `pagos.ver` no se envían precios y no se avisa.
 */
export function avisoTarifaUnica(
  form: Pick<FormularioTipo, 'modalidad' | 'disponiblePara' | 'precio' | 'precioInstitucional'>,
  opciones: { preciosOcultos: boolean },
): string | null {
  if (opciones.preciosOcultos || !sePuedeIgualarPrecioUndc(form)) return null
  const regular = soles(Number(form.precio))
  const undc = soles(Number(form.precioInstitucional))
  const gratis = Number(form.precioInstitucional) === 0 ? ' Con 0, la comunidad UNDC se inscribe gratis.' : ''
  return `Un tipo virtual suele tener tarifa única, pero aquí el precio regular es ${regular} y el precio UNDC es ${undc}.${gratis} ¿Guardar así?`
}

/**
 * Confirmación antes de cambiar la modalidad de un tipo que ya tiene inscripciones: la modalidad se lee
 * del tipo en vivo (no queda copiada en cada inscripción), así que el cambio reclasifica de golpe a todos
 * los inscritos (filtro y CSV, resumen, aviso del escáner, rótulo de la credencial PDF y párrafo del correo
 * en los reenvíos). Devuelve el texto de la confirmación, o `null` si no hace falta (tipo nuevo, sin
 * inscripciones, `totalInscripciones` desconocido o modalidad sin cambio).
 */
export function avisoCambioModalidad(
  actual: Pick<TipoInscripcion, 'modalidad' | 'totalInscripciones'> | null | undefined,
  nueva: ModalidadAsistencia,
): string | null {
  const total = Number(actual?.totalInscripciones ?? 0)
  if (!actual || !(total > 0) || modalidadDe(actual.modalidad) === nueva) return null
  const personas = total === 1 ? '1 inscripción' : `${total} inscripciones`
  const destino = nueva === 'VIRTUAL' ? 'virtual' : 'presencial'
  return `Este tipo ya tiene ${personas}. Cambiar su modalidad a ${destino} las reclasifica a todas de inmediato (filtros, CSV, resumen, aviso del escáner, credencial y correo). ¿Guardar así?`
}

/**
 * Cuerpo de `POST /registration-categories/:id/types` y `PUT /registration-types/:id`.
 * - Un precio vacío es un error (antes viajaba como 0, y 0 es «gratis»).
 * - «Solo externos» no usa el precio UNDC: se envía igual al regular para cumplir `precioInstitucional <= precio`.
 * - Sin `pagos.ver` (`preciosOcultos`) no se envían precios: el backend conserva los actuales.
 * - `modalidad`, `excluyeEstudiantesUndc` e `incluyeKit` viajan siempre (también sin `pagos.ver`: no son
 *   precios); un backend anterior a la spec 018 / 020 / 037 los ignora. Un tipo virtual viaja siempre sin kit.
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
      excluyeEstudiantesUndc: form.excluyeEstudiantesUndc === true,
      incluyeKit: modalidadDe(form.modalidad) === 'PRESENCIAL' && form.incluyeKit === true,
      activo: form.activo,
      orden: Number(form.orden) || 0,
      caracteristicas: caracteristicas.filter((c) => c.text.trim()).map((c) => ({ icon: c.icon.trim() || 'heroicons:check', text: c.text.trim() })),
    },
  }
}
