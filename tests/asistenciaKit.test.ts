import { describe, expect, it } from 'vitest'
import {
  CIERRE_EXITO_MS,
  CIERRE_KIT_ENTREGADO_MS,
  CIERRE_YA_REGISTRADA_MS,
  datosDeYaRegistrada,
  esperaContinuar,
  kitPorEntregar,
  kitPorEntregarDe,
  pausaLaCamara,
  personaDe,
  registroDeResultado,
  resultadoConKitEntregado,
  resultadoDeError,
  resultadoDeMarca,
  textoDeResultado,
  textoMarca,
  TITULO_QR_LEGADO,
  type MarcaAsistencia,
  type TipoInscripcionMarca,
} from '~/utils/asistencia'
import { aErrorApi } from '~/utils/errores'
import type { KitEstado } from '~/types/api'

/**
 * Entrega del kit en el escáner y en la pantalla Asistencia (spec 037 del backend; spec 028 del panel): el resultado
 * dice si la persona lleva kit, no se cierra solo mientras falta entregarlo y «ya registrada» trae a la persona.
 */

const MARCA: MarcaAsistencia = {
  id: 3,
  registradoEn: '2026-10-26T14:05:00.000Z',
  metodo: 'QR',
  esFueraDeHorario: false,
  alerta: null,
  participante: { id: 100, nombres: 'ANA', apellidos: 'PÉREZ GARCÍA', tipoDocumento: 'dni', numeroDocumento: '70001234', foto: { tiene: true } },
  inscripcion: { id: 500, tipoInscripcion: { nombre: 'ESTUDIANTES', etiqueta: 'CON KIT' } },
}

const KIT_PENDIENTE: KitEstado = { incluye: true, entregado: false, entregadoEn: null, entregadoPor: null }
const KIT_ENTREGADO: KitEstado = { incluye: true, entregado: true, entregadoEn: '2026-10-26T15:32:00.000Z', entregadoPor: { id: 41, nombres: 'Rosa', apellidos: 'Quispe' } }
const SIN_KIT: KitEstado = { incluye: false, entregado: false, entregadoEn: null, entregadoPor: null }
const TIPO_CON_KIT: TipoInscripcionMarca = { nombre: 'ESTUDIANTES', etiqueta: 'CON KIT', modalidad: 'PRESENCIAL', incluyeKit: true }

const conKit = (kit: KitEstado, tipo: TipoInscripcionMarca | null = TIPO_CON_KIT): MarcaAsistencia => ({
  ...MARCA,
  inscripcion: { id: 500, tipoInscripcion: tipo, kit },
})

describe('kit: resultado de la marca', () => {
  it('con kit pendiente no se cierra solo: espera «Entregar kit» o «Continuar» y pausa la cámara', () => {
    const resultado = resultadoDeMarca(conKit(KIT_PENDIENTE))
    expect(resultado).toMatchObject({ tono: 'exito', titulo: 'Asistencia registrada', cierraEnMs: null })
    expect(resultado.persona).toMatchObject({ inscripcionId: 500, estadoKit: 'PENDIENTE', kit: KIT_PENDIENTE })
    expect(esperaContinuar(resultado)).toBe(true)
    expect(pausaLaCamara(resultado)).toBe(true)
    expect(kitPorEntregar(resultado)).toBe(true)
    expect(resultado.verificaDni).toBeUndefined()
  })

  it('con el kit ya entregado se cierra como siempre y lo dice', () => {
    const resultado = resultadoDeMarca(conKit(KIT_ENTREGADO))
    expect(resultado).toMatchObject({ tono: 'exito', cierraEnMs: CIERRE_EXITO_MS })
    expect(resultado.persona?.estadoKit).toBe('ENTREGADO')
    expect(esperaContinuar(resultado)).toBe(false)
    expect(kitPorEntregar(resultado)).toBe(false)
  })

  it('un tipo sin kit se muestra «Sin kit» y se cierra como siempre', () => {
    const resultado = resultadoDeMarca(conKit(SIN_KIT, { nombre: 'ESTUDIANTES', etiqueta: 'SIN KIT', modalidad: 'PRESENCIAL', incluyeKit: false }))
    expect(resultado.persona?.estadoKit).toBe('SIN_KIT')
    expect(resultado.cierraEnMs).toBe(CIERRE_EXITO_MS)
  })

  it('con un backend anterior (sin kit) todo queda como antes', () => {
    const resultado = resultadoDeMarca(MARCA)
    expect(resultado.persona).toMatchObject({ kit: null, estadoKit: 'NO_APLICA' })
    expect(resultado.cierraEnMs).toBe(CIERRE_EXITO_MS)
    expect(kitPorEntregar(resultado)).toBe(false)
  })

  it('el QR anterior sigue pidiendo verificar el DNI, también con el kit pendiente', () => {
    const resultado = resultadoDeMarca({ ...conKit(KIT_PENDIENTE), metodo: 'QR_LEGADO', alerta: 'QR_LEGADO' })
    expect(resultado).toMatchObject({ tono: 'alerta', titulo: TITULO_QR_LEGADO, cierraEnMs: null, verificaDni: true })
    expect(resultado.persona?.estadoKit).toBe('PENDIENTE')
    expect(esperaContinuar(resultado)).toBe(true)
  })

  it('«Entregar kit» deja el resultado con el kit entregado y se despide pronto', () => {
    const pendiente = resultadoDeMarca(conKit(KIT_PENDIENTE))
    const despues = resultadoConKitEntregado(pendiente, KIT_ENTREGADO)
    expect(despues.persona).toMatchObject({ estadoKit: 'ENTREGADO', kit: KIT_ENTREGADO, inscripcionId: 500 })
    expect(despues.cierraEnMs).toBe(CIERRE_KIT_ENTREGADO_MS)
    expect(esperaContinuar(despues)).toBe(false)
    expect(despues.titulo).toBe(pendiente.titulo)
    // No toca el resultado original
    expect(pendiente.persona?.estadoKit).toBe('PENDIENTE')
  })

  it('con el QR anterior, entregar el kit no cierra el aviso: falta comparar el DNI', () => {
    const legado = resultadoDeMarca({ ...conKit(KIT_PENDIENTE), metodo: 'QR_LEGADO', alerta: 'QR_LEGADO' })
    const despues = resultadoConKitEntregado(legado, KIT_ENTREGADO)
    expect(despues).toMatchObject({ tono: 'alerta', titulo: TITULO_QR_LEGADO, mensaje: legado.mensaje, cierraEnMs: null })
    expect(esperaContinuar(despues)).toBe(true)
    expect(despues.persona?.estadoKit).toBe('ENTREGADO')
  })

  it('un «ya registrada» ámbar pasa a verde («Kit entregado») al entregar el kit', () => {
    const ya = resultadoDeError({
      status: 409,
      code: 'ATTENDANCE_ALREADY_REGISTERED',
      message: 'La asistencia ya fue registrada para esta actividad a las 10:05.',
      datos: { participante: MARCA.participante, inscripcion: { id: 500, tipoInscripcion: TIPO_CON_KIT, kit: KIT_PENDIENTE } },
    })
    expect(ya.tono).toBe('alerta')
    const despues = resultadoConKitEntregado(ya, KIT_ENTREGADO)
    expect(despues).toMatchObject({ tono: 'exito', titulo: 'Kit entregado', mensaje: null, cierraEnMs: CIERRE_KIT_ENTREGADO_MS })
    expect(esperaContinuar(despues)).toBe(false)
  })

  it('un resultado sin persona no cambia al entregar', () => {
    const rechazo = resultadoDeError({ status: 404, code: 'CODE_NOT_FOUND', message: 'x' })
    expect(resultadoConKitEntregado(rechazo, KIT_ENTREGADO)).toBe(rechazo)
  })

  it('el kit se suma a la lista de lecturas y al mensaje de la pantalla Asistencia', () => {
    const pendiente = resultadoDeMarca(conKit(KIT_PENDIENTE))
    expect(registroDeResultado(pendiente, { id: 1, instante: 0, leido: 'Código X', actividad: null }).detalle).toBe('ANA PÉREZ GARCÍA · DNI 70001234 · CON KIT')
    expect(registroDeResultado(resultadoDeMarca(conKit(KIT_ENTREGADO)), { id: 2, instante: 0, leido: null, actividad: null }).detalle).toBe('ANA PÉREZ GARCÍA · DNI 70001234 · KIT ENTREGADO')
    // Sin kit que decir, como antes
    expect(registroDeResultado(resultadoDeMarca(MARCA), { id: 3, instante: 0, leido: null, actividad: null }).detalle).toBe('ANA PÉREZ GARCÍA · DNI 70001234')
    expect(textoMarca(conKit(KIT_PENDIENTE))).toBe('✓ ANA PÉREZ GARCÍA · DNI 70001234 · Con kit · pendiente')
    expect(textoMarca(conKit(KIT_ENTREGADO))).toBe('✓ ANA PÉREZ GARCÍA · DNI 70001234 · Kit entregado')
    expect(textoMarca(MARCA)).toBe('✓ ANA PÉREZ GARCÍA · DNI 70001234')
  })

  it('personaDe lee la misma persona de una marca y de «ya registrada»', () => {
    const persona = personaDe(conKit(KIT_PENDIENTE))
    expect(persona).toEqual({
      nombre: 'ANA PÉREZ GARCÍA',
      documento: 'DNI 70001234',
      tipoInscripcion: 'ESTUDIANTES · CON KIT',
      fotoInscripcionId: 500,
      inscripcionId: 500,
      kit: KIT_PENDIENTE,
      estadoKit: 'PENDIENTE',
    })
    expect(kitPorEntregarDe(persona)).toEqual({ inscripcionId: 500, nombre: 'ANA PÉREZ GARCÍA' })
    expect(kitPorEntregarDe({ ...persona, estadoKit: 'ENTREGADO' })).toBeNull()
    expect(kitPorEntregarDe({ ...persona, inscripcionId: null })).toBeNull()
  })
})

describe('kit: «ya registrada» con la persona y su kit', () => {
  const YA = { status: 409, code: 'ATTENDANCE_ALREADY_REGISTERED', message: 'La asistencia ya fue registrada para esta actividad a las 10:05.' }
  const datos = (kit: unknown) => ({
    participante: { id: 100, nombres: 'ANA', apellidos: 'PÉREZ GARCÍA', tipoDocumento: 'dni', numeroDocumento: '****1234', foto: { tiene: false } },
    inscripcion: { id: 500, tipoInscripcion: TIPO_CON_KIT, kit },
  })

  it('con el kit pendiente muestra a la persona y espera a que se entregue', () => {
    const resultado = resultadoDeError({ ...YA, datos: datos(KIT_PENDIENTE) })
    expect(resultado).toMatchObject({ tono: 'alerta', titulo: 'Ya estaba registrada', mensaje: YA.message, cierraEnMs: null })
    expect(resultado.persona).toMatchObject({ nombre: 'ANA PÉREZ GARCÍA', documento: 'DNI ****1234', inscripcionId: 500, estadoKit: 'PENDIENTE', fotoInscripcionId: null })
    expect(esperaContinuar(resultado)).toBe(true)
    expect(kitPorEntregar(resultado)).toBe(true)
  })

  it('con el kit entregado o sin kit se cierra como antes, mostrando a la persona', () => {
    const entregado = resultadoDeError({ ...YA, datos: datos(KIT_ENTREGADO) })
    expect(entregado.cierraEnMs).toBe(CIERRE_YA_REGISTRADA_MS)
    expect(entregado.persona?.estadoKit).toBe('ENTREGADO')
    const sinKit = resultadoDeError({ ...YA, datos: datos(SIN_KIT) })
    expect(sinKit.cierraEnMs).toBe(CIERRE_YA_REGISTRADA_MS)
    expect(sinKit.persona?.estadoKit).toBe('SIN_KIT')
  })

  it('con un backend anterior (sin datos) es el ámbar de siempre, sin persona', () => {
    const resultado = resultadoDeError(YA)
    expect(resultado).toEqual({ tono: 'alerta', titulo: 'Ya estaba registrada', mensaje: YA.message, persona: null, fueraDeHorario: false, cierraEnMs: CIERRE_YA_REGISTRADA_MS, reintentable: false })
    expect(resultadoDeError({ ...YA, datos: 'raro' }).persona).toBeNull()
  })

  it('datosDeYaRegistrada descarta lo que no tiene la forma de una persona', () => {
    for (const valor of [undefined, null, 'x', 3, {}, { participante: 'x' }, { participante: { nombres: 'A' } }, { participante: { nombres: 'A', apellidos: 'B' } }]) {
      expect(datosDeYaRegistrada(valor)).toBeNull()
    }
    // Sin una inscripción válida la persona se lee igual, sin kit
    const sinInscripcion = datosDeYaRegistrada({ participante: datos(null).participante, inscripcion: { id: 'x' } })
    expect(sinInscripcion).not.toBeNull()
    expect(sinInscripcion).not.toHaveProperty('inscripcion')
    expect(personaDe(sinInscripcion as NonNullable<typeof sinInscripcion>)).toMatchObject({ inscripcionId: null, kit: null, estadoKit: 'NO_APLICA' })
  })

  it('la pantalla Asistencia lo dice en una línea: mensaje, persona y kit', () => {
    const resultado = resultadoDeError({ ...YA, datos: datos(KIT_PENDIENTE) })
    expect(textoDeResultado(resultado)).toBe(`${YA.message} · ANA PÉREZ GARCÍA · Con kit · pendiente`)
    expect(textoDeResultado(resultadoDeError(YA))).toBe(YA.message)
    expect(textoDeResultado({ titulo: 'Fuera del horario', mensaje: null, persona: null })).toBe('Fuera del horario')
  })

  it('aErrorApi lleva los datos de un error del backend (cuerpo tal cual) y no se confunde con el cuerpo anidado del BFF', () => {
    const cuerpo = { success: false, code: 'ATTENDANCE_ALREADY_REGISTERED', message: YA.message, data: datos(null) }
    const e = aErrorApi({ status: 409, data: cuerpo })
    expect(e.code).toBe('ATTENDANCE_ALREADY_REGISTERED')
    expect(e.datos).toEqual(datos(null))
    // Un error del BFF (createError) anida el cuerpo en `data` y no trae datos
    const bff = aErrorApi({ statusCode: 403, data: { data: { code: 'CSRF_ORIGIN', message: 'Origen no permitido' } } })
    expect(bff.code).toBe('CSRF_ORIGIN')
    expect(bff).not.toHaveProperty('datos')
    expect(aErrorApi({ status: 404, data: { success: false, code: 'CODE_NOT_FOUND', message: 'x' } })).not.toHaveProperty('datos')
  })
})

describe('virtuales: la asistencia se rechaza (spec 037 del backend)', () => {
  it('rojo, con su título y el mensaje del panel, sin cerrarse solo ni ofrecer reintentar', () => {
    const e = aErrorApi({ status: 403, data: { success: false, code: 'VIRTUAL_REGISTRATION', message: 'texto del servidor' } })
    expect(e.message).toBe('La inscripción es virtual: no registra asistencia presencial. Recibe el enlace de la transmisión por correo.')
    const resultado = resultadoDeError(e)
    expect(resultado).toMatchObject({ tono: 'error', titulo: 'Inscripción virtual', mensaje: e.message, persona: null, cierraEnMs: null, reintentable: false })
    expect(pausaLaCamara(resultado)).toBe(true)
  })

  it('los errores del kit tienen su mensaje', () => {
    expect(aErrorApi({ status: 409, data: { code: 'KIT_NOT_INCLUDED', message: 'x' } }).message).toBe('El tipo de inscripción de esta persona no incluye kit.')
    expect(aErrorApi({ status: 409, data: { code: 'KIT_NOT_DELIVERED', message: 'x' } }).message).toContain('no estaba entregado')
    // El servidor dice la hora de la entrega: su texto tiene prioridad
    expect(aErrorApi({ status: 409, data: { code: 'KIT_ALREADY_DELIVERED', message: 'El kit ya fue entregado a las 10:32.' } }).message).toBe('El kit ya fue entregado a las 10:32.')
    expect(aErrorApi({ status: 409, data: { code: 'KIT_ALREADY_DELIVERED' } }).message).toBe('El kit de esta persona ya estaba entregado.')
  })
})
