import type { TipoCuentaCorreo, VerificacionCorreo } from '~/types/api'
import { fechaHoraLima, nombreCompleto } from '~/utils/formato'

/** Administrador o participante con su vínculo a una cuenta de Google. */
export interface PersonaConGoogle {
  nombres: string
  apellidos: string
  correo: string
  googleVinculado?: boolean
  googleVinculadoEn?: string | null
}

const TIPOS_CUENTA: Record<TipoCuentaCorreo, string> = {
  ESTUDIANTE: 'Estudiante UNDC',
  PERSONAL: 'Personal UNDC',
  EXTERNO: 'Externo',
}

/** El backend deshace el vínculo al cambiar el correo; se avisa antes de guardar. */
export const AVISO_CAMBIO_CORREO_GOOGLE = 'Si cambias el correo, se desvinculará su cuenta de Google.'

export function etiquetaTipoCuenta(tipo: string | null | undefined): string | null {
  return tipo && tipo in TIPOS_CUENTA ? TIPOS_CUENTA[tipo as TipoCuentaCorreo] : null
}

/** «Correo verificado con Google (Estudiante UNDC)», o `null` si el correo no se verificó. */
export function textoCorreoVerificado(correo: VerificacionCorreo | null | undefined): string | null {
  if (!correo?.verificado) return null
  const tipo = etiquetaTipoCuenta(correo.detalle?.tipoCuenta)
  return tipo ? `Correo verificado con Google (${tipo})` : 'Correo verificado con Google'
}

/** Cuándo se verificó el correo, para el título del indicador. */
export function fechaCorreoVerificado(correo: VerificacionCorreo | null | undefined): string | null {
  if (!correo?.verificado) return null
  return correo.detalle?.verificadoEn ? `Verificado al inscribirse, el ${fechaHoraLima(correo.detalle.verificadoEn)}` : 'Verificado al inscribirse'
}

/** Título de la insignia «Google vinculado», o `null` si la persona no tiene Google vinculado. */
export function tituloVinculoGoogle(persona: Pick<PersonaConGoogle, 'googleVinculado' | 'googleVinculadoEn'>): string | null {
  if (!persona.googleVinculado) return null
  return persona.googleVinculadoEn ? `Vinculado el ${fechaHoraLima(persona.googleVinculadoEn)}` : 'Cuenta de Google vinculada'
}

/** Confirmación de «Desvincular Google»: cuándo usarlo y qué pasa la próxima vez que entre. */
export function mensajeDesvincularGoogle(persona: PersonaConGoogle, perfil: 'ADMIN' | 'PARTICIPANTE'): string {
  const mensaje = `¿Desvincular Google de ${nombreCompleto(persona)}? Úsalo si cambió de cuenta de Google o si no puede entrar porque su correo ya está vinculado a otra. La próxima vez que entre con Google quedará vinculada la cuenta de ${persona.correo} que use.`
  return perfil === 'ADMIN' ? `${mensaje} Su contraseña sigue funcionando.` : mensaje
}
