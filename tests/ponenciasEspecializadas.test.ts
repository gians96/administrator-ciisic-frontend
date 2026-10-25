import { describe, expect, it } from 'vitest'
import {
  agruparPorDia,
  alternarSeleccion,
  comunicadoPropuesto,
  conCorreo,
  cuerpoComunicado,
  cuerpoCorreccion,
  cuerpoPersona,
  cuerpoPonencia,
  duracionTexto,
  enlaceInscripciones,
  errorDePuerta,
  esSeleccionable,
  etiquetaModo,
  etiquetaMotivoCancelacion,
  etiquetaOrigen,
  etiquetaProcedencia,
  etiquetaValidacion,
  FILTROS_RESUMEN_VACIOS,
  filtrosPonenciaDesdeQuery,
  filtrosResumenDesdeQuery,
  formularioPersona,
  formularioPonencia,
  hayFiltros,
  hayFiltrosResumen,
  horaFinDesde,
  listaDeNombres,
  MAXIMO_COPONENTES,
  ponentesDeLaPonencia,
  mensajeDePuerta,
  minutosEntre,
  parametrosPonencia,
  parametrosResumen,
  ponenciaDePuertaInicial,
  presenciales,
  resumenDeResultado,
  rutaDescargaResumen,
  situacionDeResumen,
  textoCambioAcceso,
  textoCupo,
  textoPuede,
  tonoCupo,
  validarComunicado,
  validarPersona,
  validarPonencia,
  mensajeEnlaceAforo,
  urlEnlaceAforo,
  type PersonaResumen,
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

  it('el aforo cuenta solo a los presenciales y los virtuales se suman aparte (backend 030)', () => {
    const mixta = ponencia({ cupo: 20, inscritos: 25, inscritosPresenciales: 18, inscritosVirtuales: 7 })
    expect(presenciales(mixta)).toBe(18)
    expect(textoCupo(mixta)).toBe('18 / 20 · +7 virtuales')
    expect(textoCupo(ponencia({ cupo: null, inscritos: 3, inscritosPresenciales: 2, inscritosVirtuales: 1 }))).toBe('2 · sin límite · +1 virtual')
    expect(tonoCupo(mixta)).toBe('warn')
    expect(tonoCupo(ponencia({ cupo: 20, inscritos: 30, inscritosPresenciales: 5, inscritosVirtuales: 25 }))).toBe('ok')
    expect(tonoCupo(ponencia({ cupo: 20, inscritos: 21, inscritosPresenciales: 20, inscritosVirtuales: 1 }))).toBe('error')
  })

  it('un backend anterior no separa los inscritos: todos cuentan como presenciales', () => {
    expect(presenciales(ponencia({ inscritos: 7 }))).toBe(7)
    expect(textoCupo(ponencia({ inscritos: 7 }))).toBe('7 / 20')
  })
})

describe('validación con el congreso', () => {
  const base = { validada: true as const, modoAsistencia: 'PRESENCIAL' as const, congreso: { estado: 'APROBADO', tipo: 'Público general', categoria: 'Público general' } }

  it('una inscripción validada muestra su modo y el tipo del congreso', () => {
    expect(etiquetaValidacion(base)).toMatchObject({ texto: 'Presencial', tono: 'brand' })
    expect(etiquetaValidacion({ ...base, modoAsistencia: 'VIRTUAL' })).toMatchObject({ texto: 'Virtual', tono: 'info', detalle: 'Congresista aprobado · Público general' })
  })

  it('sin validar es ámbar y un pago que ya no está aprobado, rojo', () => {
    expect(etiquetaValidacion({ validada: false, modoAsistencia: 'PRESENCIAL', congreso: null })).toMatchObject({ texto: 'Sin validar', tono: 'warn' })
    expect(etiquetaValidacion({ ...base, congreso: { estado: 'EN_REVISION', tipo: null, categoria: null } })).toMatchObject({ texto: 'Presencial · pago no vigente', tono: 'error' })
  })

  it('un backend anterior no envía la validación: no se marca nada', () => {
    expect(etiquetaValidacion({})).toBeNull()
  })

  it('el modo se llama presencial salvo que sea virtual', () => {
    expect(etiquetaModo('VIRTUAL')).toBe('Virtual')
    expect(etiquetaModo('PRESENCIAL')).toBe('Presencial')
    expect(etiquetaModo(undefined)).toBe('Presencial')
  })

  it('los textos del interruptor explican el efecto de cada cambio', () => {
    expect(textoCambioAcceso(true)).toMatchObject({ titulo: 'Encender el acceso libre', confirmar: 'Encender acceso libre' })
    expect(textoCambioAcceso(true).mensaje).toContain('solo con su documento')
    expect(textoCambioAcceso(false).mensaje).toContain('pago aprobado')
    expect(textoCambioAcceso(false).mensaje).toContain('Sin validar')
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
      precio: 0, cupo: 20, ponente: { nombre: 'Edwin Roque', bio: 'Bio', foto: '/images/a.webp', externo: false }, coponentes: [], publicada: true, orden: 0,
    })
    const pago = cuerpoPonencia({ ...valido(), esGratuita: false, precio: '12,5', modalidad: 'VIRTUAL', ponenteBio: '', ponenteFoto: '', orden: '3' })
    expect(pago).toMatchObject({ precio: 12.5, cupo: null, modalidad: 'VIRTUAL', orden: 3, ponente: { bio: null, foto: null } })
  })

  describe('tema compartido por varios ponentes', () => {
    const javier = { nombre: 'Dr. Javier Camilo Poma Palacios', bio: 'Ingeniero Electrónico.', foto: '/images/ponentes/2026/especializados/javier-poma.webp', externo: true }

    it('cargar una ponencia con coponentes los pasa al formulario; sin ellos (o con un backend anterior) la lista queda vacía', () => {
      const form = formularioPonencia(ponencia({ coponentes: [{ ...javier, bio: null, foto: null }] }))
      expect(form.coponentes).toEqual([{ nombre: 'Dr. Javier Camilo Poma Palacios', bio: '', foto: '', externo: true }])
      expect(formularioPonencia(ponencia({ coponentes: [] })).coponentes).toEqual([])
      expect(formularioPonencia(ponencia()).coponentes).toEqual([])
      expect(formularioPonencia().coponentes).toEqual([])
    })

    it('ponentesDeLaPonencia pone al principal primero y suma a los demás', () => {
      expect(ponentesDeLaPonencia(ponencia()).map((p) => p.nombre)).toEqual(['Ph.D. Edwin Roque Tito'])
      expect(ponentesDeLaPonencia(ponencia({ coponentes: [javier] })).map((p) => p.nombre)).toEqual(['Ph.D. Edwin Roque Tito', 'Dr. Javier Camilo Poma Palacios'])
    })

    it('valida el nombre y la foto de cada coponente, indicando cuál (misma clave que usa el backend)', () => {
      const base = { ...formularioPonencia(), tema: 'Tema compartido', fecha: '2026-10-28', ambiente: 'Aula 2', ponenteNombre: 'Ángel Almidón' }
      expect(validarPonencia({ ...base, coponentes: [{ nombre: 'Javier Poma', bio: '', foto: '/images/ponentes/a.webp', externo: false }] })).toEqual({})
      const errores = validarPonencia({ ...base, coponentes: [{ nombre: 'Javier Poma', bio: '', foto: '', externo: false }, { nombre: ' ', bio: '', foto: '../x.png', externo: false }] })
      expect(Object.keys(errores).sort()).toEqual(['coponentes[1].foto', 'coponentes[1].nombre'])
    })

    it('admite hasta MAXIMO_COPONENTES ponentes adicionales', () => {
      const base = { ...formularioPonencia(), tema: 'Tema compartido', fecha: '2026-10-28', ambiente: 'Aula 2', ponenteNombre: 'Ángel Almidón' }
      const otro = (n: number) => ({ nombre: `Ponente ${n}`, bio: '', foto: '', externo: false })
      expect(MAXIMO_COPONENTES).toBe(3)
      expect(validarPonencia({ ...base, coponentes: [otro(1), otro(2), otro(3)] })).toEqual({})
      expect(validarPonencia({ ...base, coponentes: [otro(1), otro(2), otro(3), otro(4)] })).toHaveProperty('coponentes')
    })

    it('el cuerpo lleva los coponentes recortados y con null en lo que falte; sin ellos envía [] para vaciar la lista', () => {
      const form = { ...formularioPonencia(), tema: 'Tema compartido', fecha: '2026-10-28', ambiente: 'Aula 2', ponenteNombre: 'Ángel Almidón' }
      expect(cuerpoPonencia({ ...form, coponentes: [{ nombre: ' Javier Poma ', bio: ' Bio ', foto: ' /images/a.webp ', externo: true }, { nombre: 'Karen Alcos', bio: '', foto: '', externo: false }] }).coponentes).toEqual([
        { nombre: 'Javier Poma', bio: 'Bio', foto: '/images/a.webp', externo: true },
        { nombre: 'Karen Alcos', bio: null, foto: null, externo: false },
      ])
      expect(cuerpoPonencia(form).coponentes).toEqual([])
    })
  })
})

describe('filtros de las inscripciones', () => {
  it('lee la query ignorando valores inválidos', () => {
    expect(filtrosPonenciaDesdeQuery({ ponenciaId: '7', fecha: '2026-10-27', modalidad: 'VIRTUAL', estado: 'CANCELADO', asistencia: 'si', procedencia: 'SIN_DATO', origen: 'PUERTA', validacion: 'no', modo: 'VIRTUAL', q: 'ana', page: '3' }))
      .toEqual({ ponenciaId: '7', fecha: '2026-10-27', modalidad: 'VIRTUAL', estado: 'CANCELADO', asistencia: 'si', procedencia: 'SIN_DATO', origen: 'PUERTA', validacion: 'no', modo: 'VIRTUAL', q: 'ana', page: 3 })
    expect(filtrosPonenciaDesdeQuery({ ponenciaId: 'abc', fecha: 'hoy', modalidad: 'X', estado: 'x', asistencia: 'tal vez', procedencia: 'otro', origen: 'otro', validacion: 'quizás', modo: 'HIBRIDO', page: '-2', q: ['a'] }))
      .toEqual({ ponenciaId: '', fecha: '', modalidad: '', estado: '', asistencia: '', procedencia: '', origen: '', validacion: '', modo: '', q: '', page: 1 })
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
    expect(hayFiltros(filtrosPonenciaDesdeQuery({ validacion: 'no' }))).toBe(true)
    expect(hayFiltros(filtrosPonenciaDesdeQuery({ modo: 'VIRTUAL' }))).toBe(true)
  })

  it('la validación y el modo viajan como parámetros del backend', () => {
    expect(parametrosPonencia(filtrosPonenciaDesdeQuery({ validacion: 'si', modo: 'PRESENCIAL' }))).toEqual({ validacion: 'si', modo: 'PRESENCIAL' })
  })

  it('enlace desde el programa', () => {
    expect(enlaceInscripciones(12)).toBe('/ponencias-especializadas/inscripciones?ponenciaId=12')
  })
})

describe('enlace público del aforo (backend spec 036)', () => {
  const TOKEN = 'A'.repeat(43)

  it('apunta a la página oculta de la landing con el token tras el #', () => {
    expect(urlEnlaceAforo(TOKEN, 'https://ciisic-viii.episundc.pe/')).toBe(`https://ciisic-viii.episundc.pe/aforo-ponencias#${TOKEN}`)
    // Sin origen explícito usa el de la landing configurada (fuera del puerto 3001 del panel en desarrollo)
    expect(urlEnlaceAforo(TOKEN)).toBe(`https://ciisic-viii.episundc.pe/aforo-ponencias#${TOKEN}`)
  })

  it('el mensaje lleva el enlace, el evento y el aviso de uso restringido', () => {
    const mensaje = mensajeEnlaceAforo('https://x/aforo-ponencias#t', 'VIII CIISIC')
    expect(mensaje).toContain('del VIII CIISIC')
    expect(mensaje).toContain('https://x/aforo-ponencias#t')
    expect(mensaje).toContain('no lo publiques')
    expect(mensajeEnlaceAforo('u', null)).not.toContain('del ')
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

  it('un congresista virtual se marca con aviso: asiste en línea y no ocupa aforo', () => {
    const m = mensajeDePuerta(resultado({ modoAsistencia: 'VIRTUAL' }))
    expect(m.tono).toBe('aviso')
    expect(m.detalle).toContain('Congresista virtual')
    expect(m.detalle).toContain('no ocupa aforo')
    expect(mensajeDePuerta(resultado({ modoAsistencia: 'PRESENCIAL', validada: true })).tono).toBe('ok')
  })

  it('los errores de la puerta se traducen', () => {
    const error = (status: number, code: string, message = 'msg', fields?: Record<string, string>) => ({ status, data: { code, message, fields } })
    expect(errorDePuerta(error(422, 'NAMES_REQUIRED', 'x', { nombres: 'Ingresa los nombres' }))).toMatchObject({ tono: 'aviso', pideNombres: true, codigo: 'NAMES_REQUIRED' })
    expect(errorDePuerta(error(409, 'TALK_FULL', 'La ponencia «X» ya no tiene cupos disponibles.'))).toMatchObject({ tono: 'error', titulo: 'Sin cupos', detalle: 'La ponencia «X» ya no tiene cupos disponibles.', pideNombres: false })
    expect(errorDePuerta(error(409, 'ATTENDANCE_ALREADY_REGISTERED', 'La asistencia ya fue registrada a las 12:05.'))).toMatchObject({ tono: 'aviso', titulo: 'Ya registrada' })
    expect(errorDePuerta(error(422, 'VALIDATION_ERROR', 'x', { numeroDocumento: 'El DNI debe tener 8 dígitos' }))).toMatchObject({ tono: 'error', detalle: 'El DNI debe tener 8 dígitos' })
    expect(errorDePuerta(error(500, 'ERROR'))).toMatchObject({ tono: 'error', titulo: 'No se pudo registrar' })
  })

  it('quien no es congresista con el pago aprobado se rechaza con el motivo (backend 030)', () => {
    const error = (code: string, message: string) => ({ status: 422, data: { code, message } })
    expect(errorDePuerta(error('CONGRESS_REGISTRATION_NOT_FOUND', 'El documento no está entre los inscritos al congreso.')))
      .toMatchObject({ tono: 'error', titulo: 'No está inscrito al congreso', detalle: 'El documento no está entre los inscritos al congreso.', pideNombres: false })
    expect(errorDePuerta(error('CONGRESS_PAYMENT_PENDING', 'Pago pendiente.'))).toMatchObject({ tono: 'error', titulo: 'Pago del congreso pendiente' })
    expect(errorDePuerta(error('CONGRESS_REGISTRATION_REJECTED', 'Rechazada.'))).toMatchObject({ tono: 'error', titulo: 'Inscripción al congreso rechazada' })
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

const persona = (datos: Partial<PersonaResumen> = {}): PersonaResumen => ({
  asistenteId: 1,
  asistente: { id: 1, tipoDocumento: 'dni', numeroDocumento: '12345678', nombres: 'Ana María', apellidos: 'Pérez', correo: 'ana@gmail.com', celular: null, procedencia: null },
  ponencias: 2, asistencias: 0, validada: false, avisadoEn: null, situacion: 'NO_INSCRITO', congreso: null, puede: false, ...datos,
})

describe('resumen por persona: filtros', () => {
  it('lee la query y descarta los valores inválidos', () => {
    expect(filtrosResumenDesdeQuery({ situacion: 'RECHAZADO', puede: 'no', validacion: 'si', modo: 'VIRTUAL', aviso: 'no', q: 'ana', page: '3' }))
      .toEqual({ situacion: 'RECHAZADO', puede: 'no', validacion: 'si', modo: 'VIRTUAL', aviso: 'no', q: 'ana', page: 3 })
    expect(filtrosResumenDesdeQuery({ situacion: 'X', puede: 'tal vez', modo: 'HIBRIDO', aviso: 1, page: '-2', q: 5 })).toEqual(FILTROS_RESUMEN_VACIOS)
    expect(filtrosResumenDesdeQuery({ q: 'x'.repeat(300) }).q).toHaveLength(100)
  })

  it('arma los parámetros solo con lo que tiene valor y la página si no es la primera', () => {
    expect(parametrosResumen({ ...FILTROS_RESUMEN_VACIOS })).toEqual({})
    expect(parametrosResumen({ ...FILTROS_RESUMEN_VACIOS, puede: 'no', q: ' ana ', page: 2 })).toEqual({ puede: 'no', q: 'ana', page: '2' })
    expect(parametrosResumen({ ...FILTROS_RESUMEN_VACIOS, puede: 'no', page: 2 }, false)).toEqual({ puede: 'no' })
    expect(hayFiltrosResumen({ ...FILTROS_RESUMEN_VACIOS, page: 4 })).toBe(false)
    expect(hayFiltrosResumen({ ...FILTROS_RESUMEN_VACIOS, aviso: 'si' })).toBe(true)
  })

  it('la descarga lleva los mismos filtros pero no la página', () => {
    expect(rutaDescargaResumen(7, FILTROS_RESUMEN_VACIOS)).toBe('events/7/specialized-talk-attendees/export')
    expect(rutaDescargaResumen(7, { ...FILTROS_RESUMEN_VACIOS, puede: 'no', q: 'pérez', page: 3 })).toBe('events/7/specialized-talk-attendees/export?puede=no&q=p%C3%A9rez')
  })
})

describe('resumen por persona: situación y selección', () => {
  it('etiqueta cada situación y no se rompe con una desconocida', () => {
    expect(situacionDeResumen('APROBADO')).toMatchObject({ etiqueta: 'Pago aprobado', tono: 'ok' })
    expect(situacionDeResumen('PAGO_PENDIENTE').tono).toBe('warn')
    expect(situacionDeResumen('NO_INSCRITO').tono).toBe('error')
    expect(situacionDeResumen('NUEVA')).toMatchObject({ etiqueta: 'NUEVA', tono: 'neutral' })
  })

  it('dice «Puede (acceso libre)» cuando puede sin tener el pago aprobado', () => {
    expect(textoPuede(persona({ puede: false }))).toBe('No puede')
    expect(textoPuede(persona({ puede: true, situacion: 'APROBADO' }))).toBe('Puede')
    expect(textoPuede(persona({ puede: true, situacion: 'NO_INSCRITO' }))).toBe('Puede (acceso libre)')
  })

  it('solo se elige a quien no puede asistir', () => {
    const sin = persona({ asistenteId: 1 })
    const con = persona({ asistenteId: 2, puede: true, situacion: 'APROBADO' })
    expect(esSeleccionable(sin)).toBe(true)
    expect(esSeleccionable(con)).toBe(false)
    expect(Object.keys(alternarSeleccion({}, [sin, con], true))).toEqual(['1'])
  })

  it('marcar y desmarcar conserva a las demás personas elegidas', () => {
    const a = persona({ asistenteId: 1 })
    const b = persona({ asistenteId: 2 })
    const c = persona({ asistenteId: 3 })
    const inicial = alternarSeleccion({}, [a], true)
    const con = alternarSeleccion(inicial, [b, c], true)
    expect(Object.keys(con)).toEqual(['1', '2', '3'])
    expect(Object.keys(alternarSeleccion(con, [b], false))).toEqual(['1', '3'])
    expect(inicial).toEqual({ 1: a })
  })

  it('sabe si tiene correo', () => {
    expect(conCorreo(persona())).toBe(true)
    expect(conCorreo(persona({ asistente: { ...persona().asistente, correo: '  ' } }))).toBe(false)
    expect(conCorreo(persona({ asistente: { ...persona().asistente, correo: null } }))).toBe(false)
  })

  it('resume los nombres con «y N más»', () => {
    expect(listaDeNombres(['Ana', 'Luis'])).toBe('Ana, Luis')
    expect(listaDeNombres(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe('A, B, C, D, E y 2 más')
  })
})

describe('resumen por persona: comunicado', () => {
  it('propone un texto distinto al cancelar y al solo avisar, con {nombre} y el evento', () => {
    const cancelar = comunicadoPropuesto('cancelar', 'CIISIC 2026')
    const avisar = comunicadoPropuesto('avisar', 'CIISIC 2026')
    expect(cancelar.mensaje).toContain('{nombre}')
    expect(cancelar.mensaje).toContain('CIISIC 2026')
    expect(cancelar.asunto).toContain('cancelada')
    expect(avisar.asunto).not.toContain('cancelada')
    expect(avisar.mensaje).not.toBe(cancelar.mensaje)
    expect(comunicadoPropuesto('avisar', null).mensaje).toContain('el congreso')
    for (const texto of [cancelar, avisar]) {
      expect(texto.asunto.length).toBeLessThanOrEqual(150)
      expect(texto.mensaje.length).toBeLessThanOrEqual(3000)
    }
  })

  it('exige asunto y mensaje solo si se va a enviar', () => {
    const vacio = { asunto: ' ', mensaje: '', notificar: true }
    expect(Object.keys(validarComunicado(vacio, 'avisar')).sort()).toEqual(['asunto', 'mensaje'])
    expect(Object.keys(validarComunicado(vacio, 'cancelar')).sort()).toEqual(['asunto', 'mensaje'])
    expect(validarComunicado({ ...vacio, notificar: false }, 'cancelar')).toEqual({})
    expect(validarComunicado({ asunto: 'x'.repeat(151), mensaje: 'y'.repeat(3001), notificar: true }, 'avisar')).toEqual({
      asunto: 'El asunto admite hasta 150 caracteres.',
      mensaje: 'El mensaje admite hasta 3000 caracteres.',
    })
    expect(validarComunicado({ asunto: 'Aviso', mensaje: 'Hola', notificar: true }, 'avisar')).toEqual({})
  })

  it('arma el cuerpo: sin correo no manda asunto ni mensaje', () => {
    const form = { asunto: ' Asunto ', mensaje: ' Hola {nombre} ', notificar: true }
    expect(cuerpoComunicado('cancelar', [3, 4], form)).toEqual({ asistenteIds: [3, 4], notificar: true, asunto: 'Asunto', mensaje: 'Hola {nombre}' })
    expect(cuerpoComunicado('cancelar', [3], { ...form, notificar: false })).toEqual({ asistenteIds: [3], notificar: false })
    expect(cuerpoComunicado('avisar', [3], form)).toEqual({ asistenteIds: [3], asunto: 'Asunto', mensaje: 'Hola {nombre}' })
  })

  it('cuenta lo hecho, los correos y las personas omitidas con su motivo', () => {
    const lineas = resumenDeResultado('cancelar', {
      personas: 3,
      inscripciones: 4,
      omitidas: [{ asistenteId: 8, motivo: 'PUEDE_ASISTIR' }, { asistenteId: 9, motivo: 'YA_ASISTIO' }, { asistenteId: 10, motivo: 'YA_ASISTIO' }],
      avisos: { enviados: 2, sinCorreo: 1, fallidos: 0, sinCredencial: false },
    }).map((l) => l.texto)
    expect(lineas).toEqual([
      'Se cancelaron 4 inscripciones de 3 personas.',
      'Correo enviado a 2 personas.',
      '1 persona no tiene correo registrado: avísales por otro medio.',
      'Se omitió a 1 persona: ahora sí puede asistir (su pago ya está aprobado).',
      'Se omitió a 2 personas: ya asistió a una ponencia.',
    ])
  })

  it('avisa si no hay credencial o si un correo falló, y si no se canceló nada', () => {
    const sinCredencial = resumenDeResultado('cancelar', { personas: 1, inscripciones: 1, omitidas: [], avisos: { enviados: 0, sinCorreo: 0, fallidos: 0, sinCredencial: true } })
    expect(sinCredencial.map((l) => l.tono)).toEqual(['ok', 'error'])
    expect(sinCredencial[0]?.texto).toBe('Se canceló 1 inscripción de 1 persona.')
    const fallo = resumenDeResultado('avisar', { personas: 2, omitidas: [], avisos: { enviados: 1, sinCorreo: 0, fallidos: 1, sinCredencial: false } })
    expect(fallo.map((l) => l.tono)).toEqual(['ok', 'error'])
    expect(fallo[1]?.texto).toContain('La cancelación sí se guardó')
    expect(resumenDeResultado('cancelar', { personas: 0, inscripciones: 0, omitidas: [{ asistenteId: 1, motivo: 'NO_ENCONTRADA' }], avisos: null }).map((l) => l.texto)).toEqual([
      'No se canceló ninguna inscripción.',
      'Se omitió a 1 persona: ya no tiene inscripciones vigentes.',
    ])
  })

  it('el motivo SIN_CONGRESO se ve en las inscripciones canceladas', () => {
    expect(etiquetaMotivoCancelacion('SIN_CONGRESO')).toBe('Cancelada: sin inscripción aprobada al congreso')
  })
})
