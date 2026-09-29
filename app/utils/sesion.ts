import type { ParticipanteSesion, Sesion, TipoSesion, Usuario } from '~/types/api'
import { MENSAJES_POR_CODIGO } from '~/utils/errores'

/** Página de inicio de cada perfil. */
export const INICIO_ADMIN = '/'
export const INICIO_PARTICIPANTE = '/mis-inscripciones'

/** Meta de la página que decide quién puede abrirla (`definePageMeta`). */
export interface MetaAcceso {
  /** Perfil de la página; por defecto, `admin`. */
  perfil?: 'admin' | 'participante'
  soloSuperAdmin?: boolean
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null
}

/**
 * Sesión a partir de las respuestas del BFF (`/api/auth/session`, `/api/auth/login`,
 * `/api/auth/google`): `{ tipo, usuario | user | participante }`. Sin datos válidos, `null`.
 * Sin `tipo` (respuestas anteriores a los perfiles) se deduce de los datos.
 */
export function leerSesion(datos: unknown): Sesion | null {
  const respuesta = objeto(datos)
  if (!respuesta || respuesta.authenticated === false) return null
  const usuario = objeto(respuesta.usuario) ?? objeto(respuesta.user)
  const participante = objeto(respuesta.participante)
  const tipo = respuesta.tipo ?? (participante && !usuario ? 'PARTICIPANTE' : 'ADMIN')
  if (tipo === 'PARTICIPANTE') return participante ? { tipo: 'PARTICIPANTE', participante: participante as unknown as ParticipanteSesion } : null
  if (tipo === 'ADMIN') return usuario ? { tipo: 'ADMIN', usuario: usuario as unknown as Usuario } : null
  return null
}

/** Ruta interna a la que se puede redirigir: empieza con `/` pero no con `//`, sin `\` ni espacios. */
export function esRutaInterna(ruta: unknown): ruta is string {
  return typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') && !/[\\\s]/.test(ruta)
}

/**
 * A dónde redirigir antes de mostrar una página, o `null` para dejar pasar. El inscrito solo entra a
 * páginas con `perfil: 'participante'`; el administrador no entra a ellas y las `soloSuperAdmin`
 * exigen ese rol.
 */
export function redireccionPara(tipo: TipoSesion, meta: MetaAcceso, esSuperAdmin = false): string | null {
  const paginaDeParticipante = meta.perfil === 'participante'
  if (tipo === 'PARTICIPANTE') return paginaDeParticipante ? null : INICIO_PARTICIPANTE
  if (paginaDeParticipante) return INICIO_ADMIN
  if (meta.soloSuperAdmin && !esSuperAdmin) return INICIO_ADMIN
  return null
}

/**
 * Destino tras iniciar sesión: el inscrito siempre va a «Mis inscripciones»; el administrador, a
 * `redirect` si es una ruta interna (y no el propio login) o al inicio.
 */
export function destinoTrasLogin(tipo: TipoSesion, redirect: unknown): string {
  if (tipo === 'PARTICIPANTE') return INICIO_PARTICIPANTE
  return esRutaInterna(redirect) && !/^\/login(?:[/?#]|$)/.test(redirect) ? redirect : INICIO_ADMIN
}

/** Motivos de cierre de sesión que el login explica (`/login?motivo=…`). */
const MOTIVOS_CON_AVISO: readonly string[] = ['SESSION_INVALIDATED']

/** Aviso del login cuando se llega por un cierre de sesión con motivo conocido; otros valores se ignoran. */
export function avisoLogin(motivo: unknown): string | null {
  return typeof motivo === 'string' && MOTIVOS_CON_AVISO.includes(motivo) ? MENSAJES_POR_CODIGO[motivo] ?? null : null
}
