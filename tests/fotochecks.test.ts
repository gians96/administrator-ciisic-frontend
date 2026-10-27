import { describe, expect, it } from 'vitest'
import { encode } from 'uqr'
import {
  ASISTENTE_EJEMPLO,
  CLAVE_CONFIG_FOTOCHECKS,
  FILTROS_FOTOCHECKS_INICIALES,
  ROL_ASISTENTES,
  ROL_DELEGACIONES,
  calcularRejilla,
  cantidadDeHojas,
  claveImpresosFotochecks,
  colorTextoSobre,
  compararOrientaciones,
  configPorDefectoFotocheck,
  crearAsistenteManual,
  esImpresoFotocheck,
  esTipoDeDelegacion,
  etiquetaHoja,
  filtrarAsistentes,
  formatoCm,
  guardarConfigFotocheck,
  guardarImpresosFotocheck,
  leerConfigFotocheck,
  leerImpresosFotocheck,
  leerInscritosCsv,
  medidasHoja,
  modulosQr,
  nombreParaFotocheck,
  normalizarConfigFotocheck,
  olvidarQrs,
  ordenarAsistentes,
  paginarFotochecks,
  resumenRejilla,
  rolDeFotocheck,
  rutaDeModulos,
  rutaExportacionInscritos,
  tamanoNombreFotocheck,
  tiposDeAsistentes,
  type AsistenteFotocheck,
} from '~/utils/fotochecks'

const A4 = { ancho: 21, alto: 29.7 }
const TARJETA = { ancho: 6.7, alto: 10 }

describe('fotochecks: cuántos caben en la hoja', () => {
  it('A4 con el fotocheck de 6.7 × 10 cm (margen 0.4, separación 0.2): 8 en horizontal y 4 en vertical', () => {
    const { horizontal, vertical } = compararOrientaciones(A4, TARJETA, 0.4, 0.2)
    expect([horizontal.columnas, horizontal.filas, horizontal.porHoja]).toEqual([4, 2, 8])
    expect([vertical.columnas, vertical.filas, vertical.porHoja]).toEqual([2, 2, 4])
    expect(horizontal.hojaAncho).toBe(29.7)
    expect(horizontal.hojaAlto).toBe(21)
  })

  it('automática elige la orientación con más fotochecks; el empate va en vertical', () => {
    expect(calcularRejilla(A4, TARJETA, 0.4, 0.2, 'AUTO').orientacion).toBe('HORIZONTAL')
    expect(calcularRejilla(A4, TARJETA, 0.4, 0.2, 'VERTICAL').porHoja).toBe(4)
    expect(calcularRejilla(A4, TARJETA, 0.4, 0.2, 'HORIZONTAL').porHoja).toBe(8)
    expect(calcularRejilla(A4, { ancho: 30, alto: 40 }, 0, 0, 'AUTO').orientacion).toBe('VERTICAL')
    // Cuadrado sobre una hoja cuadrada: mismo número en las dos
    expect(calcularRejilla({ ancho: 20, alto: 20 }, { ancho: 10, alto: 10 }, 0, 0, 'AUTO').orientacion).toBe('VERTICAL')
  })

  it('en vertical caben 6 (3 × 2) solo con margen y separación casi nulos', () => {
    const casiNulos = calcularRejilla(A4, TARJETA, 0.4, 0.05, 'VERTICAL')
    expect([casiNulos.columnas, casiNulos.filas, casiNulos.porHoja]).toEqual([3, 2, 6])
    expect(calcularRejilla(A4, TARJETA, 0.4, 0.2, 'VERTICAL').porHoja).toBe(4)
    // Una tercera fila pide 10 cm y solo sobran 9.7
    expect(calcularRejilla(A4, TARJETA, 0, 0, 'VERTICAL').filas).toBe(2)
  })

  it('A3 vertical: 16 (4 × 4)', () => {
    const a3 = { ancho: 29.7, alto: 42 }
    const rejilla = calcularRejilla(a3, TARJETA, 0.4, 0.2, 'AUTO')
    expect([rejilla.orientacion, rejilla.columnas, rejilla.filas, rejilla.porHoja]).toEqual(['VERTICAL', 4, 4, 16])
  })

  it('el ajuste exacto cuenta (sin errores de coma flotante) y lo que no cabe da 0', () => {
    expect(calcularRejilla({ ancho: 20, alto: 10 }, { ancho: 10, alto: 10 }, 0, 0, 'VERTICAL').porHoja).toBe(2)
    expect(calcularRejilla({ ancho: 10, alto: 20 }, { ancho: 10, alto: 10 }, 0, 0, 'VERTICAL').porHoja).toBe(2)
    // 20.4 / 10.2 no es exactamente 2 en coma flotante: igual caben dos filas
    expect(calcularRejilla({ ancho: 29.7, alto: 21 }, TARJETA, 0.4, 0.2, 'VERTICAL').filas).toBe(2)
    expect(calcularRejilla(A4, { ancho: 30, alto: 40 }, 0.4, 0.2, 'AUTO').porHoja).toBe(0)
    expect(calcularRejilla(A4, { ancho: 0, alto: 10 }, 0, 0, 'AUTO').porHoja).toBe(0)
  })

  it('el bloque queda centrado en la hoja', () => {
    const { origenX, origenY } = calcularRejilla(A4, TARJETA, 0.4, 0.2, 'HORIZONTAL')
    // 4 × 6.7 + 3 × 0.2 = 27.4 de 29.7 · 2 × 10 + 0.2 = 20.2 de 21
    expect(origenX).toBeCloseTo(1.15, 6)
    expect(origenY).toBeCloseTo(0.4, 6)
  })

  it('medidas de la hoja siempre en vertical, también la personalizada', () => {
    expect(medidasHoja({ hoja: 'A4', hojaAncho: 1, hojaAlto: 1 })).toEqual({ ancho: 21, alto: 29.7 })
    expect(medidasHoja({ hoja: 'PERSONALIZADA', hojaAncho: 40, hojaAlto: 30 })).toEqual({ ancho: 30, alto: 40 })
  })

  it('hojas necesarias, reparto y textos de resumen', () => {
    expect(cantidadDeHojas(70, 8)).toBe(9)
    expect(cantidadDeHojas(8, 8)).toBe(1)
    expect(cantidadDeHojas(0, 8)).toBe(0)
    expect(cantidadDeHojas(5, 0)).toBe(0)
    expect(paginarFotochecks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(paginarFotochecks([1, 2], 0)).toEqual([])
    const rejilla = calcularRejilla(A4, TARJETA, 0.4, 0.2, 'AUTO')
    expect(resumenRejilla(rejilla, 70)).toBe('8 por hoja · 4 × 2 · 9 hojas para 70')
    expect(resumenRejilla(rejilla, 1)).toBe('8 por hoja · 4 × 2 · 1 hoja para 1')
    expect(resumenRejilla(rejilla, 0)).toBe('8 por hoja · 4 × 2')
    expect(resumenRejilla({ porHoja: 0, columnas: 0, filas: 0 }, 5)).toContain('no cabe')
    expect(etiquetaHoja({ hoja: 'A4' }, rejilla)).toBe('A4 horizontal · 29.7 × 21 cm')
    expect(etiquetaHoja({ hoja: 'PERSONALIZADA' }, { orientacion: 'VERTICAL', hojaAncho: 15.5, hojaAlto: 22 })).toBe('Personalizada vertical · 15.5 × 22 cm')
    expect(formatoCm(10)).toBe('10')
    expect(formatoCm(6.7)).toBe('6.7')
    expect(formatoCm(0.1 + 0.2)).toBe('0.3')
  })
})

describe('fotochecks: configuración', () => {
  it('los valores por defecto son los del congreso', () => {
    const config = configPorDefectoFotocheck()
    expect(config).toMatchObject({ tema: 'OSCURO', acento: '#00d9e8', ancho: 6.7, alto: 10, hoja: 'A4', orientacion: 'AUTO', margen: 0.4, separacion: 0.2 })
    expect(normalizarConfigFotocheck(undefined)).toEqual(config)
    expect(normalizarConfigFotocheck(config)).toEqual(config)
    expect(configPorDefectoFotocheck()).not.toBe(config)
  })

  it('recorta rangos, descarta lo inválido y acepta números escritos como texto', () => {
    const config = normalizarConfigFotocheck({ ancho: 0, alto: 99, margen: -1, separacion: 'x', hojaAncho: 5, hojaAlto: '35,5', acento: 'rojo', tema: 'CLARO', orientacion: 'DIAGONAL', hoja: 'A0', orden: 'INSCRIPCION' })
    expect(config).toMatchObject({ ancho: 3, alto: 30, margen: 0, separacion: 0.2, hojaAncho: 10, hojaAlto: 29.7, acento: '#00d9e8', tema: 'CLARO', orientacion: 'AUTO', hoja: 'A4', orden: 'INSCRIPCION' })
    expect(normalizarConfigFotocheck({ ancho: '6.75', acento: '#AABBCC' })).toMatchObject({ ancho: 6.75, acento: '#aabbcc' })
    expect(normalizarConfigFotocheck({ ancho: 6.7349 }).ancho).toBe(6.73)
  })

  it('el sangrado nunca pasa de la mitad de la separación', () => {
    expect(normalizarConfigFotocheck({ separacion: 0.2, sangrado: 0.5 }).sangrado).toBe(0.1)
    expect(normalizarConfigFotocheck({ separacion: 0, sangrado: 0.3 }).sangrado).toBe(0)
    expect(normalizarConfigFotocheck({ separacion: 1, sangrado: 0.3 }).sangrado).toBe(0.3)
  })

  it('casillas y textos: lo ausente toma el valor por defecto y el texto se limpia y se acota', () => {
    const config = normalizarConfigFotocheck({ mostrar: { tipo: true, logoFi: false, codigo: 'sí' }, textos: { eventoCorto: '  VIII   CIISIC ', eventoNombre: 'x'.repeat(300) }, mayusculas: false })
    expect(config.mostrar).toEqual({ logoCongreso: true, logoFi: false, nombreCongreso: true, marcaDeAgua: true, tipo: true, codigo: true })
    expect(config.textos.eventoCorto).toBe('VIII CIISIC')
    expect(config.textos.eventoNombre).toHaveLength(120)
    expect(config.mayusculas).toBe(false)
    expect(normalizarConfigFotocheck('basura')).toEqual(configPorDefectoFotocheck())
    expect(normalizarConfigFotocheck([1, 2])).toEqual(configPorDefectoFotocheck())
  })

  it('color del texto sobre el acento', () => {
    expect(colorTextoSobre('#00d9e8')).toBe('#041d39')
    expect(colorTextoSobre('#ffffff')).toBe('#041d39')
    expect(colorTextoSobre('#7c3aed')).toBe('#ffffff')
    expect(colorTextoSobre('#041d39')).toBe('#ffffff')
    expect(colorTextoSobre('no-es-un-color')).toBe('#ffffff')
  })
})

describe('fotochecks: el nombre', () => {
  it('une nombres y apellidos, limpia espacios y pasa a mayúsculas con la Ñ y las tildes', () => {
    expect(nombreParaFotocheck({ nombres: ' José  Ñandú ', apellidos: 'Pérez' }, true)).toBe('JOSÉ ÑANDÚ PÉREZ')
    expect(nombreParaFotocheck({ nombres: 'José', apellidos: 'Pérez' }, false)).toBe('José Pérez')
    expect(nombreParaFotocheck({ nombres: 'Ana', apellidos: '' }, true)).toBe('ANA')
  })

  it('el tamaño baja por tramos con el largo y nunca crece', () => {
    // Como en la credencial web: «GIANMARCOS DANIEL / ARIAS BONIFACIO» en dos líneas al tamaño completo
    expect(tamanoNombreFotocheck('GIANMARCOS DANIEL ARIAS BONIFACIO')).toBe(10.5)
    expect(tamanoNombreFotocheck('ANA PÉREZ')).toBe(10.5)
    expect(tamanoNombreFotocheck('MARÍA DEL CARMEN FERNÁNDEZ DE LA CRUZ')).toBe(8.8)
    const tamanos = [5, 25, 35, 45, 60, 90].map((largo) => tamanoNombreFotocheck('A'.repeat(largo)))
    expect(tamanos).toEqual([...tamanos].sort((a, b) => b - a))
    expect(new Set(tamanos).size).toBe(4)
  })
})

// ─── CSV con el formato real del backend (inscription.ts: COLUMNAS_CSV, spec 040) ───

const CABECERA = 'ID;Fecha registro;Tipo doc.;N° documento;Nombres;Apellidos;Correo;Celular;Categoría;Tipo de inscripción;Etiqueta;Modalidad de asistencia;Clasificación;Monto;Descuento;Estudiante UNDC;Código estudiante;Correo verificado;Modalidad;Banco / billetera;N° operación;Fecha de pago;Estado;Revisado;Motivo de rechazo;Código QR;Credencial 3D'

function fila(c: { id?: string, nombres?: string, apellidos?: string, tipo?: string, modalidad?: string, clasificacion?: string, estado?: string, codigo?: string } = {}): string {
  return [
    c.id ?? '1', '2026-10-01', 'DNI', '12345678', c.nombres ?? 'Ana', c.apellidos ?? 'Pérez', 'ana@correo.pe', '987654321', 'Estudiantes',
    c.tipo ?? 'Estudiante UNDC', 'UNDC', c.modalidad ?? 'PRESENCIAL', c.clasificacion ?? '', '60.00', '0.00', 'Sí', '', 'No', 'banco', 'BCP', '123456',
    '2026-10-01', c.estado ?? 'Aprobado', '', '', c.codigo ?? 'ABCDE12345', 'https://landing.test/credencial/ABCDE12345',
  ].join(';')
}

const csv = (...filas: string[]) => String.fromCharCode(0xfeff) + [CABECERA, ...filas].join(String.fromCharCode(13, 10))

describe('fotochecks: lectura del CSV de inscripciones', () => {
  it('lee a los aprobados con código: BOM, `;`, saltos de línea de Windows y títulos con tildes', () => {
    const resultado = leerInscritosCsv(csv(fila({ id: '7', nombres: 'Ana María', apellidos: 'Pérez Ñaupa' }), fila({ id: '8', nombres: 'Luis', apellidos: 'Quispe', codigo: 'ZZZZZ99999', clasificacion: 'Egresado' })))
    expect(resultado.faltanColumnas).toEqual([])
    expect(resultado.asistentes).toEqual([
      { clave: 'inscripcion:7', id: 7, nombres: 'Ana María', apellidos: 'Pérez Ñaupa', codigo: 'ABCDE12345', tipo: 'Estudiante UNDC', rol: 'Asistentes', virtual: false },
      { clave: 'inscripcion:8', id: 8, nombres: 'Luis', apellidos: 'Quispe', codigo: 'ZZZZZ99999', tipo: 'Estudiante UNDC', rol: 'Asistentes', virtual: false },
    ])
  })

  it('solo conserva lo que se imprime: nada de documento, correo, celular ni pagos', () => {
    const [persona] = leerInscritosCsv(csv(fila())).asistentes
    expect(Object.keys(persona ?? {}).sort()).toEqual(['apellidos', 'clave', 'codigo', 'id', 'nombres', 'rol', 'tipo', 'virtual'])
    expect(JSON.stringify(persona)).not.toMatch(/12345678|ana@correo|987654321|60\.00/)
  })

  it('comillas: `;` y `""` dentro del nombre, y el `\'` que el backend antepone a `= + - @`', () => {
    const { asistentes } = leerInscritosCsv(csv(
      fila({ id: '1', nombres: '"Pérez; Jr."', apellidos: '"O""Neil"' }),
      fila({ id: '2', nombres: '\'-Ana', apellidos: 'Díaz', codigo: 'AAAAA11111' }),
    ))
    expect(asistentes[0]).toMatchObject({ nombres: 'Pérez; Jr.', apellidos: 'O"Neil' })
    expect(asistentes[1]?.nombres).toBe('-Ana')
  })

  it('un salto de línea dentro de comillas no parte la fila', () => {
    const { asistentes } = leerInscritosCsv(csv(fila({ nombres: '"Ana\nMaría"' }), fila({ id: '2', codigo: 'BBBBB22222' })))
    expect(asistentes).toHaveLength(2)
    expect(asistentes[0]?.nombres).toBe('Ana María')
  })

  it('omite sin código, no aprobados y repetidos, y cuenta lo omitido', () => {
    const resultado = leerInscritosCsv(csv(
      fila({ id: '1' }),
      fila({ id: '2', codigo: '' }),
      fila({ id: '3', codigo: 'CORTO' }),
      fila({ id: '4', estado: 'Pendiente', codigo: 'CCCCC33333' }),
      fila({ id: '5', estado: 'Rechazado', codigo: 'DDDDD44444' }),
      fila({ id: '6' }),
      fila({ id: '7', codigo: 'eeeee55555' }),
    ))
    expect(resultado.asistentes.map((persona) => persona.id)).toEqual([1, 7])
    expect(resultado.asistentes[1]?.codigo).toBe('EEEEE55555')
    expect(resultado.sinCodigo).toBe(2)
    expect(resultado.noAprobados).toBe(2)
  })

  it('marca a los virtuales', () => {
    const { asistentes } = leerInscritosCsv(csv(
      fila({ id: '1', modalidad: 'VIRTUAL', tipo: 'Virtual general', codigo: 'AAAAA11111' }),
      fila({ id: '2', tipo: '', codigo: 'BBBBB22222' }),
    ))
    expect(asistentes.map((persona) => persona.virtual)).toEqual([true, false])
  })

  it('la pastilla dice «Asistentes» para todo inscrito, sin importar su clasificación ni su tipo, y «Delegaciones» solo para los de una delegación', () => {
    const delegacion = 'DELEGACION UNAT · ESCUELA PROFESIONAL DE INGENIERÍA DE SISTEMAS'
    const { asistentes } = leerInscritosCsv(csv(
      fila({ id: '1', tipo: 'Estudiante UNDC', codigo: 'AAAAA11111' }),
      fila({ id: '2', tipo: 'Profesionales y público en general', clasificacion: 'Egresado', codigo: 'BBBBB22222' }),
      fila({ id: '3', tipo: '', clasificacion: '', codigo: 'CCCCC33333' }),
      fila({ id: '4', modalidad: 'VIRTUAL', tipo: 'Virtual general', codigo: 'DDDDD44444' }),
      fila({ id: '5', tipo: delegacion, clasificacion: 'Egresado', codigo: 'EEEEE55555' }),
    ))
    expect(asistentes.map((persona) => persona.rol)).toEqual([ROL_ASISTENTES, ROL_ASISTENTES, ROL_ASISTENTES, ROL_ASISTENTES, ROL_DELEGACIONES])
    // El tipo de inscripción sigue siendo el real: es el de la tabla y el del filtro
    expect(asistentes[4]?.tipo).toBe(delegacion)
  })

  it('sin la columna «Código QR» (backend sin la spec 040) explica qué falta', () => {
    const sinCodigo = CABECERA.replace(';Código QR;Credencial 3D', '')
    const cuerpo = fila().split(';').slice(0, -2).join(';')
    const resultado = leerInscritosCsv(`${sinCodigo}\r\n${cuerpo}`)
    expect(resultado.faltanColumnas).toEqual(['Código QR'])
    expect(resultado.asistentes).toEqual([])
    expect(leerInscritosCsv('').faltanColumnas).toEqual(['Nombres', 'Apellidos', 'Código QR'])
    expect(leerInscritosCsv('A;B\r\n1;2').faltanColumnas).toEqual(['Nombres', 'Apellidos', 'Código QR'])
  })

  it('ubica las columnas por su título, no por su posición, y acepta `,` y un CSV sin la columna Estado', () => {
    const { asistentes, noAprobados } = leerInscritosCsv('Código QR,Apellidos,Nombres\nABCDE12345,Pérez,Ana\nFGHIJ67890,"Quispe, H.",Luis')
    expect(noAprobados).toBe(0)
    expect(asistentes.map((persona) => [persona.nombres, persona.apellidos, persona.clave])).toEqual([
      ['Ana', 'Pérez', 'codigo:ABCDE12345'],
      ['Luis', 'Quispe, H.', 'codigo:FGHIJ67890'],
    ])
    expect(asistentes[0]?.id).toBeNull()
  })

  it('ruta de la exportación: solo aprobados del evento', () => {
    expect(rutaExportacionInscritos(2)).toBe('events/2/inscriptions/export?estado=APROBADO')
  })
})

describe('fotochecks: pastilla «Asistentes» o «Delegaciones»', () => {
  it('reconoce los tipos que el backend nombra «DELEGACION <nombre>», con o sin tilde y en cualquier caja', () => {
    expect(esTipoDeDelegacion('DELEGACION UNAC')).toBe(true)
    expect(esTipoDeDelegacion('  Delegación   UNH ')).toBe(true)
    expect(esTipoDeDelegacion('Delegaciones invitadas')).toBe(true)
    expect(esTipoDeDelegacion('DELEGACION')).toBe(true)
  })

  it('no confunde otros tipos con una delegación', () => {
    expect(esTipoDeDelegacion('Estudiante UNDC')).toBe(false)
    expect(esTipoDeDelegacion('Delegado de aula')).toBe(false)
    expect(esTipoDeDelegacion('Profesional · delegación')).toBe(false)
    expect(esTipoDeDelegacion('')).toBe(false)
  })

  it('«Delegaciones» solo para una delegación; para todo lo demás, «Asistentes»', () => {
    expect(rolDeFotocheck('DELEGACION UNAT · ESCUELA PROFESIONAL DE INGENIERÍA DE SISTEMAS')).toBe('Delegaciones')
    expect(rolDeFotocheck('Profesionales y público en general')).toBe('Asistentes')
    expect(rolDeFotocheck('')).toBe('Asistentes')
  })
})

describe('fotochecks: QR', () => {
  it('es de 21 × 21 módulos y la ruta reconstruye exactamente la matriz de uqr', () => {
    olvidarQrs()
    const { lado, ruta } = modulosQr('ABCDE12345')
    const { data } = encode('ABCDE12345', { ecc: 'M', border: 0 })
    expect(lado).toBe(21)
    const reconstruida = Array.from({ length: lado }, () => Array.from({ length: lado }, () => false))
    for (const [, x, y, largo] of ruta.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let i = 0; i < Number(largo); i++) reconstruida[Number(y)]![Number(x) + i] = true
    }
    expect(reconstruida).toEqual(data)
    expect(ruta).not.toContain('ABCDE12345')
  })

  it('funde los tramos seguidos de cada fila', () => {
    expect(rutaDeModulos([[true, true, false, true], [false, false, false, false], [true, false, false, true]])).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM0 2h1v1h-1zM3 2h1v1h-1z')
    expect(rutaDeModulos([])).toBe('')
  })

  it('la caché devuelve lo mismo hasta que se vacía', () => {
    olvidarQrs()
    const primero = modulosQr('AAAAA11111')
    expect(modulosQr('AAAAA11111')).toBe(primero)
    olvidarQrs()
    expect(modulosQr('AAAAA11111')).not.toBe(primero)
    expect(modulosQr('AAAAA11111')).toEqual(primero)
  })
})

describe('fotochecks: personas agregadas a mano', () => {
  it('con rol y sin código: sin QR', () => {
    expect(crearAsistenteManual({ nombre: '  Dr.  Juan  Pérez ', rol: 'Ponente' }, 3)).toEqual({
      ok: true,
      asistente: { clave: 'manual:3', id: null, nombres: 'Dr. Juan Pérez', apellidos: '', codigo: '', tipo: 'Ponente', rol: 'Ponente', virtual: false },
    })
  })

  it('con código opcional en mayúsculas; sin rol pero con código queda «Asistentes»', () => {
    const resultado = crearAsistenteManual({ nombre: 'Ana', rol: '', codigo: 'abcde12345' }, 1)
    expect(resultado).toMatchObject({ ok: true, asistente: { codigo: 'ABCDE12345', rol: 'Asistentes' } })
  })

  it('valida nombre, rol y código', () => {
    expect(crearAsistenteManual({ nombre: '', rol: 'Staff' }, 1)).toEqual({ ok: false, errores: { nombre: 'Escribe el nombre.' } })
    expect(crearAsistenteManual({ nombre: 'Ana', rol: '' }, 1)).toMatchObject({ ok: false, errores: { rol: expect.stringContaining('Escribe el rol') } })
    expect(crearAsistenteManual({ nombre: 'Ana', rol: 'Staff', codigo: 'corto' }, 1)).toMatchObject({ ok: false, errores: { codigo: expect.any(String) } })
    expect(crearAsistenteManual({ nombre: 'x'.repeat(81), rol: 'a'.repeat(31) }, 1)).toMatchObject({ ok: false, errores: { nombre: expect.any(String), rol: expect.any(String) } })
  })
})

function persona(parcial: Partial<AsistenteFotocheck>): AsistenteFotocheck {
  return { clave: 'inscripcion:1', id: 1, nombres: 'Ana', apellidos: 'Pérez', codigo: 'ABCDE12345', tipo: 'Estudiante', rol: 'Estudiante', virtual: false, ...parcial }
}

describe('fotochecks: lista, filtros y orden', () => {
  const lista = [
    persona({ id: 3, clave: 'inscripcion:3', nombres: 'Luis', apellidos: 'Álvarez', tipo: 'Profesional' }),
    persona({ id: 1, clave: 'inscripcion:1', nombres: 'Ana', apellidos: 'Zapata' }),
    persona({ id: 2, clave: 'inscripcion:2', nombres: 'Rosa', apellidos: 'Ñahui', virtual: true, tipo: 'Virtual' }),
    persona({ id: null, clave: 'manual:1', nombres: 'Dr. Juan', apellidos: '', tipo: 'Ponente', rol: 'Ponente' }),
  ]
  const filtros = (parcial: Partial<typeof FILTROS_FOTOCHECKS_INICIALES>) => ({ ...FILTROS_FOTOCHECKS_INICIALES, ...parcial })
  const nombres = (resultado: AsistenteFotocheck[]) => resultado.map((p) => p.nombres)

  it('oculta a los virtuales salvo que se pidan', () => {
    expect(nombres(filtrarAsistentes(lista, filtros({}), new Set()))).toEqual(['Luis', 'Ana', 'Dr. Juan'])
    expect(nombres(filtrarAsistentes(lista, filtros({ virtuales: true }), new Set()))).toEqual(['Luis', 'Ana', 'Rosa', 'Dr. Juan'])
  })

  it('busca por nombre, apellidos y tipo sin tildes ni mayúsculas, y por todas las palabras', () => {
    expect(nombres(filtrarAsistentes(lista, filtros({ busqueda: 'alvarez' }), new Set()))).toEqual(['Luis'])
    expect(nombres(filtrarAsistentes(lista, filtros({ busqueda: 'ÁNA zap' }), new Set()))).toEqual(['Ana'])
    expect(nombres(filtrarAsistentes(lista, filtros({ busqueda: 'ponente' }), new Set()))).toEqual(['Dr. Juan'])
    expect(filtrarAsistentes(lista, filtros({ busqueda: 'ABCDE12345' }), new Set())).toEqual([])
  })

  it('filtra por tipo y por «ya impreso»; las personas a mano nunca figuran como impresas', () => {
    const impresos = new Set([3])
    expect(nombres(filtrarAsistentes(lista, filtros({ tipo: 'Profesional' }), impresos))).toEqual(['Luis'])
    expect(nombres(filtrarAsistentes(lista, filtros({ impresion: 'IMPRESOS' }), impresos))).toEqual(['Luis'])
    expect(nombres(filtrarAsistentes(lista, filtros({ impresion: 'PENDIENTES' }), impresos))).toEqual(['Ana', 'Dr. Juan'])
    expect(esImpresoFotocheck(persona({ id: null }), new Set([1]))).toBe(false)
  })

  it('ordena por apellidos (con tildes y Ñ) o por orden de inscripción, sin tocar la original', () => {
    expect(ordenarAsistentes(lista, 'APELLIDOS').map((p) => p.apellidos)).toEqual(['', 'Álvarez', 'Ñahui', 'Zapata'])
    expect(ordenarAsistentes(lista, 'INSCRIPCION').map((p) => p.id)).toEqual([1, 2, 3, null])
    expect(lista[0]?.id).toBe(3)
  })

  it('tipos distintos para el filtro', () => {
    expect(tiposDeAsistentes(lista)).toEqual(['Estudiante', 'Ponente', 'Profesional', 'Virtual'])
  })

  it('el asistente de ejemplo es ficticio', () => {
    expect(ASISTENTE_EJEMPLO.codigo).toBe('ABCDE12345')
    expect(ASISTENTE_EJEMPLO.rol).toBe('Asistentes')
    expect(Object.isFrozen(ASISTENTE_EJEMPLO)).toBe(true)
  })
})

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => { datos.set(clave, valor) },
    removeItem: (clave: string) => { datos.delete(clave) },
  }
}

describe('fotochecks: lo que se guarda en el navegador', () => {
  it('el diseño se guarda y se lee normalizado; uno dañado o ausente da null', () => {
    const almacen = almacenFalso()
    expect(leerConfigFotocheck(almacen)).toBeNull()
    const config = { ...configPorDefectoFotocheck(), tema: 'CLARO' as const, acento: '#ff0066' }
    guardarConfigFotocheck(almacen, config)
    expect(leerConfigFotocheck(almacen)).toEqual(config)
    almacen.datos.set(CLAVE_CONFIG_FOTOCHECKS, '{no es json')
    expect(leerConfigFotocheck(almacen)).toBeNull()
    almacen.datos.set(CLAVE_CONFIG_FOTOCHECKS, JSON.stringify({ ancho: 999, tema: 'otro' }))
    expect(leerConfigFotocheck(almacen)).toMatchObject({ ancho: 30, tema: 'OSCURO' })
    expect(leerConfigFotocheck(null)).toBeNull()
  })

  it('los impresos son solo ids de inscripción, por evento y sin repetirse ni mezclarse con otros eventos', () => {
    const almacen = almacenFalso()
    guardarImpresosFotocheck(almacen, 2, [5, 6, 6])
    guardarImpresosFotocheck(almacen, 3, [9])
    expect([...leerImpresosFotocheck(almacen, 2)].sort()).toEqual([5, 6])
    expect([...leerImpresosFotocheck(almacen, 3)]).toEqual([9])
    expect(almacen.datos.get(claveImpresosFotochecks(2))).toBe('[5,6]')
    expect(leerImpresosFotocheck(almacen, 99).size).toBe(0)
  })

  it('ignora lo inválido y tolera un almacenamiento ausente o que falla', () => {
    const almacen = almacenFalso({ [claveImpresosFotochecks(2)]: '[1,"x",-3,2.5,null,4]' })
    expect([...leerImpresosFotocheck(almacen, 2)]).toEqual([1, 4])
    almacen.datos.set(claveImpresosFotochecks(2), '{"a":1}')
    expect(leerImpresosFotocheck(almacen, 2).size).toBe(0)
    almacen.datos.set(claveImpresosFotochecks(2), 'no es json')
    expect(leerImpresosFotocheck(almacen, 2).size).toBe(0)
    expect(leerImpresosFotocheck(null, 2).size).toBe(0)
    expect(leerImpresosFotocheck(almacen, null).size).toBe(0)
    const lleno = { ...almacenFalso(), setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => guardarImpresosFotocheck(lleno, 2, [1])).not.toThrow()
    expect(() => guardarConfigFotocheck(lleno, configPorDefectoFotocheck())).not.toThrow()
    expect(() => guardarImpresosFotocheck(null, 2, [1])).not.toThrow()
  })

  it('el almacenamiento nunca recibe un código ni un nombre', () => {
    const almacen = almacenFalso()
    guardarConfigFotocheck(almacen, configPorDefectoFotocheck())
    guardarImpresosFotocheck(almacen, 2, [1, 2])
    expect(JSON.stringify([...almacen.datos])).not.toMatch(/ABCDE12345|Pérez|Ana/)
  })
})
