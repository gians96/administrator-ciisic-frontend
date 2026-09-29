import type { CodigoEstado } from '~/types/api'

const ZONA = 'America/Lima'

const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const entero = new Intl.NumberFormat('es-PE')
const fechaCorta = new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' })
const fechaHora = new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function soles(valor: number | null | undefined): string {
  return moneda.format(valor ?? 0)
}

export function numero(valor: number | null | undefined): string {
  return entero.format(valor ?? 0)
}

/** Fecha `YYYY-MM-DD` (día de calendario) sin corrimiento de zona horaria. */
export function fechaDia(valor: string | null | undefined): string {
  if (!valor) return '—'
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number)
  if (!anio || !mes || !dia) return '—'
  return fechaCorta.format(new Date(Date.UTC(anio, mes - 1, dia, 12)))
}

/** Instante ISO mostrado en hora de Lima. */
export function fechaHoraLima(valor: string | null | undefined): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : fechaHora.format(fecha)
}

export function nombreCompleto(persona: { nombres: string, apellidos: string } | null | undefined): string {
  return persona ? `${persona.nombres} ${persona.apellidos}`.trim() : '—'
}

export const ESTADOS: Array<{ codigo: CodigoEstado, nombre: string }> = [
  { codigo: 'PENDIENTE', nombre: 'Pendiente' },
  { codigo: 'EN_REVISION', nombre: 'En revisión' },
  { codigo: 'APROBADO', nombre: 'Aprobado' },
  { codigo: 'RECHAZADO', nombre: 'Rechazado' },
  { codigo: 'CANCELADO', nombre: 'Cancelado' },
]

/** Clases de color por estado (mismos colores que la landing). */
export const COLOR_ESTADO: Record<CodigoEstado, string> = {
  PENDIENTE: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
  EN_REVISION: 'bg-blue-400/15 text-blue-300 ring-blue-400/30',
  APROBADO: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  RECHAZADO: 'bg-red-400/15 text-red-300 ring-red-400/30',
  CANCELADO: 'bg-slate-400/15 text-slate-300 ring-slate-400/30',
}

export const COLOR_GRAFICO_ESTADO: Record<CodigoEstado, string> = {
  PENDIENTE: '#fbbf24',
  EN_REVISION: '#3b82f6',
  APROBADO: '#10b981',
  RECHAZADO: '#ef4444',
  CANCELADO: '#64748b',
}

export function modalidadPago(modalidad: string | null, banco?: string | null, billetera?: string | null): string {
  if (modalidad === 'banco') return `Banco${banco ? ` · ${banco.toUpperCase()}` : ''}`
  if (modalidad === 'billetera') return `Billetera${billetera ? ` · ${billetera.charAt(0).toUpperCase()}${billetera.slice(1)}` : ''}`
  return '—'
}

export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Convierte un texto a slug de evento (`IX CIISIC 2027` → `ix-ciisic-2027`). */
export function slug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}
