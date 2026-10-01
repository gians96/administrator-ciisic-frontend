/**
 * Asistencia (spec 013 del backend): cuerpo de la marca, método y textos del registro. La página
 * decide con permisos qué se muestra (`asistencia.marcar`, `asistencia.anular`,
 * `asistencia.fuera_horario`, `asistencia.exportar`).
 */

/** Cómo se marcó (`QR_LEGADO` lo asigna solo el servidor: rutas de la versión anterior). */
export type MetodoAsistencia = 'QR' | 'QR_LEGADO' | 'DOCUMENTO' | 'MANUAL'

/** Persona de una marca; `numeroDocumento` llega enmascarado (`****5678`) sin `inscripciones.ver`. */
export interface PersonaAsistencia {
  id: number
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidos: string
}

/** Fila de `GET /activities/:id/attendances` (sin las anuladas). */
export interface AsistenciaFila {
  id: number
  registradoEn: string
  /** `null` en las marcas anteriores a la spec 013. */
  metodo: MetodoAsistencia | null
  esFueraDeHorario: boolean
  /** `null` en las marcas anteriores a la spec 013. */
  registradoPor: { id: number, nombres: string, apellidos: string } | null
  participante: PersonaAsistencia
}

/** Respuesta de `POST /activities/:id/attendances`. */
export interface MarcaAsistencia {
  id: number
  registradoEn: string
  metodo: MetodoAsistencia
  esFueraDeHorario: boolean
  participante: PersonaAsistencia
}

export const ETIQUETAS_METODO: Readonly<Record<MetodoAsistencia, string>> = {
  QR: 'QR',
  QR_LEGADO: 'QR (versión anterior)',
  DOCUMENTO: 'Documento',
  MANUAL: 'Manual',
}

/** Nombre visible del método; sin método (marcas antiguas), «—». */
export function etiquetaMetodo(metodo: string | null | undefined): string {
  if (!metodo) return '—'
  return ETIQUETAS_METODO[metodo as MetodoAsistencia] ?? metodo
}

/** `qr`: el lector (o la persona) escribe el código de la credencial; `dni`: número de documento. */
export type ModoLectura = 'qr' | 'dni'

/** `''`: cualquier tipo (el backend lo pide si dos inscritos comparten el número). */
export type TipoDocumentoMarca = '' | 'dni' | 'ce'

export const TIPOS_DOCUMENTO_MARCA: ReadonlyArray<{ valor: TipoDocumentoMarca, nombre: string }> = [
  { valor: '', nombre: 'Cualquiera' },
  { valor: 'dni', nombre: 'DNI' },
  { valor: 'ce', nombre: 'Carné de extranjería (CE)' },
]

export interface FormMarca {
  modo: ModoLectura
  valor: string
  tipoDocumento: TipoDocumentoMarca
  fueraDeHorario: boolean
}

export interface CuerpoMarca {
  participanteId?: number
  numeroDocumento?: string
  tipoDocumento?: 'dni' | 'ce'
  fueraDeHorario: boolean
  metodo: 'QR' | 'DOCUMENTO'
}

/** Mismo formato que valida el backend (`registrarAsistenciaSchema`). */
const REGEX_DOCUMENTO = /^[A-Za-z0-9]{8,12}$/

/**
 * Cuerpo de `POST /activities/:id/attendances`: en modo QR el id leído con `metodo: 'QR'`; en modo
 * DNI el documento con `metodo: 'DOCUMENTO'` y el tipo solo si se eligió (resuelve
 * `AMBIGUOUS_DOCUMENT`). «Fuera de horario» solo viaja si la cuenta tiene `asistencia.fuera_horario`.
 */
export function cuerpoMarca(form: FormMarca, permiteFueraDeHorario: boolean): { body: CuerpoMarca } | { error: string } {
  const texto = form.valor.trim()
  const fueraDeHorario = permiteFueraDeHorario && form.fueraDeHorario
  if (!texto) return { error: form.modo === 'qr' ? 'Escanea o escribe el código de la credencial.' : 'Escribe el número de documento.' }
  if (form.modo === 'qr') {
    const participanteId = Number(texto)
    if (!/^\d+$/.test(texto) || !Number.isSafeInteger(participanteId) || participanteId <= 0) {
      return { error: 'El código leído no es válido. Vuelve a escanear la credencial o usa «DNI / documento».' }
    }
    return { body: { participanteId, fueraDeHorario, metodo: 'QR' } }
  }
  if (!REGEX_DOCUMENTO.test(texto)) return { error: 'El documento debe tener de 8 a 12 letras o números, sin espacios.' }
  return {
    body: {
      numeroDocumento: texto,
      ...(form.tipoDocumento ? { tipoDocumento: form.tipoDocumento } : {}),
      fueraDeHorario,
      metodo: 'DOCUMENTO',
    },
  }
}

/**
 * Tras un error se conserva lo escrito solo para elegir el tipo de documento (`AMBIGUOUS_DOCUMENT`
 * en modo DNI). En modo QR siempre se limpia: el lector escribe a continuación y mezclaría códigos.
 */
export function conservarValorTrasError(modo: ModoLectura, codigo: string): boolean {
  return modo === 'dni' && codigo === 'AMBIGUOUS_DOCUMENT'
}

/** Mensaje de una marca registrada (el documento se muestra tal cual llega, enmascarado o no). */
export function textoMarca(marca: Pick<MarcaAsistencia, 'esFueraDeHorario' | 'participante'>): string {
  const { participante } = marca
  const nombre = `${participante.nombres} ${participante.apellidos}`.trim()
  const documento = `${participante.tipoDocumento.toUpperCase()} ${participante.numeroDocumento}`.trim()
  return `✓ ${nombre} · ${documento}${marca.esFueraDeHorario ? ' · fuera de horario' : ''}`
}

/** Id positivo de un parámetro de la URL (`?evento=`, `?actividad=`); cualquier otro valor, `null`. */
export function idDeConsulta(valor: unknown): number | null {
  const id = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : Number.NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Actividad que se elige al cargar las del evento: la del enlace (`?actividad=`) si es de este evento;
 * si no, la primera. `ajena`: el enlace pedía una actividad de otro evento (se avisa en lugar de
 * cambiar de actividad sin decir nada).
 */
export function actividadInicial(actividades: ReadonlyArray<{ id: number }>, pedida: number | null): { id: number | null, ajena: boolean } {
  const encontrada = pedida !== null && actividades.some((actividad) => actividad.id === pedida)
  return { id: encontrada ? pedida : actividades[0]?.id ?? null, ajena: pedida !== null && !encontrada }
}
