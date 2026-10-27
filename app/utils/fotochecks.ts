import { encode } from 'uqr'
import type { AlmacenFotocheck } from '~/utils/fotocheck'

/**
 * Fotochecks para imprimir (spec 030): lógica pura de `/fotochecks`. Los inscritos salen del CSV de inscripciones
 * (backend spec 040: columna «Código QR»), la única vía en bloque para el código; las medidas van en **cm** y se
 * calculan aquí, y `components/fotochecks` las dibuja. Los nombres llevan «Fotocheck» donde podrían chocar con otros
 * archivos de `app/utils` (Nuxt los auto-importa).
 *
 * El código del QR es una credencial: nada de este archivo lo guarda en el almacenamiento del navegador.
 */

// ─── Medidas y diseño ───

/** Píxeles CSS de un centímetro (96 ppp): la vista previa escala la hoja con él. */
export const PX_POR_CM = 96 / 2.54

/** Tolerancia para que 20.4 / 10.2 (que en coma flotante puede dar 1.9999…) cuente como 2. */
const EPSILON = 1e-6

export type TemaFotocheck = 'OSCURO' | 'CLARO'
export type OrientacionHoja = 'AUTO' | 'VERTICAL' | 'HORIZONTAL'
export type PresetHoja = 'A4' | 'CARTA' | 'A3' | 'A5' | 'PERSONALIZADA'
export type OrdenFotochecks = 'APELLIDOS' | 'INSCRIPCION'
export type ElementoFotocheck = 'logoCongreso' | 'logoFi' | 'nombreCongreso' | 'marcaDeAgua' | 'tipo' | 'codigo'

/** Hojas conocidas, siempre en vertical (ancho < alto); la orientación la decide la rejilla. */
export const OPCIONES_HOJA: ReadonlyArray<{ id: PresetHoja, etiqueta: string, ancho: number, alto: number }> = [
  { id: 'A4', etiqueta: 'A4', ancho: 21, alto: 29.7 },
  { id: 'CARTA', etiqueta: 'Carta', ancho: 21.59, alto: 27.94 },
  { id: 'A3', etiqueta: 'A3', ancho: 29.7, alto: 42 },
  { id: 'A5', etiqueta: 'A5', ancho: 14.8, alto: 21 },
  { id: 'PERSONALIZADA', etiqueta: 'Personalizada', ancho: 21, alto: 29.7 },
]

/** Medidas frecuentes del fotocheck (el porta-fotocheck del congreso y la tarjeta de PVC). */
export const TAMANOS_FOTOCHECK: ReadonlyArray<{ id: string, etiqueta: string, ancho: number, alto: number }> = [
  { id: 'porta', etiqueta: 'Porta fotocheck · 6.7 × 10 cm', ancho: 6.7, alto: 10 },
  { id: 'cr80', etiqueta: 'Tarjeta CR80 · 5.4 × 8.56 cm', ancho: 5.4, alto: 8.56 },
]

/** Elementos que se pueden mostrar u ocultar en la tarjeta, con el texto de su casilla. */
export const ELEMENTOS_FOTOCHECK: ReadonlyArray<{ id: ElementoFotocheck, etiqueta: string, descripcion: string }> = [
  { id: 'logoCongreso', etiqueta: 'Logo del congreso', descripcion: 'Junto al nombre corto del evento' },
  { id: 'logoFi', etiqueta: 'Logo de la Facultad de Ingeniería', descripcion: 'A la derecha de la cabecera' },
  { id: 'nombreCongreso', etiqueta: 'Nombre completo del congreso', descripcion: 'Bajo la cabecera' },
  { id: 'marcaDeAgua', etiqueta: 'Marca de agua', descripcion: 'El logo del congreso, grande y tenue' },
  { id: 'tipo', etiqueta: 'Categoría', descripcion: '«Asistente», en una pastilla bajo el nombre' },
  { id: 'codigo', etiqueta: 'Código bajo el QR', descripcion: 'Las 10 letras o números del QR' },
]

export interface ConfigFotocheck {
  tema: TemaFotocheck
  /** `#rrggbb`: borde, pastilla y banda del rol. */
  acento: string
  /** Medidas del fotocheck, en cm. */
  ancho: number
  alto: number
  hoja: PresetHoja
  /** Solo con `PERSONALIZADA`, en cm. */
  hojaAncho: number
  hojaAlto: number
  orientacion: OrientacionHoja
  /** Margen mínimo de la hoja y separación entre fotochecks, en cm. */
  margen: number
  separacion: number
  /** Cuánto se extiende el fondo fuera del corte, en cm (nunca más de la mitad de la separación). */
  sangrado: number
  orden: OrdenFotochecks
  mayusculas: boolean
  mostrar: Record<ElementoFotocheck, boolean>
  /** Vacío = el texto del evento elegido. */
  textos: { eventoCorto: string, eventoNombre: string }
}

/** Configuración inicial: tarjeta de 6.7 × 10 cm en A4, tema oscuro como la credencial web y el cian del congreso. */
export function configPorDefectoFotocheck(): ConfigFotocheck {
  return {
    tema: 'OSCURO',
    acento: '#00d9e8',
    ancho: 6.7,
    alto: 10,
    hoja: 'A4',
    hojaAncho: 21,
    hojaAlto: 29.7,
    orientacion: 'AUTO',
    margen: 0.4,
    separacion: 0.2,
    sangrado: 0.1,
    orden: 'APELLIDOS',
    mayusculas: true,
    mostrar: { logoCongreso: true, logoFi: true, nombreCongreso: true, marcaDeAgua: true, tipo: false, codigo: true },
    textos: { eventoCorto: '', eventoNombre: '' },
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor)
}

/** Número dentro de `[min, max]` con dos decimales; lo que no sea un número válido vuelve al valor por defecto. */
function acotar(valor: unknown, defecto: number, min: number, max: number): number {
  const numero = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : Number.NaN
  if (!Number.isFinite(numero)) return defecto
  return Math.min(max, Math.max(min, Math.round(numero * 100) / 100))
}

export function esColorHex(valor: unknown): valor is string {
  return typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor)
}

const textoCorto = (valor: unknown) => (typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, 120) : '')
const booleano = (valor: unknown, defecto: boolean) => (typeof valor === 'boolean' ? valor : defecto)

/**
 * Configuración válida a partir de lo que haya (formulario a medias, almacenamiento de otra versión o dañado):
 * recorta los rangos y rellena con los valores por defecto. Siempre devuelve un objeto nuevo.
 */
export function normalizarConfigFotocheck(valor: unknown): ConfigFotocheck {
  const base = configPorDefectoFotocheck()
  const v = esObjeto(valor) ? valor : {}
  const mostrar = esObjeto(v.mostrar) ? v.mostrar : {}
  const textos = esObjeto(v.textos) ? v.textos : {}
  const separacion = acotar(v.separacion, base.separacion, 0, 3)
  return {
    tema: v.tema === 'CLARO' ? 'CLARO' : 'OSCURO',
    acento: esColorHex(v.acento) ? v.acento.toLowerCase() : base.acento,
    ancho: acotar(v.ancho, base.ancho, 3, 30),
    alto: acotar(v.alto, base.alto, 3, 30),
    hoja: OPCIONES_HOJA.find((opcion) => opcion.id === v.hoja)?.id ?? base.hoja,
    hojaAncho: acotar(v.hojaAncho, base.hojaAncho, 10, 100),
    hojaAlto: acotar(v.hojaAlto, base.hojaAlto, 10, 100),
    orientacion: v.orientacion === 'VERTICAL' || v.orientacion === 'HORIZONTAL' ? v.orientacion : 'AUTO',
    margen: acotar(v.margen, base.margen, 0, 3),
    separacion,
    sangrado: Math.min(acotar(v.sangrado, base.sangrado, 0, 0.5), separacion / 2),
    orden: v.orden === 'INSCRIPCION' ? 'INSCRIPCION' : 'APELLIDOS',
    mayusculas: booleano(v.mayusculas, base.mayusculas),
    mostrar: {
      logoCongreso: booleano(mostrar.logoCongreso, base.mostrar.logoCongreso),
      logoFi: booleano(mostrar.logoFi, base.mostrar.logoFi),
      nombreCongreso: booleano(mostrar.nombreCongreso, base.mostrar.nombreCongreso),
      marcaDeAgua: booleano(mostrar.marcaDeAgua, base.mostrar.marcaDeAgua),
      tipo: booleano(mostrar.tipo, base.mostrar.tipo),
      codigo: booleano(mostrar.codigo, base.mostrar.codigo),
    },
    textos: { eventoCorto: textoCorto(textos.eventoCorto), eventoNombre: textoCorto(textos.eventoNombre) },
  }
}

/** Medidas de la hoja elegida, siempre en vertical (la orientación se decide en `calcularRejilla`). */
export function medidasHoja(config: Pick<ConfigFotocheck, 'hoja' | 'hojaAncho' | 'hojaAlto'>): { ancho: number, alto: number } {
  const preset = config.hoja === 'PERSONALIZADA' ? undefined : OPCIONES_HOJA.find((opcion) => opcion.id === config.hoja)
  const a = preset?.ancho ?? config.hojaAncho
  const b = preset?.alto ?? config.hojaAlto
  return { ancho: Math.min(a, b), alto: Math.max(a, b) }
}

/** Número de decimales justo: `29.7`, `10`, `6.7` (sin ceros de más). */
export function formatoCm(valor: number): string {
  return String(Math.round(valor * 100) / 100)
}

/** Color de texto legible sobre un fondo `#rrggbb` (navy del congreso o blanco). */
export function colorTextoSobre(fondo: string): '#041d39' | '#ffffff' {
  if (!esColorHex(fondo)) return '#ffffff'
  const canal = (desde: number) => {
    const c = Number.parseInt(fondo.slice(desde, desde + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminancia = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
  return luminancia > 0.179 ? '#041d39' : '#ffffff'
}

// ─── Rejilla: cuántos fotochecks caben en la hoja ───

export interface Rejilla {
  orientacion: 'VERTICAL' | 'HORIZONTAL'
  /** Medidas de la hoja ya con la orientación, en cm. */
  hojaAncho: number
  hojaAlto: number
  columnas: number
  filas: number
  porHoja: number
  /** Esquina superior izquierda del bloque de fotochecks, centrado en la hoja, en cm. */
  origenX: number
  origenY: number
}

/** Cuántos lados de `lado` (con `separacion` entre ellos) caben en `espacio` dejando `margen` a cada extremo. */
function cabenEn(espacio: number, lado: number, margen: number, separacion: number): number {
  if (lado <= 0) return 0
  return Math.max(0, Math.floor((espacio - 2 * margen + separacion) / (lado + separacion) + EPSILON))
}

function rejillaEn(
  orientacion: 'VERTICAL' | 'HORIZONTAL',
  hoja: { ancho: number, alto: number },
  tarjeta: { ancho: number, alto: number },
  margen: number,
  separacion: number,
): Rejilla {
  const horizontal = orientacion === 'HORIZONTAL'
  const hojaAncho = horizontal ? hoja.alto : hoja.ancho
  const hojaAlto = horizontal ? hoja.ancho : hoja.alto
  const columnas = cabenEn(hojaAncho, tarjeta.ancho, margen, separacion)
  const filas = cabenEn(hojaAlto, tarjeta.alto, margen, separacion)
  const usadoX = columnas * tarjeta.ancho + Math.max(0, columnas - 1) * separacion
  const usadoY = filas * tarjeta.alto + Math.max(0, filas - 1) * separacion
  return { orientacion, hojaAncho, hojaAlto, columnas, filas, porHoja: columnas * filas, origenX: (hojaAncho - usadoX) / 2, origenY: (hojaAlto - usadoY) / 2 }
}

/** La rejilla en las dos orientaciones (para el aviso «Vertical 4 · Horizontal 8»). `hoja` en vertical. */
export function compararOrientaciones(
  hoja: { ancho: number, alto: number },
  tarjeta: { ancho: number, alto: number },
  margen: number,
  separacion: number,
): { vertical: Rejilla, horizontal: Rejilla } {
  return {
    vertical: rejillaEn('VERTICAL', hoja, tarjeta, margen, separacion),
    horizontal: rejillaEn('HORIZONTAL', hoja, tarjeta, margen, separacion),
  }
}

/**
 * Cuántos fotochecks caben por hoja y dónde va cada uno. `AUTO` elige la orientación con más fotochecks
 * (empate: vertical). Si no cabe ninguno, `porHoja` es 0.
 */
export function calcularRejilla(
  hoja: { ancho: number, alto: number },
  tarjeta: { ancho: number, alto: number },
  margen: number,
  separacion: number,
  orientacion: OrientacionHoja,
): Rejilla {
  const { vertical, horizontal } = compararOrientaciones(hoja, tarjeta, margen, separacion)
  if (orientacion === 'VERTICAL') return vertical
  if (orientacion === 'HORIZONTAL') return horizontal
  return horizontal.porHoja > vertical.porHoja ? horizontal : vertical
}

/** Cuántas hojas hacen falta para `total` fotochecks. */
export function cantidadDeHojas(total: number, porHoja: number): number {
  return porHoja > 0 && total > 0 ? Math.ceil(total / porHoja) : 0
}

/** Reparte la lista en hojas de `porHoja` fotochecks. */
export function paginarFotochecks<T>(lista: readonly T[], porHoja: number): T[][] {
  if (porHoja < 1) return []
  const hojas: T[][] = []
  for (let desde = 0; desde < lista.length; desde += porHoja) hojas.push(lista.slice(desde, desde + porHoja))
  return hojas
}

/** «A4 horizontal · 29.7 × 21 cm». */
export function etiquetaHoja(config: Pick<ConfigFotocheck, 'hoja'>, rejilla: Pick<Rejilla, 'orientacion' | 'hojaAncho' | 'hojaAlto'>): string {
  const nombre = OPCIONES_HOJA.find((opcion) => opcion.id === config.hoja)?.etiqueta ?? 'Personalizada'
  const orientacion = rejilla.orientacion === 'HORIZONTAL' ? 'horizontal' : 'vertical'
  return `${nombre} ${orientacion} · ${formatoCm(rejilla.hojaAncho)} × ${formatoCm(rejilla.hojaAlto)} cm`
}

/** «8 por hoja · 4 × 2 · 9 hojas para 70». */
export function resumenRejilla(rejilla: Pick<Rejilla, 'porHoja' | 'columnas' | 'filas'>, total: number): string {
  if (rejilla.porHoja < 1) return 'El fotocheck no cabe en la hoja con ese margen'
  const base = `${rejilla.porHoja} por hoja · ${rejilla.columnas} × ${rejilla.filas}`
  const hojas = cantidadDeHojas(total, rejilla.porHoja)
  return hojas ? `${base} · ${hojas} ${hojas === 1 ? 'hoja' : 'hojas'} para ${total}` : base
}

// ─── Asistentes ───

/** Lo único que se imprime de cada persona; del CSV se descarta todo lo demás (documento, correo, celular, pagos). */
export interface AsistenteFotocheck {
  /** `inscripcion:<id>` (o `codigo:<código>` si el CSV no trae `ID`) o `manual:<n>`: llave de la selección. */
  clave: string
  /** Id de la inscripción; `null` en las personas agregadas a mano. */
  id: number | null
  nombres: string
  apellidos: string
  /** 10 caracteres `[0-9A-Z]` del QR; vacío = sin QR (solo personas agregadas a mano). */
  codigo: string
  /** «Tipo de inscripción» (filtro y tabla). */
  tipo: string
  /** Texto de la pastilla: «Asistente» para todo inscrito, o el rol escrito a mano. */
  rol: string
  virtual: boolean
}

/** Pastilla de todo inscrito, sin importar su tipo, su clasificación ni si viene de una delegación (se imprime en mayúsculas). */
export const ROL_ASISTENTE = 'Asistente'

/** Persona ficticia para ver el diseño antes de cargar a nadie (nunca un código real). */
export const ASISTENTE_EJEMPLO: Readonly<AsistenteFotocheck> = Object.freeze({
  clave: 'ejemplo',
  id: null,
  nombres: 'Nombres',
  apellidos: 'Apellidos de ejemplo',
  codigo: 'ABCDE12345',
  tipo: 'Asistente',
  rol: ROL_ASISTENTE,
  virtual: false,
})

/** Mismo formato que `codigo_credencial` del backend: 10 caracteres en mayúsculas. */
export const REGEX_CODIGO_FOTOCHECK = /^[0-9A-Z]{10}$/

const limpiar = (valor: unknown) => String(valor ?? '').replace(/\s+/g, ' ').trim()

/** Sin tildes, en minúsculas y con un solo espacio: sirve para comparar títulos de columna y para buscar. */
const sinTildes = (valor: string) => valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Nombre y apellidos como se imprimen (mayúsculas si se pidió). */
export function nombreParaFotocheck(persona: Pick<AsistenteFotocheck, 'nombres' | 'apellidos'>, mayusculas: boolean): string {
  const nombre = [persona.nombres, persona.apellidos].map(limpiar).filter(Boolean).join(' ')
  return mayusculas ? nombre.toLocaleUpperCase('es-PE') : nombre
}

/**
 * Tamaño del nombre en `cqw` (1 % del ancho útil de la tarjeta): 10.5 es el de la credencial web y baja por tramos
 * para que un nombre largo siga cabiendo en tres líneas sin pisar el QR.
 */
export function tamanoNombreFotocheck(nombre: string): number {
  const largo = nombre.length
  if (largo <= 34) return 10.5
  if (largo <= 46) return 8.8
  if (largo <= 60) return 7.4
  return 6.2
}

// ─── Lectura del CSV de inscripciones (backend spec 040) ───

export interface ResultadoCsvFotochecks {
  asistentes: AsistenteFotocheck[]
  /** Inscripciones aprobadas que todavía no tienen código. */
  sinCodigo: number
  /** Filas que no están aprobadas (un CSV propio con todos los estados). */
  noAprobados: number
  /** Títulos imprescindibles que el archivo no trae. */
  faltanColumnas: string[]
}

/** Ruta (relativa al BFF) del CSV de los inscritos aprobados del evento. */
export function rutaExportacionInscritos(eventoId: number): string {
  return `events/${eventoId}/inscriptions/export?estado=APROBADO`
}

/** Filas de un CSV: comillas dobles (`""`), separador y saltos de línea dentro de comillas; las líneas vacías se omiten. */
function partirCsv(texto: string, separador: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false
  const cerrarFila = () => {
    fila.push(celda)
    if (fila.some((valor) => valor !== '')) filas.push(fila)
    fila = []
    celda = ''
  }
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charAt(i)
    if (entreComillas) {
      if (c !== '"') celda += c
      else if (texto.charAt(i + 1) === '"') { celda += '"'; i++ } else entreComillas = false
    } else if (c === '"') {
      entreComillas = true
    } else if (c === separador) {
      fila.push(celda)
      celda = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto.charAt(i + 1) === '\n') i++
      cerrarFila()
    } else {
      celda += c
    }
  }
  if (celda !== '' || fila.length) cerrarFila()
  return filas
}

/** El backend antepone `'` a lo que empieza con `= + - @` (inyección CSV): se quita para mostrar el dato real. */
const sinNeutralizar = (valor: string) => (/^'[=+\-@\t\r]/.test(valor) ? valor.slice(1) : valor)

/**
 * Asistentes del CSV de inscripciones (`GET events/:id/inscriptions/export`): separador `;` (o `,`), BOM, comillas.
 * Ubica las columnas **por su título** (no por su posición), conserva solo lo que se imprime y descarta a quien no está
 * aprobado, no tiene código válido o ya apareció. Sin las columnas imprescindibles devuelve `faltanColumnas`
 * (p. ej. un backend sin la spec 040 no trae «Código QR»).
 */
export function leerInscritosCsv(texto: string): ResultadoCsvFotochecks {
  const contenido = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  const finLinea = contenido.search(/[\r\n]/)
  const primera = finLinea === -1 ? contenido : contenido.slice(0, finLinea)
  const separador = primera.includes(';') || !primera.includes(',') ? ';' : ','
  const [cabecera, ...filas] = partirCsv(contenido, separador)
  const vacio = (faltanColumnas: string[]): ResultadoCsvFotochecks => ({ asistentes: [], sinCodigo: 0, noAprobados: 0, faltanColumnas })
  if (!cabecera) return vacio(['Nombres', 'Apellidos', 'Código QR'])

  const titulos = cabecera.map(sinTildes)
  const columna = (titulo: string) => titulos.indexOf(titulo)
  const iNombres = columna('nombres')
  const iApellidos = columna('apellidos')
  const iCodigo = columna('codigo qr')
  const faltan = [['Nombres', iNombres], ['Apellidos', iApellidos], ['Código QR', iCodigo]] as const
  const ausentes = faltan.filter(([, indice]) => indice < 0).map(([nombre]) => nombre)
  if (ausentes.length) return vacio(ausentes)

  const iId = columna('id')
  const iTipo = columna('tipo de inscripcion')
  const iModalidad = columna('modalidad de asistencia')
  const iEstado = columna('estado')
  const dato = (fila: string[], indice: number) => (indice < 0 ? '' : limpiar(sinNeutralizar(fila[indice] ?? '')))

  const asistentes: AsistenteFotocheck[] = []
  const vistos = new Set<string>()
  let sinCodigo = 0
  let noAprobados = 0
  for (const fila of filas) {
    if (iEstado >= 0 && sinTildes(dato(fila, iEstado)) !== 'aprobado') {
      noAprobados++
      continue
    }
    const codigo = dato(fila, iCodigo).toUpperCase()
    if (!REGEX_CODIGO_FOTOCHECK.test(codigo)) {
      sinCodigo++
      continue
    }
    const nombres = dato(fila, iNombres)
    const apellidos = dato(fila, iApellidos)
    if (vistos.has(codigo) || (!nombres && !apellidos)) continue
    vistos.add(codigo)
    const id = Number(dato(fila, iId))
    const tipo = dato(fila, iTipo)
    asistentes.push({
      clave: Number.isSafeInteger(id) && id > 0 ? `inscripcion:${id}` : `codigo:${codigo}`,
      id: Number.isSafeInteger(id) && id > 0 ? id : null,
      nombres,
      apellidos,
      codigo,
      tipo,
      rol: ROL_ASISTENTE,
      virtual: dato(fila, iModalidad).toUpperCase() === 'VIRTUAL',
    })
  }
  return { asistentes, sinCodigo, noAprobados, faltanColumnas: [] }
}

// ─── Personas agregadas a mano ───

export type ResultadoManual =
  | { ok: true, asistente: AsistenteFotocheck }
  | { ok: false, errores: Partial<Record<'nombre' | 'rol' | 'codigo', string>> }

/**
 * Persona que no está en las inscripciones (ponente, organizador, prensa): nombre y rol; el código es opcional y, si no
 * hay, la tarjeta no lleva QR sino una banda con el rol. Un QR inventado no marcaría asistencia: para eso la persona
 * debe estar inscrita (cortesía).
 */
export function crearAsistenteManual(datos: { nombre: string, rol: string, codigo?: string }, numero: number): ResultadoManual {
  const nombre = limpiar(datos.nombre)
  const rol = limpiar(datos.rol)
  const codigo = limpiar(datos.codigo).toUpperCase()
  const errores: Partial<Record<'nombre' | 'rol' | 'codigo', string>> = {}
  if (!nombre) errores.nombre = 'Escribe el nombre.'
  else if (nombre.length > 80) errores.nombre = 'Máximo 80 caracteres.'
  if (rol.length > 30) errores.rol = 'Máximo 30 caracteres.'
  else if (!rol && !codigo) errores.rol = 'Escribe el rol: es lo que se imprime en la banda.'
  if (codigo && !REGEX_CODIGO_FOTOCHECK.test(codigo)) errores.codigo = 'Son 10 letras mayúsculas o números.'
  if (Object.keys(errores).length) return { ok: false, errores }
  return { ok: true, asistente: { clave: `manual:${numero}`, id: null, nombres: nombre, apellidos: '', codigo, tipo: rol || 'Manual', rol: rol || ROL_ASISTENTE,virtual: false } }
}

// ─── Lista: filtros, orden y «ya impreso» ───

export type FiltroImpresion = 'TODOS' | 'PENDIENTES' | 'IMPRESOS'

export interface FiltrosFotochecks {
  busqueda: string
  /** `''` = todos los tipos. */
  tipo: string
  impresion: FiltroImpresion
  virtuales: boolean
}

export const FILTROS_FOTOCHECKS_INICIALES: Readonly<FiltrosFotochecks> = Object.freeze({ busqueda: '', tipo: '', impresion: 'TODOS', virtuales: false })

/** Las personas agregadas a mano no tienen id, así que nunca figuran como impresas. */
export function esImpresoFotocheck(persona: Pick<AsistenteFotocheck, 'id'>, impresos: ReadonlySet<number>): boolean {
  return persona.id !== null && impresos.has(persona.id)
}

/** Búsqueda por nombre, apellidos y tipo (sin tildes ni mayúsculas); nunca por código, que no se muestra. */
export function filtrarAsistentes(lista: readonly AsistenteFotocheck[], filtros: FiltrosFotochecks, impresos: ReadonlySet<number>): AsistenteFotocheck[] {
  const palabras = sinTildes(filtros.busqueda).split(' ').filter(Boolean)
  return lista.filter((persona) => {
    if (!filtros.virtuales && persona.virtual) return false
    if (filtros.tipo && persona.tipo !== filtros.tipo) return false
    if (filtros.impresion !== 'TODOS' && (filtros.impresion === 'IMPRESOS') !== esImpresoFotocheck(persona, impresos)) return false
    if (!palabras.length) return true
    const texto = sinTildes(`${persona.nombres} ${persona.apellidos} ${persona.tipo} ${persona.rol}`)
    return palabras.every((palabra) => texto.includes(palabra))
  })
}

const COLACION = new Intl.Collator('es-PE', { sensitivity: 'base', numeric: true })

/** Por apellidos y nombres (o por orden de inscripción); no modifica la lista recibida. */
export function ordenarAsistentes(lista: readonly AsistenteFotocheck[], orden: OrdenFotochecks): AsistenteFotocheck[] {
  const copia = [...lista]
  if (orden === 'INSCRIPCION') return copia.sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))
  return copia.sort((a, b) => COLACION.compare(a.apellidos, b.apellidos) || COLACION.compare(a.nombres, b.nombres))
}

/** Tipos de inscripción distintos, para el filtro. */
export function tiposDeAsistentes(lista: readonly AsistenteFotocheck[]): string[] {
  return [...new Set(lista.map((persona) => persona.tipo).filter(Boolean))].sort((a, b) => COLACION.compare(a, b))
}

// ─── QR ───

export interface ModulosQr {
  /** Módulos por lado (21 para un código de 10 caracteres). */
  lado: number
  /** Una sola ruta SVG con todos los módulos oscuros, en unidades de módulo. */
  ruta: string
}

/** Ruta SVG de los módulos oscuros: los tramos horizontales seguidos se funden en un solo rectángulo. */
export function rutaDeModulos(modulos: ReadonlyArray<readonly boolean[]>): string {
  const partes: string[] = []
  modulos.forEach((fila, y) => {
    let x = 0
    while (x < fila.length) {
      if (!fila[x]) {
        x++
        continue
      }
      let fin = x
      while (fin < fila.length && fila[fin]) fin++
      const largo = fin - x
      partes.push(`M${x} ${y}h${largo}v1h-${largo}z`)
      x = fin
    }
  })
  return partes.join('')
}

const LIMITE_CACHE_QR = 2000
const cacheQr = new Map<string, ModulosQr>()

/**
 * QR del código, igual que el de la credencial web (`uqr`, corrección M, sin borde): vectorial y sin `v-html`. La caché
 * vive solo en memoria y se acota; `olvidarQrs` la vacía al descartar la lista.
 */
export function modulosQr(codigo: string): ModulosQr {
  const guardado = cacheQr.get(codigo)
  if (guardado) return guardado
  const { data } = encode(codigo, { ecc: 'M', border: 0 })
  const modulos = { lado: data.length, ruta: rutaDeModulos(data) }
  if (cacheQr.size >= LIMITE_CACHE_QR) cacheQr.clear()
  cacheQr.set(codigo, modulos)
  return modulos
}

export function olvidarQrs(): void {
  cacheQr.clear()
}

// ─── Lo que se guarda en este navegador ───

/** Diseño elegido: no es sensible. */
export const CLAVE_CONFIG_FOTOCHECKS = 'ciisic:fotochecks:config'

/** Solo ids de inscripción ya impresas (nunca nombres ni códigos), una lista por evento. */
export function claveImpresosFotochecks(eventoId: number): string {
  return `ciisic:fotochecks:impresos:${eventoId}`
}

const MAXIMO_IMPRESOS = 20_000

export function leerConfigFotocheck(almacen: AlmacenFotocheck | null): ConfigFotocheck | null {
  if (!almacen) return null
  try {
    const texto = almacen.getItem(CLAVE_CONFIG_FOTOCHECKS)
    return texto ? normalizarConfigFotocheck(JSON.parse(texto)) : null
  } catch {
    return null
  }
}

export function guardarConfigFotocheck(almacen: AlmacenFotocheck | null, config: ConfigFotocheck): void {
  try {
    almacen?.setItem(CLAVE_CONFIG_FOTOCHECKS, JSON.stringify(config))
  } catch {
    // Sin espacio o almacenamiento bloqueado: el diseño dura hasta recargar
  }
}

export function leerImpresosFotocheck(almacen: AlmacenFotocheck | null, eventoId: number | null): Set<number> {
  if (!almacen || !eventoId) return new Set()
  try {
    const valor: unknown = JSON.parse(almacen.getItem(claveImpresosFotochecks(eventoId)) ?? '[]')
    if (!Array.isArray(valor)) return new Set()
    return new Set(valor.filter((id): id is number => Number.isSafeInteger(id) && id > 0).slice(0, MAXIMO_IMPRESOS))
  } catch {
    return new Set()
  }
}

export function guardarImpresosFotocheck(almacen: AlmacenFotocheck | null, eventoId: number | null, ids: Iterable<number>): void {
  if (!almacen || !eventoId) return
  try {
    almacen.setItem(claveImpresosFotochecks(eventoId), JSON.stringify([...new Set(ids)].slice(0, MAXIMO_IMPRESOS)))
  } catch {
    // Sin espacio o almacenamiento bloqueado: la marca dura hasta recargar
  }
}
