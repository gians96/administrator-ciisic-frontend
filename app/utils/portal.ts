import { aErrorApi } from '~/utils/errores'

/**
 * Portal del participante (backend-ciisic spec 014, `contracts/api-portal.md`): navegación, tipos de
 * las respuestas de `/api/portal/**` (→ `/api/v1/me/**`) y compatibilidad con el backend anterior.
 * Todas sus páginas declaran `definePageMeta({ layout: 'participante', perfil: 'participante' })`.
 */

export interface ItemPortal {
  to: string
  label: string
  icon: string
}

/** Secciones del portal: pestañas en escritorio y barra inferior fija en el celular. */
export const NAVEGACION_PORTAL: readonly ItemPortal[] = [
  { to: '/mis-inscripciones', label: 'Inscripciones', icon: 'heroicons:ticket' },
  { to: '/mi-fotocheck', label: 'Fotocheck', icon: 'heroicons:identification' },
  { to: '/mi-asistencia', label: 'Asistencia', icon: 'heroicons:calendar-days' },
  { to: '/mis-certificados', label: 'Certificados', icon: 'heroicons:academic-cap' },
  { to: '/mi-perfil', label: 'Perfil', icon: 'heroicons:user-circle' },
]

/** La sección del portal está activa en su ruta y en las que cuelgan de ella (`/mi-fotocheck/500`). */
export function esItemPortalActivo(item: Pick<ItemPortal, 'to'>, ruta: string): boolean {
  const camino = ruta.split(/[?#]/)[0] ?? ''
  return camino === item.to || camino.startsWith(`${item.to}/`)
}

/** Texto del estado vacío cuando el backend aún no tiene la sección. */
export const MENSAJE_PRONTO_DISPONIBLE = 'Esta sección estará disponible pronto.'

/**
 * La sección aún no existe en el backend (producción con la imagen anterior a la 014, o los
 * certificados antes de la 015): `405`, o `404` de ruta inexistente (`NOT_FOUND` o sin código). Los 404
 * de negocio (`INSCRIPTION_NOT_FOUND`, `PHOTO_NOT_FOUND`, `PARTICIPANT_NOT_FOUND`…) no cuentan. La
 * página muestra «pronto disponible» en lugar de un error.
 */
export function esNoDisponible(error: unknown): boolean {
  const { status, code } = aErrorApi(error)
  return status === 405 || (status === 404 && (code === 'NOT_FOUND' || code === 'ERROR'))
}

// ─── Paso del staff a su portal ───

/**
 * Respuestas de `POST /api/auth/portal` que se resuelven con un código al correo de la cuenta:
 * `CODE_REQUIRED` (entró con contraseña) y `GOOGLE_ACCOUNT_MISMATCH` (su inscripción está vinculada a
 * otra cuenta de Google; el código prueba el correo igual).
 */
export const CODIGOS_PIDEN_CODIGO: readonly string[] = ['CODE_REQUIRED', 'GOOGLE_ACCOUNT_MISMATCH']

export function pideCodigoParaPortal(error: unknown): boolean {
  return CODIGOS_PIDEN_CODIGO.includes(aErrorApi(error).code)
}

/** Mensaje de un error al pasar al portal (`PARTICIPANT_NOT_FOUND` aquí es «no hay inscripción con tu correo»). */
export function mensajeCambioAPortal(error: unknown): string {
  const e = aErrorApi(error)
  if (e.code === 'PARTICIPANT_NOT_FOUND') return 'No hay ninguna inscripción con el correo de tu cuenta. Si te inscribiste con otro correo, entra al portal con ese correo.'
  return e.message
}

// ─── Respuestas del portal (`data` de cada ruta) ───

/** `GET /me`. Con el backend anterior a la 014 faltan `celular`, `foto` y `google`. */
export interface PerfilPortal {
  id: number
  nombres: string
  apellidos: string
  correo: string
  tipoDocumento: string
  numeroDocumento: string
  celular?: string | null
  foto?: { tiene: boolean, actualizadaEn: string | null }
  google?: { vinculado: boolean }
}

/** `GET /me/inscriptions/:id/badge`. */
export interface FotocheckPortal {
  inscripcionId: number
  /** Código de la credencial (10 caracteres): lo único que lleva el QR. */
  codigo: string
  /** PNG en `data:` (480 px). */
  qr: string
  evento: { nombre: string, nombreCorto: string, fechaInicio: string, fechaFin: string, sede: string | null }
  participante: { nombres: string, apellidos: string, tipoDocumento: string, documentoEnmascarado: string }
  tipoInscripcion: { nombre: string, etiqueta: string | null } | null
  foto: { tiene: boolean }
}

/** Actividad de `GET /me/attendances` (horas de Lima, `HH:mm`). */
export interface ActividadPortal {
  id: number
  nombre: string
  fecha: string
  horaInicio: string
  horaFin: string
  asistio: boolean
  registradoEn: string | null
}

/** Elemento de `GET /me/attendances`: un evento con la inscripción aprobada. */
export interface AsistenciaEventoPortal {
  evento: { id: number, nombre: string, nombreCorto: string }
  totalActividades: number
  asistidas: number
  actividades: ActividadPortal[]
}
