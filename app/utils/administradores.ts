import type { Administrador } from '~/types/api'

/** Cómo entra un administrador al panel. */
export type AccesoAdmin = 'GOOGLE' | 'CONTRASENA'

export const MIN_CONTRASENA = 12

export const OPCIONES_ACCESO: ReadonlyArray<{ valor: AccesoAdmin, titulo: string, detalle: string }> = [
  { valor: 'GOOGLE', titulo: 'Solo Google', detalle: 'Entra con «Continuar con Google» usando este correo (Gmail o cuenta institucional).' },
  { valor: 'CONTRASENA', titulo: 'Contraseña o Google', detalle: 'Entra con este correo y una contraseña; también puede usar Google.' },
]

export interface FormAdmin {
  nombres: string
  apellidos: string
  correo: string
  acceso: AccesoAdmin
  contrasena: string
  rolCodigo: 'ADMIN' | 'SUPERADMIN'
  activo: boolean
}

type ConAcceso = Pick<Administrador, 'tieneContrasena'>

/** Acceso actual; un administrador nuevo empieza con «Solo Google». */
export function accesoDe(admin?: ConAcceso | null): AccesoAdmin {
  if (!admin) return 'GOOGLE'
  // Respuestas anteriores sin el campo: todas tenían contraseña
  return admin.tieneContrasena === false ? 'GOOGLE' : 'CONTRASENA'
}

export function etiquetaAcceso(admin: ConAcceso): string {
  return accesoDe(admin) === 'GOOGLE' ? 'Solo Google' : 'Contraseña o Google'
}

/** La contraseña es obligatoria si se elige contraseña y la cuenta aún no tiene una. */
export function contrasenaObligatoria(acceso: AccesoAdmin, editando?: ConAcceso | null): boolean {
  return acceso === 'CONTRASENA' && accesoDe(editando) === 'GOOGLE'
}

/**
 * Cuerpo de `POST /admin` o `PUT /admin/:id` y errores locales del formulario.
 * - «Solo Google»: nunca envía contraseña; si la cuenta tenía una, pide quitarla.
 * - «Contraseña o Google»: al editar, vacía = conservar la actual.
 */
export function cuerpoAdmin(form: FormAdmin, editando?: ConAcceso | null) {
  const body: Record<string, unknown> = {
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
    correo: form.correo.trim(),
    rolCodigo: form.rolCodigo,
    activo: form.activo,
  }
  const errores: Record<string, string> = {}
  if (form.acceso === 'GOOGLE') {
    if (editando && accesoDe(editando) === 'CONTRASENA') body.quitarContrasena = true
  } else if (form.contrasena) {
    if (form.contrasena.length < MIN_CONTRASENA) errores.contrasena = `Mínimo ${MIN_CONTRASENA} caracteres.`
    body.contrasena = form.contrasena
  } else if (contrasenaObligatoria(form.acceso, editando)) {
    errores.contrasena = 'Escribe una contraseña o elige «Solo Google».'
  }
  return { body, errores }
}
