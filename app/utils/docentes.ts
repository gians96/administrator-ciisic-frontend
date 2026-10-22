import type { DocenteAdmin, SeccionRef } from '~/types/api'

/**
 * Docentes y su DNI (spec 019 del panel; backend 028). Lógica pura del formulario de un docente y de la página
 * común donde cada docente entra con su DNI. Los nombres llevan «Docente» porque `app/utils` se auto-importa y
 * `utils/delegaciones.ts` ya tiene `normalizarDni`.
 */

export const LARGO_DNI = 8

/** Solo dígitos y hasta 8: lo que se acepta al escribir en un campo de DNI. */
export function soloDigitosDni(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, LARGO_DNI)
}

/** DNI de un docente: 8 dígitos (con 7 se completa el cero inicial que pierde Excel); `null` si no lo es. Igual que el backend. */
export function dniDelDocente(valor: string | null | undefined): string | null {
  const dni = (valor ?? '').replace(/\s+/g, '')
  return /^\d{7,8}$/.test(dni) ? dni.padStart(LARGO_DNI, '0') : null
}

export const claveDeSeccionDocente = (seccion: SeccionRef): string => `${seccion.ciclo}|${seccion.seccion}`

/** Agrupa las secciones por ciclo conservando el orden en que llegan (el servidor ya las ordena). */
export function seccionesPorCiclo(secciones: readonly SeccionRef[]): Array<{ ciclo: string, secciones: SeccionRef[] }> {
  const grupos = new Map<string, SeccionRef[]>()
  for (const seccion of secciones) grupos.set(seccion.ciclo, [...(grupos.get(seccion.ciclo) ?? []), seccion])
  return [...grupos].map(([ciclo, lista]) => ({ ciclo, secciones: lista }))
}

/**
 * Lo que se puede marcar en el formulario de un docente: las secciones del padrón y las que ya tiene aunque el padrón
 * ya no las traiga (para poder quitárselas). Sin repetidos y en el orden de `catalogo`, con las extra al final.
 */
export function seccionesAsignables(catalogo: readonly SeccionRef[], propias: readonly SeccionRef[]): SeccionRef[] {
  const vistas = new Set(catalogo.map(claveDeSeccionDocente))
  return [...catalogo, ...propias.filter((seccion) => !vistas.has(claveDeSeccionDocente(seccion)))]
}

/** Qué secciones se agregan y cuáles se quitan al pasar de `actuales` a `elegidas`. */
export function cambiosDeSecciones(actuales: readonly SeccionRef[], elegidas: readonly SeccionRef[]): { agregadas: SeccionRef[], quitadas: SeccionRef[] } {
  const antes = new Set(actuales.map(claveDeSeccionDocente))
  const despues = new Set(elegidas.map(claveDeSeccionDocente))
  return {
    agregadas: elegidas.filter((seccion) => !antes.has(claveDeSeccionDocente(seccion))),
    quitadas: actuales.filter((seccion) => !despues.has(claveDeSeccionDocente(seccion))),
  }
}

/** Cuántos docentes tienen y cuántos no tienen DNI registrado. */
export function conteoDeDni(docentes: readonly Pick<DocenteAdmin, 'documento'>[]): { con: number, sin: number } {
  const con = docentes.filter((docente) => Boolean(docente.documento)).length
  return { con, sin: docentes.length - con }
}
