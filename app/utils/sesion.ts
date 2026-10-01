import type { AccesoPanel, ParticipanteSesion, Permiso, Sesion, TipoSesion, Usuario } from '~/types/api'
import { aErrorApi, MENSAJES_POR_CODIGO, type ErrorApi } from '~/utils/errores'
import { inicioPara, RUTA_SIN_ACCESO, sinEventosAsignados, tienePermiso } from '~/utils/permisos'

/**
 * Página de inicio del inscrito (la del staff depende de sus permisos: `inicioPara`). Las demás
 * secciones del portal (`NAVEGACION_PORTAL` en `app/utils/portal.ts`) declaran `perfil: 'participante'`.
 */
export const INICIO_PARTICIPANTE = '/mis-inscripciones'

/** Meta de la página que decide quién puede abrirla (`definePageMeta`). */
export interface MetaAcceso {
  /** Perfil de la página; por defecto, `admin`. */
  perfil?: 'admin' | 'participante'
  /** Permiso (o alguno de la lista) que exige la página al staff. Sin él, cualquier cuenta de staff. */
  permiso?: Permiso | readonly Permiso[]
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
 * páginas con `perfil: 'participante'`. El staff no entra a ellas ni a las que exigen un permiso que
 * no tiene: va a su página de inicio (`inicioPara`). `ruta` (la que se intenta abrir) evita
 * redirigir a la misma página: en ese caso va a `/sin-acceso`.
 */
export function redireccionPara(tipo: TipoSesion, meta: MetaAcceso, acceso: AccesoPanel | null = null, ruta?: string): string | null {
  const paginaDeParticipante = meta.perfil === 'participante'
  if (tipo === 'PARTICIPANTE') return paginaDeParticipante ? null : INICIO_PARTICIPANTE
  // Una cuenta por evento sin eventos no puede trabajar en ninguna página que exija permiso
  const permitida = !paginaDeParticipante && (!meta.permiso || (tienePermiso(acceso, meta.permiso) && !sinEventosAsignados(acceso)))
  if (permitida) return null
  const destino = inicioPara(acceso)
  if (destino !== ruta) return destino
  return ruta === RUTA_SIN_ACCESO ? null : RUTA_SIN_ACCESO
}

const RUTA_LOGIN = /^\/login(?:[/?#]|$)/

/**
 * Destino tras iniciar sesión: `redirect` si es una ruta interna (no el propio login) que la sesión
 * puede abrir —el inscrito, solo las del portal (`perfil: 'participante'`, p. ej. su fotocheck)—; si
 * no, la página de inicio (`INICIO_PARTICIPANTE` o `inicioPara`). `metaDe` da la meta de la página de
 * `redirect` (en el panel, `router.resolve(ruta).meta`).
 */
export function destinoTrasLogin(
  tipo: TipoSesion,
  redirect: unknown,
  acceso: AccesoPanel | null = null,
  metaDe: (ruta: string) => MetaAcceso = () => ({}),
): string {
  if (esRutaInterna(redirect) && !RUTA_LOGIN.test(redirect) && redireccionPara(tipo, metaDe(redirect), acceso) === null) return redirect
  return tipo === 'PARTICIPANTE' ? INICIO_PARTICIPANTE : inicioPara(acceso)
}

/**
 * Motivos que el login explica (`/login?motivo=…`): cierres de sesión y `SESSION_UNAVAILABLE` (no se
 * pudo verificar la sesión porque el backend no respondió; la cookie sigue y se puede reintentar).
 */
const MOTIVOS_CON_AVISO: readonly string[] = ['SESSION_INVALIDATED', 'SESSION_EXPIRED', 'SESSION_UNAVAILABLE']

/** Aviso del login cuando se llega por un cierre de sesión con motivo conocido; otros valores se ignoran. */
export function avisoLogin(motivo: unknown): string | null {
  return typeof motivo === 'string' && MOTIVOS_CON_AVISO.includes(motivo) ? MENSAJES_POR_CODIGO[motivo] ?? null : null
}

/** Valor de `clave` en la query de una ruta interna (`/login?redirect=…`). */
function parametroDe(ruta: string, clave: string): string | null {
  const query = ruta.split('#')[0]?.split('?')[1]
  return query ? new URLSearchParams(query).get(clave) : null
}

/**
 * Ruta del login tras un 401 (o una sesión que no se pudo verificar): con `motivo` si el login lo
 * explica y con `redirect` para volver a la página (salvo el inicio). Si ya se está en el login (dos
 * peticiones fallaron a la vez), conserva su `redirect` y su `motivo`.
 */
export function rutaLoginTrasCierre(code: string, rutaActual: string): { path: string, query: Record<string, string> } {
  const query: Record<string, string> = {}
  const enLogin = typeof rutaActual === 'string' && RUTA_LOGIN.test(rutaActual)
  const motivo = MOTIVOS_CON_AVISO.includes(code) ? code : enLogin ? parametroDe(rutaActual, 'motivo') : null
  if (motivo && MOTIVOS_CON_AVISO.includes(motivo)) query.motivo = motivo
  const volverA = enLogin ? parametroDe(rutaActual, 'redirect') : rutaActual
  if (esRutaInterna(volverA) && volverA !== '/' && !RUTA_LOGIN.test(volverA)) query.redirect = volverA
  return { path: '/login', query }
}

// ─── Lectura de la sesión y errores de la API del staff ───

/** Resultado de leer la sesión: vigente, cerrada o no disponible (backend caído: se conserva la actual). */
export type LecturaSesion = 'VIGENTE' | 'CERRADA' | 'NO_DISPONIBLE'

/** Una lectura de la sesión que falló: solo un 401 la da por cerrada; 503 o la red caída son pasajeros. */
export function lecturaTrasError(error: unknown): Exclude<LecturaSesion, 'VIGENTE'> {
  return aErrorApi(error).status === 401 ? 'CERRADA' : 'NO_DISPONIBLE'
}

/** 403 que indican que el acceso de la cuenta cambió (permisos o eventos): se vuelve a leer. */
export const CODIGOS_ACCESO_CAMBIADO: readonly string[] = ['FORBIDDEN', 'EVENT_NOT_ASSIGNED']

/**
 * Qué hace el panel ante un error de la API del staff: un 401 va al login (salvo `silenciar401`); un
 * 403 por permisos o eventos (`CODIGOS_ACCESO_CAMBIADO`) relee el acceso. Los 403 de negocio
 * (`OUT_OF_HOURS_NOT_ALLOWED`, `STATUS_NOT_ALLOWED`, `NOT_APPROVED`…) los maneja cada pantalla.
 */
export function reaccionAError(error: Pick<ErrorApi, 'status' | 'code'>, silenciar401 = false): 'LOGIN' | 'RELEER_ACCESO' | null {
  if (error.status === 401) return silenciar401 ? null : 'LOGIN'
  if (error.status === 403 && CODIGOS_ACCESO_CAMBIADO.includes(error.code)) return 'RELEER_ACCESO'
  return null
}

/**
 * Qué hace el portal del inscrito ante un error de `/api/portal/**`: un 401 va al login; un 403
 * `FORBIDDEN_PROFILE` significa que la cookie ya no es la del participante (otra pestaña entró al panel,
 * o una respuesta del staff llegó tarde tras el paso al portal): se vuelve a leer la sesión y se va a la
 * página que corresponda.
 */
export function reaccionPortalAError(error: Pick<ErrorApi, 'status' | 'code'>): 'LOGIN' | 'RELEER_SESION' | null {
  if (error.status === 401) return 'LOGIN'
  if (error.status === 403 && error.code === 'FORBIDDEN_PROFILE') return 'RELEER_SESION'
  return null
}
