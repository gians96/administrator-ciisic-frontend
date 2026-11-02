import { describe, expect, it } from 'vitest'
import {
  entregadoARevisar,
  ETIQUETA_FILTRO_KIT,
  esFiltroKit,
  FILTROS_KIT,
  situacionKitFila,
  TEXTO_SITUACION_KIT_FILA,
  TONO_SITUACION_KIT_FILA,
} from '~/utils/kit'
import {
  CONTENIDO_KIT,
  consultaDeVista,
  diaInicialDeEntregas,
  diasConEntregas,
  estadoFilaKit,
  esFilaDeDelegacion,
  hayTiposConKit,
  horaEnLimaKits,
  horasDelDia,
  hoyEnLimaKits,
  indicadoresKits,
  listaSinFiltrarPorKit,
  nombreEntregador,
  nombreFilaTipo,
  notaDeVista,
  porcentajeKits,
  puedeDeshacerEnLista,
  puedeEntregarEnLista,
  tableroKitsDe,
  TITULO_VISTA,
  totalDelDia,
  VISTA_INICIAL,
  type EntregaPorHora,
  type TotalesKits,
  type VistaKits,
} from '~/utils/kitsTablero'
import type { KitEstado } from '~/types/api'

const TABLERO = {
  totales: { conKit: 50, entregados: 34, pendientes: 16, porAprobar: 8, aRevisar: 3 },
  porTipo: [
    { tipoInscripcionId: 10, nombre: 'ESTUDIANTES', etiqueta: 'CON KIT', categoria: { codigo: 'ESTUDIANTES', nombre: 'ESTUDIANTES' }, delegacionId: null, conKit: 40, entregados: 30, pendientes: 10, porAprobar: 8, aRevisar: 1 },
    { tipoInscripcionId: null, nombre: 'Sin tipo (cortesía)', etiqueta: null, categoria: null, delegacionId: null, conKit: 0, entregados: 0, pendientes: 0, porAprobar: 0, aRevisar: 1 },
  ],
  entregas: [{ fecha: '2026-10-27', hora: 9, total: 2 }],
  porPersona: [{ id: 41, nombres: 'Rosa', apellidos: 'Quispe', total: 3, ultimaEn: '2026-10-27T15:40:00.000Z' }],
}

const kit = (cambios: Partial<KitEstado> = {}): KitEstado => ({ incluye: true, entregado: false, entregadoEn: null, entregadoPor: null, ...cambios })
const ENTREGADO = kit({ entregado: true, entregadoEn: '2026-10-27T15:32:00.000Z', entregadoPor: { id: 41, nombres: 'Rosa', apellidos: 'Quispe' } })

const fila = (cambios: Record<string, unknown> = {}) => ({ id: 7, kit: kit(), estado: { id: 2, codigo: 'APROBADO' as const, nombre: 'Aprobado' }, ...cambios })

describe('tablero de kits: lo que llega del backend se lee con tolerancia', () => {
  it('acepta la forma esperada', () => {
    expect(tableroKitsDe(TABLERO)).toEqual(TABLERO)
  })

  it.each([
    ['null', null],
    ['texto', 'tablero'],
    ['arreglo', []],
    ['sin totales', { ...TABLERO, totales: undefined }],
    ['un total que no es número', { ...TABLERO, totales: { ...TABLERO.totales, conKit: '50' } }],
    ['un total que falta', { ...TABLERO, totales: { conKit: 1, entregados: 1, pendientes: 0, porAprobar: 0 } }],
    ['porTipo que no es arreglo', { ...TABLERO, porTipo: {} }],
    ['entregas que no es arreglo', { ...TABLERO, entregas: null }],
    ['porPersona que no es arreglo', { ...TABLERO, porPersona: 'x' }],
  ])('descarta %s (backend anterior o respuesta rota)', (_nombre, valor) => {
    expect(tableroKitsDe(valor)).toBeNull()
  })

  it('quita las filas que no tienen la forma esperada sin tumbar el tablero', () => {
    const tablero = tableroKitsDe({
      ...TABLERO,
      porTipo: [TABLERO.porTipo[0], { nombre: 'sin cifras' }, null, 5],
      entregas: [TABLERO.entregas[0], { fecha: '2026-10-27', hora: 'nueve', total: 1 }],
      porPersona: [TABLERO.porPersona[0], { total: 1 }],
    })
    expect(tablero?.porTipo).toHaveLength(1)
    expect(tablero?.entregas).toHaveLength(1)
    expect(tablero?.porPersona).toHaveLength(1)
  })

  it('un backend sin el tablero se detecta con una lista que no trae `kit`', () => {
    // Las filas de un backend anterior a la spec 045 no traen `kit` y `?kit=` se ignora: la lista no está filtrada
    expect(listaSinFiltrarPorKit('PENDIENTE', [{ kit: undefined }, { kit: undefined }])).toBe(true)
    expect(listaSinFiltrarPorKit('PENDIENTE', [{ kit: kit() }])).toBe(false)
    expect(listaSinFiltrarPorKit('', [{ kit: undefined }])).toBe(false)
    expect(listaSinFiltrarPorKit('PENDIENTE', [])).toBe(false)
  })
})

describe('tablero de kits: porcentajes e indicadores', () => {
  it('porcentajeKits redondea, no pasa de 100 y nunca muestra 100 % mientras falte algo', () => {
    expect(porcentajeKits(34, 50)).toBe(68)
    expect(porcentajeKits(50, 50)).toBe(100)
    expect(porcentajeKits(60, 50)).toBe(100)
    expect(porcentajeKits(499, 500)).toBe(99)
    expect(porcentajeKits(1, 1000)).toBe(0)
    expect(porcentajeKits(0, 50)).toBe(0)
    expect(porcentajeKits(5, 0)).toBe(0)
    expect(porcentajeKits(-3, 50)).toBe(0)
  })

  it('cinco indicadores en orden, cada uno con su vista, y el tono avisa de lo pendiente y de lo que hay que revisar', () => {
    const indicadores = indicadoresKits(TABLERO.totales)
    expect(indicadores.map((i) => i.vista)).toEqual(['A_ENTREGAR', 'ENTREGADOS', 'PENDIENTES', 'POR_APROBAR', 'A_REVISAR'])
    expect(indicadores.map((i) => i.valor)).toEqual([50, 34, 16, 8, 3])
    expect(indicadores.find((i) => i.vista === 'ENTREGADOS')?.detalle).toBe('68 % de los que corresponden')
    expect(indicadores.find((i) => i.vista === 'PENDIENTES')?.tono).toBe('warn')
    expect(indicadores.find((i) => i.vista === 'A_REVISAR')?.tono).toBe('error')

    const limpio = indicadoresKits({ conKit: 10, entregados: 10, pendientes: 0, porAprobar: 0, aRevisar: 0 })
    expect(limpio.find((i) => i.vista === 'PENDIENTES')?.tono).toBe('ok')
    expect(limpio.find((i) => i.vista === 'A_REVISAR')?.tono).toBe('neutral')
  })

  it('cada vista pide al listado el filtro que le corresponde; «aprobados con kit» añade el estado', () => {
    const vistas: VistaKits[] = ['A_ENTREGAR', 'ENTREGADOS', 'PENDIENTES', 'POR_APROBAR', 'A_REVISAR']
    expect(vistas.map((v) => consultaDeVista(v))).toEqual([
      { kit: 'CON_KIT', estado: 'APROBADO' },
      { kit: 'ENTREGADO', estado: '' },
      { kit: 'PENDIENTE', estado: '' },
      { kit: 'POR_APROBAR', estado: '' },
      { kit: 'REVISAR', estado: '' },
    ])
    // Todos los filtros que se piden son valores que el backend entiende
    for (const v of vistas) expect(esFiltroKit(consultaDeVista(v).kit)).toBe(true)
    expect(VISTA_INICIAL).toBe('PENDIENTES')
    for (const v of vistas) expect(TITULO_VISTA[v]).not.toBe('')
  })

  it('la lista de entregados avisa cuántos hoy no corresponden; otras vistas, solo lo necesario', () => {
    const totales: TotalesKits = { ...TABLERO.totales }
    expect(notaDeVista('ENTREGADOS', totales)).toContain('3 kits entregados que hoy no corresponden')
    expect(notaDeVista('ENTREGADOS', { ...totales, aRevisar: 1 })).toContain('1 kit entregado que hoy no corresponde')
    expect(notaDeVista('ENTREGADOS', { ...totales, aRevisar: 0 })).toBe('')
    expect(notaDeVista('ENTREGADOS', null)).toBe('')
    expect(notaDeVista('POR_APROBAR', totales)).toContain('aprobar su pago')
    expect(notaDeVista('A_REVISAR', totales)).toContain('detalle de la inscripción')
    expect(notaDeVista('PENDIENTES', totales)).toBe('')
    expect(notaDeVista('A_ENTREGAR', totales)).toBe('')
  })

  it('el contenido del kit es el de la landing: mochila, tomatodo, fotocheck con QR y certificado de 100 horas', () => {
    expect(CONTENIDO_KIT.map((item) => item.titulo)).toEqual(['Mochila oficial', 'Tomatodo oficial', 'Fotocheck con código QR', 'Certificado de 100 horas'])
  })

  it('hayTiposConKit mira la bandera del tipo (un backend anterior no la envía)', () => {
    expect(hayTiposConKit([{ tipos: [{ incluyeKit: false }, { incluyeKit: true }] }] as never)).toBe(true)
    expect(hayTiposConKit([{ tipos: [{ incluyeKit: false }, {}] }] as never)).toBe(false)
    expect(hayTiposConKit([])).toBe(false)
  })
})

describe('tablero de kits: por tipo y delegación', () => {
  it('los planes de una delegación se reconocen por su delegacionId', () => {
    expect(esFilaDeDelegacion({ delegacionId: 2 })).toBe(true)
    expect(esFilaDeDelegacion({ delegacionId: null })).toBe(false)
  })

  it('el nombre lleva la etiqueta si la hay', () => {
    expect(nombreFilaTipo({ nombre: 'ESTUDIANTES', etiqueta: 'CON KIT' })).toBe('ESTUDIANTES · CON KIT')
    expect(nombreFilaTipo({ nombre: 'Sin tipo (cortesía)', etiqueta: null })).toBe('Sin tipo (cortesía)')
  })
})

describe('tablero de kits: ritmo de entrega en hora de Lima', () => {
  const entregas: EntregaPorHora[] = [
    { fecha: '2026-10-27', hora: 9, total: 2 },
    { fecha: '2026-10-27', hora: 12, total: 4 },
    { fecha: '2026-10-28', hora: 8, total: 1 },
  ]

  it('hoy y la hora se leen en Lima, no en UTC', () => {
    // 02:30 UTC del 28 = 21:30 del 27 en Lima
    const instante = new Date('2026-10-28T02:30:00.000Z')
    expect(hoyEnLimaKits(instante)).toBe('2026-10-27')
    expect(horaEnLimaKits(instante)).toBe('21:30')
    // Medianoche de Lima (05:00 UTC) es 00:00, no 24:00
    expect(horaEnLimaKits(new Date('2026-10-28T05:00:00.000Z'))).toBe('00:00')
  })

  it('días con entregas, sin repetir y en orden; total de un día', () => {
    expect(diasConEntregas(entregas)).toEqual(['2026-10-27', '2026-10-28'])
    expect(diasConEntregas([])).toEqual([])
    expect(totalDelDia(entregas, '2026-10-27')).toBe(6)
    expect(totalDelDia(entregas, '2026-11-01')).toBe(0)
  })

  it('el día inicial es hoy si ya hubo entregas; si no, el último con entregas; sin entregas, ninguno', () => {
    expect(diaInicialDeEntregas(entregas, '2026-10-27')).toBe('2026-10-27')
    expect(diaInicialDeEntregas(entregas, '2026-11-02')).toBe('2026-10-28')
    expect(diaInicialDeEntregas([], '2026-11-02')).toBeNull()
  })

  it('las horas de un día van de la primera a la última con entregas, con ceros en medio', () => {
    expect(horasDelDia(entregas, '2026-10-27')).toEqual({
      etiquetas: ['09:00', '10:00', '11:00', '12:00'],
      valores: [2, 0, 0, 4],
    })
    expect(horasDelDia(entregas, '2026-10-28')).toEqual({ etiquetas: ['08:00'], valores: [1] })
    expect(horasDelDia(entregas, '2026-11-01')).toEqual({ etiquetas: [], valores: [] })
  })

  it('ignora horas fuera de 0–23 y suma las filas repetidas de una misma hora', () => {
    const raras: EntregaPorHora[] = [
      { fecha: '2026-10-27', hora: 9, total: 1 },
      { fecha: '2026-10-27', hora: 9, total: 2 },
      { fecha: '2026-10-27', hora: 25, total: 9 },
    ]
    expect(horasDelDia(raras, '2026-10-27')).toEqual({ etiquetas: ['09:00'], valores: [3] })
  })
})

describe('tablero de kits: quién entrega', () => {
  it('muestra el nombre, o «Cuenta eliminada» si la cuenta ya no existe', () => {
    expect(nombreEntregador({ id: 41, nombres: 'Rosa', apellidos: 'Quispe' })).toBe('Rosa Quispe')
    expect(nombreEntregador({ id: null, nombres: null, apellidos: null })).toBe('Cuenta eliminada')
  })
})

describe('kit en el listado de inscripciones (spec 045)', () => {
  it('los seis filtros son los del backend y cada uno tiene su texto', () => {
    expect(FILTROS_KIT).toEqual(['CON_KIT', 'SIN_KIT', 'PENDIENTE', 'ENTREGADO', 'POR_APROBAR', 'REVISAR'])
    for (const valor of FILTROS_KIT) expect(ETIQUETA_FILTRO_KIT[valor]).not.toBe('')
    for (const valor of ['con_kit', 'TODOS', '', null, undefined, 3]) expect(esFiltroKit(valor)).toBe(false)
  })

  it('situacionKitFila: entregado manda; después el tipo; después el estado de la inscripción', () => {
    expect(situacionKitFila(ENTREGADO, 'CANCELADO')).toBe('ENTREGADO')
    expect(situacionKitFila(kit(), 'APROBADO')).toBe('PENDIENTE')
    expect(situacionKitFila(kit(), 'PENDIENTE')).toBe('POR_APROBAR')
    expect(situacionKitFila(kit(), 'EN_REVISION')).toBe('POR_APROBAR')
    expect(situacionKitFila(kit(), 'RECHAZADO')).toBe('NINGUNO')
    expect(situacionKitFila(kit(), 'CANCELADO')).toBe('NINGUNO')
    expect(situacionKitFila(kit({ incluye: false }), 'APROBADO')).toBe('NINGUNO')
    // Un backend anterior no envía `kit`: no hay nada que decir
    expect(situacionKitFila(undefined, 'APROBADO')).toBe('NINGUNO')
    expect(situacionKitFila(null, 'APROBADO')).toBe('NINGUNO')
    expect(TEXTO_SITUACION_KIT_FILA.NINGUNO).toBe('')
    expect(TONO_SITUACION_KIT_FILA.ENTREGADO).toBe('ok')
    expect(TONO_SITUACION_KIT_FILA.PENDIENTE).toBe('warn')
  })

  it('entregadoARevisar: se entregó pero hoy no corresponde (otro estado o un tipo sin kit)', () => {
    expect(entregadoARevisar(ENTREGADO, 'APROBADO')).toBe(false)
    expect(entregadoARevisar(ENTREGADO, 'CANCELADO')).toBe(true)
    expect(entregadoARevisar({ ...ENTREGADO, incluye: false }, 'APROBADO')).toBe(true)
    expect(entregadoARevisar(kit(), 'CANCELADO')).toBe(false)
    expect(entregadoARevisar(undefined, 'APROBADO')).toBe(false)
  })

  it('estadoFilaKit junta las dos cosas para una fila', () => {
    expect(estadoFilaKit(fila())).toEqual({ situacion: 'PENDIENTE', aRevisar: false })
    expect(estadoFilaKit(fila({ kit: ENTREGADO }))).toEqual({ situacion: 'ENTREGADO', aRevisar: false })
    expect(estadoFilaKit(fila({ kit: ENTREGADO, estado: { id: 5, codigo: 'CANCELADO', nombre: 'Cancelado' } }))).toEqual({ situacion: 'ENTREGADO', aRevisar: true })
    expect(estadoFilaKit(fila({ kit: undefined }))).toEqual({ situacion: 'NINGUNO', aRevisar: false })
    // Una `kit` con otra forma (backend raro) se trata como ausente
    expect(estadoFilaKit(fila({ kit: { entregado: 'sí' } }))).toEqual({ situacion: 'NINGUNO', aRevisar: false })
  })

  it('«Entregar kit» solo en una aprobada con kit y sin entregar; «Deshacer», en cualquiera ya entregada', () => {
    expect(puedeEntregarEnLista(fila())).toBe(true)
    // Sin aprobar el backend responde NOT_APPROVED: no se ofrece
    expect(puedeEntregarEnLista(fila({ estado: { id: 1, codigo: 'PENDIENTE', nombre: 'Pendiente' } }))).toBe(false)
    expect(puedeEntregarEnLista(fila({ kit: kit({ incluye: false }) }))).toBe(false)
    expect(puedeEntregarEnLista(fila({ kit: ENTREGADO }))).toBe(false)
    expect(puedeEntregarEnLista(fila({ kit: undefined }))).toBe(false)

    expect(puedeDeshacerEnLista(fila({ kit: ENTREGADO }))).toBe(true)
    // Se puede deshacer aunque hoy no corresponda (corregir un error)
    expect(puedeDeshacerEnLista(fila({ kit: { ...ENTREGADO, incluye: false } }))).toBe(true)
    expect(puedeDeshacerEnLista(fila())).toBe(false)
    expect(puedeDeshacerEnLista(fila({ kit: undefined }))).toBe(false)
  })
})
