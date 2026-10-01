import type {
  AlineacionCampo,
  AvisoEstampado,
  CampoPlantilla,
  CapitalizacionCampo,
  FormatoFechaCampo,
  TipoCampoPlantilla,
} from '~/types/api'

/**
 * Plantillas de certificado (backend-ciisic spec 015): catálogo y validación de los campos con las
 * mismas reglas y mensajes que el backend (`validation/plantillas.ts`), normalización, texto de ejemplo
 * del editor (`capitalizarTitulo`, `reemplazarMarcadores` y fechas como `pdf/texto.ts`), conversión
 * entre píxeles del visor (pdf.js) y puntos PDF, campos por defecto y avisos de la vista previa.
 *
 * Coordenadas en puntos PDF absolutos (origen abajo a la izquierda). En el texto, `y` es la línea base
 * de la primera línea; en el QR, la esquina inferior izquierda.
 */

export const TIPOS_CAMPO: readonly TipoCampoPlantilla[] = ['NOMBRE', 'TIPO', 'CODIGO', 'QR', 'FECHA_EMISION', 'HORAS', 'EVENTO', 'DOCUMENTO', 'DETALLE', 'TEXTO']
export const ALINEACIONES: readonly AlineacionCampo[] = ['IZQUIERDA', 'CENTRO', 'DERECHA']
export const CAPITALIZACIONES: readonly CapitalizacionCampo[] = ['ORIGINAL', 'MAYUSCULAS', 'TITULO']
export const FORMATOS_FECHA: readonly FormatoFechaCampo[] = ['LARGO', 'CORTO']

/** Marcadores que admite `texto`; uno desconocido se imprime tal cual. */
export const MARCADORES = ['nombre', 'tipo', 'evento', 'eventoCorto', 'horas', 'fecha', 'detalle', 'codigo', 'documento'] as const
export type Marcador = typeof MARCADORES[number]

export const LIMITES_CAMPOS = {
  maxCampos: 30,
  tamanoMin: 4,
  tamanoMax: 200,
  ladoQrMin: 36,
  ladoQrMax: 300,
  lineasMaxMax: 10,
  interlineadoMin: 0.8,
  interlineadoMax: 3,
  textoMax: 500,
  paginasMax: 2,
} as const

/** Tamaño máximo de página de un PDF (200 pulgadas), en ambos sentidos. */
export const COORDENADA_MAXIMA = 14_400
export const REGEX_ID_CAMPO = /^[A-Za-z0-9_-]{1,40}$/
export const REGEX_COLOR_CAMPO = /^#[0-9a-fA-F]{6}$/
export const FUENTE_POR_DEFECTO = 'MONTSERRAT'

/** Valores que usa el backend cuando el campo no los trae. */
export const POR_DEFECTO_CAMPO = {
  tamano: 12,
  color: '#000000',
  alineacion: 'IZQUIERDA' as AlineacionCampo,
  capitalizacion: 'ORIGINAL' as CapitalizacionCampo,
  lineasMax: 1,
  interlineado: 1.2,
  formatoFecha: 'LARGO' as FormatoFechaCampo,
  ladoQr: 90,
} as const

export const ETIQUETAS_TIPO_CAMPO: Readonly<Record<TipoCampoPlantilla, string>> = {
  NOMBRE: 'Nombre',
  TIPO: 'Tipo de certificado',
  CODIGO: 'Código',
  QR: 'QR de verificación',
  FECHA_EMISION: 'Fecha de emisión',
  HORAS: 'Horas',
  EVENTO: 'Evento',
  DOCUMENTO: 'Documento',
  DETALLE: 'Detalle',
  TEXTO: 'Texto libre',
}

export const ETIQUETAS_ALINEACION: Readonly<Record<AlineacionCampo, string>> = { IZQUIERDA: 'Izquierda', CENTRO: 'Centro', DERECHA: 'Derecha' }
export const ETIQUETAS_CAPITALIZACION: Readonly<Record<CapitalizacionCampo, string>> = { ORIGINAL: 'Como está', MAYUSCULAS: 'MAYÚSCULAS', TITULO: 'Tipo Título' }
export const ETIQUETAS_FORMATO_FECHA: Readonly<Record<FormatoFechaCampo, string>> = { LARGO: '3 de noviembre de 2026', CORTO: '03/11/2026' }

/** Qué escribe cada marcador (ayuda del campo `texto`). */
export const ETIQUETAS_MARCADOR: Readonly<Record<Marcador, string>> = {
  nombre: 'Nombre del titular',
  tipo: 'Tipo de certificado (texto impreso)',
  evento: 'Nombre del evento',
  eventoCorto: 'Nombre corto del evento',
  horas: 'Horas',
  fecha: 'Fecha de emisión',
  detalle: 'Detalle (ponencia, comisión…)',
  codigo: 'Código del certificado',
  documento: 'Documento del titular',
}

// ─── Validación (mismas reglas y mensajes que el backend) ───

const redondear = (valor: number) => Math.round(valor * 100) / 100

/** Medida redondeada a centésimas de pt (como la guarda el backend). */
export function redondearPt(valor: number): number {
  return redondear(valor)
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Ausente: `undefined`, `null` (yup `nullable`). */
function ausente(valor: unknown): boolean {
  return valor === undefined || valor === null
}

/** Número de un valor (como `yup.number()`: acepta texto numérico); `NaN` si no lo es. */
function aNumero(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : Number.NaN
  if (typeof valor === 'string' && valor.trim()) return Number(valor.trim())
  return Number.NaN
}

interface ReglaNumero {
  etiqueta: string
  entero?: string
  min?: [number, string]
  max?: [number, string]
}

function errorNumero(valor: unknown, regla: ReglaNumero): string | null {
  const numero = aNumero(valor)
  if (Number.isNaN(numero)) return `${regla.etiqueta} debe ser un número`
  if (regla.entero && !Number.isInteger(numero)) return regla.entero
  if (regla.min && numero < regla.min[0]) return regla.min[1]
  if (regla.max && numero > regla.max[0]) return regla.max[1]
  return null
}

const L = LIMITES_CAMPOS
const RANGO_TAMANO = `${L.tamanoMin} a ${L.tamanoMax} pt`
const RANGO_QR = `El QR mide de ${L.ladoQrMin} a ${L.ladoQrMax} pt`
const RANGO_LINEAS = `Las líneas van de 1 a ${L.lineasMaxMax}`
const RANGO_INTERLINEADO = `El interlineado va de ${L.interlineadoMin} a ${L.interlineadoMax}`

const REGLAS_NUMERO: Readonly<Record<string, ReglaNumero>> = {
  pagina: { etiqueta: 'La página', entero: 'La página debe ser un entero', min: [1, 'La página empieza en 1'], max: [L.paginasMax, `El diseño tiene como máximo ${L.paginasMax} páginas`] },
  x: { etiqueta: 'x', min: [-COORDENADA_MAXIMA, 'x está fuera de la página'], max: [COORDENADA_MAXIMA, 'x está fuera de la página'] },
  y: { etiqueta: 'y', min: [-COORDENADA_MAXIMA, 'y está fuera de la página'], max: [COORDENADA_MAXIMA, 'y está fuera de la página'] },
  ancho: { etiqueta: 'El ancho', min: [1, 'El ancho debe ser de al menos 1 pt'], max: [COORDENADA_MAXIMA, 'El ancho es demasiado grande'] },
  lado: { etiqueta: 'El lado del QR', min: [L.ladoQrMin, RANGO_QR], max: [L.ladoQrMax, RANGO_QR] },
  tamano: { etiqueta: 'El tamaño', min: [L.tamanoMin, `El tamaño va de ${RANGO_TAMANO}`], max: [L.tamanoMax, `El tamaño va de ${RANGO_TAMANO}`] },
  tamanoMinimo: { etiqueta: 'El tamaño mínimo', min: [L.tamanoMin, `El tamaño mínimo va de ${RANGO_TAMANO}`], max: [L.tamanoMax, `El tamaño mínimo va de ${RANGO_TAMANO}`] },
  lineasMax: { etiqueta: 'Las líneas', entero: 'Las líneas deben ser un entero', min: [1, RANGO_LINEAS], max: [L.lineasMaxMax, RANGO_LINEAS] },
  interlineado: { etiqueta: 'El interlineado', min: [L.interlineadoMin, RANGO_INTERLINEADO], max: [L.interlineadoMax, RANGO_INTERLINEADO] },
}

const OPCIONES: Readonly<Record<string, readonly [readonly string[], string]>> = {
  alineacion: [ALINEACIONES, 'Alineación'],
  capitalizacion: [CAPITALIZACIONES, 'Capitalización'],
  formatoFecha: [FORMATOS_FECHA, 'Formato de fecha'],
}

/** Errores de un campo que es un objeto (sin los que dependen de la plantilla). */
function erroresDeCampo(campo: Record<string, unknown>, fuentes: readonly string[] | null): Record<string, string> {
  const errores: Record<string, string> = {}
  if (!ausente(campo.id) && !(typeof campo.id === 'string' && REGEX_ID_CAMPO.test(campo.id.trim()))) {
    errores.id = 'El id lleva de 1 a 40 letras, números, «-» o «_»'
  }
  if (ausente(campo.tipo) || campo.tipo === '') errores.tipo = 'El tipo es obligatorio'
  else if (!(TIPOS_CAMPO as readonly unknown[]).includes(campo.tipo)) errores.tipo = `Tipo de campo desconocido: usa ${TIPOS_CAMPO.join(', ')}`

  for (const [clave, regla] of Object.entries(REGLAS_NUMERO)) {
    const valor = campo[clave]
    if (ausente(valor)) {
      if (clave === 'x' || clave === 'y') errores[clave] = `${clave} es obligatorio`
      continue
    }
    const error = errorNumero(valor, regla)
    if (error) errores[clave] = error
  }

  if (!ausente(campo.fuente) && fuentes && !(typeof campo.fuente === 'string' && fuentes.includes(campo.fuente.trim()))) {
    errores.fuente = 'Fuente desconocida: elige una del catálogo'
  }
  if (!ausente(campo.color) && !(typeof campo.color === 'string' && REGEX_COLOR_CAMPO.test(campo.color.trim()))) {
    errores.color = 'El color va como #rrggbb'
  }
  for (const [clave, [valores, etiqueta]] of Object.entries(OPCIONES)) {
    const valor = campo[clave]
    if (!ausente(valor) && !valores.includes(valor as string)) errores[clave] = `${etiqueta}: usa ${valores.join(', ')}`
  }
  if (!ausente(campo.texto) && (typeof campo.texto !== 'string' || campo.texto.length > L.textoMax)) {
    errores.texto = `El texto tiene como máximo ${L.textoMax} caracteres`
  }
  return errores
}

/** Id con el que quedará un campo (el suyo o `<tipo>-<posición>`), o `null` si no se puede saber. */
function idDeCampo(crudo: unknown, indice: number): string | null {
  if (!esObjeto(crudo)) return null
  if (typeof crudo.id === 'string' && crudo.id.trim()) return crudo.id.trim()
  return typeof crudo.tipo === 'string' && (TIPOS_CAMPO as readonly string[]).includes(crudo.tipo) ? `${crudo.tipo.toLowerCase()}-${indice + 1}` : null
}

/**
 * Errores de los campos de una plantilla de `paginas` páginas con las claves del backend
 * (`campos[3].tamano`, `campos[5].id`…; `campos` para la lista); `{}` si son válidos. `fuentes`
 * (códigos de `/certificate-fonts`) valida la fuente; sin ella no se comprueba (lo hará el backend).
 */
export function validarCamposPlantilla(campos: unknown, paginas: number, fuentes: readonly string[] | null = null): Record<string, string> {
  if (!Array.isArray(campos)) return { campos: 'Los campos deben ser una lista' }
  if (campos.length > L.maxCampos) return { campos: `La plantilla admite como máximo ${L.maxCampos} campos` }

  const fields: Record<string, string> = {}
  campos.forEach((crudo: unknown, i) => {
    const ruta = `campos[${i}]`
    if (!esObjeto(crudo)) {
      fields[ruta] = 'Cada campo debe ser un objeto'
      return
    }
    const errores = erroresDeCampo(crudo, fuentes)
    for (const [clave, mensaje] of Object.entries(errores)) fields[`${ruta}.${clave}`] = mensaje
    if (Object.keys(errores).length) return

    const pagina = ausente(crudo.pagina) ? 1 : aNumero(crudo.pagina)
    if (pagina > paginas) fields[`${ruta}.pagina`] = `El diseño tiene ${paginas} ${paginas === 1 ? 'página' : 'páginas'}`
    if (crudo.tipo === 'TEXTO' && !(typeof crudo.texto === 'string' && crudo.texto.trim())) fields[`${ruta}.texto`] = 'Un campo TEXTO necesita su texto'
    const tamano = ausente(crudo.tamano) ? POR_DEFECTO_CAMPO.tamano : aNumero(crudo.tamano)
    if (!ausente(crudo.tamanoMinimo) && aNumero(crudo.tamanoMinimo) > tamano) fields[`${ruta}.tamanoMinimo`] = 'El tamaño mínimo no puede superar al tamaño'
  })

  // Ids repetidos, también entre campos con otros errores
  const ids = new Map<string, number>()
  campos.forEach((crudo: unknown, i) => {
    const id = idDeCampo(crudo, i)
    if (id === null || fields[`campos[${i}].id`]) return
    const anterior = ids.get(id)
    if (anterior !== undefined) fields[`campos[${i}].id`] = `Id repetido (también en campos[${anterior}])`
    else ids.set(id, i)
  })
  return fields
}

/**
 * Errores de `fields` (los del panel o los de un `422 INVALID_TEMPLATE_FIELDS`) agrupados por campo,
 * para marcarlos en el editor: `porCampo[3].tamano`; lo que no es de un campo va en `generales`.
 */
export function erroresPorCampo(fields: Readonly<Record<string, string>> | null | undefined): { generales: string[], porCampo: Record<number, Record<string, string>> } {
  const generales: string[] = []
  const porCampo: Record<number, Record<string, string>> = {}
  for (const [clave, mensaje] of Object.entries(fields ?? {})) {
    const m = /^campos\[(\d+)\](?:\.(\w+))?$/.exec(clave)
    if (!m) {
      generales.push(mensaje)
      continue
    }
    const indice = Number(m[1])
    porCampo[indice] = { ...porCampo[indice], [m[2] ?? 'campo']: mensaje }
  }
  return { generales, porCampo }
}

// ─── Normalización (como la guarda el backend) ───

const CLAVES_CAMPO = [
  'id', 'tipo', 'pagina', 'x', 'y', 'ancho', 'lado', 'fuente', 'tamano', 'tamanoMinimo', 'color',
  'alineacion', 'capitalizacion', 'lineasMax', 'interlineado', 'texto', 'formatoFecha',
] as const satisfies readonly (keyof CampoPlantilla)[]

const CLAVES_NUMERICAS = new Set<string>(['pagina', 'x', 'y', 'ancho', 'lado', 'tamano', 'tamanoMinimo', 'lineasMax', 'interlineado'])
const CLAVES_REDONDEADAS = new Set<string>(['x', 'y', 'ancho', 'lado', 'tamano', 'tamanoMinimo', 'interlineado'])
const CLAVES_RECORTADAS = new Set<string>(['id', 'fuente', 'color'])

/**
 * Campo con las claves en orden fijo, sin vacíos (`null`, `undefined`, `''`), con las medidas a
 * centésimas de pt, el color en minúsculas, la página 1 por defecto y el id `<tipo>-<posición>` si
 * falta: lo mismo que guarda el backend para un campo válido.
 */
export function normalizarCampoPlantilla(campo: Partial<CampoPlantilla>, indice: number): CampoPlantilla {
  const salida: Record<string, unknown> = {}
  for (const clave of CLAVES_CAMPO) {
    let valor: unknown = campo[clave]
    if (typeof valor === 'string' && CLAVES_RECORTADAS.has(clave)) valor = valor.trim()
    if (clave === 'id' && !valor && campo.tipo) valor = `${campo.tipo.toLowerCase()}-${indice + 1}`
    if (clave === 'pagina' && ausente(valor)) valor = 1
    if (valor === null || valor === undefined || valor === '') continue
    if (CLAVES_NUMERICAS.has(clave)) valor = aNumero(valor)
    if (CLAVES_REDONDEADAS.has(clave)) valor = redondear(valor as number)
    if (clave === 'color') valor = String(valor).toLowerCase()
    salida[clave] = valor
  }
  return salida as unknown as CampoPlantilla
}

export function normalizarCamposPlantilla(campos: readonly Partial<CampoPlantilla>[]): CampoPlantilla[] {
  return campos.map((campo, indice) => normalizarCampoPlantilla(campo, indice))
}

/** Copia con las claves de cada objeto ordenadas (MySQL reordena las claves al guardar). */
function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.keys(valor).sort().map((clave) => [clave, canonico((valor as Record<string, unknown>)[clave])]))
  }
  return valor
}

/**
 * Dos listas de campos son iguales después de normalizarlas, sin importar el orden de las claves:
 * el editor sabe si hay cambios sin guardar (y si guardar subiría la versión).
 */
export function mismosCamposPlantilla(a: readonly Partial<CampoPlantilla>[] | null | undefined, b: readonly Partial<CampoPlantilla>[] | null | undefined): boolean {
  return JSON.stringify(canonico(normalizarCamposPlantilla(a ?? []))) === JSON.stringify(canonico(normalizarCamposPlantilla(b ?? [])))
}

// ─── Texto (como `pdf/texto.ts` del backend) ───

/** Partículas que van en minúscula dentro de un nombre (salvo al inicio). */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von', 'der'])

function mayusculaInicial(palabra: string): string {
  if (!palabra) return palabra
  const primera = String.fromCodePoint(palabra.codePointAt(0) as number)
  return primera.toLocaleUpperCase('es') + palabra.slice(primera.length)
}

/** «MARÍA JOSÉ DE LA CRUZ ñahuinlla» → «María José de la Cruz Ñahuinlla» (partículas en minúscula salvo al inicio). */
export function capitalizarTitulo(texto: string): string {
  return texto
    .toLocaleLowerCase('es')
    .split(/(\s+)/)
    .map((parte, indice) => {
      if (/^\s+$/.test(parte) || parte === '') return parte
      if (indice > 0 && PARTICULAS.has(parte)) return parte
      return parte.split('-').map(mayusculaInicial).join('-')
    })
    .join('')
}

export function aplicarCapitalizacion(texto: string, modo: CapitalizacionCampo | null | undefined): string {
  if (modo === 'MAYUSCULAS') return texto.toLocaleUpperCase('es')
  if (modo === 'TITULO') return capitalizarTitulo(texto)
  return texto
}

/** Reemplaza `{marcador}` por su valor; uno desconocido queda tal cual. */
export function reemplazarMarcadores(plantilla: string, valores: Partial<Record<Marcador, string>>): string {
  return plantilla.replace(/\{([A-Za-z]+)\}/g, (completo, nombre: string) => {
    const valor = (valores as Record<string, string | undefined>)[nombre]
    return Object.prototype.hasOwnProperty.call(valores, nombre) && valor !== undefined ? valor : completo
  })
}

/** Marcadores de un texto: los conocidos y los que se imprimirían tal cual (para avisar en el editor). */
export function marcadoresDeTexto(texto: string | null | undefined): { usados: Marcador[], desconocidos: string[] } {
  const usados: Marcador[] = []
  const desconocidos: string[] = []
  for (const [, nombre] of String(texto ?? '').matchAll(/\{([A-Za-z]+)\}/g)) {
    if ((MARCADORES as readonly string[]).includes(nombre as string)) {
      if (!usados.includes(nombre as Marcador)) usados.push(nombre as Marcador)
    } else if (!desconocidos.includes(nombre as string)) {
      desconocidos.push(nombre as string)
    }
  }
  return { usados, desconocidos }
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Fecha `AAAA-MM-DD` como la imprime el backend: LARGO «1 de octubre de 2026», CORTO «01/10/2026». */
export function formatearFechaCertificado(fecha: string, formato: FormatoFechaCampo | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  if (!m) return fecha
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (formato === 'CORTO') return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`
  return `${dia} de ${MESES[mes - 1] ?? ''} de ${anio}`
}

/** Datos con los que el editor muestra cada campo (el PDF real lo da la vista previa del backend). */
export interface DatosEjemplo {
  nombre: string
  /** Texto impreso del tipo (PARTICIPANTE…). */
  tipo: string
  codigo: string
  /** `AAAA-MM-DD`. */
  fechaEmision: string
  horas: number | null
  evento: string
  eventoCorto: string
  documento: string
  detalle: string | null
}

/** Los mismos datos de ejemplo que la vista previa del backend (el evento lo pone la pantalla). */
export const DATOS_EJEMPLO: Readonly<DatosEjemplo> = Object.freeze({
  nombre: 'María José Ñahuinlla Güemes',
  tipo: 'PARTICIPANTE',
  codigo: 'CIISIC-2026-000123-7KQ2XM',
  fechaEmision: '2026-11-03',
  horas: 40,
  evento: 'Nombre del evento',
  eventoCorto: 'Evento',
  documento: 'DNI 12345678',
  detalle: 'Ponencia: «Inteligencia artificial aplicada a la agricultura familiar»',
})

/**
 * Texto que imprimiría el campo con esos datos (como `textoDelCampo` del backend, ya capitalizado), o
 * `null` si no escribe nada: el QR, o un campo HORAS o DETALLE sin valor (aunque tenga `texto`).
 */
export function textoDeEjemplo(campo: Pick<CampoPlantilla, 'tipo' | 'texto' | 'capitalizacion' | 'formatoFecha'>, datos: DatosEjemplo = DATOS_EJEMPLO): string | null {
  const marcadores: Record<Marcador, string> = {
    nombre: datos.nombre,
    tipo: datos.tipo,
    evento: datos.evento,
    eventoCorto: datos.eventoCorto,
    horas: datos.horas === null || datos.horas === undefined ? '' : String(datos.horas),
    fecha: formatearFechaCertificado(datos.fechaEmision, campo.formatoFecha ?? POR_DEFECTO_CAMPO.formatoFecha),
    detalle: datos.detalle ?? '',
    codigo: datos.codigo,
    documento: datos.documento,
  }
  if ((campo.tipo === 'HORAS' && !marcadores.horas) || (campo.tipo === 'DETALLE' && !marcadores.detalle)) return null
  let texto: string | null
  if (campo.texto) {
    texto = reemplazarMarcadores(campo.texto, marcadores)
  } else {
    const porTipo: Partial<Record<TipoCampoPlantilla, string>> = {
      NOMBRE: marcadores.nombre,
      TIPO: marcadores.tipo,
      CODIGO: marcadores.codigo,
      FECHA_EMISION: marcadores.fecha,
      HORAS: marcadores.horas,
      EVENTO: marcadores.evento,
      DOCUMENTO: marcadores.documento,
      DETALLE: marcadores.detalle,
    }
    texto = porTipo[campo.tipo] || null
  }
  return texto === null ? null : aplicarCapitalizacion(texto, campo.capitalizacion)
}

// ─── Píxeles del visor (pdf.js) ↔ puntos PDF ───

/** `page.view` de pdf.js: la CropBox `[x0, y0, x1, y1]` en pt (el diseño no viene rotado). */
export type CajaPdf = readonly [number, number, number, number]

export interface Punto {
  x: number
  y: number
}

/** Pt de un punto del visor (px desde la esquina superior izquierda, a `escala` px por pt). */
export function pxAPt(punto: Punto, view: CajaPdf, escala: number): Punto {
  return { x: view[0] + punto.x / escala, y: view[3] - punto.y / escala }
}

/** Px del visor (desde la esquina superior izquierda) de un punto en pt. */
export function ptAPx(punto: Punto, view: CajaPdf, escala: number): Punto {
  return { x: (punto.x - view[0]) * escala, y: (view[3] - punto.y) * escala }
}

/** Ancho y alto de la CropBox en pt y su origen. */
export function medidasDeCaja(view: CajaPdf): { x0: number, y0: number, anchoPt: number, altoPt: number } {
  return { x0: view[0], y0: view[1], anchoPt: view[2] - view[0], altoPt: view[3] - view[1] }
}

/** Rectángulo en pt con su esquina inferior izquierda en (x, y). */
export interface RectanguloPt {
  x: number
  y: number
  ancho: number
  alto: number
}

/**
 * Caja aproximada que ocupa un campo, para dibujarlo y arrastrarlo en el editor. QR: su cuadrado. Texto:
 * la caja `[x, x + ancho]` o, sin ancho, `anchoTexto` (por defecto 8 veces el tamaño) según la
 * alineación del ancla; de alto, desde la primera línea (ascendentes ≈ 0,8 del tamaño) hasta la última
 * (`lineasMax`, descendentes ≈ 0,2).
 */
export function rectanguloCampo(campo: CampoPlantilla, anchoTexto?: number): RectanguloPt {
  if (campo.tipo === 'QR') {
    const lado = campo.lado ?? POR_DEFECTO_CAMPO.ladoQr
    return { x: campo.x, y: campo.y, ancho: lado, alto: lado }
  }
  const tamano = campo.tamano ?? POR_DEFECTO_CAMPO.tamano
  const lineas = campo.lineasMax ?? POR_DEFECTO_CAMPO.lineasMax
  const interlineado = campo.interlineado ?? POR_DEFECTO_CAMPO.interlineado
  const ancho = campo.ancho ?? anchoTexto ?? tamano * 8
  const alineacion = campo.alineacion ?? POR_DEFECTO_CAMPO.alineacion
  const x = campo.ancho ? campo.x : alineacion === 'CENTRO' ? campo.x - ancho / 2 : alineacion === 'DERECHA' ? campo.x - ancho : campo.x
  const abajo = campo.y - (lineas - 1) * tamano * interlineado - tamano * 0.2
  return { x, y: abajo, ancho, alto: campo.y + tamano * 0.8 - abajo }
}

// ─── Campos nuevos ───

/** Medidas de la página (de la plantilla o de `medidasDeCaja`); `x0`/`y0` si la CropBox está desplazada. */
export interface DimensionesPagina {
  anchoPt: number
  altoPt: number
  x0?: number
  y0?: number
}

/** Id libre `<tipo>-<n>` (p. ej. `texto-6`) para un campo nuevo. */
export function idUnicoCampo(tipo: TipoCampoPlantilla, existentes: readonly Pick<CampoPlantilla, 'id'>[]): string {
  const usados = new Set(existentes.map((campo) => campo.id))
  let n = existentes.length + 1
  while (usados.has(`${tipo.toLowerCase()}-${n}`)) n++
  return `${tipo.toLowerCase()}-${n}`
}

/**
 * Campos con los que empieza una plantilla nueva: NOMBRE centrado en una caja del 80 % del ancho (en
 * mayúsculas, hasta 2 líneas), TIPO centrado debajo, QR abajo a la izquierda con el CÓDIGO a su lado y
 * FECHA de emisión abajo a la derecha. Se acomodan luego en el editor.
 */
export function camposPorDefecto(pagina: DimensionesPagina): CampoPlantilla[] {
  const x0 = pagina.x0 ?? 0
  const y0 = pagina.y0 ?? 0
  const margen = pagina.anchoPt * 0.1
  const ladoQr = 72
  const campos: CampoPlantilla[] = [
    {
      id: 'nombre-1', tipo: 'NOMBRE', pagina: 1, x: x0 + margen, y: y0 + pagina.altoPt * 0.5, ancho: pagina.anchoPt - 2 * margen,
      fuente: 'MONTSERRAT_BOLD', tamano: 28, tamanoMinimo: 16, color: '#1f2937', alineacion: 'CENTRO', capitalizacion: 'MAYUSCULAS', lineasMax: 2,
    },
    { id: 'tipo-2', tipo: 'TIPO', pagina: 1, x: x0 + pagina.anchoPt / 2, y: y0 + pagina.altoPt * 0.4, fuente: 'MONTSERRAT_BOLD', tamano: 18, color: '#1f2937', alineacion: 'CENTRO' },
    { id: 'qr-3', tipo: 'QR', pagina: 1, x: x0 + 36, y: y0 + 30, lado: ladoQr },
    { id: 'codigo-4', tipo: 'CODIGO', pagina: 1, x: x0 + 36 + ladoQr + 10, y: y0 + 34, tamano: 8, color: '#374151' },
    { id: 'fecha_emision-5', tipo: 'FECHA_EMISION', pagina: 1, x: x0 + pagina.anchoPt - 36, y: y0 + 34, tamano: 10, color: '#374151', alineacion: 'DERECHA' },
  ]
  return normalizarCamposPlantilla(campos)
}

/** Campo nuevo de `tipo` en `posicion` (pt), con valores razonables para empezar. */
export function nuevoCampo(tipo: TipoCampoPlantilla, existentes: readonly CampoPlantilla[], posicion: Punto, pagina = 1): CampoPlantilla {
  const base: CampoPlantilla = { id: idUnicoCampo(tipo, existentes), tipo, pagina, x: posicion.x, y: posicion.y }
  if (tipo === 'QR') return normalizarCampoPlantilla({ ...base, lado: POR_DEFECTO_CAMPO.ladoQr }, existentes.length)
  if (tipo === 'TEXTO') {
    return normalizarCampoPlantilla({ ...base, ancho: 400, tamano: 12, alineacion: 'CENTRO', lineasMax: 3, texto: 'Por su participación en el {evento}.' }, existentes.length)
  }
  if (tipo === 'NOMBRE') return normalizarCampoPlantilla({ ...base, tamano: 24, capitalizacion: 'MAYUSCULAS' }, existentes.length)
  return normalizarCampoPlantilla({ ...base, tamano: POR_DEFECTO_CAMPO.tamano }, existentes.length)
}

/**
 * «Centrar horizontalmente» en la página: el QR y un texto con caja se mueven para quedar al medio;
 * un texto sin caja pasa a anclarse en el centro (`alineacion: CENTRO`).
 */
export function centrarHorizontalmente(campo: CampoPlantilla, pagina: DimensionesPagina): CampoPlantilla {
  const x0 = pagina.x0 ?? 0
  if (campo.tipo === 'QR') return { ...campo, x: redondear(x0 + (pagina.anchoPt - (campo.lado ?? POR_DEFECTO_CAMPO.ladoQr)) / 2) }
  if (campo.ancho) return { ...campo, x: redondear(x0 + (pagina.anchoPt - campo.ancho) / 2) }
  return { ...campo, x: redondear(x0 + pagina.anchoPt / 2), alineacion: 'CENTRO' }
}

// ─── Avisos de la vista previa (`X-Avisos`, `X-Avisos-Total`) ───

export const MENSAJES_AVISO_PLANTILLA: Readonly<Record<string, string>> = {
  GLIFO_RESPALDO: 'Algún carácter no existe en la fuente elegida: se imprime con DejaVu Sans.',
  GLIFO_FALTANTE: 'Algún carácter no existe en ninguna fuente: no se imprimirá.',
  DESBORDA: 'El texto no entra en su caja ni con el tamaño mínimo: amplía la caja, permite más líneas o baja el tamaño mínimo.',
  PAGINA_INEXISTENTE: 'El campo está en una página que el diseño no tiene.',
  FUENTE_DESCONOCIDA: 'La fuente no está en el catálogo: se usa Montserrat.',
  FUENTE_SIN_SUBCONJUNTO: 'La fuente se incluyó completa: el PDF pesa más.',
  URL_VERIFICACION_NO_CONFIGURADA: 'Falta la URL del panel en Sistema: el QR de la vista previa es de ejemplo y no se podrán generar certificados hasta configurarla.',
  MAS_AVISOS: 'Hay más avisos que no caben en la respuesta.',
}

export interface AvisosVistaPrevia {
  avisos: AvisoEstampado[]
  /** Total que informa `X-Avisos-Total` (puede ser mayor que los recibidos). */
  total: number
  /** No llegaron todos (`MAS_AVISOS`). */
  incompletos: boolean
}

interface CabecerasRespuesta {
  get: (nombre: string) => string | null
}

/** Avisos de la cabecera `X-Avisos` (`encodeURIComponent(JSON.stringify([...]))`) de la vista previa. */
export function avisosDeVistaPrevia(cabeceras: CabecerasRespuesta): AvisosVistaPrevia {
  let lista: unknown = []
  const crudo = cabeceras.get('x-avisos')
  if (crudo) {
    try {
      lista = JSON.parse(decodeURIComponent(crudo))
    } catch {
      lista = []
    }
  }
  const avisos: AvisoEstampado[] = []
  let incompletos = false
  for (const item of Array.isArray(lista) ? lista : []) {
    if (!esObjeto(item) || typeof item.codigo !== 'string') continue
    if (item.codigo === 'MAS_AVISOS') {
      incompletos = true
      continue
    }
    const mensaje = typeof item.mensaje === 'string' && item.mensaje ? item.mensaje : (MENSAJES_AVISO_PLANTILLA[item.codigo] ?? item.codigo)
    avisos.push({ campo: typeof item.campo === 'string' ? item.campo : null, codigo: item.codigo, mensaje })
  }
  const total = Number(cabeceras.get('x-avisos-total'))
  return { avisos, total: Number.isSafeInteger(total) && total >= avisos.length ? total : avisos.length, incompletos: incompletos || total > avisos.length }
}
