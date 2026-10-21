import { describe, expect, it } from 'vitest'
import {
  enlaceInscripcionDelegacion,
  estimarGrupo,
  filaEnBlanco,
  filaVacia,
  filasParaEnviar,
  formularioPagos,
  hoyLima,
  montoDelegacion,
  normalizarDni,
  pagoVacio,
  parsearParticipantesDelegacion,
  precioUnitarioDelegacion,
  tarifaDeTipos,
  textoSaldo,
  validarPago,
  type PagoFormulario,
  type TarifaDelegaciones,
} from '~/utils/delegaciones'

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
