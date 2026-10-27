import { describe, expect, it } from 'vitest'
import type { CredencialCorreo } from '~/types/api'
import {
  avisoApiKeyBrevo,
  avisoSinRespaldo,
  cuerpoCredencialCorreo,
  describirCredencialEvento,
  describirPlanBrevo,
  esClaveAplicacionValida,
  esCorreoValido,
  estadoCredencialCorreo,
  etiquetaUsarPredeterminada,
  formularioCredencialCorreo,
  hayPrioridades,
  mensajeDesactivarCredencial,
  mensajeEliminarCredencial,
  nombreProveedor,
  nombreSecreto,
  normalizarClaveAplicacion,
  opcionesCredencialEvento,
  ordenarCredencialesCorreo,
  ordenTrasMover,
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

  it('tolera planes sin créditos, sin tipo de créditos o sin tipo', () => {
    expect(describirPlanBrevo({ tipo: 'sms', creditos: null, tipoCreditos: null })).toBe('SMS: sin datos de créditos')
    expect(describirPlanBrevo({ tipo: 'free', creditos: 20, tipoCreditos: null })).toBe('Gratuito: 20 créditos')
    expect(describirPlanBrevo({ tipo: '', creditos: 0, tipoCreditos: '' })).toBe('Plan: 0 créditos')
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
    expect(formularioCredencialCorreo(null, true)).toEqual({ proveedor: 'BREVO', nombre: '', apiKey: '', remitenteCorreo: '', remitenteNombre: '', esPredeterminada: true, activo: true })
    expect(formularioCredencialCorreo(null, false, 'GMAIL_SMTP').proveedor).toBe('GMAIL_SMTP')
    expect(formularioCredencialCorreo(credencial({ proveedor: 'GMAIL_SMTP' }), false, 'BREVO').proveedor).toBe('GMAIL_SMTP')
    expect(formularioCredencialCorreo(credencial({ esPredeterminada: false }), true)).toMatchObject({ nombre: 'Brevo congreso', apiKey: '', esPredeterminada: false })
  })

  it('exige nombre, API key al crear y un remitente válido', () => {
    const vacio = formularioCredencialCorreo()
    expect(Object.keys(validarCredencialCorreo(vacio))).toEqual(['nombre', 'apiKey', 'remitenteCorreo'])
    expect(validarCredencialCorreo({ ...vacio, nombre: 'Brevo', remitenteCorreo: 'no-es-correo' }, credencial())).toEqual({ remitenteCorreo: 'Ingresa un correo válido.' })
  })

  it('aplica las longitudes mínimas del backend', () => {
    const form = { ...formularioCredencialCorreo(), nombre: 'X', apiKey: 'corta', remitenteCorreo: 'a@b.pe' }
    expect(validarCredencialCorreo(form)).toEqual({
      nombre: 'El nombre debe tener al menos 2 caracteres.',
      apiKey: 'La API key parece incompleta (mínimo 10 caracteres).',
    })
    // Al editar, la API key vacía es válida (se conserva), pero una nueva también se valida
    const original = credencial()
    expect(validarCredencialCorreo({ ...formularioCredencialCorreo(original) }, original)).toEqual({})
    expect(validarCredencialCorreo({ ...formularioCredencialCorreo(original), apiKey: 'corta' }, original).apiKey).toBeDefined()
  })

  it('no permite que una credencial nueva sea predeterminada e inactiva', () => {
    const form = { ...formularioCredencialCorreo(), nombre: 'Brevo', apiKey: 'xkeysib-123456', remitenteCorreo: 'a@b.pe', esPredeterminada: true, activo: false }
    expect(validarCredencialCorreo(form).activo).toBeDefined()
    expect(validarCredencialCorreo(form, credencial({ esPredeterminada: true }))).toEqual({})
  })

  it('avisa si la key parece SMTP', () => {
    expect(avisoApiKeyBrevo(' xsmtpsib-123')).toContain('xkeysib-')
    expect(avisoApiKeyBrevo('xkeysib-123')).toBeNull()
  })

  it('arma el cuerpo del alta', () => {
    const form = { proveedor: 'BREVO' as const, nombre: ' Brevo ', apiKey: ' xkeysib-1 ', remitenteCorreo: ' a@b.pe ', remitenteNombre: ' ', esPredeterminada: false, activo: true }
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

describe('credenciales de correo: Gmail por SMTP (backend spec 041)', () => {
  const gmail = () => credencial({ id: 5, proveedor: 'GMAIL_SMTP', nombre: 'Gmail', remitenteCorreo: 'garias@undc.edu.pe', apiKeyEnmascarada: '••••mnop' })
  const formulario = (datos = {}) => ({ ...formularioCredencialCorreo(null, false, 'GMAIL_SMTP'), nombre: 'Gmail', remitenteCorreo: 'garias@undc.edu.pe', ...datos })

  it('nombra al proveedor y a su secreto', () => {
    expect(nombreProveedor('GMAIL_SMTP')).toBe('Gmail')
    expect(nombreProveedor('BREVO')).toBe('Brevo')
    expect(nombreProveedor(undefined)).toBe('Brevo')
    expect(nombreSecreto('GMAIL_SMTP')).toBe('contraseña de aplicación')
    expect(nombreSecreto('BREVO')).toBe('API key')
  })

  it('acepta la contraseña de aplicación con o sin espacios y exige 16 letras', () => {
    expect(normalizarClaveAplicacion(' ABCD efgh  ijkl mnop ')).toBe('abcdefghijklmnop')
    expect(esClaveAplicacionValida('abcd efgh ijkl mnop')).toBe(true)
    expect(esClaveAplicacionValida('abcdefghijklmno')).toBe(false)
    expect(esClaveAplicacionValida('abcdefghijklmno1')).toBe(false)
    expect(esClaveAplicacionValida('xkeysib-abcdefghijklmnop')).toBe(false)
  })

  it('valida la contraseña con su propio mensaje (no el de la API key de Brevo)', () => {
    expect(validarCredencialCorreo(formulario())).toEqual({ apiKey: 'Pega la contraseña de aplicación de Google.' })
    expect(validarCredencialCorreo(formulario({ apiKey: 'corta' })).apiKey).toContain('16 letras')
    expect(validarCredencialCorreo(formulario({ apiKey: 'abcd efgh ijkl mnop' }))).toEqual({})
  })

  it('al cambiar la cuenta de Gmail exige la contraseña de esa cuenta', () => {
    const original = gmail()
    expect(validarCredencialCorreo({ ...formularioCredencialCorreo(original) }, original)).toEqual({})
    expect(validarCredencialCorreo({ ...formularioCredencialCorreo(original), remitenteCorreo: 'otra@undc.edu.pe' }, original).apiKey).toContain('Cambiaste la cuenta de Gmail')
    expect(validarCredencialCorreo({ ...formularioCredencialCorreo(original), remitenteCorreo: 'otra@undc.edu.pe', apiKey: 'zzzz yyyy xxxx wwww' }, original)).toEqual({})
  })

  it('el alta envía el proveedor y la contraseña sin espacios; Brevo no envía proveedor', () => {
    expect(cuerpoCredencialCorreo(formulario({ apiKey: ' abcd EFGH ijkl mnop ' }))).toEqual({
      proveedor: 'GMAIL_SMTP', nombre: 'Gmail', apiKey: 'abcdefghijklmnop', remitenteCorreo: 'garias@undc.edu.pe', activo: true,
    })
    expect(cuerpoCredencialCorreo({ ...formulario({ apiKey: 'xkeysib-123456' }), proveedor: 'BREVO' })).not.toHaveProperty('proveedor')
  })

  it('al editar normaliza la contraseña nueva y no envía el proveedor', () => {
    const original = gmail()
    expect(cuerpoCredencialCorreo({ ...formularioCredencialCorreo(original), apiKey: 'wxyz abcd wxyz abcd' }, original)).toEqual({ apiKey: 'wxyzabcdwxyzabcd' })
  })

  it('al eliminar nombra la contraseña de aplicación', () => {
    expect(mensajeEliminarCredencial(gmail())).toBe('¿Eliminar «Gmail»? La contraseña de aplicación guardada se descarta y no se puede deshacer.')
  })
})

describe('credenciales de correo: orden de respaldo (backend spec 041)', () => {
  const lista = () => [
    credencial({ id: 1, nombre: 'Brevo', esPredeterminada: true, prioridad: 1 }),
    credencial({ id: 2, nombre: 'Gmail', proveedor: 'GMAIL_SMTP', prioridad: 3 }),
    credencial({ id: 3, nombre: 'Brevo 2', prioridad: 2, activo: false }),
    credencial({ id: 4, nombre: 'Brevo 3', prioridad: 4 }),
  ]

  it('ordena por prioridad con la predeterminada primero, también las inactivas', () => {
    expect(ordenarCredencialesCorreo(lista()).map((c) => c.id)).toEqual([1, 3, 2, 4])
    const marcada = lista().map((c) => ({ ...c, esPredeterminada: c.id === 4 }))
    expect(ordenarCredencialesCorreo(marcada).map((c) => c.id)).toEqual([4, 1, 3, 2])
  })

  it('con un backend anterior (sin prioridad) conserva el orden de siempre', () => {
    const anterior = lista().map(({ prioridad: _prioridad, ...resto }) => resto as CredencialCorreo)
    expect(ordenarCredencialesCorreo(anterior).map((c) => c.id)).toEqual([1, 4, 2, 3])
    expect(hayPrioridades(anterior)).toBe(false)
    expect(hayPrioridades(lista())).toBe(true)
    expect(hayPrioridades([])).toBe(false)
  })

  it('sube y baja una credencial de respaldo un lugar y devuelve el orden completo', () => {
    const ordenadas = ordenarCredencialesCorreo(lista())
    expect(ordenTrasMover(ordenadas, 2, 'arriba')).toEqual([1, 2, 3, 4])
    expect(ordenTrasMover(ordenadas, 3, 'abajo')).toEqual([1, 2, 3, 4])
    expect(ordenTrasMover(ordenadas, 3, 'arriba')).toBeNull() // pasaría por encima de la predeterminada
    expect(ordenTrasMover(ordenadas, 4, 'abajo')).toBeNull()
    expect(ordenTrasMover(ordenadas, 1, 'abajo')).toBeNull() // la predeterminada no se mueve
    expect(ordenTrasMover(ordenadas, 99, 'arriba')).toBeNull()
    expect(ordenadas.map((c) => c.id)).toEqual([1, 3, 2, 4])
  })

  it('avisa cuando solo hay una credencial activa', () => {
    expect(avisoSinRespaldo(lista().map((c) => ({ ...c, activo: c.id === 1 })))).toContain('300 envíos al día')
    expect(avisoSinRespaldo([credencial({ proveedor: 'GMAIL_SMTP' })])).toContain('500 envíos al día')
    expect(avisoSinRespaldo(lista())).toBeNull()
    expect(avisoSinRespaldo([])).toBeNull()
    expect(avisoSinRespaldo([credencial({ activo: false })])).toBeNull()
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
