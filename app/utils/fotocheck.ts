import { watch, type WatchStopHandle } from 'vue'
import { aErrorApi } from '~/utils/errores'
import type { InscripcionPortal } from '~/utils/misInscripciones'
import type { FotocheckPortal } from '~/utils/portal'

/**
 * Fotocheck virtual del portal (backend-ciisic spec 014, `GET /me/inscriptions/:id/badge`): qué
 * inscripción mostrar, por qué no hay fotocheck, el reloj «en vivo» y la copia guardada en el
 * dispositivo para verlo sin conexión (se borra al cerrar sesión: `plugins/fotocheck-guardado.client.ts`).
 */

const ZONA = 'America/Lima'

/**
 * La inscripción tiene fotocheck: con el backend 014, `fotocheck.disponible`; con el anterior (sin la
 * clave), si está aprobada (la página pide el fotocheck y, si la ruta no existe, dice «pronto disponible»).
 */
export function tieneFotocheck(inscripcion: Pick<InscripcionPortal, 'estado' | 'fotocheck'>): boolean {
  return inscripcion.fotocheck ? inscripcion.fotocheck.disponible : inscripcion.estado.codigo === 'APROBADO'
}

/** Hora en Lima con segundos (`14:05:09`): el reloj del fotocheck. */
export function horaEnLima(ahora: Date): string {
  return new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(ahora)
}

/**
 * Inscripciones con fotocheck, en el orden del selector: primero el evento en curso, luego los próximos
 * (el más cercano primero) y al final los que ya pasaron (el más reciente primero). `hoy` en Lima
 * (`hoyEnLima` de `app/utils/tokensAcceso.ts`).
 */
export function inscripcionesConFotocheck(lista: readonly InscripcionPortal[], hoy: string): InscripcionPortal[] {
  const momento = (inscripcion: InscripcionPortal) => {
    if (inscripcion.evento.fechaFin < hoy) return 2
    return inscripcion.evento.fechaInicio <= hoy ? 0 : 1
  }
  return lista.filter(tieneFotocheck).sort((a, b) => {
    const diferencia = momento(a) - momento(b)
    if (diferencia) return diferencia
    if (momento(a) === 1) return a.evento.fechaInicio.localeCompare(b.evento.fechaInicio)
    return b.evento.fechaFin.localeCompare(a.evento.fechaFin) || b.id - a.id
  })
}

/**
 * La inscripción pedida en el enlace «Ver fotocheck» (`?inscripcion=500`, leído con `idDeConsulta`) si
 * tiene fotocheck; si no, la primera (la del evento en curso).
 */
export function inscripcionElegida(opciones: readonly InscripcionPortal[], pedida: number | null): InscripcionPortal | null {
  return opciones.find((inscripcion) => inscripcion.id === pedida) ?? opciones[0] ?? null
}

export interface MotivoSinFotocheck {
  titulo: string
  descripcion: string
}

/** Por qué no hay ningún fotocheck que mostrar, según el estado de las inscripciones. */
export function motivoSinFotocheck(lista: readonly Pick<InscripcionPortal, 'estado'>[]): MotivoSinFotocheck {
  const hay = (...codigos: string[]) => lista.some((inscripcion) => codigos.includes(inscripcion.estado.codigo))
  if (!lista.length) {
    return {
      titulo: 'Aún no tienes inscripciones',
      descripcion: 'Tu fotocheck aparece aquí cuando te inscribes a un evento con este correo y el equipo aprueba tu inscripción.',
    }
  }
  if (hay('PENDIENTE', 'EN_REVISION')) {
    return {
      titulo: 'Tu inscripción aún está en revisión',
      descripcion: 'El fotocheck aparece cuando el equipo valida tu pago y aprueba tu inscripción. Te avisaremos por correo.',
    }
  }
  if (hay('RECHAZADO')) {
    return {
      titulo: 'Tu inscripción no fue aprobada',
      descripcion: 'El fotocheck solo está disponible para inscripciones aprobadas. Revisa el motivo en «Mis inscripciones» y, si tienes dudas, escríbenos.',
    }
  }
  return {
    titulo: 'No tienes inscripciones aprobadas',
    descripcion: 'El fotocheck solo está disponible para inscripciones aprobadas.',
  }
}

/**
 * El fotocheck no llegó por un problema de conexión o del servidor (sin red, 5xx, demasiadas
 * solicitudes): se puede mostrar la copia guardada. Un 404/409 (ya no es tuya o ya no está aprobada) no.
 */
export function esFalloDeConexion(error: unknown): boolean {
  const { status } = aErrorApi(error)
  return status === 0 || status === 429 || status >= 500
}

// ─── Copia en el dispositivo (sin conexión) ───

/** Clave de `localStorage` con el último fotocheck que se vio. */
export const CLAVE_FOTOCHECK_GUARDADO = 'ciisic-portal:fotocheck'

export interface FotocheckGuardado {
  /** Dueño de la copia: solo se muestra en una sesión del mismo participante. */
  participanteId: number
  /** Instante ISO en que se guardó. */
  guardadoEn: string
  fotocheck: FotocheckPortal
  /** Foto en `data:` (o `null` si no tiene o no cupo). */
  foto: string | null
}

/** Lo que se usa del almacenamiento (`localStorage` o un doble en las pruebas). */
export type AlmacenFotocheck = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const IMAGEN_EN_DATOS = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/

/** Solo imágenes PNG o JPEG en `data:` base64 (el QR del backend y la foto convertida con `datosDeImagen`). */
export function esImagenEnDatos(valor: unknown): valor is string {
  return typeof valor === 'string' && IMAGEN_EN_DATOS.test(valor)
}

/**
 * Bytes de una imagen PNG o JPEG (`GET /me/photo` o la foto recién recodificada) en `data:` base64,
 * para mostrarla y guardarla con el fotocheck. Otro tipo o vacía: `null`.
 */
export function datosDeImagen(bytes: Uint8Array, tipo: string): string | null {
  const mime = (tipo.split(';')[0] ?? '').trim().toLowerCase()
  if ((mime !== 'image/png' && mime !== 'image/jpeg') || !bytes.length) return null
  let binario = ''
  for (let inicio = 0; inicio < bytes.length; inicio += 0x2000) binario += String.fromCharCode(...bytes.subarray(inicio, inicio + 0x2000))
  return `data:${mime};base64,${btoa(binario)}`
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor)
}

/** Forma mínima de un fotocheck (para no mostrar una copia dañada o de otra versión). */
export function esFotocheckPortal(valor: unknown): valor is FotocheckPortal {
  if (!esObjeto(valor) || !esObjeto(valor.evento) || !esObjeto(valor.participante)) return false
  return Number.isInteger(valor.inscripcionId)
    && typeof valor.codigo === 'string'
    && esImagenEnDatos(valor.qr)
    && typeof valor.evento.nombre === 'string'
    && typeof valor.participante.nombres === 'string'
    && typeof valor.participante.apellidos === 'string'
}

/** `localStorage` si el navegador lo permite (modo privado o almacenamiento bloqueado: `null`). */
export function almacenDelNavegador(): AlmacenFotocheck | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Guarda el último fotocheck. Si no cabe con la foto, lo guarda sin ella; si tampoco, no guarda nada
 * (devuelve `false`): la copia es una comodidad, nunca un error para la persona.
 */
export function guardarFotocheck(almacen: AlmacenFotocheck | null, copia: FotocheckGuardado): boolean {
  if (!almacen) return false
  const intentos = copia.foto ? [copia, { ...copia, foto: null }] : [copia]
  for (const intento of intentos) {
    try {
      almacen.setItem(CLAVE_FOTOCHECK_GUARDADO, JSON.stringify(intento))
      return true
    } catch {
      // Sin espacio o almacenamiento bloqueado: se prueba sin la foto
    }
  }
  return false
}

/** La copia guardada si es de `participanteId` y está entera; si no, `null`. */
export function leerFotocheckGuardado(almacen: AlmacenFotocheck | null, participanteId: number | null | undefined): FotocheckGuardado | null {
  if (!almacen || !participanteId) return null
  let valor: unknown
  try {
    const texto = almacen.getItem(CLAVE_FOTOCHECK_GUARDADO)
    if (!texto) return null
    valor = JSON.parse(texto)
  } catch {
    return null
  }
  if (!esObjeto(valor) || valor.participanteId !== participanteId || typeof valor.guardadoEn !== 'string' || !esFotocheckPortal(valor.fotocheck)) return null
  return {
    participanteId,
    guardadoEn: valor.guardadoEn,
    fotocheck: valor.fotocheck,
    foto: esImagenEnDatos(valor.foto) ? valor.foto : null,
  }
}

export function borrarFotocheckGuardado(almacen: AlmacenFotocheck | null): void {
  try {
    almacen?.removeItem(CLAVE_FOTOCHECK_GUARDADO)
  } catch {
    // Almacenamiento bloqueado: no hay nada que borrar
  }
}

/**
 * Borra la copia si no es del participante de la sesión: al cerrar sesión (o al vencer, `null`) y
 * cuando entra otra persona en el mismo navegador.
 */
export function conservarFotocheckDe(almacen: AlmacenFotocheck | null, participanteId: number | null | undefined): void {
  if (!almacen) return
  let texto: string | null
  try {
    texto = almacen.getItem(CLAVE_FOTOCHECK_GUARDADO)
  } catch {
    return
  }
  if (texto !== null && !leerFotocheckGuardado(almacen, participanteId)) borrarFotocheckGuardado(almacen)
}

/** Cambia la foto de la copia guardada (tras subirla o quitarla en «Mi perfil»). */
export function cambiarFotoGuardada(almacen: AlmacenFotocheck | null, participanteId: number | null | undefined, foto: string | null): void {
  const copia = leerFotocheckGuardado(almacen, participanteId)
  if (!copia) return
  guardarFotocheck(almacen, { ...copia, foto, fotocheck: { ...copia.fotocheck, foto: { tiene: Boolean(foto) } } })
}

/** Lo que mira `vigilarCopiaFotocheck` de la sesión (store `auth`). */
export interface SesionVigilada {
  /** La sesión ya se leyó del BFF (sin red queda en falso y la copia se conserva: es cuando sirve). */
  verificado: boolean
  participanteId: number | null
}

/**
 * Borra la copia del fotocheck cuando deja de ser de la sesión: al cerrarla (salir, vencida o
 * invalidada: `participanteId` nulo) o al entrar otra persona en el mismo navegador. Sin `immediate`: al
 * arrancar la sesión aún no se leyó y decide la primera lectura (`verificado`). La usa el plugin
 * `fotocheck-guardado.client.ts` con el store `auth`.
 */
export function vigilarCopiaFotocheck(sesion: () => SesionVigilada, almacen: () => AlmacenFotocheck | null): WatchStopHandle {
  return watch(
    () => {
      const { verificado, participanteId } = sesion()
      return [verificado, participanteId] as const
    },
    ([verificado, participanteId]) => {
      if (verificado) conservarFotocheckDe(almacen(), participanteId)
    },
  )
}
