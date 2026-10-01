import { describe, expect, it } from 'vitest'
import {
  claveLectura,
  debeProcesar,
  esLecturaLegada,
  interpretarLectura,
  lecturasNuevas,
  limpiarLectura,
  recienteTrasCerrar,
  VENTANA_REPETICION_MS,
} from '~/utils/lecturaQr'

describe('escáner: interpretar lo leído', () => {
  it('QR nuevo: 10 letras o dígitos, en mayúsculas y sin espacios ni saltos', () => {
    expect(interpretarLectura('K7Q2M9X4TB')).toEqual({ codigo: 'K7Q2M9X4TB' })
    expect(interpretarLectura('k7q2m9x4tb\r\n')).toEqual({ codigo: 'K7Q2M9X4TB' })
    expect(interpretarLectura(' K7Q2 M9X4\tTB ')).toEqual({ codigo: 'K7Q2M9X4TB' })
    // 10 dígitos también es un código (el id anterior nunca llega a 10 dígitos)
    expect(interpretarLectura('0123456789')).toEqual({ codigo: '0123456789' })
  })

  it('QR anterior: el id del participante (solo dígitos)', () => {
    expect(interpretarLectura('100')).toEqual({ participanteId: 100 })
    expect(interpretarLectura('  4521\n')).toEqual({ participanteId: 4521 })
    expect(interpretarLectura('007')).toEqual({ participanteId: 7 })
  })

  it('cualquier otra cosa: QR no válido (sin llamar al backend)', () => {
    for (const malo of ['', '   ', '0', '000', 'K7Q2M9X4T', 'K7Q2M9X4TBX', 'K7Q2-M9X4T', 'https://ciisic.pe/qr/K7Q2M9X4TB', 'ñ7Q2M9X4TB', '-12', '12.5', '99999999999999999999']) {
      expect(interpretarLectura(malo), malo).toBeNull()
    }
  })

  it('limpia espacios y saltos de línea', () => {
    expect(limpiarLectura(' a b\r\nc\t')).toBe('abc')
  })

  it('distingue el QR anterior (alerta ámbar) y arma la clave', () => {
    expect(esLecturaLegada({ participanteId: 100 })).toBe(true)
    expect(esLecturaLegada({ codigo: 'K7Q2M9X4TB' })).toBe(false)
    expect(claveLectura({ codigo: 'K7Q2M9X4TB' })).toBe('c:K7Q2M9X4TB')
    expect(claveLectura({ participanteId: 100 })).toBe('p:100')
  })
})

describe('escáner: lecturas repetidas', () => {
  const AHORA = 1_000_000
  const lectura = { codigo: 'K7Q2M9X4TB' }

  it('procesa la primera lectura y una distinta', () => {
    expect(debeProcesar(lectura, null, AHORA)).toBe(true)
    expect(debeProcesar({ codigo: 'AAAAAAAAAA' }, { clave: 'c:K7Q2M9X4TB', instante: AHORA }, AHORA + 10)).toBe(true)
    expect(debeProcesar({ participanteId: 100 }, { clave: 'c:K7Q2M9X4TB', instante: AHORA }, AHORA + 10)).toBe(true)
  })

  it('ignora la misma lectura antes de 3 s y la vuelve a procesar después', () => {
    const reciente = { clave: claveLectura(lectura), instante: AHORA }
    expect(debeProcesar(lectura, reciente, AHORA + 500)).toBe(false)
    expect(debeProcesar({ codigo: 'K7Q2M9X4TB' }, reciente, AHORA + VENTANA_REPETICION_MS - 1)).toBe(false)
    expect(debeProcesar(lectura, reciente, AHORA + VENTANA_REPETICION_MS)).toBe(true)
  })
})

describe('escáner: al cerrar un resultado', () => {
  const reciente = { clave: 'c:K7Q2M9X4TB', instante: 1_000 }

  it('tras un error la misma lectura se vuelve a procesar (p. ej. con «Fuera de horario» recién marcado)', () => {
    expect(recienteTrasCerrar(reciente, 'error', 2_000)).toBeNull()
    expect(debeProcesar({ codigo: 'K7Q2M9X4TB' }, recienteTrasCerrar(reciente, 'error', 2_000), 2_001)).toBe(true)
  })

  it('tras un registro o un aviso, los 3 s cuentan desde el cierre (la cámara vuelve a ver el mismo QR)', () => {
    const tras = recienteTrasCerrar(reciente, 'alerta', 60_000)
    expect(tras).toEqual({ clave: 'c:K7Q2M9X4TB', instante: 60_000 })
    expect(debeProcesar({ codigo: 'K7Q2M9X4TB' }, tras, 60_000 + VENTANA_REPETICION_MS - 1)).toBe(false)
    expect(recienteTrasCerrar(reciente, 'exito', 5_000)).toEqual({ clave: 'c:K7Q2M9X4TB', instante: 5_000 })
    expect(recienteTrasCerrar(null, 'exito', 5_000)).toBeNull()
  })
})

describe('escáner: QR que detecta la cámara', () => {
  it('con dos QR a la vista se procesan los dos (antes solo el primero, y el segundo nunca)', () => {
    expect(lecturasNuevas(['A', 'B'], [])).toEqual(['A', 'B'])
    // Queda solo B: la librería no vuelve a emitir, pero B ya se procesó con A
    expect(lecturasNuevas(['B'], ['A', 'B'])).toEqual([])
  })

  it('solo lo que no estaba en la detección anterior, sin repetidos ni vacíos', () => {
    expect(lecturasNuevas(['A', 'B'], ['A'])).toEqual(['B'])
    expect(lecturasNuevas(['A', 'A', '', 'C'], [])).toEqual(['A', 'C'])
    expect(lecturasNuevas(['A'], ['A'])).toEqual([])
  })

  it('tras pausar (detección anterior vacía) el mismo QR vuelve a salir', () => {
    expect(lecturasNuevas(['A'], [])).toEqual(['A'])
  })
})
