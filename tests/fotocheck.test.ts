import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  borrarFotocheckGuardado,
  cambiarFotoGuardada,
  CLAVE_FOTOCHECK_GUARDADO,
  conservarFotocheckDe,
  datosDeImagen,
  esFalloDeConexion,
  esFotocheckPortal,
  esImagenEnDatos,
  guardarFotocheck,
  horaEnLima,
  inscripcionElegida,
  inscripcionesConFotocheck,
  leerFotocheckGuardado,
  motivoSinFotocheck,
  tieneFotocheck,
  vigilarCopiaFotocheck,
  type AlmacenFotocheck,
  type FotocheckGuardado,
} from '~/utils/fotocheck'
import type { InscripcionPortal } from '~/utils/misInscripciones'
import type { FotocheckPortal } from '~/utils/portal'

const QR = 'data:image/png;base64,iVBORw0KGgo='
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

function inscripcion(id: number, estado: InscripcionPortal['estado']['codigo'], fechaInicio: string, fechaFin: string, fotocheck?: boolean): InscripcionPortal {
  return {
    id,
    evento: { codigo: `E${id}`, nombre: `Evento ${id}`, nombreCorto: `E${id}`, fechaInicio, fechaFin, sede: null },
    tipoInscripcion: null,
    clasificacion: null,
    monto: 0,
    precioRegular: 0,
    descuento: 0,
    pago: { modalidad: null, banco: null, tipoOperacion: null, billeteraDigital: null, numeroOperacion: 'X', fechaPago: null },
    estado: { codigo: estado, nombre: estado },
    motivoRechazo: null,
    revisadoEn: null,
    credencial: { disponible: estado === 'APROBADO', enviadaEn: null },
    ...(fotocheck === undefined ? {} : { fotocheck: { disponible: fotocheck } }),
    creadoEn: '2026-09-01T00:00:00.000Z',
  }
}

function fotocheck(inscripcionId = 500): FotocheckPortal {
  return {
    inscripcionId,
    codigo: 'K7Q2M9X4TB',
    qr: QR,
    evento: { nombre: 'VIII Congreso', nombreCorto: 'VIII CIISIC 2026', fechaInicio: '2026-10-26', fechaFin: '2026-10-30', sede: 'UNDC' },
    participante: { nombres: 'ANA', apellidos: 'PÉREZ GARCÍA', tipoDocumento: 'dni', documentoEnmascarado: '****1234' },
    tipoInscripcion: { nombre: 'ESTUDIANTES', etiqueta: 'CON KIT' },
    foto: { tiene: true },
  }
}

function copia(participanteId = 29, extra: Partial<FotocheckGuardado> = {}): FotocheckGuardado {
  return { participanteId, guardadoEn: '2026-10-26T13:00:00.000Z', fotocheck: fotocheck(), foto: FOTO, ...extra }
}

/** `localStorage` en memoria; `lleno` rechaza textos más largos que el tope, `bloqueado` lanza siempre. */
function almacen(opciones: { tope?: number, bloqueado?: boolean } = {}): AlmacenFotocheck & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  const revisar = () => {
    if (opciones.bloqueado) throw new Error('SecurityError')
  }
  return {
    datos,
    getItem: (clave) => {
      revisar()
      return datos.get(clave) ?? null
    },
    setItem: (clave, valor) => {
      revisar()
      if (opciones.tope !== undefined && valor.length > opciones.tope) throw new Error('QuotaExceededError')
      datos.set(clave, valor)
    },
    removeItem: (clave) => {
      revisar()
      datos.delete(clave)
    },
  }
}

describe('fotocheck: qué inscripción mostrar', () => {
  it('con el backend 014 manda fotocheck.disponible; con el anterior, el estado APROBADO', () => {
    expect(tieneFotocheck(inscripcion(1, 'APROBADO', '2026-10-26', '2026-10-30', true))).toBe(true)
    expect(tieneFotocheck(inscripcion(1, 'APROBADO', '2026-10-26', '2026-10-30', false))).toBe(false)
    expect(tieneFotocheck(inscripcion(1, 'APROBADO', '2026-10-26', '2026-10-30'))).toBe(true)
    expect(tieneFotocheck(inscripcion(1, 'PENDIENTE', '2026-10-26', '2026-10-30'))).toBe(false)
  })

  it('orden: en curso, próximos (el más cercano) y pasados (el más reciente); sin las no aprobadas', () => {
    const lista = [
      inscripcion(1, 'APROBADO', '2025-10-20', '2025-10-24', true),
      inscripcion(2, 'APROBADO', '2026-12-01', '2026-12-03', true),
      inscripcion(3, 'APROBADO', '2026-10-26', '2026-10-30', true),
      inscripcion(4, 'APROBADO', '2026-11-10', '2026-11-12', true),
      inscripcion(5, 'PENDIENTE', '2026-10-26', '2026-10-30', false),
      inscripcion(6, 'APROBADO', '2026-05-01', '2026-05-02', true),
    ]
    expect(inscripcionesConFotocheck(lista, '2026-10-27').map((i) => i.id)).toEqual([3, 4, 2, 6, 1])
    // Antes del evento: los próximos primero, el más cercano antes
    expect(inscripcionesConFotocheck(lista, '2026-10-01').map((i) => i.id)).toEqual([3, 4, 2, 6, 1])
    // El último día del evento sigue en curso
    expect(inscripcionesConFotocheck(lista, '2026-10-30')[0]?.id).toBe(3)
    expect(inscripcionesConFotocheck(lista, '2026-10-31').map((i) => i.id)).toEqual([4, 2, 3, 6, 1])
  })

  it('la del enlace si tiene fotocheck; si no, la primera', () => {
    const opciones = [inscripcion(3, 'APROBADO', '2026-10-26', '2026-10-30'), inscripcion(4, 'APROBADO', '2026-11-10', '2026-11-12')]
    expect(inscripcionElegida(opciones, 4)?.id).toBe(4)
    expect(inscripcionElegida(opciones, 99)?.id).toBe(3)
    expect(inscripcionElegida(opciones, null)?.id).toBe(3)
    expect(inscripcionElegida([], 3)).toBeNull()
  })

  it('explica por qué no hay fotocheck', () => {
    expect(motivoSinFotocheck([]).titulo).toMatch(/Aún no tienes inscripciones/)
    expect(motivoSinFotocheck([{ estado: { codigo: 'EN_REVISION', nombre: '' } }, { estado: { codigo: 'RECHAZADO', nombre: '' } }]).titulo).toMatch(/en revisión/)
    expect(motivoSinFotocheck([{ estado: { codigo: 'PENDIENTE', nombre: '' } }]).descripcion).toMatch(/aprueba tu inscripción/)
    expect(motivoSinFotocheck([{ estado: { codigo: 'RECHAZADO', nombre: '' } }]).descripcion).toMatch(/Revisa el motivo/)
    expect(motivoSinFotocheck([{ estado: { codigo: 'CANCELADO', nombre: '' } }]).titulo).toMatch(/No tienes inscripciones aprobadas/)
  })
})

describe('fotocheck: reloj en vivo', () => {
  it('hora de Lima con segundos, de 00 a 23', () => {
    expect(horaEnLima(new Date('2026-10-26T19:05:09.000Z'))).toBe('14:05:09')
    expect(horaEnLima(new Date('2026-10-27T05:00:00.000Z'))).toBe('00:00:00')
  })
})

describe('fotocheck: fallos de conexión', () => {
  it('sin red, 5xx o 429 permiten mostrar la copia; los 404/409 no', () => {
    expect(esFalloDeConexion(new Error('fetch failed'))).toBe(true)
    expect(esFalloDeConexion({ status: 503, data: { code: 'SESSION_UNAVAILABLE' } })).toBe(true)
    expect(esFalloDeConexion({ status: 429, data: { code: 'RATE_LIMITED' } })).toBe(true)
    expect(esFalloDeConexion({ status: 409, data: { code: 'NOT_APPROVED' } })).toBe(false)
    expect(esFalloDeConexion({ status: 404, data: { code: 'INSCRIPTION_NOT_FOUND' } })).toBe(false)
  })
})

describe('fotocheck: imágenes en data:', () => {
  it('solo PNG o JPEG en base64', () => {
    expect(esImagenEnDatos(QR)).toBe(true)
    expect(esImagenEnDatos(FOTO)).toBe(true)
    expect(esImagenEnDatos('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(esImagenEnDatos('javascript:alert(1)')).toBe(false)
    expect(esImagenEnDatos('data:image/png;base64,abc"onerror')).toBe(false)
    expect(esImagenEnDatos(null)).toBe(false)
  })

  it('convierte los bytes de la foto', () => {
    const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])
    expect(datosDeImagen(bytes, 'image/jpeg')).toBe('data:image/jpeg;base64,/9j/2Q==')
    expect(datosDeImagen(bytes, 'Image/JPEG; charset=binary')).toBe('data:image/jpeg;base64,/9j/2Q==')
    expect(datosDeImagen(bytes, 'image/webp')).toBeNull()
    expect(datosDeImagen(new Uint8Array(), 'image/png')).toBeNull()
  })

  it('imágenes grandes (por partes) dan el mismo base64', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(datosDeImagen(bytes, 'image/png')).toBe(`data:image/png;base64,${Buffer.from(bytes).toString('base64')}`)
  })

  it('forma mínima del fotocheck', () => {
    expect(esFotocheckPortal(fotocheck())).toBe(true)
    expect(esFotocheckPortal({ ...fotocheck(), qr: 'https://otro.sitio/qr.png' })).toBe(false)
    expect(esFotocheckPortal({ ...fotocheck(), participante: null })).toBe(false)
    expect(esFotocheckPortal('x')).toBe(false)
  })
})

describe('fotocheck: copia en el dispositivo', () => {
  it('guarda y lee la copia del mismo participante', () => {
    const local = almacen()
    expect(guardarFotocheck(local, copia())).toBe(true)
    expect(leerFotocheckGuardado(local, 29)).toEqual(copia())
    expect(leerFotocheckGuardado(local, 30)).toBeNull()
    expect(leerFotocheckGuardado(local, null)).toBeNull()
  })

  it('si no cabe con la foto, la guarda sin ella; si tampoco, no guarda nada', () => {
    const sinFoto = JSON.stringify(copia(29, { foto: null })).length
    const justo = almacen({ tope: sinFoto })
    expect(guardarFotocheck(justo, copia())).toBe(true)
    expect(leerFotocheckGuardado(justo, 29)?.foto).toBeNull()

    expect(guardarFotocheck(almacen({ tope: 10 }), copia())).toBe(false)
  })

  it('almacenamiento bloqueado o ausente: nunca lanza', () => {
    const bloqueado = almacen({ bloqueado: true })
    expect(guardarFotocheck(bloqueado, copia())).toBe(false)
    expect(leerFotocheckGuardado(bloqueado, 29)).toBeNull()
    expect(() => borrarFotocheckGuardado(bloqueado)).not.toThrow()
    expect(() => conservarFotocheckDe(bloqueado, null)).not.toThrow()
    expect(guardarFotocheck(null, copia())).toBe(false)
    expect(leerFotocheckGuardado(null, 29)).toBeNull()
  })

  it('una copia dañada o de otra forma no se muestra', () => {
    const local = almacen()
    local.datos.set(CLAVE_FOTOCHECK_GUARDADO, '{no es json')
    expect(leerFotocheckGuardado(local, 29)).toBeNull()
    local.datos.set(CLAVE_FOTOCHECK_GUARDADO, JSON.stringify({ ...copia(), fotocheck: { inscripcionId: 1 } }))
    expect(leerFotocheckGuardado(local, 29)).toBeNull()
    local.datos.set(CLAVE_FOTOCHECK_GUARDADO, JSON.stringify({ ...copia(), foto: 'data:text/html;base64,PGI+' }))
    expect(leerFotocheckGuardado(local, 29)?.foto).toBeNull()
  })

  it('al cerrar sesión (sin participante) o entrar otra persona se borra; la misma la conserva', () => {
    const local = almacen()
    guardarFotocheck(local, copia())
    conservarFotocheckDe(local, 29)
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(true)
    conservarFotocheckDe(local, 30)
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(false)

    guardarFotocheck(local, copia())
    conservarFotocheckDe(local, null)
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(false)

    local.datos.set(CLAVE_FOTOCHECK_GUARDADO, 'basura')
    conservarFotocheckDe(local, 29)
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(false)
  })

  it('cambiar o quitar la foto actualiza la copia (solo la del mismo participante)', () => {
    const local = almacen()
    guardarFotocheck(local, copia(29, { foto: null, fotocheck: { ...fotocheck(), foto: { tiene: false } } }))
    cambiarFotoGuardada(local, 29, FOTO)
    expect(leerFotocheckGuardado(local, 29)).toMatchObject({ foto: FOTO, fotocheck: { foto: { tiene: true } } })
    cambiarFotoGuardada(local, 29, null)
    expect(leerFotocheckGuardado(local, 29)).toMatchObject({ foto: null, fotocheck: { foto: { tiene: false } } })
    cambiarFotoGuardada(local, 30, FOTO)
    expect(leerFotocheckGuardado(local, 29)?.foto).toBeNull()
  })
})

describe('fotocheck: la copia sigue a la sesión (plugin fotocheck-guardado)', () => {
  function sesion() {
    const verificado = ref(false)
    const participanteId = ref<number | null>(null)
    return { verificado, participanteId, leer: () => ({ verificado: verificado.value, participanteId: participanteId.value }) }
  }

  it('al arrancar no borra nada hasta leer la sesión (sin red la copia se conserva)', async () => {
    const local = almacen()
    guardarFotocheck(local, copia(29))
    const { leer } = sesion()
    const parar = vigilarCopiaFotocheck(leer, () => local)
    await nextTick()
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(true)
    parar()
  })

  it('la primera lectura de la sesión decide: del mismo participante se queda, de otro se borra', async () => {
    const local = almacen()
    guardarFotocheck(local, copia(29))
    const { verificado, participanteId, leer } = sesion()
    const parar = vigilarCopiaFotocheck(leer, () => local)
    verificado.value = true
    participanteId.value = 29
    await nextTick()
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(true)
    // Entra otra persona en el mismo navegador
    participanteId.value = 30
    await nextTick()
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(false)
    parar()
  })

  it('al cerrar la sesión (o al entrar el staff) se borra', async () => {
    const local = almacen()
    guardarFotocheck(local, copia(29))
    const { verificado, participanteId, leer } = sesion()
    verificado.value = true
    participanteId.value = 29
    const parar = vigilarCopiaFotocheck(leer, () => local)
    participanteId.value = null
    await nextTick()
    expect(local.datos.has(CLAVE_FOTOCHECK_GUARDADO)).toBe(false)
    parar()
  })
})
