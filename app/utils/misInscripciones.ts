import type { CodigoEstado } from '~/types/api'

/** Inscripción tal como la entrega el portal (`GET /api/v1/me/inscriptions`, spec 011 del backend). */
export interface InscripcionPortal {
  id: number
  evento: { codigo: string, nombre: string, nombreCorto: string, fechaInicio: string, fechaFin: string, sede: string | null }
  tipoInscripcion: { nombre: string, etiqueta: string | null, categoria: string } | null
  clasificacion: { nombre: string } | null
  monto: number
  precioRegular: number
  descuento: number
  pago: { modalidad: string | null, banco: string | null, tipoOperacion: string | null, billeteraDigital: string | null, numeroOperacion: string, fechaPago: string | null }
  estado: { codigo: CodigoEstado, nombre: string }
  motivoRechazo: string | null
  revisadoEn: string | null
  credencial: { disponible: boolean, enviadaEn: string | null }
  /** Fotocheck virtual (spec 014): `true` solo si está aprobada. Falta con el backend anterior. */
  fotocheck?: { disponible: boolean }
  creadoEn: string
}

/** Texto que explica el estado al inscrito, en lenguaje simple. */
export function explicacionEstado(inscripcion: Pick<InscripcionPortal, 'estado' | 'credencial'>): string {
  switch (inscripcion.estado.codigo) {
    case 'PENDIENTE':
      return 'Recibimos tu inscripción. El equipo revisará tu voucher de pago.'
    case 'EN_REVISION':
      return 'Estamos revisando tu voucher de pago.'
    case 'APROBADO':
      return inscripcion.credencial.enviadaEn
        ? 'Tu inscripción está aprobada. Te enviamos la credencial por correo y puedes descargarla aquí.'
        : 'Tu inscripción está aprobada. Descarga aquí tu credencial.'
    case 'RECHAZADO':
      return 'Tu inscripción fue rechazada. Revisa el motivo y, si tienes dudas, escríbenos.'
    case 'CANCELADO':
      return 'Tu inscripción fue cancelada.'
    default:
      return ''
  }
}

/** Rango de fechas del evento: «26 – 30 oct. 2026» o «30 oct. – 2 nov. 2026». */
export function rangoFechas(inicio: string, fin: string): string {
  const aFecha = (valor: string) => new Date(`${valor}T12:00:00-05:00`)
  const opciones = { day: 'numeric', month: 'short', timeZone: 'America/Lima' } as const
  const desde = aFecha(inicio)
  const hasta = aFecha(fin)
  const anio = hasta.toLocaleDateString('es-PE', { year: 'numeric', timeZone: 'America/Lima' })
  if (inicio === fin) return `${hasta.toLocaleDateString('es-PE', opciones)} ${anio}`
  const mismoMes = desde.getUTCMonth() === hasta.getUTCMonth()
  const textoDesde = mismoMes ? desde.toLocaleDateString('es-PE', { day: 'numeric', timeZone: 'America/Lima' }) : desde.toLocaleDateString('es-PE', opciones)
  return `${textoDesde} – ${hasta.toLocaleDateString('es-PE', opciones)} ${anio}`
}

/** Ordena mostrando primero lo que requiere atención (pendiente/en revisión), luego por fecha. */
export function ordenarInscripciones(lista: readonly InscripcionPortal[]): InscripcionPortal[] {
  const prioridad: Record<string, number> = { PENDIENTE: 0, EN_REVISION: 0, RECHAZADO: 1, APROBADO: 2, CANCELADO: 3 }
  return [...lista].sort((a, b) => (prioridad[a.estado.codigo] ?? 4) - (prioridad[b.estado.codigo] ?? 4) || b.creadoEn.localeCompare(a.creadoEn))
}
