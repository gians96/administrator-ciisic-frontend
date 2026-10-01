import type { FilaImportacion } from '~/types/api'
import { esCorreoDeAcceso, normalizarCorreo } from '~/utils/codigoAcceso'
import { esDocumentoValido, MAX_NOMBRE } from '~/utils/participantes'

/**
 * Lista de destinatarios para emitir certificados (organizadores, ponentes…) pegada o subida como CSV
 * (`POST /events/:eventId/certificates/import`, backend-ciisic spec 015). Acepta `;`, `,` o tabulador
 * (pegado desde Excel), comillas de CSV, BOM y encabezados opcionales. Valida cada fila con las reglas
 * del alta de participantes y marca los documentos repetidos; el backend vuelve a validar todo y
 * responde fila por fila. Se envía en tandas de 300 filas.
 */

/** Filas por solicitud (más → `422 IMPORT_TOO_LARGE`). */
export const MAX_FILAS_POR_TANDA = 300
export const MAX_HORAS_CERTIFICADO = 10_000
export const MAX_DETALLE_CERTIFICADO = 500

/** Columnas en el orden por defecto (sin encabezado). */
export const COLUMNAS_LISTA = ['tipoDocumento', 'numeroDocumento', 'correo', 'nombres', 'apellidos', 'detalle', 'horas'] as const
export type ColumnaLista = typeof COLUMNAS_LISTA[number]

export const ETIQUETAS_COLUMNA_LISTA: Readonly<Record<ColumnaLista, string>> = {
  tipoDocumento: 'Tipo de documento',
  numeroDocumento: 'N.° de documento',
  correo: 'Correo',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  detalle: 'Detalle',
  horas: 'Horas',
}

/** Encabezados reconocidos (en minúsculas, sin tildes, espacios ni signos). */
const ALIAS_COLUMNA: Readonly<Record<string, ColumnaLista>> = {
  tipodocumento: 'tipoDocumento',
  tipodedocumento: 'tipoDocumento',
  tipodoc: 'tipoDocumento',
  tipo: 'tipoDocumento',
  numerodocumento: 'numeroDocumento',
  numerodedocumento: 'numeroDocumento',
  nrodocumento: 'numeroDocumento',
  nrodedocumento: 'numeroDocumento',
  ndocumento: 'numeroDocumento',
  ndedocumento: 'numeroDocumento',
  nrodoc: 'numeroDocumento',
  documento: 'numeroDocumento',
  dni: 'numeroDocumento',
  correo: 'correo',
  correoelectronico: 'correo',
  email: 'correo',
  mail: 'correo',
  nombres: 'nombres',
  nombre: 'nombres',
  apellidos: 'apellidos',
  apellido: 'apellidos',
  detalle: 'detalle',
  descripcion: 'detalle',
  horas: 'horas',
  horasacademicas: 'horas',
}

/** Valores del tipo de documento (`dni` o `ce`, como el backend). */
const ALIAS_TIPO_DOCUMENTO: Readonly<Record<string, 'dni' | 'ce'>> = {
  dni: 'dni',
  ce: 'ce',
  carne: 'ce',
  carnet: 'ce',
  carnedeextranjeria: 'ce',
  carnetdeextranjeria: 'ce',
}

export type SeparadorLista = ';' | ',' | '\t'

export interface FilaLista {
  /** Línea del texto donde empieza la fila (1-based), para señalar los errores. */
  linea: number
  /** Fila normalizada, lista para enviar. */
  fila: FilaImportacion
  /** Problemas que detecta el panel (la fila no se envía mientras tenga alguno). */
  errores: string[]
  /** Línea de la primera aparición del mismo documento, si se repite. */
  repetidaDe: number | null
}

export interface ListaLeida {
  separador: SeparadorLista
  conEncabezado: boolean
  /** Columna de cada posición (`null`: encabezado desconocido, se ignora). */
  columnas: (ColumnaLista | null)[]
  /** Encabezados que no se reconocieron. */
  columnasIgnoradas: string[]
  /** Problemas de toda la lista (p. ej. falta la columna del documento). */
  errores: string[]
  filas: FilaLista[]
}

/** Texto sin tildes, en minúsculas y solo con letras y números (encabezados y tipos de documento). */
function clave(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Valor propio de un diccionario (nunca uno heredado, como `constructor`). */
function propio<T>(diccionario: Readonly<Record<string, T>>, llave: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(diccionario, llave) ? diccionario[llave] : undefined
}

/** Cuenta un carácter fuera de comillas en la primera línea con contenido. */
function contarFueraDeComillas(linea: string, caracter: string): number {
  let dentro = false
  let total = 0
  for (const letra of linea) {
    if (letra === '"') dentro = !dentro
    else if (!dentro && letra === caracter) total++
  }
  return total
}

/** Separador de la lista según la primera línea con contenido: tabulador (Excel), `;` o `,`. */
export function detectarSeparador(texto: string): SeparadorLista {
  const primera = texto.split(/\r\n|\n|\r/).find((linea) => linea.trim()) ?? ''
  if (contarFueraDeComillas(primera, '\t') > 0) return '\t'
  const puntoYComa = contarFueraDeComillas(primera, ';')
  const coma = contarFueraDeComillas(primera, ',')
  return coma > puntoYComa ? ',' : ';'
}

interface FilaCruda {
  linea: number
  celdas: string[]
}

/** Filas de un CSV con comillas (`""` escapa una comilla; un salto dentro de comillas es parte de la celda). */
function partirCsv(texto: string, separador: SeparadorLista): FilaCruda[] {
  const filas: FilaCruda[] = []
  let celdas: string[] = []
  let celda = ''
  let dentro = false
  let linea = 1
  let inicio = 1
  const cerrarFila = () => {
    celdas.push(celda)
    filas.push({ linea: inicio, celdas })
    celdas = []
    celda = ''
  }
  for (let i = 0; i < texto.length; i++) {
    const letra = texto[i] as string
    if (dentro) {
      if (letra === '"') {
        if (texto[i + 1] === '"') {
          celda += '"'
          i++
        } else {
          dentro = false
        }
      } else {
        if (letra === '\n') linea++
        celda += letra
      }
      continue
    }
    if (letra === '"' && celda.trim() === '') {
      celda = ''
      dentro = true
    } else if (letra === separador) {
      celdas.push(celda)
      celda = ''
    } else if (letra === '\r' || letra === '\n') {
      if (letra === '\r' && texto[i + 1] === '\n') i++
      cerrarFila()
      linea++
      inicio = linea
    } else {
      celda += letra
    }
  }
  if (celda !== '' || celdas.length) cerrarFila()
  return filas
    .map((fila) => ({ linea: fila.linea, celdas: fila.celdas.map((valor) => valor.trim()) }))
    .filter((fila) => fila.celdas.some(Boolean))
}

/** Tipo de documento escrito («DNI», «C.E.», «Carné de extranjería»…); vacío → `dni`; desconocido → `null`. */
export function tipoDocumentoDeTexto(texto: string): 'dni' | 'ce' | null {
  const valor = clave(texto)
  if (!valor) return 'dni'
  return propio(ALIAS_TIPO_DOCUMENTO, valor) ?? null
}

/** La primera fila es de encabezados: dos o más nombres conocidos y ningún correo ni número de documento. */
function esEncabezado(celdas: readonly string[]): boolean {
  const conocidas = celdas.filter((celda) => propio(ALIAS_COLUMNA, clave(celda)) !== undefined).length
  const pareceDato = celdas.some((celda) => celda.includes('@') || /^\d{6,}$/.test(celda))
  return conocidas >= 2 && !pareceDato
}

function columnasDeEncabezado(celdas: readonly string[]): { columnas: (ColumnaLista | null)[], ignoradas: string[] } {
  const usadas = new Set<ColumnaLista>()
  const ignoradas: string[] = []
  const columnas = celdas.map((celda) => {
    const columna = propio(ALIAS_COLUMNA, clave(celda))
    if (!columna || usadas.has(columna)) {
      if (celda) ignoradas.push(celda)
      return null
    }
    usadas.add(columna)
    return columna
  })
  return { columnas, ignoradas }
}

/** Texto con los espacios repetidos colapsados. */
function compactar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

/** Normaliza y valida una fila con las reglas del alta de participantes (el backend vuelve a validar). */
function filaDe(valores: Partial<Record<ColumnaLista, string>>): { fila: FilaImportacion, errores: string[] } {
  const errores: string[] = []
  const tipo = tipoDocumentoDeTexto(valores.tipoDocumento ?? '')
  if (!tipo) errores.push('Tipo de documento: usa DNI o CE.')
  const tipoDocumento = tipo ?? clave(valores.tipoDocumento ?? '')
  const crudo = valores.numeroDocumento ?? ''
  const numeroDocumento = tipoDocumento === 'dni' ? crudo.replace(/[\s.-]/g, '') : crudo.replace(/[\s.-]/g, '').toUpperCase()
  if (!numeroDocumento) errores.push('Falta el número de documento.')
  else if (tipo === 'dni' && !esDocumentoValido('dni', numeroDocumento)) errores.push('El DNI debe tener 8 dígitos (si empieza con 0, revisa que Excel no lo haya quitado).')
  else if (tipo === 'ce' && !esDocumentoValido('ce', numeroDocumento)) errores.push('El carné de extranjería debe tener entre 9 y 12 letras o números.')

  const correo = normalizarCorreo(valores.correo ?? '')
  if (!correo) errores.push('Falta el correo (es obligatorio).')
  else if (!esCorreoDeAcceso(correo)) errores.push('El correo no es válido.')

  const fila: FilaImportacion = { tipoDocumento, numeroDocumento, correo }
  for (const campo of ['nombres', 'apellidos'] as const) {
    const valor = compactar(valores[campo] ?? '')
    if (!valor) continue
    if (valor.length < 2 || valor.length > MAX_NOMBRE) errores.push(`${ETIQUETAS_COLUMNA_LISTA[campo]}: de 2 a ${MAX_NOMBRE} caracteres.`)
    fila[campo] = valor
  }

  const detalle = compactar(valores.detalle ?? '')
  if (detalle) {
    if (detalle.length > MAX_DETALLE_CERTIFICADO) errores.push(`Detalle: como máximo ${MAX_DETALLE_CERTIFICADO} caracteres.`)
    fila.detalle = detalle
  }

  const horas = (valores.horas ?? '').trim()
  if (horas) {
    const numero = Number(horas.replace(',', '.'))
    if (Number.isInteger(numero) && numero >= 0 && numero <= MAX_HORAS_CERTIFICADO) fila.horas = numero
    else errores.push(`Horas: un número entero de 0 a ${MAX_HORAS_CERTIFICADO}.`)
  }
  return { fila, errores }
}

/**
 * Lee la lista pegada o el CSV. Sin encabezados, las columnas van en el orden de `COLUMNAS_LISTA`; si la
 * primera celda de la primera fila no es un tipo de documento (DNI/CE), se entiende que la lista
 * empieza por el número de documento (todas DNI salvo que se indique). Los documentos repetidos se
 * marcan en las filas siguientes a la primera.
 */
export function leerListaCertificados(texto: string): ListaLeida {
  const limpio = String(texto ?? '').replace(/^﻿/, '')
  const separador = detectarSeparador(limpio)
  const crudas = partirCsv(limpio, separador)
  const errores: string[] = []

  let columnas: (ColumnaLista | null)[]
  let columnasIgnoradas: string[] = []
  const primera = crudas[0]
  const conEncabezado = primera !== undefined && esEncabezado(primera.celdas)
  if (conEncabezado && primera) {
    const encabezado = columnasDeEncabezado(primera.celdas)
    columnas = encabezado.columnas
    columnasIgnoradas = encabezado.ignoradas
    crudas.shift()
    if (!columnas.includes('numeroDocumento')) errores.push('La lista no tiene la columna del número de documento.')
    if (!columnas.includes('correo')) errores.push('La lista no tiene la columna del correo (es obligatorio).')
  } else {
    const empiezaConTipo = primera !== undefined && propio(ALIAS_TIPO_DOCUMENTO, clave(primera.celdas[0] ?? '')) !== undefined
    columnas = empiezaConTipo ? [...COLUMNAS_LISTA] : COLUMNAS_LISTA.filter((columna) => columna !== 'tipoDocumento')
  }

  const primeraPorDocumento = new Map<string, number>()
  const filas = crudas.map((cruda): FilaLista => {
    const valores: Partial<Record<ColumnaLista, string>> = {}
    columnas.forEach((columna, indice) => {
      if (columna) valores[columna] = cruda.celdas[indice] ?? ''
    })
    const { fila, errores: problemas } = filaDe(valores)
    let repetidaDe: number | null = null
    if (fila.numeroDocumento) {
      const claveDocumento = `${fila.tipoDocumento}:${fila.numeroDocumento.toUpperCase()}`
      const anterior = primeraPorDocumento.get(claveDocumento)
      if (anterior !== undefined) {
        repetidaDe = anterior
        problemas.push(`Documento repetido en la lista (línea ${anterior}).`)
      } else {
        primeraPorDocumento.set(claveDocumento, cruda.linea)
      }
    }
    return { linea: cruda.linea, fila, errores: problemas, repetidaDe }
  })

  return { separador, conEncabezado, columnas, columnasIgnoradas, errores, filas }
}

/** Filas sin problemas, listas para enviar (si la lista tiene errores generales, ninguna). */
export function filasParaEnviar(lista: Pick<ListaLeida, 'errores' | 'filas'>): FilaLista[] {
  if (lista.errores.length) return []
  return lista.filas.filter((fila) => fila.errores.length === 0)
}

export interface TandaLista<T> {
  /** Posición (0-based) del primer elemento de la tanda en la lista completa. */
  inicio: number
  elementos: T[]
}

/**
 * Parte la lista en tandas de `tamano` (300) para enviarla por partes. El resultado `fila` (1-based) de
 * la respuesta de una tanda corresponde a `tanda.elementos[fila - 1]`.
 */
export function partirEnTandas<T>(elementos: readonly T[], tamano: number = MAX_FILAS_POR_TANDA): TandaLista<T>[] {
  const paso = Math.max(1, Math.floor(tamano))
  const tandas: TandaLista<T>[] = []
  for (let inicio = 0; inicio < elementos.length; inicio += paso) {
    tandas.push({ inicio, elementos: elementos.slice(inicio, inicio + paso) })
  }
  return tandas
}
