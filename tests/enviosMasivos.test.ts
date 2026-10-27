import { describe, expect, it, vi } from 'vitest'
import {
  alternarDestinatarios,
  claveEnlaceVirtual,
  cuerpoMensajePonencias,
  cuerpoMensajeVirtual,
  dividirEnTandas,
  enviarPorTandas,
  esEnlaceDeAcceso,
  FILTROS_ENVIO_VACIOS,
  filtrosEnvioDesdeQuery,
  hayFiltrosEnvio,
  idsElegidos,
  LARGO_ASUNTO,
  LARGO_ENLACE,
  LARGO_MENSAJE,
  mensajePonenciasPropuesto,
  mensajeVirtualPropuesto,
  parametrosEnvio,
  parrafosDelMensaje,
  RESULTADO_ENVIO_VACIO,
  resumenDeEnvio,
  rutaEnvio,
  seleccionDeIds,
  sumarResultados,
  TEXTOS_CANAL,
  TEXTO_BOTON_VIRTUAL,
  tipoDelDestinatario,
  todasMarcadas,
  validarMensajePonencias,
  validarMensajeVirtual,
  type EnvioPorTandas,
  type ResultadoEnvio,
} from '~/utils/enviosMasivos'

const resultado = (cambios: Partial<ResultadoEnvio> = {}): ResultadoEnvio => ({ ...RESULTADO_ENVIO_VACIO, ...cambios })

describe('envíos masivos: rutas del backend', () => {
  it('cada canal tiene su segmento y sus acciones', () => {
    expect(rutaEnvio(2, 'credencial', 'lista')).toBe('events/2/credential-links')
    expect(rutaEnvio(2, 'credencial', 'ids')).toBe('events/2/credential-links/ids')
    expect(rutaEnvio(2, 'credencial', 'enviar')).toBe('events/2/credential-links/send')
    expect(rutaEnvio(2, 'ponencias', 'lista')).toBe('events/2/specialized-talk-invitations')
    expect(rutaEnvio(2, 'ponencias', 'enviar')).toBe('events/2/specialized-talk-invitations/send')
    expect(rutaEnvio(2, 'ponencias', 'probar')).toBe('events/2/specialized-talk-invitations/test')
    expect(rutaEnvio(2, 'virtual', 'lista')).toBe('events/2/virtual-access')
    expect(rutaEnvio(2, 'virtual', 'ids')).toBe('events/2/virtual-access/ids')
    expect(rutaEnvio(2, 'virtual', 'enviar')).toBe('events/2/virtual-access/send')
    expect(rutaEnvio(2, 'virtual', 'probar')).toBe('events/2/virtual-access/test')
  })
})

describe('envíos masivos: filtros', () => {
  it('se leen de la URL con tolerancia: lo desconocido queda vacío', () => {
    expect(filtrosEnvioDesdeQuery({})).toEqual(FILTROS_ENVIO_VACIOS)
    expect(filtrosEnvioDesdeQuery({ q: '  ana  ', enviado: 'no', page: '3' })).toEqual({ q: 'ana', enviado: 'no', page: 3 })
    expect(filtrosEnvioDesdeQuery({ enviado: 'quizas', page: '-2' })).toEqual(FILTROS_ENVIO_VACIOS)
    expect(filtrosEnvioDesdeQuery({ q: ['a', 'b'], page: 'x' }).q).toBe('a')
    expect(filtrosEnvioDesdeQuery({ q: 'x'.repeat(300) }).q).toHaveLength(100)
  })

  it('los parámetros llevan solo lo que tiene valor; la página 1 no se escribe', () => {
    expect(parametrosEnvio(FILTROS_ENVIO_VACIOS)).toEqual({})
    expect(parametrosEnvio({ q: ' ana ', enviado: 'no', page: 2 })).toEqual({ q: 'ana', enviado: 'no', page: 2 })
    expect(parametrosEnvio({ q: '', enviado: 'si', page: 4 }, false)).toEqual({ enviado: 'si' })
  })

  it('detecta si hay filtros (la página no cuenta)', () => {
    expect(hayFiltrosEnvio(FILTROS_ENVIO_VACIOS)).toBe(false)
    expect(hayFiltrosEnvio({ q: '', enviado: '', page: 5 })).toBe(false)
    expect(hayFiltrosEnvio({ q: 'ana', enviado: '', page: 1 })).toBe(true)
    expect(hayFiltrosEnvio({ q: '  ', enviado: 'no', page: 1 })).toBe(true)
  })
})

describe('envíos masivos: selección', () => {
  it('marca y desmarca sin tocar a las demás ni modificar la original', () => {
    const base = seleccionDeIds([1, 2])
    const con = alternarDestinatarios(base, [3, 4], true)
    expect(idsElegidos(con).sort()).toEqual([1, 2, 3, 4])
    expect(idsElegidos(base)).toEqual([1, 2])
    expect(idsElegidos(alternarDestinatarios(con, [1, 3], false)).sort()).toEqual([2, 4])
  })

  it('«todas marcadas» pide a todas las filas de la página (y una página vacía no cuenta)', () => {
    const filas = [{ id: 1 }, { id: 2 }]
    expect(todasMarcadas(seleccionDeIds([1, 2, 9]), filas)).toBe(true)
    expect(todasMarcadas(seleccionDeIds([1]), filas)).toBe(false)
    expect(todasMarcadas(seleccionDeIds([1]), [])).toBe(false)
  })
})

describe('envíos masivos: por tandas', () => {
  it('divide en tandas del tamaño pedido y conserva el orden', () => {
    expect(dividirEnTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(dividirEnTandas([], 25)).toEqual([])
    expect(dividirEnTandas(Array.from({ length: 60 }, (_, i) => i), 25).map(t => t.length)).toEqual([25, 25, 10])
    // Un tamaño inválido no cuelga el bucle
    expect(dividirEnTandas([1, 2], 0)).toEqual([[1], [2]])
  })

  it('suma los resultados de cada tanda', () => {
    expect(sumarResultados(resultado({ enviados: 20, fallidos: 1 }), resultado({ enviados: 5, yaEnviados: 2, noElegibles: 1 })))
      .toEqual({ enviados: 25, yaEnviados: 2, noElegibles: 1, fallidos: 1 })
  })

  it('envía una tanda a la vez, en orden, avisa el avance y suma lo que responde el servidor', async () => {
    const tandas: number[][] = []
    const avance = vi.fn()
    const envio = await enviarPorTandas({
      ids: [1, 2, 3, 4, 5],
      tamano: 2,
      enviar: async (tanda) => { tandas.push(tanda); return resultado({ enviados: tanda.length }) },
      alAvanzar: avance,
    })
    expect(tandas).toEqual([[1, 2], [3, 4], [5]])
    expect(envio).toEqual({ resultado: resultado({ enviados: 5 }), hechas: 5, corte: null })
    expect(avance.mock.calls.map(([progreso]) => progreso.hechas)).toEqual([0, 2, 4, 5])
    expect(avance).toHaveBeenLastCalledWith({ hechas: 5, total: 5 })
  })

  it('si una petición falla corta ahí, conserva lo logrado y no lanza', async () => {
    const error = new Error('409 LANDING_URL_MISSING')
    const enviar = vi.fn()
      .mockResolvedValueOnce(resultado({ enviados: 2 }))
      .mockRejectedValueOnce(error)
    const envio = await enviarPorTandas({ ids: [1, 2, 3, 4, 5, 6], tamano: 2, enviar })
    expect(enviar).toHaveBeenCalledTimes(2)
    expect(envio.resultado).toEqual(resultado({ enviados: 2 }))
    expect(envio.hechas).toBe(2)
    expect(envio.corte).toEqual({ tipo: 'error', error })
  })

  it('«detener» corta entre tanda y tanda sin perder lo ya enviado', async () => {
    let detener = false
    const enviar = vi.fn(async (tanda: number[]) => { detener = true; return resultado({ enviados: tanda.length }) })
    const envio = await enviarPorTandas({ ids: [1, 2, 3, 4], tamano: 2, enviar, detener: () => detener })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(envio).toEqual({ resultado: resultado({ enviados: 2 }), hechas: 2, corte: { tipo: 'detenido' } })
  })

  it('sin personas no manda nada', async () => {
    const enviar = vi.fn()
    expect(await enviarPorTandas({ ids: [], enviar })).toEqual({ resultado: RESULTADO_ENVIO_VACIO, hechas: 0, corte: null })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('suma por credencial las tandas, en el orden en que aparecen, y solo agrega las claves cuando aplican', async () => {
    const respuestas = [
      resultado({ enviados: 2, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 2 }] }),
      resultado({ enviados: 2, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 1 }, { credencialId: 3, nombre: 'LORENA', enviados: 1 }] }),
    ]
    const envio = await enviarPorTandas({ ids: [1, 2, 3, 4], tamano: 2, enviar: async () => respuestas.shift()! })
    expect(envio.resultado).toEqual(resultado({
      enviados: 4, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 3 }, { credencialId: 3, nombre: 'LORENA', enviados: 1 }],
    }))
    expect(envio.resultado).not.toHaveProperty('agotado')
    expect(sumarResultados(resultado({ enviados: 1 }), resultado({ enviados: 2 }))).toEqual(resultado({ enviados: 3 }))
  })

  it('si el servidor dice que se agotaron los envíos corta ahí y cuenta solo a quienes alcanzó', async () => {
    const enviar = vi.fn()
      .mockResolvedValueOnce(resultado({ enviados: 25, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 25 }] }))
      .mockResolvedValueOnce(resultado({ enviados: 10, agotado: true, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 10 }] }))
    const avance = vi.fn()
    const envio = await enviarPorTandas({ ids: Array.from({ length: 100 }, (_, i) => i + 1), tamano: 25, enviar, alAvanzar: avance })
    expect(enviar).toHaveBeenCalledTimes(2)
    expect(envio.corte).toEqual({ tipo: 'agotado' })
    expect(envio.hechas).toBe(35)
    expect(envio.resultado).toMatchObject({ enviados: 35, agotado: true, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 35 }] })
    expect(avance).toHaveBeenLastCalledWith({ hechas: 35, total: 100 })
  })

  it('si una tanda entera no salió corta para no insistir con el resto', async () => {
    const enviar = vi.fn()
      .mockResolvedValueOnce(resultado({ enviados: 2 }))
      .mockResolvedValueOnce(resultado({ fallidos: 2 }))
    const envio = await enviarPorTandas({ ids: [1, 2, 3, 4, 5, 6], tamano: 2, enviar })
    expect(enviar).toHaveBeenCalledTimes(2)
    expect(envio.corte).toEqual({ tipo: 'sin-salida' })
    expect(envio.hechas).toBe(4)
    expect(envio.resultado).toEqual(resultado({ enviados: 2, fallidos: 2 }))
  })

  it('una tanda con algunos fallidos y algunos enviados sigue con la siguiente', async () => {
    const enviar = vi.fn().mockResolvedValue(resultado({ enviados: 1, fallidos: 1 }))
    const envio = await enviarPorTandas({ ids: [1, 2, 3, 4], tamano: 2, enviar })
    expect(enviar).toHaveBeenCalledTimes(2)
    expect(envio.corte).toBeNull()
  })
})

describe('envíos masivos: resumen del resultado', () => {
  const envio = (res: ResultadoEnvio, corte: EnvioPorTandas['corte'] = null): EnvioPorTandas => ({ resultado: res, hechas: 0, corte })

  it('cuenta a quién se le envió y a quién se omitió, con su motivo', () => {
    const lineas = resumenDeEnvio(envio(resultado({ enviados: 18, yaEnviados: 3, noElegibles: 1, fallidos: 2 })), null)
    expect(lineas).toEqual([
      { tono: 'ok', texto: 'Correo enviado a 18 personas.' },
      { tono: 'warn', texto: 'Se omitió a 3 personas que ya lo habían recibido.' },
      { tono: 'warn', texto: 'Se omitió a 1 persona que ya no cumplen (no están aprobadas o no son presenciales).' },
      { tono: 'error', texto: 'No se pudo enviar a 2 personas: siguen como «Sin enviar» para reintentar.' },
    ])
  })

  it('en el acceso virtual los que no cumplen son los que no son virtuales', () => {
    const lineas = resumenDeEnvio(envio(resultado({ enviados: 2, noElegibles: 1 })), null, 'virtual')
    expect(lineas.at(-1)).toEqual({ tono: 'warn', texto: 'Se omitió a 1 persona que ya no cumplen (no están aprobadas o no son virtuales).' })
  })

  it('con una sola persona usa el singular y sin envíos lo dice', () => {
    expect(resumenDeEnvio(envio(resultado({ enviados: 1 })), null)).toEqual([{ tono: 'ok', texto: 'Correo enviado a 1 persona.' }])
    expect(resumenDeEnvio(envio(resultado()), null)).toEqual([{ tono: 'warn', texto: 'No se envió ningún correo.' }])
  })

  it('si se cortó por un error o por la persona, lo explica y dice que lo que faltó sigue sin enviar', () => {
    const porError = resumenDeEnvio(envio(resultado({ enviados: 5 }), { tipo: 'error', error: new Error('x') }), 'Falta la URL de la landing.')
    expect(porError.at(-1)).toMatchObject({ tono: 'error' })
    expect(porError.at(-1)!.texto).toContain('Falta la URL de la landing.')
    expect(porError.at(-1)!.texto).toContain('sigue como «Sin enviar»')
    // El mensaje del servidor ya termina en punto: no se duplica
    expect(porError.at(-1)!.texto).not.toContain('..')
    const detenido = resumenDeEnvio(envio(resultado({ enviados: 5 }), { tipo: 'detenido' }), null)
    expect(detenido.at(-1)).toEqual({ tono: 'warn', texto: 'Detuviste el envío. Lo que faltó sigue como «Sin enviar».' })
  })

  it('dice cuántos salieron por cada credencial', () => {
    const lineas = resumenDeEnvio(envio(resultado({ enviados: 320, porCredencial: [{ credencialId: 1, nombre: 'ANGEL', enviados: 295 }, { credencialId: 3, nombre: 'LORENA', enviados: 25 }] })), null)
    expect(lineas).toEqual([
      { tono: 'ok', texto: 'Correo enviado a 320 personas.' },
      { tono: 'ok', texto: 'Salieron por ANGEL (295) y LORENA (25).' },
    ])
    // Sin el dato (un backend anterior) el resumen es el de siempre
    expect(resumenDeEnvio(envio(resultado({ enviados: 3 })), null)).toEqual([{ tono: 'ok', texto: 'Correo enviado a 3 personas.' }])
  })

  it('si se agotaron los envíos o una tanda no salió, lo explica y dice qué hacer', () => {
    const agotado = resumenDeEnvio(envio(resultado({ enviados: 295, agotado: true }), { tipo: 'agotado' }), null)
    expect(agotado.at(-1)).toMatchObject({ tono: 'error' })
    expect(agotado.at(-1)!.texto).toContain('No quedan envíos en ninguna credencial de correo activa')
    expect(agotado.at(-1)!.texto).toContain('sigue como «Sin enviar»')
    const sinSalida = resumenDeEnvio(envio(resultado({ fallidos: 25 }), { tipo: 'sin-salida' }), null)
    expect(sinSalida.at(-1)!.texto).toContain('Ninguno de los últimos correos salió')
  })
})

describe('envíos masivos: mensaje de las ponencias', () => {
  it('el texto propuesto menciona el evento, el botón y el DNI, y no personaliza', () => {
    const { asunto, mensaje } = mensajePonenciasPropuesto('VIII CIISIC 2026')
    expect(asunto).toContain('VIII CIISIC 2026')
    expect(mensaje).toContain('VIII CIISIC 2026')
    expect(mensaje).toMatch(/botón de abajo/i)
    expect(mensaje).toMatch(/DNI/)
    expect(mensaje).not.toContain('{nombre}')
    expect(mensajePonenciasPropuesto(null).asunto).toContain('el congreso')
    expect(validarMensajePonencias(mensajePonenciasPropuesto('VIII CIISIC 2026'))).toEqual({})
  })

  it('valida los mismos largos que el backend', () => {
    expect(validarMensajePonencias({ asunto: '', mensaje: '' })).toEqual({ asunto: 'Escribe el asunto del correo.', mensaje: 'Escribe el mensaje.' })
    expect(validarMensajePonencias({ asunto: 'ab', mensaje: 'corto' })).toMatchObject({ asunto: expect.stringContaining(String(LARGO_ASUNTO.minimo)), mensaje: expect.stringContaining(String(LARGO_MENSAJE.minimo)) })
    expect(validarMensajePonencias({ asunto: 'x'.repeat(151), mensaje: 'y'.repeat(3001) })).toMatchObject({ asunto: expect.stringContaining('150'), mensaje: expect.stringContaining('3000') })
    expect(validarMensajePonencias({ asunto: '  ', mensaje: '   ' })).toHaveProperty('asunto')
    expect(validarMensajePonencias({ asunto: 'Asunto', mensaje: 'Un mensaje largo.' })).toEqual({})
  })

  it('el cuerpo recorta los espacios y los párrafos se separan por líneas en blanco', () => {
    expect(cuerpoMensajePonencias({ asunto: '  Asunto  ', mensaje: '\n Hola \n\n\n Chau \n' })).toEqual({ asunto: 'Asunto', mensaje: 'Hola \n\n\n Chau' })
    expect(parrafosDelMensaje('Hola\nlínea 2\n\n\nChau\n\n  ')).toEqual(['Hola\nlínea 2', 'Chau'])
  })
})

describe('envíos masivos: acceso de los inscritos virtuales', () => {
  const valido = { asunto: 'Tu acceso al congreso', mensaje: 'Entra con el botón de abajo.', enlace: 'https://meet.example.com/sala' }

  it('el texto propuesto menciona el evento y el botón, no personaliza y deja el enlace vacío para quien envía', () => {
    const { asunto, mensaje, enlace } = mensajeVirtualPropuesto('VIII CIISIC 2026')
    expect(asunto).toContain('VIII CIISIC 2026')
    expect(mensaje).toContain('VIII CIISIC 2026')
    expect(mensaje).toMatch(/botón de abajo/i)
    expect(mensaje).not.toContain('{nombre}')
    expect(enlace).toBe('')
    expect(mensajeVirtualPropuesto(null).asunto).toContain('el congreso')
  })

  it('no se puede enviar sin enlace; con él, el texto propuesto es válido', () => {
    expect(validarMensajeVirtual(mensajeVirtualPropuesto('VIII CIISIC 2026'))).toEqual({ enlace: 'Escribe el enlace para ingresar al congreso.' })
    expect(validarMensajeVirtual({ ...mensajeVirtualPropuesto('VIII CIISIC 2026'), enlace: 'https://meet.example.com/sala' })).toEqual({})
  })

  it('valida el asunto y el mensaje con los mismos largos de las ponencias', () => {
    expect(validarMensajeVirtual({ asunto: 'ab', mensaje: 'corto', enlace: valido.enlace })).toMatchObject({
      asunto: expect.stringContaining(String(LARGO_ASUNTO.minimo)),
      mensaje: expect.stringContaining(String(LARGO_MENSAJE.minimo)),
    })
  })

  it.each([
    ['https://meet.example.com/sala', true],
    ['  https://us02web.zoom.us/j/123456789?pwd=AbC  ', true],
    ['http://meet.example.com/sala', false],
    ['javascript:alert(1)', false],
    ['data:text/html,hola', false],
    ['//meet.example.com/sala', false],
    ['meet.example.com/sala', false],
    ['https://usuario:clave@meet.example.com/sala', false],
    ['https://localhost/sala', false],
    ['https://meet.example.com/sala con espacio', false],
    ['', false],
  ])('el enlace %j es válido: %s', (enlace, esperado) => {
    expect(esEnlaceDeAcceso(enlace)).toBe(esperado)
    expect(Boolean(validarMensajeVirtual({ ...valido, enlace }).enlace)).toBe(!esperado)
  })

  it('rechaza un enlace de más de 500 caracteres (el límite del backend)', () => {
    expect(esEnlaceDeAcceso(`https://meet.example.com/${'a'.repeat(LARGO_ENLACE)}`)).toBe(false)
    expect(esEnlaceDeAcceso(`https://meet.example.com/${'a'.repeat(LARGO_ENLACE - 40)}`)).toBe(true)
  })

  it('el cuerpo recorta los espacios de todo, también del enlace', () => {
    expect(cuerpoMensajeVirtual({ asunto: '  Asunto  ', mensaje: ' Hola ', enlace: '  https://meet.example.com/sala \n' })).toEqual({
      asunto: 'Asunto', mensaje: 'Hola', enlace: 'https://meet.example.com/sala',
    })
  })

  it('el botón y los textos del canal hablan de virtuales y la clave del enlace es de cada evento', () => {
    expect(TEXTO_BOTON_VIRTUAL).toBe('Ingresar al congreso')
    expect(TEXTOS_CANAL.virtual).toMatchObject({ inscritos: 'Inscritos virtuales', columna: 'Acceso enviado' })
    expect(TEXTOS_CANAL.credencial.inscritos).toBe('Inscritos presenciales')
    expect(claveEnlaceVirtual(2)).not.toBe(claveEnlaceVirtual(3))
  })
})

describe('envíos masivos: presentación', () => {
  it('el tipo une nombre, etiqueta y clasificación sin repetir; sin nada es una cortesía', () => {
    expect(tipoDelDestinatario({ tipo: { nombre: 'ESTUDIANTES', etiqueta: 'CON KIT' }, clasificacion: 'ESTUDIANTE - IV CICLO' })).toBe('ESTUDIANTES · CON KIT · ESTUDIANTE - IV CICLO')
    expect(tipoDelDestinatario({ tipo: { nombre: 'CON KIT', etiqueta: 'CON KIT' }, clasificacion: null })).toBe('CON KIT')
    expect(tipoDelDestinatario({ tipo: null, clasificacion: null })).toBe('Cortesía')
  })
})
