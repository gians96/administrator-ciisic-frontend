import type { Administrador, AlcanceRol, CodigoRol, EstadoEvento, Permiso, PermisoElegible, RolAsignable } from '~/types/api'
import { conDependencias, dependenciasDe, ETIQUETAS_PERMISO, esPermiso, requeridoPor } from '~/utils/permisos'

/** Cómo entra una cuenta al panel. */
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
  /** Vacío hasta que se elige (las cuentas nuevas no tienen rol por defecto). */
  rolCodigo: CodigoRol | ''
  activo: boolean
  /** Eventos marcados (roles con alcance `EVENTO`: Tesorero y Comisión). */
  eventoIds: number[]
  /** Permisos marcados (roles con `permisosElegibles`: la Comisión). */
  permisos: Permiso[]
}

/** Lo que el formulario necesita de la cuenta que se edita (`GET /admin`). */
export type CuentaEditada = Pick<Administrador, 'tieneContrasena'>
  & Partial<Pick<Administrador, 'rolCodigo' | 'alcance' | 'eventos' | 'permisos' | 'correo' | 'googleVinculado'>>

/** Permiso que muestra datos personales de los inscritos (nombre, documento, correo y celular). */
export const PERMISO_DATOS_PERSONALES: Permiso = 'inscripciones.ver'

/** Nombres visibles de los campos del formulario (detalle de los errores de validación). */
export const ETIQUETAS_CAMPOS_ADMIN: Readonly<Record<string, string>> = {
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  correo: 'Correo',
  contrasena: 'Contraseña',
  acceso: 'Acceso',
  rolCodigo: 'Rol',
  activo: 'Estado',
  eventoIds: 'Eventos',
  permisos: 'Permisos',
}

// ─── Acceso (contraseña o Google) ───

/** Acceso actual; una cuenta nueva empieza con «Solo Google». */
export function accesoDe(admin?: Pick<Administrador, 'tieneContrasena'> | null): AccesoAdmin {
  if (!admin) return 'GOOGLE'
  // Respuestas anteriores sin el campo: todas tenían contraseña
  return admin.tieneContrasena === false ? 'GOOGLE' : 'CONTRASENA'
}

export function etiquetaAcceso(admin: Pick<Administrador, 'tieneContrasena'>): string {
  return accesoDe(admin) === 'GOOGLE' ? 'Solo Google' : 'Contraseña o Google'
}

/**
 * Una cuenta por evento (Tesorero o Comisión) pasa a un rol global (Owner o Administrador): el backend
 * le borra la contraseña y el vínculo con Google, salvo que la misma petición traiga una contraseña.
 */
export function promueveAGlobal(editando: CuentaEditada | null | undefined, alcanceRol: AlcanceRol | null | undefined): boolean {
  return editando?.alcance === 'EVENTO' && alcanceRol === 'GLOBAL'
}

/**
 * La contraseña es obligatoria si se elige contraseña y la cuenta aún no tiene una, o si se promueve a
 * un rol global (la actual se borra).
 */
export function contrasenaObligatoria(acceso: AccesoAdmin, editando?: Pick<Administrador, 'tieneContrasena'> | null, promueve = false): boolean {
  return acceso === 'CONTRASENA' && (accesoDe(editando) === 'GOOGLE' || promueve)
}

// ─── Eventos y permisos de la cuenta ───

/** Ids de evento válidos, sin repetir y ordenados. */
export function idsEvento(ids: readonly number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b)
}

export interface OpcionEvento {
  id: number
  nombreCorto: string
  /** Estado del evento si no está publicado («borrador», «finalizado»…). */
  detalle?: string
}

/**
 * Casillas de eventos: los de la lista (en su orden) y, al final, los asignados a la cuenta que ya no
 * están en ella, para no quitarlos sin querer.
 */
export function opcionesEventos(
  eventos: ReadonlyArray<{ id: number, nombreCorto: string, estado?: EstadoEvento }>,
  asignados: ReadonlyArray<{ id: number, nombreCorto: string }> = [],
): OpcionEvento[] {
  const opciones: OpcionEvento[] = eventos.map((evento) => ({
    id: evento.id,
    nombreCorto: evento.nombreCorto,
    ...(evento.estado && evento.estado !== 'PUBLICADO' ? { detalle: evento.estado.toLowerCase() } : {}),
  }))
  const vistos = new Set(opciones.map((opcion) => opcion.id))
  for (const asignado of asignados) {
    if (vistos.has(asignado.id)) continue
    vistos.add(asignado.id)
    opciones.push({ id: asignado.id, nombreCorto: asignado.nombreCorto })
  }
  return opciones
}

/** Nombre visible de un permiso: el de `GET /roles` o el del catálogo. */
export function nombrePermiso(codigo: string, elegibles: readonly PermisoElegible[] = []): string {
  return elegibles.find((elegible) => elegible.codigo === codigo)?.nombre
    ?? (esPermiso(codigo) ? ETIQUETAS_PERMISO[codigo] : codigo)
}

/** Permisos marcados con sus dependencias (`implica`), siempre dentro de los elegibles del rol. */
export function permisosParaGuardar(marcados: Iterable<string>, elegibles: readonly PermisoElegible[]): Permiso[] {
  const codigos = new Set(elegibles.map((elegible) => elegible.codigo))
  return conDependencias(marcados, dependenciasDe(elegibles)).filter((permiso) => codigos.has(permiso))
}

/** El permiso (o alguno que implica) deja ver datos personales de los inscritos. */
export function exponeDatosPersonales(permiso: Permiso, elegibles: readonly PermisoElegible[] = []): boolean {
  return conDependencias([permiso], dependenciasDe(elegibles)).includes(PERMISO_DATOS_PERSONALES)
}

/**
 * Permisos con los que empieza una cuenta de la Comisión: los por defecto del rol (con sus
 * dependencias), sin los que dejan ver datos personales.
 */
export function permisosIniciales(rol: Pick<RolAsignable, 'permisosElegibles' | 'permisosPorDefecto'>): Permiso[] {
  const elegibles = rol.permisosElegibles ?? []
  const seguros = (rol.permisosPorDefecto ?? []).filter((permiso) => !exponeDatosPersonales(permiso, elegibles))
  return permisosParaGuardar(seguros, elegibles)
}

/** Permisos marcados que obligan a mantener `permiso` (su casilla no se puede desmarcar). */
export function bloqueadoPor(permiso: Permiso, marcados: readonly Permiso[], elegibles: readonly PermisoElegible[]): Permiso[] {
  return requeridoPor(permiso, marcados, dependenciasDe(elegibles))
}

/**
 * Marca o desmarca una casilla de permiso. Marcar agrega lo que implica; desmarcar no hace nada si
 * otro permiso marcado lo exige.
 */
export function alternarPermiso(marcados: readonly Permiso[], permiso: Permiso, marcar: boolean, elegibles: readonly PermisoElegible[]): Permiso[] {
  if (marcar) return permisosParaGuardar([...marcados, permiso], elegibles)
  if (bloqueadoPor(permiso, marcados, elegibles).length) return [...marcados]
  return marcados.filter((otro) => otro !== permiso)
}

/** Etiquetas de los permisos para los chips de la tabla: las primeras `max` y el resto aparte. */
export function chipsPermisos(permisos: readonly string[], max = 3): { visibles: string[], ocultos: string[] } {
  const etiquetas = permisos.map((permiso) => nombrePermiso(permiso))
  return { visibles: etiquetas.slice(0, max), ocultos: etiquetas.slice(max) }
}

/** Explicación corta del rol elegido en el formulario. */
export function descripcionRol(rol: Pick<RolAsignable, 'alcance' | 'permisosElegibles'> | null | undefined): string | null {
  if (!rol) return null
  if (rol.alcance === 'GLOBAL') return 'Trabaja con todos los eventos.'
  return rol.permisosElegibles
    ? 'Solo trabaja en los eventos elegidos, con los permisos que marques.'
    : 'Solo trabaja en los eventos elegidos, con los permisos fijos del rol.'
}

// ─── Propia cuenta ───

/**
 * Si se puede cambiar el correo (y desvincular el Google) de la cuenta: en las demás, siempre; en la
 * propia, solo el Owner, el único con `sistema.configurar` (a los demás el backend responde
 * `SELF_UPDATE_FORBIDDEN`).
 */
export function puedeEditarCorreo(propia: boolean, puede: (permiso: Permiso) => boolean): boolean {
  return !propia || puede('sistema.configurar')
}

/** El correo del formulario es otro que el de la cuenta (sin distinguir mayúsculas, como el backend). */
function cambiaCorreo(form: Pick<FormAdmin, 'correo'>, editando: CuentaEditada | null | undefined): boolean {
  return Boolean(editando?.correo) && form.correo.trim().toLowerCase() !== editando?.correo?.toLowerCase()
}

/**
 * Por qué la propia cuenta aún no puede quedar «Solo Google» (quitar su contraseña), o `null` si puede.
 * El backend lo rechaza (`SELF_UPDATE_FORBIDDEN`) si Google no está vinculado o si el correo cambia en
 * la misma petición: se quedaría sin forma de entrar.
 */
export function motivoGoogleBloqueado(form: Pick<FormAdmin, 'correo'>, editando: CuentaEditada | null | undefined, propia: boolean): string | null {
  if (!propia || !editando || accesoDe(editando) !== 'CONTRASENA') return null
  if (!editando.googleVinculado) return 'Para dejar tu cuenta solo con Google, primero entra una vez con «Continuar con Google».'
  if (cambiaCorreo(form, editando)) return 'Para dejar tu cuenta solo con Google con el correo nuevo, primero guarda el correo y entra una vez con Google usando ese correo.'
  return null
}

// ─── Formulario y cuerpo de la petición ───

/** Formulario de una cuenta nueva o de una existente. */
export function formularioDe(admin?: Administrador | null): FormAdmin {
  return {
    nombres: admin?.nombres ?? '',
    apellidos: admin?.apellidos ?? '',
    correo: admin?.correo ?? '',
    acceso: accesoDe(admin),
    contrasena: '',
    rolCodigo: admin?.rolCodigo ?? '',
    activo: admin?.activo ?? true,
    eventoIds: idsEvento((admin?.eventos ?? []).map((evento) => evento.id)),
    permisos: (admin?.permisos ?? []).filter(esPermiso),
  }
}

/**
 * Si una selección vacía (eventos o permisos) es un error: al crear, si la cuenta ya tenía alguno (no
 * se puede guardar vacía y omitirla conservaría los anteriores) o al pasar a este rol estando activa.
 * Una cuenta que se quedó sin eventos (p. ej. se borró su único evento) se puede editar sin elegirlos.
 */
function exigeSeleccion(editando: CuentaEditada | null | undefined, cambiaRol: boolean, activo: boolean, actuales: number): boolean {
  if (!editando || actuales > 0) return true
  return cambiaRol && activo
}

export interface OpcionesCuerpo {
  /** Es la cuenta de la sesión: no se envían rol, estado, eventos ni permisos. */
  propia?: boolean
  /** Alcance del rol elegido; `null` si se desconoce (no se envían eventos ni permisos). */
  alcanceRol?: AlcanceRol | null
  /** Permisos elegibles del rol elegido (solo la Comisión); sin ellos no se envían permisos. */
  permisosElegibles?: readonly PermisoElegible[] | null
  /** En la propia cuenta: puede cambiar su correo (solo el Owner, `puedeEditarCorreo`). Por defecto, no. */
  correoEditable?: boolean
}

/**
 * Cuerpo de `POST /admin` o `PUT /admin/:id` y errores locales del formulario.
 * - Rol: siempre al crear; al editar, solo si cambia. La propia cuenta nunca envía rol, estado,
 *   eventos ni permisos (ni el correo si no es Owner).
 * - Eventos (roles `EVENTO`) y permisos (Comisión, con sus dependencias): obligatorios; los roles
 *   globales no los envían.
 * - «Solo Google»: nunca envía contraseña; si la cuenta tenía una, pide quitarla (en la propia, solo
 *   si Google ya está vinculado y el correo no cambia: `motivoGoogleBloqueado`).
 * - «Contraseña o Google»: al editar, vacía = conservar la actual (salvo al promover a un rol global,
 *   que la borra).
 */
export function cuerpoAdmin(form: FormAdmin, editando?: CuentaEditada | null, opciones: OpcionesCuerpo = {}) {
  const { propia = false, alcanceRol = null, permisosElegibles = null, correoEditable = false } = opciones
  const body: Record<string, unknown> = {
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
  }
  const errores: Record<string, string> = {}
  if (!propia || correoEditable) body.correo = form.correo.trim()

  if (!propia) {
    const cambiaRol = Boolean(editando) && form.rolCodigo !== editando?.rolCodigo
    if (!form.rolCodigo) errores.rolCodigo = 'Elige un rol.'
    if (!editando || cambiaRol) body.rolCodigo = form.rolCodigo
    body.activo = form.activo
    if (form.rolCodigo && alcanceRol === 'EVENTO') {
      const eventoIds = idsEvento(form.eventoIds)
      if (eventoIds.length) body.eventoIds = eventoIds
      else if (exigeSeleccion(editando, cambiaRol, form.activo, editando?.eventos?.length ?? 0)) errores.eventoIds = 'Elige al menos un evento.'
      if (permisosElegibles) {
        const permisos = permisosParaGuardar(form.permisos, permisosElegibles)
        if (permisos.length) body.permisos = permisos
        else if (exigeSeleccion(editando, cambiaRol, form.activo, editando?.permisos?.length ?? 0)) errores.permisos = 'Elige al menos un permiso.'
      }
    }
  }

  const promueve = !propia && promueveAGlobal(editando, alcanceRol)
  if (form.acceso === 'GOOGLE') {
    const bloqueo = motivoGoogleBloqueado(form, editando, propia)
    if (bloqueo) errores.acceso = bloqueo
    else if (editando && accesoDe(editando) === 'CONTRASENA') body.quitarContrasena = true
  } else if (form.contrasena) {
    if (form.contrasena.length < MIN_CONTRASENA) errores.contrasena = `Mínimo ${MIN_CONTRASENA} caracteres.`
    body.contrasena = form.contrasena
  } else if (contrasenaObligatoria(form.acceso, editando, promueve)) {
    errores.contrasena = promueve
      ? 'Al pasar a un rol global se borra su contraseña: escribe una nueva o elige «Solo Google».'
      : 'Escribe una contraseña o elige «Solo Google».'
  }
  return { body, errores }
}

// ─── Errores del backend ───

/** Qué volver a cargar tras un error al guardar o eliminar una cuenta. */
export type ReaccionError = 'cuentas' | 'roles' | 'eventos' | null

export function reaccionAlError(code: string): ReaccionError {
  // La cuenta cambió (p. ej. el Owner la promovió) o ya no es gestionable: la lista está desactualizada
  if (code === 'ADMIN_CHANGED' || code === 'ADMIN_NOT_MANAGEABLE' || code === 'ADMIN_NOT_FOUND') return 'cuentas'
  if (code === 'ROLE_NOT_ASSIGNABLE') return 'roles'
  if (code === 'EVENT_NOT_FOUND') return 'eventos'
  return null
}
