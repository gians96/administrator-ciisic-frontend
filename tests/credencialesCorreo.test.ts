import { describe, expect, it } from 'vitest'
import type { CredencialCorreo } from '~/types/api'
import {
  avisoApiKeyBrevo,
  cuerpoCredencialCorreo,
  describirCredencialEvento,
  describirPlanBrevo,
  esCorreoValido,
  estadoCredencialCorreo,
  etiquetaUsarPredeterminada,
  formularioCredencialCorreo,
  mensajeDesactivarCredencial,
  mensajeEliminarCredencial,
  opcionesCredencialEvento,
  ordenarCredencialesCorreo,
  remitenteCredencial,
  validarCredencialCorreo,
} from '~/utils/credencialesCorreo'

function credencial(datos: Partial<CredencialCorreo> = {}): CredencialCorreo {
  return {
    id: 1,
    proveedor: 'BREVO',
    nombre: 'Brevo congreso',
    apiKeyEnmascarada: '••••abcd',
    remitenteCorreo: 'congreso@undc.edu.pe',
    remitenteNombre: 'CIISIC UNDC',
    esPredeterminada: false,
    activo: true,
    ultimoEstado: null,
    ultimoError: null,
    ultimaPruebaEn: null,
    ultimoEnvioEn: null,
    eventos: [],
    creadoEn: '2026-09-29T10:00:00.000Z',
    actualizadoEn: '2026-09-29T10:00:00.000Z',
    ...datos,
  }
}

describe('credenciales de correo: presentación', () => {
  it('describe el último estado', () => {
    expect(estadoCredencialCorreo({ ultimoEstado: 'OK' })).toEqual({ texto: 'Último estado: OK', tono: 'ok' })
    expect(estadoCredencialCorreo({ ultimoEstado: 'ERROR' }).tono).toBe('error')
    expect(estadoCredencialCorreo({ ultimoEstado: null })).toEqual({ texto: 'Sin probar', tono: 'neutral' })
  })

  it('muestra el remitente con o sin nombre', () => {
    expect(remitenteCredencial({ remitenteCorreo: 'a@undc.edu.pe', remitenteNombre: ' CIISIC ' })).toBe('CIISIC <a@undc.edu.pe>')
    expect(remitenteCredencial({ remitenteCorreo: 'a@undc.edu.pe', remitenteNombre: null })).toBe('a@undc.edu.pe')
  })

  it('traduce los planes de Brevo y conserva los desconocidos', () => {
    expect(describirPlanBrevo({ tipo: 'free', creditos: 300, tipoCreditos: 'sendLimit' })).toBe('Gratuito: 300 envíos disponibles')
    expect(describirPlanBrevo({ tipo: 'payAsYouGo', creditos: 12500, tipoCreditos: 'sendLimit' })).toMatch(/^Pago por uso: 12,?500 envíos disponibles$/)
    expect(describirPlanBrevo({ tipo: 'enterprise', creditos: 5, tipoCreditos: 'otro' })).toBe('enterprise: 5 créditos (otro)')
  })

  it('ordena: predeterminada, activas y por nombre', () => {
    const lista = [
      credencial({ id: 1, nombre: 'Zeta', activo: true }),
      credencial({ id: 2, nombre: 'Beta', activo: false }),
      credencial({ id: 3, nombre: 'Alfa', activo: true }),
      credencial({ id: 4, nombre: 'Omega', esPredeterminada: true }),
    ]
    expect(ordenarCredencialesCorreo(lista).map((c) => c.id)).toEqual([4, 3, 1, 2])
    expect(lista.map((c) => c.id)).toEqual([1, 2, 3, 4])
  })
})

describe('credenciales de correo: formulario', () => {
  it('valida correos', () => {
    expect(esCorreoValido(' ana@undc.edu.pe ')).toBe(true)
    expect(esCorreoValido('ana@undc')).toBe(false)
    expect(esCorreoValido('ana undc.edu.pe')).toBe(false)
  })

  it('arranca vacío (la primera queda predeterminada) o con los datos sin la API key', () => {
    expect(formularioCredencialCorreo(null, true)).toEqual({ nombre: '', apiKey: '', remitenteCorreo: '', remitenteNombre: '', esPredeterminada: true, activo: true })
    expect(formularioCredencialCorreo(credencial({ esPredeterminada: false }), true)).toMatchObject({ nombre: 'Brevo congreso', apiKey: '', esPredeterminada: false })
  })

  it('exige nombre, API key al crear y un remitente válido', () => {
    const vacio = formularioCredencialCorreo()
    expect(Object.keys(validarCredencialCorreo(vacio))).toEqual(['nombre', 'apiKey', 'remitenteCorreo'])
    expect(validarCredencialCorreo({ ...vacio, nombre: 'X', remitenteCorreo: 'no-es-correo' }, credencial())).toEqual({ remitenteCorreo: 'Ingresa un correo válido.' })
  })

  it('no permite que una credencial nueva sea predeterminada e inactiva', () => {
    const form = { ...formularioCredencialCorreo(), nombre: 'X', apiKey: 'xkeysib-1', remitenteCorreo: 'a@b.pe', esPredeterminada: true, activo: false }
    expect(validarCredencialCorreo(form).activo).toBeDefined()
    expect(validarCredencialCorreo(form, credencial({ esPredeterminada: true }))).toEqual({})
  })

  it('avisa si la key parece SMTP', () => {
    expect(avisoApiKeyBrevo(' xsmtpsib-123')).toContain('xkeysib-')
    expect(avisoApiKeyBrevo('xkeysib-123')).toBeNull()
  })

  it('arma el cuerpo del alta', () => {
    const form = { nombre: ' Brevo ', apiKey: ' xkeysib-1 ', remitenteCorreo: ' a@b.pe ', remitenteNombre: ' ', esPredeterminada: false, activo: true }
    expect(cuerpoCredencialCorreo(form)).toEqual({ nombre: 'Brevo', apiKey: 'xkeysib-1', remitenteCorreo: 'a@b.pe', activo: true })
    expect(cuerpoCredencialCorreo({ ...form, remitenteNombre: 'CIISIC', esPredeterminada: true })).toMatchObject({ remitenteNombre: 'CIISIC', esPredeterminada: true })
  })

  it('en edición envía solo lo que cambió y conserva la API key si está vacía', () => {
    const original = credencial()
    expect(cuerpoCredencialCorreo(formularioCredencialCorreo(original), original)).toEqual({})
    expect(cuerpoCredencialCorreo({ ...formularioCredencialCorreo(original), apiKey: ' xkeysib-nueva ' }, original)).toEqual({ apiKey: 'xkeysib-nueva' })
    expect(cuerpoCredencialCorreo({ ...formularioCredencialCorreo(original), nombre: 'Otro', remitenteNombre: '', activo: false }, original))
      .toEqual({ nombre: 'Otro', remitenteNombre: null, activo: false })
  })

  it('solo envía esPredeterminada al marcarla', () => {
    const original = credencial()
    expect(cuerpoCredencialCorreo({ ...formularioCredencialCorreo(original), esPredeterminada: true }, original)).toEqual({ esPredeterminada: true })
    const predeterminada = credencial({ esPredeterminada: true })
    expect(cuerpoCredencialCorreo({ ...formularioCredencialCorreo(predeterminada), esPredeterminada: false }, predeterminada)).toEqual({})
  })
})

describe('credenciales de correo: confirmaciones', () => {
  const usada = credencial({ esPredeterminada: true, eventos: [{ id: 7, codigo: 'ix', nombreCorto: 'IX CIISIC 2027' }, { id: 8, codigo: 'ss', nombreCorto: 'Semana Sistémica' }] })

  it('al eliminar menciona los eventos y la predeterminada', () => {
    const texto = mensajeEliminarCredencial(usada)
    expect(texto).toContain('IX CIISIC 2027, Semana Sistémica')
    expect(texto).toContain('predeterminada')
    expect(mensajeEliminarCredencial(credencial())).toBe('¿Eliminar «Brevo congreso»? La API key guardada se descarta y no se puede deshacer.')
  })

  it('al desactivar solo pide confirmación si afecta a eventos', () => {
    expect(mensajeDesactivarCredencial(credencial())).toBeNull()
    expect(mensajeDesactivarCredencial(usada)).toContain('La usan: IX CIISIC 2027, Semana Sistémica.')
  })
})

describe('credencial de correo del evento', () => {
  const lista = [
    credencial({ id: 1, nombre: 'Brevo congreso', esPredeterminada: true }),
    credencial({ id: 2, nombre: 'Brevo deportes', remitenteCorreo: 'deportes@undc.edu.pe' }),
    credencial({ id: 3, nombre: 'Antigua', activo: false }),
  ]

  it('ofrece las activas y marca la predeterminada', () => {
    expect(opcionesCredencialEvento(lista, null)).toEqual([
      { id: 1, etiqueta: 'Brevo congreso · congreso@undc.edu.pe (predeterminada)' },
      { id: 2, etiqueta: 'Brevo deportes · deportes@undc.edu.pe' },
    ])
    expect(etiquetaUsarPredeterminada(lista)).toBe('Usar la predeterminada (Brevo congreso · congreso@undc.edu.pe)')
    expect(etiquetaUsarPredeterminada([])).toBe('Usar la predeterminada')
  })

  it('conserva la credencial actual aunque esté inactiva o no aparezca', () => {
    expect(opcionesCredencialEvento(lista, { id: 3, nombre: 'Antigua', remitenteCorreo: 'congreso@undc.edu.pe' }).at(-1))
      .toEqual({ id: 3, etiqueta: 'Antigua · congreso@undc.edu.pe (inactiva)' })
    expect(opcionesCredencialEvento([], { id: 9, nombre: 'Otra', remitenteCorreo: 'o@undc.edu.pe' }))
      .toEqual([{ id: 9, etiqueta: 'Otra · o@undc.edu.pe (actual)' }])
    expect(opcionesCredencialEvento([], { id: 9 })).toEqual([{ id: 9, etiqueta: 'Credencial #9 (actual)' }])
  })

  it('describe la credencial en solo lectura', () => {
    expect(describirCredencialEvento(null)).toBe('Usar la predeterminada')
    expect(describirCredencialEvento({ id: 2, nombre: 'Brevo deportes', remitenteCorreo: 'd@undc.edu.pe' })).toBe('Brevo deportes · d@undc.edu.pe')
  })
})
