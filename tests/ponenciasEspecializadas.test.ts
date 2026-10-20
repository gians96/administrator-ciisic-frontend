import { describe, expect, it } from 'vitest'
import {
  agruparPorDia,
  cuerpoCorreccion,
  cuerpoPersona,
  cuerpoPonencia,
  duracionTexto,
  enlaceInscripciones,
  errorDePuerta,
  etiquetaMotivoCancelacion,
  etiquetaOrigen,
  etiquetaProcedencia,
  filtrosPonenciaDesdeQuery,
  formularioPersona,
  formularioPonencia,
  hayFiltros,
  horaFinDesde,
  mensajeDePuerta,
  minutosEntre,
  parametrosPonencia,
  ponenciaDePuertaInicial,
  textoCupo,
  tonoCupo,
  validarPersona,
  validarPonencia,
  type PonenciaEspecializada,
  type ResultadoPuerta,
} from '~/utils/ponenciasEspecializadas'

const ponencia = (datos: Partial<PonenciaEspecializada> = {}): PonenciaEspecializada => ({
  id: 1, eventoId: 2, tema: 'Bases de datos vectoriales', fecha: '2026-10-27', horaInicio: '12:00', horaFin: '12:45', duracionMin: 45,
  ambiente: 'Laboratorio 2', modalidad: 'PRESENCIAL', precio: 0, esGratuita: true, cupo: 20, inscritos: 5, asistentes: 2, cuposDisponibles: 15,
  ponente: { nombre: 'Ph.D. Edwin Roque Tito', bio: null, foto: null, externo: false }, publicada: true, orden: 2, ...datos,
})

const resultado = (datos: Partial<ResultadoPuerta> = {}): ResultadoPuerta => ({
  id: 9, inscripcionNueva: false, asistioEn: '2026-10-27T17:05:00.000Z', esFueraDeHorario: false,
  asistente: { id: 3, tipoDocumento: 'dni', numeroDocumento: '12345678', nombres: 'Ana', apellidos: 'Pérez', correo: null, celular: null, procedencia: null },
  ponencia: { id: 1, tema: 'Tema', ambiente: 'Laboratorio 2', cupo: 20, inscritos: 6, asistentes: 3 }, liberadas: [], ...datos,
})

describe('horario y duración', () => {
  it('textos de duración', () => {
    expect(duracionTexto(45)).toBe('45 min')
    expect(duracionTexto(60)).toBe('1 h')
    expect(duracionTexto(90)).toBe('1 h 30 min')
    expect(duracionTexto(0)).toBe('—')
    expect(duracionTexto(Number.NaN)).toBe('—')
  })

  it('la hora de fin sale del inicio y la duración, sin pasar de la medianoche', () => {
    expect(horaFinDesde('12:00', 45)).toBe('12:45')
    expect(horaFinDesde('09:30', 90)).toBe('11:00')
    expect(horaFinDesde('23:00', 60)).toBeNull()
    expect(horaFinDesde('23:00', 59)).toBe('23:59')
    expect(horaFinDesde('25:00', 10)).toBeNull()
    expect(horaFinDesde('12:00', 0)).toBeNull()
    expect(horaFinDesde('12:00', 1.5)).toBeNull()
  })

  it('minutos entre dos horas', () => {
    expect(minutosEntre('12:00', '12:45')).toBe(45)
    expect(minutosEntre('12:45', '12:00')).toBe(0)
    expect(minutosEntre('x', '12:00')).toBe(0)
  })
})

describe('cupos', () => {
  it('texto y tono del cupo', () => {
    expect(textoCupo(ponencia())).toBe('5 / 20')
    expect(textoCupo(ponencia({ cupo: null }))).toBe('5 · sin límite')
    expect(tonoCupo(ponencia({ inscritos: 5 }))).toBe('ok')
    expect(tonoCupo(ponencia({ inscritos: 16 }))).toBe('warn')
    expect(tonoCupo(ponencia({ inscritos: 20 }))).toBe('error')
    expect(tonoCupo(ponencia({ cupo: null }))).toBe('neutral')
  })
})

describe('programa por día', () => {
  it('agrupa por día y ordena por hora, orden y ambiente (numérico)', () => {
    const dias = agruparPorDia([
      ponencia({ id: 1, fecha: '2026-10-28', ambiente: 'Aula 3' }),
      ponencia({ id: 2, fecha: '2026-10-27', ambiente: 'Laboratorio 10', orden: 5 }),
      ponencia({ id: 3, fecha: '2026-10-27', ambiente: 'Laboratorio 2', orden: 5 }),
      ponencia({ id: 4, fecha: '2026-10-27', ambiente: 'Aula 5', horaInicio: '11:00', horaFin: '11:45' }),
    ])
    expect(dias.map((d) => d.fecha)).toEqual(['2026-10-27', '2026-10-28'])
    expect(dias[0]!.ponencias.map((p) => p.id)).toEqual([4, 3, 2])
  })

  it('la ponencia inicial de la puerta es la que está en curso o por empezar hoy', () => {
    const lista = [
      ponencia({ id: 1, fecha: '2026-10-27', horaInicio: '09:00', horaFin: '09:45' }),
      ponencia({ id: 2, fecha: '2026-10-27', horaInicio: '12:00', horaFin: '12:45' }),
      ponencia({ id: 3, fecha: '2026-10-28', horaInicio: '12:00', horaFin: '12:45' }),
    ]
    // 12:10 en Lima = 17:10 UTC
    expect(ponenciaDePuertaInicial(lista, new Date('2026-10-27T17:10:00.000Z'))?.id).toBe(2)
    // Pasada la última de hoy, se queda con la primera de hoy
    expect(ponenciaDePuertaInicial(lista, new Date('2026-10-27T22:00:00.000Z'))?.id).toBe(1)
    // Hoy no hay ninguna: la primera del programa
    expect(ponenciaDePuertaInicial(lista, new Date('2026-10-20T17:00:00.000Z'))?.id).toBe(1)
    expect(ponenciaDePuertaInicial([])).toBeNull()
  })
})

describe('formulario de la ponencia', () => {
  it('el formulario nuevo es presencial, gratuito, publicado y de 45 minutos a las 12:00', () => {
    expect(formularioPonencia()).toMatchObject({ horaInicio: '12:00', duracionMin: '45', modalidad: 'PRESENCIAL', esGratuita: true, publicada: true, cupo: '' })
  })

  it('cargar una ponencia existente conserva sus datos (cupo vacío = sin límite, precio solo si es de pago)', () => {
    const form = formularioPonencia(ponencia({ cupo: null, precio: 15, esGratuita: false, ponente: { nombre: 'X', bio: 'Bio', foto: '/images/a.webp', externo: true } }))
    expect(form).toMatchObject({ cupo: '', precio: '15', esGratuita: false, ponenteNombre: 'X', ponenteBio: 'Bio', ponenteFoto: '/images/a.webp', ponenteExterno: true })
    expect(formularioPonencia(ponencia()).precio).toBe('')
  })

  const valido = () => ({ ...formularioPonencia(), tema: 'Bases de datos vectoriales', fecha: '2026-10-27', ambiente: 'Laboratorio 2', ponenteNombre: 'Edwin Roque' })

  it('valida lo obligatorio', () => {
    expect(validarPonencia(valido())).toEqual({})
    expect(Object.keys(validarPonencia(formularioPonencia())).sort()).toEqual(['ambiente', 'fecha', 'ponente.nombre', 'tema'])
  })

  it('valida duración, precio, cupo, orden y foto', () => {
    expect(validarPonencia({ ...valido(), duracionMin: '0' })).toHaveProperty('duracionMin')
    expect(validarPonencia({ ...valido(), horaInicio: '23:30', duracionMin: '45' })).toHaveProperty('duracionMin')
    expect(validarPonencia({ ...valido(), esGratuita: false, precio: '' })).toHaveProperty('precio')
    expect(validarPonencia({ ...valido(), esGratuita: false, precio: '10.555' })).toHaveProperty('precio')
    expect(validarPonencia({ ...valido(), esGratuita: false, precio: '10,50' })).toEqual({})
    expect(validarPonencia({ ...valido(), cupo: '0' })).toHaveProperty('cupo')
    expect(validarPonencia({ ...valido(), cupo: '2.5' })).toHaveProperty('cupo')
    expect(validarPonencia({ ...valido(), cupo: '' })).toEqual({})
    expect(validarPonencia({ ...valido(), orden: 'x' })).toHaveProperty('orden')
    for (const foto of ['../x.png', 'http://sitio.pe/a.png', '//otro.com/a.png', 'foto.png']) expect(validarPonencia({ ...valido(), ponenteFoto: foto })).toHaveProperty(['ponente.foto'])
    for (const foto of ['/images/ponentes/a.webp', 'https://cdn.ejemplo.pe/a.png', '']) expect(validarPonencia({ ...valido(), ponenteFoto: foto })).toEqual({})
  })

  it('arma el cuerpo con la hora de fin calculada, el precio, el cupo y el ponente', () => {
    expect(cuerpoPonencia({ ...valido(), cupo: '20', ponenteBio: ' Bio ', ponenteFoto: ' /images/a.webp ' })).toEqual({
      tema: 'Bases de datos vectoriales', fecha: '2026-10-27', horaInicio: '12:00', horaFin: '12:45', ambiente: 'Laboratorio 2', modalidad: 'PRESENCIAL',
      precio: 0, cupo: 20, ponente: { nombre: 'Edwin Roque', bio: 'Bio', foto: '/images/a.webp', externo: false }, publicada: true, orden: 0,
    })
    const pago = cuerpoPonencia({ ...valido(), esGratuita: false, precio: '12,5', modalidad: 'VIRTUAL', ponenteBio: '', ponenteFoto: '', orden: '3' })
    expect(pago).toMatchObject({ precio: 12.5, cupo: null, modalidad: 'VIRTUAL', orden: 3, ponente: { bio: null, foto: null } })
  })
})

describe('filtros de las inscripciones', () => {
  it('lee la query ignorando valores inválidos', () => {
    expect(filtrosPonenciaDesdeQuery({ ponenciaId: '7', fecha: '2026-10-27', modalidad: 'VIRTUAL', estado: 'CANCELADO', asistencia: 'si', procedencia: 'SIN_DATO', origen: 'PUERTA', q: 'ana', page: '3' }))
      .toEqual({ ponenciaId: '7', fecha: '2026-10-27', modalidad: 'VIRTUAL', estado: 'CANCELADO', asistencia: 'si', procedencia: 'SIN_DATO', origen: 'PUERTA', q: 'ana', page: 3 })
    expect(filtrosPonenciaDesdeQuery({ ponenciaId: 'abc', fecha: 'hoy', modalidad: 'X', estado: 'x', asistencia: 'tal vez', procedencia: 'otro', origen: 'otro', page: '-2', q: ['a'] }))
      .toEqual({ ponenciaId: '', fecha: '', modalidad: '', estado: '', asistencia: '', procedencia: '', origen: '', q: '', page: 1 })
    expect(filtrosPonenciaDesdeQuery({ q: 'x'.repeat(300) }).q).toHaveLength(100)
  })

  it('serializa solo lo no vacío y la página desde la 2', () => {
    const filtros = filtrosPonenciaDesdeQuery({ ponenciaId: '7', q: ' ana ', page: '2' })
    expect(parametrosPonencia(filtros)).toEqual({ ponenciaId: '7', q: 'ana', page: '2' })
    expect(parametrosPonencia(filtros, false)).toEqual({ ponenciaId: '7', q: 'ana' })
    expect(parametrosPonencia(filtrosPonenciaDesdeQuery({}))).toEqual({})
  })

  it('detecta si hay filtros activos', () => {
    expect(hayFiltros(filtrosPonenciaDesdeQuery({}))).toBe(false)
    expect(hayFiltros(filtrosPonenciaDesdeQuery({ page: '4' }))).toBe(false)
    expect(hayFiltros(filtrosPonenciaDesdeQuery({ asistencia: 'no' }))).toBe(true)
  })

  it('enlace desde el programa', () => {
    expect(enlaceInscripciones(12)).toBe('/ponencias-especializadas/inscripciones?ponenciaId=12')
  })
})

describe('persona (alta manual y puerta)', () => {
  it('solo el documento es obligatorio', () => {
    expect(validarPersona({ ...formularioPersona(), numeroDocumento: '12345678' }, { nombresObligatorios: false })).toEqual({})
    expect(validarPersona(formularioPersona(), { nombresObligatorios: false })).toHaveProperty('numeroDocumento')
    expect(validarPersona({ ...formularioPersona(), numeroDocumento: '1234' }, { nombresObligatorios: false })).toHaveProperty('numeroDocumento')
    expect(validarPersona({ ...formularioPersona(), tipoDocumento: 'ce', numeroDocumento: 'ABC123456' }, { nombresObligatorios: true })).toHaveProperty('nombres')
  })

  it('exige nombres cuando el DNI no los trajo y valida correo y celular solo si se escriben', () => {
    const base = { ...formularioPersona(), numeroDocumento: '12345678' }
    expect(Object.keys(validarPersona(base, { nombresObligatorios: true })).sort()).toEqual(['apellidos', 'nombres'])
    expect(validarPersona({ ...base, correo: 'no-es-correo' }, { nombresObligatorios: false })).toHaveProperty('correo')
    expect(validarPersona({ ...base, celular: '123' }, { nombresObligatorios: false })).toHaveProperty('celular')
    expect(validarPersona({ ...base, correo: 'ana@gmail.com', celular: '987 654 321' }, { nombresObligatorios: false })).toEqual({})
    expect(validarPersona({ ...base, nombres: 'A' }, { nombresObligatorios: false })).toHaveProperty('nombres')
  })

  it('el cuerpo omite los opcionales vacíos y normaliza correo y celular', () => {
    expect(cuerpoPersona({ ...formularioPersona(), numeroDocumento: ' 12345678 ' })).toEqual({ tipoDocumento: 'dni', numeroDocumento: '12345678' })
    expect(cuerpoPersona({ tipoDocumento: 'dni', numeroDocumento: '12345678', nombres: ' Ana ', apellidos: 'Pérez', correo: ' Ana@Gmail.com ', celular: '987 654-321', procedencia: 'EXTERNO' }))
      .toEqual({ tipoDocumento: 'dni', numeroDocumento: '12345678', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@gmail.com', celular: '987654321', procedencia: 'EXTERNO' })
  })

  it('la corrección envía todos los campos para que los vacíos borren', () => {
    expect(cuerpoCorreccion({ nombres: ' Ana ', apellidos: 'Pérez', correo: '', celular: '', procedencia: '' }))
      .toEqual({ asistente: { nombres: 'Ana', apellidos: 'Pérez', correo: '', celular: '', procedencia: '' } })
  })
})

describe('puerta: resultados y errores', () => {
  it('un inscrito que ya estaba: verde', () => {
    expect(mensajeDePuerta(resultado())).toEqual({ tono: 'ok', titulo: 'Asistencia registrada · Ana Pérez', detalle: 'Estaba inscrito en esta ponencia.' })
  })

  it('inscrito en el acto, cupo liberado o fuera de horario: ámbar con el detalle', () => {
    const m = mensajeDePuerta(resultado({
      inscripcionNueva: true, esFueraDeHorario: true,
      liberadas: [{ inscripcionId: 4, ponenciaId: 7, tema: 'Big Data', ambiente: 'Laboratorio 6' }, { inscripcionId: 5, ponenciaId: 8, tema: 'IA', ambiente: 'Aula 5' }],
    }))
    expect(m.tono).toBe('aviso')
    expect(m.detalle).toContain('se inscribió en el acto')
    expect(m.detalle).toContain('«Big Data» (Laboratorio 6) y «IA» (Aula 5)')
    expect(m.detalle).toContain('Fuera del horario')
    expect(mensajeDePuerta(resultado({ esFueraDeHorario: true })).tono).toBe('aviso')
  })

  it('los errores de la puerta se traducen', () => {
    const error = (status: number, code: string, message = 'msg', fields?: Record<string, string>) => ({ status, data: { code, message, fields } })
    expect(errorDePuerta(error(422, 'NAMES_REQUIRED', 'x', { nombres: 'Ingresa los nombres' }))).toMatchObject({ tono: 'aviso', pideNombres: true, codigo: 'NAMES_REQUIRED' })
    expect(errorDePuerta(error(409, 'TALK_FULL', 'La ponencia «X» ya no tiene cupos disponibles.'))).toMatchObject({ tono: 'error', titulo: 'Sin cupos', detalle: 'La ponencia «X» ya no tiene cupos disponibles.', pideNombres: false })
    expect(errorDePuerta(error(409, 'ATTENDANCE_ALREADY_REGISTERED', 'La asistencia ya fue registrada a las 12:05.'))).toMatchObject({ tono: 'aviso', titulo: 'Ya registrada' })
    expect(errorDePuerta(error(422, 'VALIDATION_ERROR', 'x', { numeroDocumento: 'El DNI debe tener 8 dígitos' }))).toMatchObject({ tono: 'error', detalle: 'El DNI debe tener 8 dígitos' })
    expect(errorDePuerta(error(500, 'ERROR'))).toMatchObject({ tono: 'error', titulo: 'No se pudo registrar' })
  })
})

describe('etiquetas', () => {
  it('traducen los códigos', () => {
    expect(etiquetaProcedencia('INTERNO')).toBe('Interno (UNDC)')
    expect(etiquetaProcedencia(null)).toBe('Sin dato')
    expect(etiquetaOrigen('PUERTA')).toBe('En puerta')
    expect(etiquetaOrigen('OTRO')).toBe('OTRO')
    expect(etiquetaMotivoCancelacion('CAMBIO_EN_PUERTA')).toBe('Cambió de ponencia en puerta')
    expect(etiquetaMotivoCancelacion(null)).toBe('Cancelada')
  })
})
