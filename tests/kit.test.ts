import { describe, expect, it } from 'vitest'
import {
  avisoCambioKit,
  avisoKitIncoherente,
  backendSinKit,
  cuandoKit,
  diceConKit,
  diceSinKit,
  estadoKit,
  kitDe,
  kitNoGuardado,
  mensajeDeshacerKit,
  puedeDeshacerKit,
  puedeEntregarKit,
  ROTULO_KIT,
  resumenKitsDe,
  rutaKit,
  TEXTO_KIT,
  textoEntregaKit,
  textoResumenKits,
  TONO_KIT,
} from '~/utils/kit'
import type { KitEstado } from '~/types/api'

const ENTREGADOR = { id: 41, nombres: 'Rosa', apellidos: 'Quispe' }
/** 26-oct-2026 10:32 hora de Lima (UTC-5). */
const ENTREGADO_EN = '2026-10-26T15:32:00.000Z'
const MEDIODIA_LIMA = new Date('2026-10-26T17:00:00.000Z')
const OTRO_DIA = new Date('2026-10-27T17:00:00.000Z')

const kit = (cambios: Partial<KitEstado> = {}): KitEstado => ({ incluye: true, entregado: false, entregadoEn: null, entregadoPor: null, ...cambios })
const entregado = kit({ entregado: true, entregadoEn: ENTREGADO_EN, entregadoPor: ENTREGADOR })
const PRESENCIAL = { modalidad: 'PRESENCIAL' }

describe('kit: lo que llega del backend se lee con tolerancia', () => {
  it('la ruta de la entrega es la de la inscripción', () => {
    expect(rutaKit(500)).toBe('inscriptions/500/kit')
  })

  it('kitDe acepta la forma esperada y descarta lo demás (backend anterior)', () => {
    expect(kitDe(entregado)).toEqual(entregado)
    expect(kitDe(kit())).toEqual(kit())
    for (const valor of [undefined, null, 'kit', 3, {}, { incluye: true }, { entregado: false }, { incluye: 'si', entregado: false }]) {
      expect(kitDe(valor)).toBeNull()
    }
  })

  it('kitDe completa lo que falta de la entrega con null', () => {
    expect(kitDe({ incluye: true, entregado: true })).toEqual({ incluye: true, entregado: true, entregadoEn: null, entregadoPor: null })
    expect(kitDe({ incluye: true, entregado: true, entregadoEn: 5, entregadoPor: 'Rosa' })).toMatchObject({ entregadoEn: null, entregadoPor: null })
  })

  it('el resumen se lee solo con sus tres números', () => {
    expect(resumenKitsDe({ conKit: 10, entregados: 4, pendientes: 6 })).toEqual({ conKit: 10, entregados: 4, pendientes: 6 })
    for (const valor of [undefined, null, 'x', {}, { conKit: 10 }, { conKit: '10', entregados: 4, pendientes: 6 }, { conKit: 10, entregados: Number.NaN, pendientes: 6 }]) {
      expect(resumenKitsDe(valor)).toBeNull()
    }
  })
})

describe('kit: estado de una inscripción', () => {
  it('pendiente si el tipo lo incluye y aún no se entregó', () => {
    expect(estadoKit(kit(), PRESENCIAL)).toBe('PENDIENTE')
  })

  it('entregado manda aunque el tipo ya no lo incluya o sea virtual (la entrega ya ocurrió)', () => {
    expect(estadoKit(entregado, PRESENCIAL)).toBe('ENTREGADO')
    expect(estadoKit({ ...entregado, incluye: false }, PRESENCIAL)).toBe('ENTREGADO')
    expect(estadoKit({ ...entregado, incluye: false }, { modalidad: 'VIRTUAL' })).toBe('ENTREGADO')
  })

  it('sin kit si el tipo es presencial y no lo incluye', () => {
    expect(estadoKit(kit({ incluye: false }), PRESENCIAL)).toBe('SIN_KIT')
    // Un tipo anterior sin `modalidad` es presencial
    expect(estadoKit(kit({ incluye: false }), {})).toBe('SIN_KIT')
  })

  it('no aplica sin kit (backend anterior), en un virtual o en una cortesía sin tipo', () => {
    expect(estadoKit(undefined, PRESENCIAL)).toBe('NO_APLICA')
    expect(estadoKit(null, PRESENCIAL)).toBe('NO_APLICA')
    expect(estadoKit(kit({ incluye: false }), { modalidad: 'VIRTUAL' })).toBe('NO_APLICA')
    expect(estadoKit(kit({ incluye: false }), null)).toBe('NO_APLICA')
    expect(estadoKit(kit({ incluye: false }), undefined)).toBe('NO_APLICA')
  })

  it('cada estado tiene su rótulo, su texto y su tono (no aplica no muestra nada)', () => {
    expect(ROTULO_KIT).toEqual({ ENTREGADO: 'KIT ENTREGADO', PENDIENTE: 'CON KIT', SIN_KIT: 'SIN KIT', NO_APLICA: '' })
    expect(TEXTO_KIT).toEqual({ ENTREGADO: 'Kit entregado', PENDIENTE: 'Con kit · pendiente', SIN_KIT: 'Sin kit', NO_APLICA: '' })
    expect(TONO_KIT.ENTREGADO).toBe('ok')
    expect(TONO_KIT.PENDIENTE).toBe('warn')
  })

  it('se puede entregar solo lo pendiente y deshacer solo lo entregado', () => {
    expect(puedeEntregarKit(kit())).toBe(true)
    expect(puedeEntregarKit(entregado)).toBe(false)
    expect(puedeEntregarKit(kit({ incluye: false }))).toBe(false)
    expect(puedeEntregarKit(null)).toBe(false)
    expect(puedeEntregarKit(undefined)).toBe(false)

    expect(puedeDeshacerKit(entregado)).toBe(true)
    // Se puede corregir aunque el tipo ya no incluya kit
    expect(puedeDeshacerKit({ ...entregado, incluye: false })).toBe(true)
    expect(puedeDeshacerKit(kit())).toBe(false)
    expect(puedeDeshacerKit(null)).toBe(false)
  })
})

describe('kit: cuándo y quién lo entregó', () => {
  it('el mismo día dice solo la hora de Lima', () => {
    expect(cuandoKit(ENTREGADO_EN, MEDIODIA_LIMA)).toBe('a las 10:32')
  })

  it('otro día agrega la fecha (el kit pudo entregarse al día siguiente)', () => {
    expect(cuandoKit(ENTREGADO_EN, OTRO_DIA)).toMatch(/^el 26 oct a las 10:32$/)
  })

  it('se mide en hora de Lima: pasada la medianoche de Lima ya es otro día', () => {
    // 2026-10-27 04:59 UTC = 26-oct 23:59 Lima; 05:01 UTC = 27-oct 00:01 Lima
    expect(cuandoKit('2026-10-27T04:59:00.000Z', new Date('2026-10-27T05:01:00.000Z'))).toMatch(/^el 26 oct a las 23:59$/)
  })

  it('un instante ausente o inválido no dice nada', () => {
    for (const valor of [null, undefined, '', 'ayer']) expect(cuandoKit(valor as string | null | undefined, MEDIODIA_LIMA)).toBe('')
  })

  it('el texto de la entrega suma quién la hizo y se omite lo que no se sabe', () => {
    expect(textoEntregaKit(entregado, MEDIODIA_LIMA)).toBe('Entregado a las 10:32 · por Rosa Quispe')
    expect(textoEntregaKit({ ...entregado, entregadoPor: null }, MEDIODIA_LIMA)).toBe('Entregado a las 10:32')
    expect(textoEntregaKit({ ...entregado, entregadoEn: null }, MEDIODIA_LIMA)).toBe('Entregado · por Rosa Quispe')
    expect(textoEntregaKit(kit(), MEDIODIA_LIMA)).toBe('')
    expect(textoEntregaKit(null)).toBe('')
  })

  it('la pregunta de deshacer dice a quién y qué pasa', () => {
    const mensaje = mensajeDeshacerKit('Ana Pérez', entregado)
    expect(mensaje).toContain('¿Deshacer la entrega del kit de Ana Pérez?')
    expect(mensaje).toContain('por Rosa Quispe')
    expect(mensaje).toContain('Vuelve a quedar pendiente')
    expect(mensajeDeshacerKit('Ana Pérez', null)).toBe('¿Deshacer la entrega del kit de Ana Pérez? Vuelve a quedar pendiente y se podrá entregar después.')
  })
})

describe('kit: resumen del evento', () => {
  it('dice entregados, pendientes y el total', () => {
    expect(textoResumenKits({ conKit: 47, entregados: 35, pendientes: 12 })).toBe('35 entregados · 12 pendientes de 47')
  })

  it('sin kits que entregar o sin resumen no dice nada', () => {
    expect(textoResumenKits({ conKit: 0, entregados: 0, pendientes: 0 })).toBe('')
    expect(textoResumenKits(null)).toBe('')
    expect(textoResumenKits(undefined)).toBe('')
  })
})

describe('kit: editor de tipos', () => {
  it('reconoce lo que dice «con kit» y «sin kit» por código o etiqueta', () => {
    expect(diceConKit('estudiantes_con_kit', '')).toBe(true)
    expect(diceConKit('con_kit', '')).toBe(true)
    expect(diceConKit(' General_Con_Kit ', '')).toBe(true)
    expect(diceConKit('x', ' con  kit ')).toBe(true)
    expect(diceConKit('estudiantes_sin_kit', 'SIN KIT')).toBe(false)
    expect(diceConKit('delegacion_con_kit_extra', '')).toBe(false)
    expect(diceSinKit('estudiantes_sin_kit', '')).toBe(true)
    expect(diceSinKit('x', 'SIN KIT')).toBe(true)
    expect(diceSinKit('estudiantes_con_kit', 'CON KIT')).toBe(false)
  })

  const form = (cambios: Record<string, unknown> = {}) => ({ codigo: 'estudiantes_con_kit', etiqueta: 'CON KIT', modalidad: 'PRESENCIAL', incluyeKit: true, ...cambios })

  it('avisa si dice «CON KIT» y el interruptor está apagado (y al revés)', () => {
    expect(avisoKitIncoherente(form())).toBeNull()
    expect(avisoKitIncoherente(form({ incluyeKit: false }))).toContain('«Sin kit»')
    expect(avisoKitIncoherente(form({ codigo: 'estudiantes_sin_kit', etiqueta: 'SIN KIT' }))).toContain('«Con kit»')
    expect(avisoKitIncoherente(form({ codigo: 'estudiantes_sin_kit', etiqueta: 'SIN KIT', incluyeKit: false }))).toBeNull()
  })

  it('no avisa en un virtual ni si el texto es ambiguo o no habla de kit', () => {
    expect(avisoKitIncoherente(form({ modalidad: 'VIRTUAL', incluyeKit: false }))).toBeNull()
    expect(avisoKitIncoherente(form({ codigo: 'general_virtual', etiqueta: 'VIRTUAL', incluyeKit: false }))).toBeNull()
    expect(avisoKitIncoherente(form({ codigo: 'con_kit', etiqueta: 'SIN KIT', incluyeKit: false }))).toBeNull()
  })

  it('detecta un backend anterior (ningún tipo trae `incluyeKit`) y un tipo que no lo guardó', () => {
    expect(backendSinKit([{ tipos: [{}, {}] }])).toBe(true)
    expect(backendSinKit([{ tipos: [{ incluyeKit: false }, {}] }])).toBe(false)
    // Sin tipos no se puede saber
    expect(backendSinKit([{ tipos: [] }])).toBe(false)
    expect(backendSinKit([])).toBe(false)
    expect(kitNoGuardado(true, { incluyeKit: false })).toBe(true)
    expect(kitNoGuardado(true, {})).toBe(true)
    expect(kitNoGuardado(true, { incluyeKit: true })).toBe(false)
    expect(kitNoGuardado(false, { incluyeKit: false })).toBe(false)
    expect(kitNoGuardado(true, null)).toBe(false)
  })

  it('pide confirmar solo al cambiar el kit de un tipo que ya tiene inscripciones', () => {
    expect(avisoCambioKit({ incluyeKit: true, totalInscripciones: 35 }, false)).toContain('35 inscripciones')
    expect(avisoCambioKit({ incluyeKit: true, totalInscripciones: 35 }, false)).toContain('Apagar')
    expect(avisoCambioKit({ incluyeKit: false, totalInscripciones: 1 }, true)).toContain('1 inscripción.')
    expect(avisoCambioKit({ incluyeKit: false, totalInscripciones: 1 }, true)).toContain('Encender')
    expect(avisoCambioKit({ incluyeKit: true, totalInscripciones: 35 }, true)).toBeNull()
    expect(avisoCambioKit({ incluyeKit: false, totalInscripciones: 0 }, true)).toBeNull()
    expect(avisoCambioKit({ totalInscripciones: 5 }, false)).toBeNull()
    expect(avisoCambioKit(null, true)).toBeNull()
    expect(avisoCambioKit(undefined, true)).toBeNull()
  })
})
