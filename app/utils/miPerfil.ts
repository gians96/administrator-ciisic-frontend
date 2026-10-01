import type { PerfilPortal } from '~/utils/portal'

/**
 * «Mi perfil» del portal (backend-ciisic spec 014, `GET /me` y `PATCH /me/profile`): solo el celular
 * se edita; nombres, documento y correo son la identidad y la llave de la sesión.
 */

/** Formato que acepta el backend (`PATCH /me/profile`). */
export const FORMATO_CELULAR_PERFIL = /^\+?\d{9,15}$/

/** Quita espacios, guiones, puntos y paréntesis («987 654 321», «+51 (987) 654-321»). */
export function normalizarCelularPerfil(texto: string): string {
  return texto.replace(/[\s\-.()]/g, '')
}

/** Error del celular escrito (se normaliza antes de validarlo); válido: `null`. */
export function errorCelularPerfil(texto: string): string | null {
  const celular = normalizarCelularPerfil(texto)
  if (!celular) return 'Escribe tu número de celular.'
  if (!FORMATO_CELULAR_PERFIL.test(celular)) return 'Escribe un celular válido: de 9 a 15 dígitos, con el código de país si no es de Perú (por ejemplo, +51987654321).'
  return null
}

/**
 * El backend ya tiene el perfil ampliado de la spec 014 (celular editable y foto). El anterior solo
 * envía los datos de identidad: la página muestra esas secciones como «pronto disponible».
 */
export function esPerfilAmpliado(perfil: Pick<PerfilPortal, 'celular' | 'foto'>): boolean {
  return perfil.celular !== undefined && perfil.foto !== undefined
}

/** Nombre del tipo de documento: `dni` → «DNI», `ce` → «Carné de extranjería». */
export function nombreTipoDocumento(tipo: string | null | undefined): string {
  const valor = (tipo ?? '').trim().toLowerCase()
  if (valor === 'dni') return 'DNI'
  if (valor === 'ce') return 'Carné de extranjería'
  return valor.toUpperCase() || 'Documento'
}
