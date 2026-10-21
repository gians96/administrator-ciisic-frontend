import { describe, expect, it } from 'vitest'
import {
  cuerpoTarifa,
  cuerpoTarifaDelegacion,
  enlaceInscripcionDelegacion,
  esTarifaDeConvenio,
  estimarGrupo,
  filaEnBlanco,
  filaVacia,
  filasParaEnviar,
  formularioDeTarifa,
  formularioDeTarifaDelegacion,
  formularioPagos,
  hoyLima,
  montoDelegacion,
  normalizarDni,
  origenLanding,
  pagoVacio,
  parsearParticipantesDelegacion,
  precioUnitarioDelegacion,
  tarifaDeAdmin,
  tarifaDeTipos,
  tarifaParaModalidad,
  textoSaldo,
  textoTarifaGuardada,
  validarPago,
  validarTarifa,
  validarTarifaDelegacion,
  type PagoFormulario,
  type TarifaDelegaciones,
} from '~/utils/delegaciones'
import type { TarifaDelegacionesAdmin } from '~/types/api'

describe('tarifa de la delegación', () => {
  it.each([
    [0, 60], [1, 60], [9, 60], [10, 50], [11, 50], [25, 50],
  ])('con %i integrantes cobra %i por persona', (total, esperado) => {
    expect(precioUnitarioDelegacion(60, 50, 10, total)).toBe(esperado)
  })

  it('calcula el total con la tarifa vigente', () => {
    expect(montoDelegacion(60, 9)).toBe(540)
    expect(montoDelegacion(50, 10)).toBe(500)
    expect(montoDelegacion(50, 13)).toBe(650)
  })
})

describe('carga masiva', () => {
  it('lee cinco columnas y normaliza el correo', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana, Pérez, Ana@Example.com, 987654321')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas).toEqual([{
      tipoDocumento: 'dni', numeroDocumento: '70123456', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com', celular: '987654321',
    }])
  })

  it('acepta tres columnas con el nombre completo y separa la última palabra como apellido', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana María Pérez, ana@example.com')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas[0]).toMatchObject({ nombres: 'Ana María', apellidos: 'Pérez', correo: 'ana@example.com', celular: '' })
  })

  it('ignora la cabecera, las líneas vacías y acepta punto y coma o tabulador', () => {
    const resultado = parsearParticipantesDelegacion('DNI;Nombres;Apellidos;Correo;Celular\n\n70123456;Ana;Pérez;ana@example.com;987654321\n')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas).toHaveLength(1)
    expect(parsearParticipantesDelegacion('70123456\tAna\tPérez\tana@example.com').filas).toHaveLength(1)
  })

  it('señala las filas incompletas con su número de línea', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana, ana@example.com\n70123457, Luis, Gómez, correo-invalido')
    expect(resultado.filas).toHaveLength(0)
    expect(resultado.errores).toEqual(expect.arrayContaining([
      expect.stringContaining('Línea 1: faltan los apellidos'),
      expect.stringContaining('Línea 2: el correo'),
    ]))
  })

  it('un documento que no tiene 8 dígitos se envía como carné de extranjería', () => {
    expect(parsearParticipantesDelegacion('CE1234567, Ana, Pérez, ana@example.com').filas[0].tipoDocumento).toBe('ce')
  })
})

describe('link público', () => {
  it('lleva el código al formulario de la landing', () => {
    expect(enlaceInscripcionDelegacion('abc123', 'https://ciisic.example/')).toBe('https://ciisic.example/delegaciones?delegacion=abc123')
  })

  it('escapa el código en la URL', () => {
    expect(enlaceInscripcionDelegacion('a b&c', 'https://ciisic.example')).toBe('https://ciisic.example/delegaciones?delegacion=a%20b%26c')
  })
})

const TARIFA: TarifaDelegaciones = { minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50, virtual: { precio: 30 } }

describe('estimado en vivo (convenio)', () => {
  it.each([
    [0, 60, 0, 10], [1, 60, 60, 9], [9, 60, 540, 1], [10, 50, 500, null], [24, 50, 1200, null],
  ])('presencial con %i integrantes: S/ %i c/u, total %i', (cantidad, unitario, total, faltan) => {
    expect(estimarGrupo('PRESENCIAL', cantidad, TARIFA)).toEqual({ precioUnitario: unitario, total, faltan })
  })

  it('virtual cobra la tarifa única sin escalas', () => {
    expect(estimarGrupo('VIRTUAL', 3, TARIFA)).toEqual({ precioUnitario: 30, total: 90, faltan: null })
    expect(estimarGrupo('VIRTUAL', 24, TARIFA)).toEqual({ precioUnitario: 30, total: 720, faltan: null })
  })

  it('sin tipo virtual usa el precio por defecto de la tarifa virtual', () => {
    expect(estimarGrupo('VIRTUAL', 2, { ...TARIFA, virtual: null }).precioUnitario).toBe(30)
  })

  it('una cantidad inválida cuenta como cero', () => {
    expect(estimarGrupo('PRESENCIAL', Number.NaN, TARIFA).total).toBe(0)
    expect(estimarGrupo('PRESENCIAL', -3, TARIFA).total).toBe(0)
  })

  it('la tarifa sale de los tipos activos de DELEGACIONES', () => {
    expect(tarifaDeTipos([
      { codigo: 'delegacion_general', precio: 65, activo: true },
      { codigo: 'delegacion_grupal', precio: 55, activo: true },
      { codigo: 'delegacion_virtual', precio: 30, activo: true },
    ])).toEqual({ minIntegrantes: 10, precioEstandar: 65, precioPromocional: 55, virtual: { precio: 30 } })
  })

  it('sin tipos usa los precios por defecto y no ofrece virtual; un tipo inactivo no cuenta', () => {
    expect(tarifaDeTipos([])).toEqual({ minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50, virtual: null })
    expect(tarifaDeTipos([{ codigo: 'delegacion_virtual', precio: 30, activo: false }]).virtual).toBeNull()
  })
})

describe('DNI y filas de integrantes', () => {
  it('completa con cero el DNI de 7 dígitos que Excel dejó sin él', () => {
    expect(normalizarDni('7969419')).toBe('07969419')
    expect(normalizarDni('23715269')).toBe('23715269')
    expect(normalizarDni(' 7969419 ')).toBe('07969419')
    expect(normalizarDni('CE1234567')).toBe('CE1234567')
  })

  it('la carga masiva también completa el DNI de 7 dígitos', () => {
    const resultado = parsearParticipantesDelegacion('7969419, Janeth, Mariño, janeth@unat.edu.pe')
    expect(resultado.filas[0]).toMatchObject({ tipoDocumento: 'dni', numeroDocumento: '07969419' })
  })

  it('ignora las filas en blanco y limpia las demás', () => {
    const vacia = filaVacia()
    const con = { ...filaVacia(), numeroDocumento: ' 7969419 ', nombres: ' Ana ', apellidos: ' Pérez', correo: ' ANA@Example.com ', celular: ' 987654321 ' }
    expect(filaEnBlanco(vacia)).toBe(true)
    expect(filasParaEnviar([vacia, con])).toEqual([{
      tipoDocumento: 'dni', numeroDocumento: '07969419', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com', celular: '987654321',
    }])
  })

  it('cada fila nueva tiene su propia clave', () => {
    expect(filaVacia().clave).not.toBe(filaVacia().clave)
  })
})

describe('vouchers del panel', () => {
  const archivo = (nombre = 'voucher.pdf', tamano = 1024) => new File([new Uint8Array(tamano)], nombre, { type: 'application/pdf' })
  const completo = (extra: Partial<PagoFormulario> = {}): PagoFormulario => ({
    ...pagoVacio(), numeroOperacion: 'OP-123', fechaPago: '2026-10-15', monto: 250, archivo: archivo(), ...extra,
  })

  it('un voucher completo no tiene errores', () => {
    expect(validarPago(completo(), '2026-10-20')).toEqual({})
  })

  it('exige número, fecha, monto y archivo', () => {
    expect(Object.keys(validarPago(pagoVacio(), '2026-10-20')).sort()).toEqual(['archivo', 'fechaPago', 'monto', 'numeroOperacion'])
  })

  it('rechaza fecha futura, monto en cero y archivos no permitidos o demasiado grandes', () => {
    expect(validarPago(completo({ fechaPago: '2026-10-21' }), '2026-10-20').fechaPago).toMatch(/futura/)
    expect(validarPago(completo({ monto: 0 }), '2026-10-20').monto).toBeTruthy()
    expect(validarPago(completo({ archivo: archivo('voucher.exe') }), '2026-10-20').archivo).toMatch(/PDF, JPG/)
    expect(validarPago(completo({ archivo: archivo('voucher.pdf', 6 * 1024 * 1024) }), '2026-10-20').archivo).toMatch(/5 MB/)
    expect(validarPago(completo({ archivo: archivo('voucher.pdf', 0) }), '2026-10-20').archivo).toMatch(/vacío/)
  })

  it('el multipart lleva un archivo por pago, en el mismo orden', () => {
    const uno = archivo('uno.pdf')
    const dos = archivo('dos.pdf')
    const cuerpo = formularioPagos([
      completo({ archivo: uno, modalidadPago: 'billetera', billeteraDigital: 'yape' }),
      completo({ archivo: dos, modalidadPago: 'banco', banco: 'bcp', tipoOperacion: 'interbancario', numeroOperacion: 'OP-456', monto: 100 }),
    ])
    const pagos = JSON.parse(String(cuerpo.get('pagos'))) as Array<Record<string, unknown>>
    expect(pagos).toEqual([
      { modalidadPago: 'billetera', billeteraDigital: 'yape', numeroOperacion: 'OP-123', fechaPago: '2026-10-15', monto: 250 },
      { modalidadPago: 'banco', banco: 'bcp', tipoOperacion: 'interbancario', numeroOperacion: 'OP-456', fechaPago: '2026-10-15', monto: 100 },
    ])
    expect(cuerpo.getAll('vouchers')).toHaveLength(2)
  })

  it('el saldo se describe como falta, sobra o pagado', () => {
    expect(textoSaldo(0)).toBe('Pagado')
    expect(textoSaldo(0.004)).toBe('Pagado')
    expect(textoSaldo(120)).toBe('Falta pagar 120.00')
    expect(textoSaldo(-30)).toBe('Se declaró 30.00 de más')
  })

  it('hoy se calcula en hora de Lima', () => {
    // 03:00 UTC del 21 todavía es 22:00 del 20 en Lima
    expect(hoyLima(new Date('2026-10-21T03:00:00Z'))).toBe('2026-10-20')
    expect(hoyLima(new Date('2026-10-21T12:00:00Z'))).toBe('2026-10-21')
  })
})

const ADMIN: TarifaDelegacionesAdmin = {
  minIntegrantes: 10,
  presencial: { precioEstandar: 60, precioPromocional: 50 },
  virtual: { precio: 30, activo: true },
  delegaciones: { total: 2, sinIntegrantes: 1 },
}

describe('tarifa del evento (spec 015)', () => {
  it('la tarifa del alta sale de la del evento y la virtual solo se ofrece si su tipo está activo', () => {
    expect(tarifaDeAdmin(ADMIN)).toEqual({ minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50, virtual: { precio: 30 } })
    expect(tarifaDeAdmin({ ...ADMIN, virtual: { precio: 30, activo: false } }).virtual).toBeNull()
    expect(tarifaDeAdmin({ ...ADMIN, virtual: null }).virtual).toBeNull()
    expect(tarifaDeAdmin({ ...ADMIN, minIntegrantes: 8 }).minIntegrantes).toBe(8)
  })

  it('el formulario parte de la tarifa vigente y, sin tipo virtual, propone S/ 30 apagado', () => {
    expect(formularioDeTarifa(ADMIN)).toEqual({ minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50, precioVirtual: 30, virtualActivo: true, aplicarAExistentes: false })
    expect(formularioDeTarifa({ ...ADMIN, virtual: null })).toMatchObject({ precioVirtual: 30, virtualActivo: false })
  })

  it('una tarifa vigente no tiene errores', () => {
    expect(validarTarifa(formularioDeTarifa(ADMIN))).toEqual({})
  })

  it.each([
    ['mínimo en cero', { minIntegrantes: 0 }, 'minIntegrantes'],
    ['mínimo decimal', { minIntegrantes: 2.5 }, 'minIntegrantes'],
    ['mínimo vacío', { minIntegrantes: '' as const }, 'minIntegrantes'],
    ['mínimo sobre el máximo', { minIntegrantes: 1001 }, 'minIntegrantes'],
    ['estándar negativo', { precioEstandar: -1 }, 'precioEstandar'],
    ['estándar vacío', { precioEstandar: '' as const }, 'precioEstandar'],
    ['tres decimales', { precioEstandar: 60.123 }, 'precioEstandar'],
    ['promocional mayor que el estándar', { precioPromocional: 61 }, 'precioPromocional'],
    ['virtual vacío con la modalidad encendida', { precioVirtual: '' as const }, 'precioVirtual'],
  ])('rechaza %s', (_nombre, cambio, campo) => {
    expect(Object.keys(validarTarifa({ ...formularioDeTarifa(ADMIN), ...cambio }))).toContain(campo)
  })

  it('con la virtual apagada su precio no se valida', () => {
    expect(validarTarifa({ ...formularioDeTarifa(ADMIN), virtualActivo: false, precioVirtual: '' })).toEqual({})
  })

  it('acepta un promocional igual al estándar y precio en cero', () => {
    expect(validarTarifa({ ...formularioDeTarifa(ADMIN), precioPromocional: 60 })).toEqual({})
    expect(validarTarifa({ ...formularioDeTarifa(ADMIN), precioEstandar: 0, precioPromocional: 0 })).toEqual({})
  })

  it('el cuerpo lleva solo lo que cambió y es null si no cambió nada', () => {
    expect(cuerpoTarifa(formularioDeTarifa(ADMIN), ADMIN)).toBeNull()
    expect(cuerpoTarifa({ ...formularioDeTarifa(ADMIN), precioEstandar: 70, minIntegrantes: 8 }, ADMIN)).toEqual({ precioEstandar: 70, minIntegrantes: 8 })
    expect(cuerpoTarifa({ ...formularioDeTarifa(ADMIN), precioVirtual: 35, virtualActivo: false }, ADMIN)).toEqual({ precioVirtual: 35, virtualActivo: false })
  })

  it('aplicar a las existentes se envía aunque no cambie ningún precio', () => {
    expect(cuerpoTarifa({ ...formularioDeTarifa(ADMIN), aplicarAExistentes: true }, ADMIN)).toEqual({ aplicarAExistentes: true })
  })

  it('sin tipo virtual, el precio virtual no se envía (crearía el tipo) salvo que se encienda la modalidad', () => {
    const sinVirtual = { ...ADMIN, virtual: null }
    expect(cuerpoTarifa({ ...formularioDeTarifa(sinVirtual), precioEstandar: 70 }, sinVirtual)).toEqual({ precioEstandar: 70 })
    expect(cuerpoTarifa({ ...formularioDeTarifa(sinVirtual), virtualActivo: true, precioVirtual: 35 }, sinVirtual)).toEqual({ virtualActivo: true, precioVirtual: 35 })
  })

  it('un campo vacío no se envía como cero', () => {
    expect(cuerpoTarifa({ ...formularioDeTarifa(ADMIN), precioVirtual: '', virtualActivo: false }, ADMIN)).toEqual({ virtualActivo: false })
  })

  it('el aviso de guardado distingue si se aplicó a las existentes', () => {
    expect(textoTarifaGuardada(0, false)).toContain('delegaciones nuevas')
    expect(textoTarifaGuardada(0, true)).toContain('Ninguna')
    expect(textoTarifaGuardada(2, true)).toContain('2 delegación(es)')
  })
})

describe('tarifa de una delegación (spec 015)', () => {
  const EVENTO: TarifaDelegaciones = { minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50, virtual: { precio: 30 } }
  const PRESENCIAL = { modalidad: 'PRESENCIAL' as const, minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50 }
  const VIRTUAL = { modalidad: 'VIRTUAL' as const, minIntegrantes: 10, precioEstandar: 30, precioPromocional: 30 }

  it('la tarifa del evento por modalidad: la virtual es plana y, sin tipo, usa S/ 30', () => {
    expect(tarifaParaModalidad('PRESENCIAL', EVENTO)).toEqual({ minIntegrantes: 10, precioEstandar: 60, precioPromocional: 50 })
    expect(tarifaParaModalidad('VIRTUAL', EVENTO)).toEqual({ minIntegrantes: 10, precioEstandar: 30, precioPromocional: 30 })
    expect(tarifaParaModalidad('VIRTUAL', { ...EVENTO, virtual: null }).precioEstandar).toBe(30)
  })

  it('sin cambios no hay cuerpo', () => {
    expect(cuerpoTarifaDelegacion(formularioDeTarifaDelegacion(PRESENCIAL), PRESENCIAL)).toBeNull()
    expect(cuerpoTarifaDelegacion(formularioDeTarifaDelegacion(VIRTUAL), VIRTUAL)).toBeNull()
  })

  it('un convenio presencial envía solo las cifras que cambió', () => {
    const form = { ...formularioDeTarifaDelegacion(PRESENCIAL), precioEstandar: 55, precioPromocional: 45 }
    expect(cuerpoTarifaDelegacion(form, PRESENCIAL)).toEqual({ precioEstandar: 55, precioPromocional: 45 })
    expect(cuerpoTarifaDelegacion({ ...formularioDeTarifaDelegacion(PRESENCIAL), minIntegrantes: 5 }, PRESENCIAL)).toEqual({ minIntegrantes: 5 })
  })

  it('en virtual el promocional siempre acompaña al estándar (sin escalas)', () => {
    const form = { ...formularioDeTarifaDelegacion(VIRTUAL), precioEstandar: 25 }
    expect(cuerpoTarifaDelegacion(form, VIRTUAL)).toEqual({ precioEstandar: 25, precioPromocional: 25 })
  })

  it('cambiar la modalidad envía la modalidad y las tres cifras', () => {
    const form = { modalidad: 'VIRTUAL' as const, ...tarifaParaModalidad('VIRTUAL', EVENTO) }
    expect(cuerpoTarifaDelegacion(form, PRESENCIAL)).toEqual({ modalidad: 'VIRTUAL', minIntegrantes: 10, precioEstandar: 30, precioPromocional: 30 })
  })

  it('valida el mínimo y los precios; en virtual ignora el promocional', () => {
    expect(validarTarifaDelegacion(formularioDeTarifaDelegacion(PRESENCIAL))).toEqual({})
    expect(Object.keys(validarTarifaDelegacion({ ...formularioDeTarifaDelegacion(PRESENCIAL), precioPromocional: 70 }))).toEqual(['precioPromocional'])
    expect(Object.keys(validarTarifaDelegacion({ ...formularioDeTarifaDelegacion(PRESENCIAL), minIntegrantes: 0, precioEstandar: -5 })).sort()).toEqual(['minIntegrantes', 'precioEstandar'])
    expect(validarTarifaDelegacion({ ...formularioDeTarifaDelegacion(VIRTUAL), precioPromocional: '' })).toEqual({})
    expect(Object.keys(validarTarifaDelegacion({ ...formularioDeTarifaDelegacion(VIRTUAL), precioEstandar: '' }))).toEqual(['precioEstandar'])
  })

  it('marca como convenio la delegación que cobra distinto del evento', () => {
    expect(esTarifaDeConvenio(PRESENCIAL, EVENTO)).toBe(false)
    expect(esTarifaDeConvenio({ ...PRESENCIAL, precioPromocional: 45 }, EVENTO)).toBe(true)
    expect(esTarifaDeConvenio({ ...PRESENCIAL, minIntegrantes: 8 }, EVENTO)).toBe(true)
    expect(esTarifaDeConvenio(VIRTUAL, EVENTO)).toBe(false)
    // En virtual el mínimo no se usa: no cuenta como convenio
    expect(esTarifaDeConvenio({ ...VIRTUAL, minIntegrantes: 3 }, EVENTO)).toBe(false)
    expect(esTarifaDeConvenio({ ...VIRTUAL, precioEstandar: 25, precioPromocional: 25 }, EVENTO)).toBe(true)
  })
})

describe('origen de la landing', () => {
  it('en producción el link apunta a la landing, no al panel', () => {
    expect(origenLanding()).toBe('https://ciisic-viii.episundc.pe')
    expect(enlaceInscripcionDelegacion('abc123')).toBe('https://ciisic-viii.episundc.pe/delegaciones?delegacion=abc123')
  })

  it('en desarrollo (panel en el puerto 3001) apunta a la landing local', () => {
    const original = globalThis.window
    globalThis.window = { location: { protocol: 'http:', hostname: 'localhost', port: '3001', origin: 'http://localhost:3001' } } as unknown as Window & typeof globalThis
    try {
      expect(origenLanding()).toBe('http://localhost:3000')
    } finally {
      globalThis.window = original
    }
  })
})
