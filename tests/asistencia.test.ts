import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  actividadEnCurso,
  actividadInicial,
  actividadParaEscaner,
  agregarRegistro,
  CIERRE_EXITO_MS,
  conservarValorTrasError,
  cuerpoLectura,
  cuerpoMarca,
  describirLectura,
  esErrorPasajero,
  esperaContinuar,
  estadoEscanerInicial,
  etiquetaMetodo,
  idDeConsulta,
  MAXIMO_RECIENTES,
  MENSAJE_CODIGO_SIN_SOPORTE,
  mensajeErrorCamara,
  mensajeProblemaCamara,
  nombreTipoInscripcion,
  pausaLaCamara,
  problemaCamara,
  registroDeResultado,
  resultadoDeError,
  resultadoDeMarca,
  resultadoNoProcesada,
  resultadoQrNoValido,
  RUTA_WASM_ZXING,
  SENALES,
  textoMarca,
  textoVentana,
  TITULO_QR_LEGADO,
  ubicarArchivoZxing,
  ventanaActividad,
  type FormMarca,
  type MarcaAsistencia,
} from '~/utils/asistencia'
import { aErrorApi } from '~/utils/errores'

const form = (cambios: Partial<FormMarca> = {}): FormMarca => ({ modo: 'qr', valor: '', tipoDocumento: '', fueraDeHorario: false, ...cambios })

describe('asistencia: cuerpo de la marca', () => {
  it('en modo QR con el QR anterior envía el id leído con metodo QR (lo entiende el backend 013)', () => {
    expect(cuerpoMarca(form({ valor: ' 1234 ' }), false)).toEqual({ body: { participanteId: 1234, fueraDeHorario: false, metodo: 'QR' } })
  })

  it('en modo QR con el código del fotocheck envía { codigo } en mayúsculas y sin saltos', () => {
    expect(cuerpoMarca(form({ valor: ' k7q2m9x4tb\r\n' }), false)).toEqual({ body: { codigo: 'K7Q2M9X4TB', fueraDeHorario: false, metodo: 'QR' } })
    // 10 dígitos es un código (el id anterior nunca llega a 10)
    expect(cuerpoMarca(form({ valor: '0123456789' }), false)).toEqual({ body: { codigo: '0123456789', fueraDeHorario: false, metodo: 'QR' } })
  })

  it('en modo QR rechaza lo que no es un código ni un id positivo (sin llamar al backend)', () => {
    for (const valor of ['abc', '12a', '0', '-5', '1.5', '99999999999999999999', 'K7Q2M9X4T', 'https://ciisic.pe/K7Q2M9X4TB']) {
      const resultado = cuerpoMarca(form({ valor }), false)
      expect(resultado, valor).toHaveProperty('error')
      expect((resultado as { error: string }).error).toMatch(/^QR no válido/)
    }
  })

  it('en modo DNI envía el documento con metodo DOCUMENTO y sin tipo si no se eligió', () => {
    expect(cuerpoMarca(form({ modo: 'dni', valor: ' 12345678 ' }), false))
      .toEqual({ body: { numeroDocumento: '12345678', fueraDeHorario: false, metodo: 'DOCUMENTO' } })
  })

  it('en modo DNI agrega el tipo elegido (resuelve AMBIGUOUS_DOCUMENT)', () => {
    expect(cuerpoMarca(form({ modo: 'dni', valor: '001234567', tipoDocumento: 'ce' }), false))
      .toEqual({ body: { numeroDocumento: '001234567', tipoDocumento: 'ce', fueraDeHorario: false, metodo: 'DOCUMENTO' } })
  })

  it('en modo DNI valida el formato del backend (8 a 12 letras o números)', () => {
    for (const valor of ['1234567', '1234567890123', '1234 5678', '12-345678']) {
      expect(cuerpoMarca(form({ modo: 'dni', valor }), false)).toHaveProperty('error')
    }
  })

  it('sin valor devuelve un error', () => {
    expect(cuerpoMarca(form({ valor: '   ' }), true)).toHaveProperty('error')
    expect(cuerpoMarca(form({ modo: 'dni', valor: '' }), true)).toHaveProperty('error')
  })

  it('«fuera de horario» solo viaja con el permiso asistencia.fuera_horario', () => {
    expect(cuerpoMarca(form({ valor: '7', fueraDeHorario: true }), true)).toEqual({ body: { participanteId: 7, fueraDeHorario: true, metodo: 'QR' } })
    expect(cuerpoMarca(form({ valor: '7', fueraDeHorario: true }), false)).toEqual({ body: { participanteId: 7, fueraDeHorario: false, metodo: 'QR' } })
    expect(cuerpoMarca(form({ valor: 'K7Q2M9X4TB', fueraDeHorario: true }), true)).toEqual({ body: { codigo: 'K7Q2M9X4TB', fueraDeHorario: true, metodo: 'QR' } })
  })

  it('cuerpo de una lectura del escáner', () => {
    expect(cuerpoLectura({ codigo: 'K7Q2M9X4TB' }, false)).toEqual({ codigo: 'K7Q2M9X4TB', fueraDeHorario: false, metodo: 'QR' })
    expect(cuerpoLectura({ participanteId: 100 }, true)).toEqual({ participanteId: 100, fueraDeHorario: true, metodo: 'QR' })
    expect(describirLectura({ codigo: 'K7Q2M9X4TB' })).toBe('Código K7Q2M9X4TB')
    expect(describirLectura({ participanteId: 100 })).toBe('QR anterior 100')
  })
})

describe('asistencia: textos', () => {
  it('conserva lo escrito solo ante AMBIGUOUS_DOCUMENT en modo DNI', () => {
    expect(conservarValorTrasError('dni', 'AMBIGUOUS_DOCUMENT')).toBe(true)
    expect(conservarValorTrasError('qr', 'AMBIGUOUS_DOCUMENT')).toBe(false)
    expect(conservarValorTrasError('dni', 'PARTICIPANT_NOT_FOUND')).toBe(false)
  })

  it('nombra el método y muestra «—» en las marcas antiguas', () => {
    expect(etiquetaMetodo('QR')).toBe('QR')
    expect(etiquetaMetodo('DOCUMENTO')).toBe('Documento')
    expect(etiquetaMetodo('QR_LEGADO')).toBe('QR (versión anterior)')
    expect(etiquetaMetodo(null)).toBe('—')
    expect(etiquetaMetodo('OTRO')).toBe('OTRO')
  })

  it('describe la marca con el documento tal cual llega (enmascarado)', () => {
    const participante = { id: 1, nombres: 'Ana', apellidos: 'Díaz', tipoDocumento: 'dni', numeroDocumento: '****5678' }
    expect(textoMarca({ esFueraDeHorario: false, participante })).toBe('✓ Ana Díaz · DNI ****5678')
    expect(textoMarca({ esFueraDeHorario: true, participante })).toBe('✓ Ana Díaz · DNI ****5678 · fuera de horario')
  })

  it('con el QR anterior avisa que hay que verificar el DNI', () => {
    const participante = { id: 1, nombres: 'Ana', apellidos: 'Díaz', tipoDocumento: 'dni', numeroDocumento: '70001234' }
    expect(textoMarca({ esFueraDeHorario: false, participante, alerta: 'QR_LEGADO' })).toBe('⚠ QR antiguo: verifica el DNI · Ana Díaz · DNI 70001234')
    expect(textoMarca({ esFueraDeHorario: false, participante, alerta: null })).toBe('✓ Ana Díaz · DNI 70001234')
  })
})

describe('asistencia: enlace desde Eventos → Actividades', () => {
  it('lee ids positivos de la URL', () => {
    expect(idDeConsulta('12')).toBe(12)
    for (const valor of [undefined, null, '', '0', '-3', '1.5', 'abc', '12abc', ['12'], '99999999999999999999']) {
      expect(idDeConsulta(valor), String(valor)).toBeNull()
    }
  })

  it('elige la actividad del enlace si es de este evento', () => {
    expect(actividadInicial([{ id: 10 }, { id: 12 }], 12)).toEqual({ id: 12, ajena: false })
  })

  it('si la actividad del enlace es de otro evento, elige la primera y lo avisa', () => {
    expect(actividadInicial([{ id: 10 }, { id: 11 }], 12)).toEqual({ id: 10, ajena: true })
    expect(actividadInicial([], 12)).toEqual({ id: null, ajena: true })
  })

  it('sin enlace, la primera (o ninguna)', () => {
    expect(actividadInicial([{ id: 10 }, { id: 11 }], null)).toEqual({ id: 10, ajena: false })
    expect(actividadInicial([], null)).toEqual({ id: null, ajena: false })
  })
})

// Lima es UTC-5: 09:00 en Lima = 14:00 UTC
const ACTIVIDAD = { id: 10, fecha: '2026-10-26', horaInicio: '09:00', horaFin: '10:30' }
const utc = (iso: string) => new Date(iso)

describe('escáner: horario de registro de la actividad (hora de Lima)', () => {
  it('abre 30 min antes del inicio y cierra al fin (incluido)', () => {
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-26T13:29:00Z'))).toEqual({ estado: 'PROXIMA', hoy: true, desde: '08:30', hasta: '10:30' })
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-26T13:30:00Z'))?.estado).toBe('ABIERTA')
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-26T15:30:00Z'))?.estado).toBe('ABIERTA')
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-26T15:31:00Z'))).toEqual({ estado: 'CERRADA', hoy: true, desde: '08:30', hasta: '10:30' })
  })

  it('el día se cuenta en Lima, no en UTC', () => {
    // 2026-10-26T03:00Z son las 22:00 del 25 en Lima: la actividad es mañana
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-26T03:00:00Z'))).toMatchObject({ estado: 'PROXIMA', hoy: false })
    // 2026-10-27T04:00Z son las 23:00 del 26 en Lima: ya cerró, pero es hoy
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-27T04:00:00Z'))).toMatchObject({ estado: 'CERRADA', hoy: true })
    expect(ventanaActividad(ACTIVIDAD, utc('2026-10-27T12:00:00Z'))).toMatchObject({ estado: 'CERRADA', hoy: false })
  })

  it('acepta la fecha con hora y rechaza formatos inválidos', () => {
    expect(ventanaActividad({ ...ACTIVIDAD, fecha: '2026-10-26T00:00:00.000Z' }, utc('2026-10-26T14:00:00Z'))?.estado).toBe('ABIERTA')
    expect(ventanaActividad({ ...ACTIVIDAD, horaInicio: '9:00' }, utc('2026-10-26T14:00:00Z'))).toBeNull()
    expect(ventanaActividad({ ...ACTIVIDAD, fecha: '' }, utc('2026-10-26T14:00:00Z'))).toBeNull()
  })

  it('describe el horario', () => {
    expect(textoVentana({ estado: 'ABIERTA', hoy: true, desde: '08:30', hasta: '10:30' })).toBe('Registro abierto hasta las 10:30')
    expect(textoVentana({ estado: 'PROXIMA', hoy: true, desde: '08:30', hasta: '10:30' })).toBe('El registro abre a las 08:30')
    expect(textoVentana({ estado: 'PROXIMA', hoy: false, desde: '08:30', hasta: '10:30' })).toBe('El registro abre el día de la actividad, a las 08:30')
    expect(textoVentana({ estado: 'CERRADA', hoy: true, desde: '08:30', hasta: '10:30' })).toBe('El registro cerró a las 10:30')
    expect(textoVentana({ estado: 'CERRADA', hoy: false, desde: '08:30', hasta: '10:30' })).toBe('La actividad ya pasó')
  })
})

describe('escáner: actividad por defecto', () => {
  const ACTIVIDADES = [
    { id: 1, fecha: '2026-10-26', horaInicio: '09:00', horaFin: '10:30' },
    { id: 2, fecha: '2026-10-26', horaInicio: '10:30', horaFin: '12:00' },
    { id: 3, fecha: '2026-10-26', horaInicio: '15:00', horaFin: '17:00' },
    { id: 4, fecha: '2026-10-27', horaInicio: '08:00', horaFin: '09:00' },
  ]

  it('la que está en curso o, si no, la próxima de hoy', () => {
    // 08:00 en Lima: ninguna abierta; la próxima de hoy
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-26T13:00:00Z'))).toBe(1)
    // 09:10: solo la 1
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-26T14:10:00Z'))).toBe(1)
    // 10:15: se cruzan la 1 (empezó 09:00) y la 2 (empieza 10:30): la de inicio más cercano
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-26T15:15:00Z'))).toBe(2)
    // 13:00: la de la tarde
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-26T18:00:00Z'))).toBe(3)
    // 07:40 del 27: la 4 ya abrió
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-27T12:40:00Z'))).toBe(4)
  })

  it('sin actividades hoy (o ya terminadas), ninguna', () => {
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-26T23:00:00Z'))).toBeNull()
    expect(actividadEnCurso(ACTIVIDADES, utc('2026-10-20T15:00:00Z'))).toBeNull()
    expect(actividadEnCurso([], utc('2026-10-26T15:00:00Z'))).toBeNull()
  })

  it('el enlace manda; luego la ya elegida, la en curso y la primera', () => {
    const ahora = utc('2026-10-26T18:00:00Z')
    expect(actividadParaEscaner(ACTIVIDADES, { pedida: 2, anterior: 1, ahora })).toEqual({ id: 2, ajena: false })
    expect(actividadParaEscaner(ACTIVIDADES, { pedida: 99, anterior: 1, ahora })).toEqual({ id: 1, ajena: true })
    expect(actividadParaEscaner(ACTIVIDADES, { pedida: null, anterior: 4, ahora })).toEqual({ id: 4, ajena: false })
    expect(actividadParaEscaner(ACTIVIDADES, { pedida: null, anterior: 99, ahora })).toEqual({ id: 3, ajena: false })
    expect(actividadParaEscaner(ACTIVIDADES, { pedida: null, anterior: null, ahora: utc('2026-10-20T15:00:00Z') })).toEqual({ id: 1, ajena: false })
    expect(actividadParaEscaner([], { pedida: 5, anterior: null, ahora })).toEqual({ id: null, ajena: true })
  })

  it('estado compartido inicial', () => {
    expect(estadoEscanerInicial()).toEqual({ eventoId: null, actividades: [], actividadId: null, cargando: false })
    expect(estadoEscanerInicial()).not.toBe(estadoEscanerInicial())
  })
})

const MARCA_014: MarcaAsistencia = {
  id: 3,
  registradoEn: '2026-10-26T14:05:00.000Z',
  metodo: 'QR',
  esFueraDeHorario: false,
  alerta: null,
  participante: { id: 100, nombres: 'ANA', apellidos: 'PÉREZ GARCÍA', tipoDocumento: 'dni', numeroDocumento: '70001234', foto: { tiene: true } },
  inscripcion: { id: 500, tipoInscripcion: { nombre: 'ESTUDIANTES', etiqueta: 'CON KIT' } },
}

describe('escáner: resultado de la marca', () => {
  it('verde con nombre, documento, tipo y foto (spec 014)', () => {
    expect(resultadoDeMarca(MARCA_014)).toEqual({
      tono: 'exito',
      titulo: 'Asistencia registrada',
      mensaje: null,
      persona: { nombre: 'ANA PÉREZ GARCÍA', documento: 'DNI 70001234', tipoInscripcion: 'ESTUDIANTES · CON KIT', fotoInscripcionId: 500 },
      fueraDeHorario: false,
      cierraEnMs: CIERRE_EXITO_MS,
      reintentable: false,
    })
  })

  it('sin foto no se pide la imagen', () => {
    const sinFoto = { ...MARCA_014, participante: { ...MARCA_014.participante, foto: { tiene: false } } }
    expect(resultadoDeMarca(sinFoto).persona?.fotoInscripcionId).toBeNull()
  })

  it('con el backend 013 (sin alerta, foto ni inscripción) también es verde', () => {
    const marca013: MarcaAsistencia = {
      id: 3,
      registradoEn: '2026-10-26T14:05:00.000Z',
      metodo: 'QR',
      esFueraDeHorario: true,
      participante: { id: 100, nombres: 'Ana', apellidos: 'Pérez', tipoDocumento: 'dni', numeroDocumento: '****1234' },
    }
    expect(resultadoDeMarca(marca013)).toMatchObject({
      tono: 'exito',
      persona: { nombre: 'Ana Pérez', documento: 'DNI ****1234', tipoInscripcion: null, fotoInscripcionId: null },
      fueraDeHorario: true,
    })
  })

  it('ámbar con el QR anterior: verificar el DNI, sin cerrarse solo', () => {
    const resultado = resultadoDeMarca({ ...MARCA_014, metodo: 'QR_LEGADO', alerta: 'QR_LEGADO' })
    expect(resultado.tono).toBe('alerta')
    expect(resultado.titulo).toBe(TITULO_QR_LEGADO)
    expect(resultado.titulo).toBe('QR antiguo: verifica el DNI')
    expect(resultado.persona?.documento).toBe('DNI 70001234')
    expect(resultado.cierraEnMs).toBeNull()
  })

  it('nombre del tipo de inscripción', () => {
    expect(nombreTipoInscripcion({ nombre: 'PONENTE', etiqueta: null })).toBe('PONENTE')
    expect(nombreTipoInscripcion(null)).toBeNull()
    expect(nombreTipoInscripcion(undefined)).toBeNull()
  })
})

const errorDe = (status: number, code?: string, message?: string) => aErrorApi({ status, data: code ? { success: false, code, message } : undefined })

describe('escáner: resultado de un rechazo', () => {
  it('ya registrada: ámbar con la hora del backend', () => {
    const resultado = resultadoDeError(errorDe(409, 'ATTENDANCE_ALREADY_REGISTERED', 'La asistencia ya fue registrada para esta actividad a las 09:12.'))
    expect(resultado).toMatchObject({ tono: 'alerta', titulo: 'Ya estaba registrada', mensaje: 'La asistencia ya fue registrada para esta actividad a las 09:12.', reintentable: false })
    expect(resultado.cierraEnMs).toBeGreaterThan(0)
  })

  it('rojo con el mensaje de cada código', () => {
    expect(resultadoDeError(errorDe(409, 'CODE_OTHER_EVENT', 'La credencial es de otro evento.'))).toMatchObject({
      tono: 'error',
      titulo: 'Credencial de otro evento',
      mensaje: 'La credencial es de otro evento. Revisa el evento elegido en la barra superior.',
      cierraEnMs: null,
      reintentable: false,
    })
    expect(resultadoDeError(errorDe(409, 'OUTSIDE_WINDOW', 'La asistencia se registra desde 08:30 hasta 10:30.'))).toMatchObject({ titulo: 'Fuera del horario', mensaje: 'La asistencia se registra desde 08:30 hasta 10:30.' })
    expect(resultadoDeError(errorDe(422, 'LEGACY_QR_NOT_ALLOWED', 'El QR anterior solo valía hasta el fin del evento (2026-10-30).'))).toMatchObject({ titulo: 'QR antiguo no válido', mensaje: 'El QR anterior solo valía hasta el fin del evento (2026-10-30).' })
    expect(resultadoDeError(errorDe(404, 'CODE_NOT_FOUND', 'x')).titulo).toBe('QR no reconocido')
    expect(resultadoDeError(errorDe(403, 'NOT_APPROVED', 'El participante no tiene una inscripción aprobada en este evento.')).titulo).toBe('Inscripción no aprobada')
    expect(resultadoDeError(errorDe(418, 'OTRO', 'Algo')).titulo).toBe('No se registró')
  })

  it('un código rechazado por validación es el backend 013', () => {
    const error = errorDe(422, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
    expect(resultadoDeError(error, { codigo: 'K7Q2M9X4TB' })).toMatchObject({ tono: 'error', mensaje: MENSAJE_CODIGO_SIN_SOPORTE })
    expect(resultadoDeError(error, { participanteId: 7 }).mensaje).not.toBe(MENSAJE_CODIGO_SIN_SOPORTE)
    expect(resultadoDeError(error).mensaje).not.toBe(MENSAJE_CODIGO_SIN_SOPORTE)
  })

  it('la red o el servidor caídos y demasiadas lecturas (429) se pueden reintentar', () => {
    expect(resultadoDeError(errorDe(0)).reintentable).toBe(true)
    expect(resultadoDeError(errorDe(503)).reintentable).toBe(true)
    expect(resultadoDeError(errorDe(429, 'RATE_LIMITED')).reintentable).toBe(true)
    expect(resultadoDeError(errorDe(409, 'OUTSIDE_WINDOW')).reintentable).toBe(false)
    expect(resultadoDeError(errorDe(404, 'CODE_NOT_FOUND')).reintentable).toBe(false)
    expect([0, 429, 500, 502, 503].every(esErrorPasajero)).toBe(true)
    expect([400, 401, 403, 404, 409, 422].some(esErrorPasajero)).toBe(false)
  })

  it('el aviso del QR anterior espera «Continuar»; un error o ese aviso pausan la cámara', () => {
    const legado = resultadoDeMarca({ ...MARCA_014, alerta: 'QR_LEGADO' })
    const verde = resultadoDeMarca(MARCA_014)
    const rojo = resultadoDeError(errorDe(409, 'OUTSIDE_WINDOW', 'x'))
    const yaEstaba = resultadoDeError(errorDe(409, 'ATTENDANCE_ALREADY_REGISTERED', 'x'))
    expect(esperaContinuar(legado)).toBe(true)
    for (const otro of [verde, rojo, yaEstaba, resultadoQrNoValido()]) expect(esperaContinuar(otro)).toBe(false)
    // La cámara no lee debajo de un resultado que no se cierra solo (el siguiente QR de la fila no lo reemplaza)
    expect(pausaLaCamara(legado)).toBe(true)
    expect(pausaLaCamara(rojo)).toBe(true)
    expect(pausaLaCamara(verde)).toBe(false)
    expect(pausaLaCamara(yaEstaba)).toBe(false)
    expect(pausaLaCamara(null)).toBe(false)
  })

  it('una lectura que no cupo en la cola queda en rojo como «No procesada»', () => {
    expect(resultadoNoProcesada()).toMatchObject({ tono: 'error', titulo: 'No procesada', persona: null, reintentable: false })
    expect(resultadoNoProcesada().mensaje).toMatch(/vuelve a escanear/)
  })

  it('QR no válido: rojo, sin persona, se cierra solo', () => {
    expect(resultadoQrNoValido()).toMatchObject({ tono: 'error', titulo: 'QR no válido', persona: null })
    expect(resultadoQrNoValido().cierraEnMs).toBeGreaterThan(0)
  })
})

describe('escáner: últimas lecturas y señales', () => {
  it('registra la persona o, si no se identificó, lo leído', () => {
    const verde = resultadoDeMarca(MARCA_014)
    expect(registroDeResultado(verde, { id: 1, instante: 5, leido: 'Código K7Q2M9X4TB', actividad: 'Inauguración' }))
      .toEqual({ id: 1, instante: 5, tono: 'exito', titulo: 'Asistencia registrada', detalle: 'ANA PÉREZ GARCÍA · DNI 70001234', actividad: 'Inauguración' })
    expect(registroDeResultado(resultadoQrNoValido(), { id: 2, instante: 6, leido: null, actividad: null }).detalle).toMatch(/^No es el QR/)
    expect(registroDeResultado(resultadoDeError(errorDe(404, 'CODE_NOT_FOUND', 'x')), { id: 3, instante: 7, leido: 'Código AAAAAAAAAA', actividad: null }).detalle).toBe('Código AAAAAAAAAA')
  })

  it('guarda las 10 últimas, la más reciente primero', () => {
    let lista: number[] = []
    for (let i = 1; i <= 12; i++) lista = agregarRegistro(lista, i)
    expect(MAXIMO_RECIENTES).toBe(10)
    expect(lista).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3])
    const original = [1]
    expect(agregarRegistro(original, 2)).toEqual([2, 1])
    expect(original).toEqual([1])
  })

  it('cada resultado vibra y pita; el error, más largo', () => {
    for (const senal of Object.values(SENALES)) {
      expect(senal.vibracion.length).toBeGreaterThan(0)
      expect(senal.tonos.length).toBeGreaterThan(0)
    }
    const total = (vibracion: number[]) => vibracion.reduce((suma, ms) => suma + ms, 0)
    expect(total(SENALES.error.vibracion)).toBeGreaterThan(total(SENALES.exito.vibracion))
    expect(SENALES.error.tonos[0]!.frecuencia).toBeLessThan(SENALES.exito.tonos[0]!.frecuencia)
  })
})

describe('escáner: cámara', () => {
  it('sin HTTPS o sin getUserMedia no se pide la cámara', () => {
    expect(problemaCamara({ seguro: false, conGetUserMedia: true })).toBe('INSEGURO')
    expect(problemaCamara({ seguro: true, conGetUserMedia: false })).toBe('SIN_SOPORTE')
    expect(problemaCamara({ seguro: true, conGetUserMedia: true })).toBeNull()
    expect(mensajeProblemaCamara('INSEGURO')).toMatch(/https/)
    expect(mensajeProblemaCamara('SIN_SOPORTE')).toMatch(/Chrome.*Safari/)
  })

  it('explica cada error de la cámara', () => {
    expect(mensajeErrorCamara({ name: 'NotAllowedError' })).toMatch(/permiso/)
    expect(mensajeErrorCamara(new DOMException('x', 'NotFoundError'))).toMatch(/No se encontró una cámara/)
    expect(mensajeErrorCamara({ name: 'NotReadableError' })).toMatch(/ocupada/)
    expect(mensajeErrorCamara({ name: 'InsecureContextError' })).toMatch(/https/)
    expect(mensajeErrorCamara({ name: 'StreamApiNotSupportedError' })).toMatch(/Chrome.*Safari/)
    expect(mensajeErrorCamara({ name: 'StreamLoadTimeoutError' })).toMatch(/no respondió/)
    for (const raro of [null, undefined, 'texto', {}, { name: 'constructor' }, { name: 'toString' }, new Error('x')]) {
      expect(mensajeErrorCamara(raro)).toMatch(/No se pudo iniciar la cámara/)
    }
  })

  it('el wasm de ZXing sale del panel, no de un CDN', () => {
    expect(ubicarArchivoZxing('zxing_reader.wasm', 'https://fastly.jsdelivr.net/npm/zxing-wasm/')).toBe(RUTA_WASM_ZXING)
    expect(ubicarArchivoZxing('otro.js', '/base/')).toBe('/base/otro.js')
    expect(RUTA_WASM_ZXING).toMatch(/^\/zxing-wasm\/\d+\.\d+\.\d+\/zxing_reader\.wasm$/)
  })

  it('el wasm de public/ es el de la versión de ZXing que trae vue-qrcode-reader (bun run escaner:wasm)', () => {
    const raiz = new URL('../', import.meta.url)
    const bundle = readFileSync(fileURLToPath(new URL('node_modules/vue-qrcode-reader/dist/vue-qrcode-reader.js', raiz)), 'utf8')
    const versiones = [...new Set([...bundle.matchAll(/zxing-wasm@(\d+\.\d+\.\d+)/g)].map((coincidencia) => coincidencia[1]))]
    expect(versiones).toHaveLength(1)
    const version = versiones[0]
    expect(RUTA_WASM_ZXING, 'actualiza RUTA_WASM_ZXING y corre bun run escaner:wasm').toBe(`/zxing-wasm/${version}/zxing_reader.wasm`)

    const paquete = JSON.parse(readFileSync(fileURLToPath(new URL('node_modules/zxing-wasm/package.json', raiz)), 'utf8')) as { version: string }
    expect(paquete.version, 'zxing-wasm instalado distinto del que usa vue-qrcode-reader').toBe(version)

    const publicado = fileURLToPath(new URL(`public${RUTA_WASM_ZXING}`, raiz))
    expect(existsSync(publicado), 'falta el wasm: bun run escaner:wasm').toBe(true)
    const huella = (ruta: string) => createHash('sha256').update(readFileSync(ruta)).digest('hex')
    expect(huella(publicado)).toBe(huella(fileURLToPath(new URL('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', raiz))))
  })
})
