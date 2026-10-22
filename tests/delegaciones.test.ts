import { describe, expect, it } from 'vitest'
import {
  cambiosDePlanes,
  cantidadesPorPlan,
  correoFueraDeDominio,
  enlaceInscripcionDelegacion,
  enlaceInscripcionIndividual,
  errorDeDominio,
  errorDeMinimo,
  estimarGrupo,
  filaEnBlanco,
  filaVacia,
  filasParaEnviar,
  formularioDePlanes,
  formularioPagos,
  hoyLima,
  montoDelegacion,
  normalizarDni,
  normalizarDominio,
  origenLanding,
  pagoVacio,
  parsearParticipantesDelegacion,
  planesActivos,
  planesParaAlta,
  planesVacios,
  planPorDefecto,
  precioUnitarioPlan,
  resumenPlanes,
  textoSaldo,
  validarPago,
  validarPlanes,
  type PagoFormulario,
} from '~/utils/delegaciones'
import type { PlanDelegacion } from '~/types/api'

// ─── Planes (backend spec 029) ───

const plan = (codigo: PlanDelegacion['codigo'], precio: number | null, extra: Partial<PlanDelegacion> = {}): PlanDelegacion => ({
  codigo, tipoInscripcionId: 1, etiqueta: codigo, modalidad: codigo === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL', activo: true,
  precio, precioPromocional: null, precioUnitario: precio, integrantes: 0, ...extra,
})
const CON_KIT = plan('CON_KIT', 80)
const SIN_KIT = plan('SIN_KIT', 60, { precioPromocional: 50 })
const VIRTUAL = plan('VIRTUAL', 30)

describe('precio por persona de un plan', () => {
  it.each([[0, 60], [9, 60], [10, 50], [25, 50]])('con %i integrantes un plan con promocional cobra %i', (total, esperado) => {
    expect(precioUnitarioPlan(60, 50, 10, total)).toBe(esperado)
  })

  it('sin promocional, o con uno que no rebaja, cobra siempre el precio', () => {
    expect(precioUnitarioPlan(80, null, 10, 40)).toBe(80)
    expect(precioUnitarioPlan(60, 60, 10, 40)).toBe(60)
  })

  it('calcula el total con el precio por persona', () => {
    expect(montoDelegacion(60, 9)).toBe(540)
    expect(montoDelegacion(50, 13)).toBe(650)
  })
})

describe('planes de una delegación', () => {
  it('lista solo los activos y precarga el único activo; con varios hay que elegir', () => {
    const apagado = plan('VIRTUAL', 30, { activo: false })
    expect(planesActivos([CON_KIT, SIN_KIT, apagado]).map((p) => p.codigo)).toEqual(['CON_KIT', 'SIN_KIT'])
    expect(planPorDefecto([CON_KIT, SIN_KIT, apagado])).toBe('')
    expect(planPorDefecto([{ ...CON_KIT, activo: false }, SIN_KIT, apagado])).toBe('SIN_KIT')
    expect(planPorDefecto([])).toBe('')
  })

  it('resume lo que se ofrece; sin «pagos.ver» solo los nombres', () => {
    expect(resumenPlanes([CON_KIT, SIN_KIT, { ...VIRTUAL, activo: false }])).toBe('Con kit S/ 80.00 · Sin kit S/ 60.00')
    expect(resumenPlanes([plan('CON_KIT', null)])).toBe('Con kit')
  })

  it('estima un grupo mixto: cada plan con su precio y el promocional solo donde lo tiene', () => {
    const planes = [CON_KIT, SIN_KIT, VIRTUAL]
    const bajo = estimarGrupo(planes, { CON_KIT: 2, SIN_KIT: 3, VIRTUAL: 1 }, 10)
    expect(bajo).toMatchObject({ integrantes: 6, total: 2 * 80 + 3 * 60 + 30, faltan: 4 })
    const alto = estimarGrupo(planes, { CON_KIT: 2, SIN_KIT: 8, VIRTUAL: 0 }, 10)
    expect(alto).toMatchObject({ integrantes: 10, total: 2 * 80 + 8 * 50, faltan: null })
    expect(alto?.unitarios).toEqual({ CON_KIT: 80, SIN_KIT: 50, VIRTUAL: 30 })
  })

  it('sin escala no avisa cuántos faltan y sin precios no estima', () => {
    expect(estimarGrupo([CON_KIT, VIRTUAL], { CON_KIT: 1 }, 10)?.faltan).toBeNull()
    expect(estimarGrupo([plan('CON_KIT', null)], { CON_KIT: 1 }, 10)).toBeNull()
  })

  it('cuenta los integrantes por plan; sin plan elegido toman el único activo y las filas en blanco no cuentan', () => {
    const filas = [
      { ...filaVacia('CON_KIT'), numeroDocumento: '70123456' },
      { ...filaVacia(), numeroDocumento: '70123457' },
      filaVacia('SIN_KIT'),
    ]
    expect(cantidadesPorPlan(filas, 'SIN_KIT')).toEqual({ CON_KIT: 1, SIN_KIT: 1 })
    expect(cantidadesPorPlan(filas, '')).toEqual({ CON_KIT: 1 })
  })
})

describe('formulario de planes', () => {
  it('una delegación nueva parte con los tres planes apagados y sin precio', () => {
    expect(planesVacios()).toEqual({
      CON_KIT: { activo: false, precio: '', precioPromocional: '' },
      SIN_KIT: { activo: false, precio: '', precioPromocional: '' },
      VIRTUAL: { activo: false, precio: '', precioPromocional: '' },
    })
    expect(validarPlanes(planesVacios())).toEqual({})
    expect(planesParaAlta(planesVacios())).toBeNull()
  })

  it('el formulario de una delegación ya creada sale de sus planes (sin «pagos.ver» los precios quedan vacíos)', () => {
    expect(formularioDePlanes([CON_KIT, SIN_KIT]).SIN_KIT).toEqual({ activo: true, precio: 60, precioPromocional: 50 })
    expect(formularioDePlanes([plan('CON_KIT', null)]).CON_KIT).toEqual({ activo: true, precio: '', precioPromocional: '' })
  })

  it('un plan activo necesita un precio mayor que cero', () => {
    const form = planesVacios()
    form.CON_KIT.activo = true
    expect(validarPlanes(form)['CON_KIT.precio']).toContain('Un plan activo')
    form.CON_KIT.precio = 0
    expect(validarPlanes(form)['CON_KIT.precio']).toContain('mayor que cero')
    form.CON_KIT.precio = 80
    expect(validarPlanes(form)).toEqual({})
  })

  it('valida precios con hasta dos decimales y un promocional que no supere al precio', () => {
    const form = planesVacios()
    form.SIN_KIT = { activo: true, precio: 60.123, precioPromocional: '' }
    expect(validarPlanes(form)['SIN_KIT.precio']).toContain('dos decimales')
    form.SIN_KIT = { activo: true, precio: 60, precioPromocional: 70 }
    expect(validarPlanes(form)['SIN_KIT.precioPromocional']).toContain('no puede ser mayor')
    form.SIN_KIT = { activo: true, precio: 60, precioPromocional: -1 }
    expect(validarPlanes(form)['SIN_KIT.precioPromocional']).toBeDefined()
    form.SIN_KIT = { activo: true, precio: 60, precioPromocional: 50 }
    expect(validarPlanes(form)).toEqual({})
  })

  it('el alta envía de cada plan con datos lo que escribió el staff', () => {
    const form = planesVacios()
    form.CON_KIT = { activo: true, precio: 80, precioPromocional: '' }
    form.SIN_KIT = { activo: true, precio: 60, precioPromocional: 50 }
    form.VIRTUAL = { activo: false, precio: 30, precioPromocional: '' }
    expect(planesParaAlta(form)).toEqual({
      CON_KIT: { activo: true, precio: 80 },
      SIN_KIT: { activo: true, precio: 60, precioPromocional: 50 },
      VIRTUAL: { activo: false, precio: 30 },
    })
  })

  it('la edición envía solo lo que cambió y es null si no cambió nada', () => {
    const actuales = [CON_KIT, SIN_KIT, VIRTUAL]
    expect(cambiosDePlanes(formularioDePlanes(actuales), actuales)).toBeNull()
    const form = formularioDePlanes(actuales)
    form.CON_KIT.precio = 90
    form.VIRTUAL.activo = false
    form.SIN_KIT.precioPromocional = ''
    expect(cambiosDePlanes(form, actuales)).toEqual({ CON_KIT: { precio: 90 }, VIRTUAL: { activo: false }, SIN_KIT: { precioPromocional: null } })
  })

  it('un campo vacío no se envía como cero', () => {
    const actuales = [CON_KIT]
    const form = formularioDePlanes(actuales)
    form.CON_KIT.precio = ''
    expect(cambiosDePlanes(form, actuales)).toBeNull()
  })

  it('valida el mínimo de integrantes', () => {
    expect(errorDeMinimo(10)).toBeNull()
    for (const malo of [0, 1.5, '', 1001] as const) expect(errorDeMinimo(malo)).not.toBeNull()
  })
})

describe('correo con dominio', () => {
  it('normaliza el dominio como lo guarda el backend', () => {
    expect(normalizarDominio('  @UNAC.edu.pe ')).toBe('unac.edu.pe')
    expect(normalizarDominio('')).toBe('')
  })

  it('valida el dominio; vacío no filtra', () => {
    expect(errorDeDominio('')).toBeNull()
    expect(errorDeDominio('@unac.edu.pe')).toBeNull()
    expect(errorDeDominio('unac')).not.toBeNull()
    expect(errorDeDominio('no es un dominio')).not.toBeNull()
  })

  it('avisa al staff cuando un correo queda fuera del dominio', () => {
    expect(correoFueraDeDominio('ana@unac.edu.pe', 'unac.edu.pe')).toBe(false)
    expect(correoFueraDeDominio('Ana@UNAC.edu.pe', 'unac.edu.pe')).toBe(false)
    expect(correoFueraDeDominio('ana@gmail.com', 'unac.edu.pe')).toBe(true)
    expect(correoFueraDeDominio('ana@gmail.com', null)).toBe(false)
    expect(correoFueraDeDominio('', 'unac.edu.pe')).toBe(false)
  })
})

// ─── Carga masiva ───

describe('carga masiva', () => {
  it('lee cinco columnas y normaliza el correo (el plan lo elige quien pega la lista)', () => {
    const resultado = parsearParticipantesDelegacion('70123456, Ana, Pérez, Ana@Example.com, 987654321')
    expect(resultado.errores).toEqual([])
    expect(resultado.filas).toEqual([{
      tipoDocumento: 'dni', numeroDocumento: '70123456', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com', celular: '987654321', plan: '',
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
    expect(parsearParticipantesDelegacion('CE1234567, Ana, Pérez, ana@example.com').filas[0]?.tipoDocumento).toBe('ce')
  })
})

describe('links públicos', () => {
  it('el del delegado lleva el código al formulario de la landing', () => {
    expect(enlaceInscripcionDelegacion('abc123', 'https://ciisic.example/')).toBe('https://ciisic.example/delegaciones?delegacion=abc123')
  })

  it('escapa el código en la URL', () => {
    expect(enlaceInscripcionDelegacion('a b&c', 'https://ciisic.example')).toBe('https://ciisic.example/delegaciones?delegacion=a%20b%26c')
  })

  it('el individual usa el parámetro «unirme»', () => {
    expect(enlaceInscripcionIndividual('a1b2c3d4e5f60718', 'https://ciisic-viii.episundc.pe')).toBe('https://ciisic-viii.episundc.pe/delegaciones?unirme=a1b2c3d4e5f60718')
    expect(enlaceInscripcionIndividual('x y', 'http://localhost:3000/')).toBe('http://localhost:3000/delegaciones?unirme=x%20y')
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

  it('ignora las filas en blanco (aunque traigan el plan precargado) y limpia las demás', () => {
    const vacia = filaVacia('CON_KIT')
    const con = { ...filaVacia('SIN_KIT'), numeroDocumento: ' 7969419 ', nombres: ' Ana ', apellidos: ' Pérez', correo: ' ANA@Example.com ', celular: ' 987654321 ' }
    expect(filaEnBlanco(vacia)).toBe(true)
    expect(filasParaEnviar([vacia, con])).toEqual([{
      tipoDocumento: 'dni', numeroDocumento: '07969419', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com', celular: '987654321', plan: 'SIN_KIT',
    }])
  })

  it('una fila sin plan no envía la clave (el servidor asume el único plan activo)', () => {
    const fila = { ...filaVacia(), numeroDocumento: '70123456', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com' }
    expect(filasParaEnviar([fila])[0]).not.toHaveProperty('plan')
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

describe('origen de la landing', () => {
  it('en producción el link apunta a la landing, no al panel', () => {
    expect(origenLanding()).toBe('https://ciisic-viii.episundc.pe')
    expect(enlaceInscripcionDelegacion('abc123')).toBe('https://ciisic-viii.episundc.pe/delegaciones?delegacion=abc123')
    expect(enlaceInscripcionIndividual('abc123')).toBe('https://ciisic-viii.episundc.pe/delegaciones?unirme=abc123')
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
