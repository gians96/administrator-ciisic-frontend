import { describe, expect, it } from 'vitest'
import type { ConfiguracionSistema } from '~/types/api'
import {
  AVISO_DESACTIVAR_LEGACY,
  avisoUrlPanel,
  codigoHttpPrueba,
  confirmacionCambiosSistema,
  cuerpoDeTarjeta,
  cuerpoSistema,
  describirActualizacion,
  errorClientIdGoogle,
  erroresDeGuardado,
  erroresDeTarjeta,
  errorTimeout,
  errorUrl,
  estadoUndcApi,
  formularioSistema,
  hayCambiosEnTarjeta,
  latenciaPrueba,
  origenDe,
  origenesAutorizados,
  reiniciarTarjeta,
  validarSistema,
} from '~/utils/configuracionSistema'

function config(datos: Partial<ConfiguracionSistema> = {}): ConfiguracionSistema {
  return {
    undcApi: {
      url: 'https://api.undc.edu.pe/api/v1',
      apiKeyEnmascarada: '••••9f3a',
      timeoutMs: 8000,
      configurada: true,
      ultimoEstado: null,
      ultimoError: null,
      ultimaPruebaEn: null,
    },
    google: { clientId: '123456789012-abc123def456.apps.googleusercontent.com', configurado: true },
    urlPanel: 'https://panel.ciisic.undc.edu.pe',
    rutasLegacy: { activas: true },
    actualizadoPor: { id: 1, nombres: 'Ana', apellidos: 'Quispe' },
    actualizadoEn: '2026-09-29T15:30:00.000Z',
    ...datos,
  }
}

const CLIENT_ID = '123456789012-abc123def456.apps.googleusercontent.com'

describe('sistema: formulario', () => {
  it('se arma desde el GET sin precargar la API key', () => {
    expect(formularioSistema(config())).toEqual({
      undcApiUrl: 'https://api.undc.edu.pe/api/v1',
      undcApiKey: '',
      quitarUndcApiKey: false,
      undcApiTimeoutMs: 8000,
      googleClientId: CLIENT_ID,
      urlPanel: 'https://panel.ciisic.undc.edu.pe',
      rutasLegacyActivas: true,
    })
    const vacia = config({ undcApi: { ...config().undcApi, url: null, apiKeyEnmascarada: null }, google: { clientId: null, configurado: false }, urlPanel: null })
    expect(formularioSistema(vacia)).toMatchObject({ undcApiUrl: '', googleClientId: '', urlPanel: '' })
    expect(formularioSistema(null).undcApiTimeoutMs).toBe(8000)
  })

  it('reinicia solo los campos de la tarjeta guardada', () => {
    const form = { ...formularioSistema(config()), undcApiKey: 'nueva-key-123', quitarUndcApiKey: true, urlPanel: 'https://otro.pe' }
    reiniciarTarjeta(form, config({ undcApi: { ...config().undcApi, timeoutMs: 5000 } }), 'undc')
    expect(form).toMatchObject({ undcApiKey: '', quitarUndcApiKey: false, undcApiTimeoutMs: 5000, urlPanel: 'https://otro.pe' })
  })
})

describe('sistema: validación', () => {
  it('URL con https; http solo para localhost; sin credenciales', () => {
    expect(errorUrl('https://api.undc.edu.pe/api/v1')).toBeNull()
    expect(errorUrl('  ')).toBeNull()
    for (const local of ['http://localhost:3000', 'http://127.0.0.1:8000/api', 'http://[::1]:3001']) expect(errorUrl(local), local).toBeNull()
    expect(errorUrl('http://api.undc.edu.pe')).toBe('Usa https (http solo se permite para localhost).')
    expect(errorUrl('ftp://api.undc.edu.pe')).toBe('Usa https (http solo se permite para localhost).')
    expect(errorUrl('api.undc.edu.pe')).toBe('Ingresa la URL completa, con https:// al inicio.')
    expect(errorUrl('https://usuario:clave@api.undc.edu.pe')).toBe('La URL no debe incluir usuario ni contraseña.')
  })

  it('tiempo de espera entero entre 1000 y 30000 ms', () => {
    expect(errorTimeout(1000)).toBeNull()
    expect(errorTimeout('30000')).toBeNull()
    for (const valor of ['', 999, 30001, 1500.5, 'abc']) expect(errorTimeout(valor), String(valor)).toMatch(/entre 1000 y 30000 ms/)
  })

  it('client ID con el formato de Google', () => {
    expect(errorClientIdGoogle(` ${CLIENT_ID} `)).toBeNull()
    expect(errorClientIdGoogle('')).toBeNull()
    expect(errorClientIdGoogle('GOCSPX-secreto')).toMatch(/apps\.googleusercontent\.com/)
    expect(errorClientIdGoogle('123-ABC.apps.googleusercontent.com')).not.toBeNull()
  })

  it('valida el formulario con las claves del backend', () => {
    const form = { ...formularioSistema(config()), undcApiUrl: 'http://api.undc.edu.pe', undcApiKey: 'corta', undcApiTimeoutMs: '', googleClientId: 'x', urlPanel: 'panel' }
    expect(Object.keys(validarSistema(form))).toEqual(['undcApiUrl', 'undcApiKey', 'undcApiTimeoutMs', 'googleClientId', 'urlPanel'])
    expect(validarSistema({ ...formularioSistema(config()), undcApiKey: 'x'.repeat(501) }).undcApiKey).toMatch(/500/)
    // Con «Quitar key» no se valida lo escrito
    expect(validarSistema({ ...formularioSistema(config()), undcApiKey: 'corta', quitarUndcApiKey: true })).toEqual({})
    expect(validarSistema(formularioSistema(config()))).toEqual({})
  })

  it('separa los errores por tarjeta', () => {
    const errores = { undcApiUrl: 'a', googleClientId: 'b', urlPanel: 'c' }
    expect(erroresDeTarjeta(errores, 'undc')).toEqual({ undcApiUrl: 'a' })
    expect(erroresDeTarjeta(errores, 'google')).toEqual({ googleClientId: 'b' })
    expect(erroresDeTarjeta(errores, 'legacy')).toEqual({})
  })

  it('ubica los errores del backend junto al campo', () => {
    expect(erroresDeGuardado({ code: 'VALIDATION_ERROR', message: 'x', fields: { undcApiTimeoutMs: 'min 1000' } }, 'undc')).toEqual({ undcApiTimeoutMs: 'min 1000' })
    expect(erroresDeGuardado({ code: 'HOST_NOT_ALLOWED', message: 'Interna' }, 'undc')).toEqual({ undcApiUrl: 'Interna' })
    expect(erroresDeGuardado({ code: 'INVALID_URL', message: 'No válida' }, 'panel')).toEqual({ urlPanel: 'No válida' })
    expect(erroresDeGuardado({ code: 'INVALID_URL', message: 'No válida' }, 'google')).toEqual({})
  })
})

describe('sistema: PUT parcial', () => {
  it('sin cambios no envía nada', () => {
    expect(cuerpoSistema(formularioSistema(config()), config())).toEqual({})
    // Una barra final no cuenta como cambio
    expect(cuerpoSistema({ ...formularioSistema(config()), undcApiUrl: 'https://api.undc.edu.pe/api/v1/' }, config())).toEqual({})
  })

  it('envía solo lo cambiado y los textos vacíos como null', () => {
    const form = { ...formularioSistema(config()), undcApiTimeoutMs: 12000, googleClientId: ' ', urlPanel: ' https://nuevo.undc.edu.pe ', rutasLegacyActivas: false }
    expect(cuerpoSistema(form, config())).toEqual({ undcApiTimeoutMs: 12000, googleClientId: null, urlPanel: 'https://nuevo.undc.edu.pe', rutasLegacyActivas: false })
    expect(cuerpoSistema({ ...formularioSistema(config()), undcApiUrl: '' }, config())).toEqual({ undcApiUrl: null })
  })

  it('la API key es write-only: se envía solo si se escribe; «Quitar key» envía null', () => {
    const original = config()
    expect(cuerpoSistema({ ...formularioSistema(original), undcApiKey: ' nueva-api-key-123 ' }, original)).toEqual({ undcApiKey: 'nueva-api-key-123' })
    expect(cuerpoSistema({ ...formularioSistema(original), undcApiKey: 'ignorada-123', quitarUndcApiKey: true }, original)).toEqual({ undcApiKey: null })
    // Sin key guardada, «Quitar key» no tiene nada que quitar
    const sinKey = config({ undcApi: { ...original.undcApi, apiKeyEnmascarada: null, configurada: false } })
    expect(cuerpoSistema({ ...formularioSistema(sinKey), quitarUndcApiKey: true }, sinKey)).toEqual({})
  })

  it('cada tarjeta envía solo sus campos', () => {
    const original = config()
    const form = { ...formularioSistema(original), undcApiTimeoutMs: 9000, googleClientId: '', urlPanel: 'https://otro.undc.edu.pe' }
    expect(cuerpoDeTarjeta(form, original, 'undc')).toEqual({ undcApiTimeoutMs: 9000 })
    expect(cuerpoDeTarjeta(form, original, 'google')).toEqual({ googleClientId: null })
    expect(cuerpoDeTarjeta(form, original, 'panel')).toEqual({ urlPanel: 'https://otro.undc.edu.pe' })
    expect(hayCambiosEnTarjeta(form, original, 'legacy')).toBe(false)
    expect(hayCambiosEnTarjeta(form, original, 'undc')).toBe(true)
  })

  it('pide confirmación al quitar la conexión, Google o las rutas legacy', () => {
    expect(confirmacionCambiosSistema({ undcApiTimeoutMs: 9000, urlPanel: null })).toBeNull()
    expect(confirmacionCambiosSistema({ undcApiKey: null })).toMatch(/estudiantes UNDC/)
    expect(confirmacionCambiosSistema({ undcApiUrl: null })).toMatch(/estudiantes UNDC/)
    expect(confirmacionCambiosSistema({ googleClientId: null })).toMatch(/nadie podrá entrar con Google/)
    expect(confirmacionCambiosSistema({ rutasLegacyActivas: false })).toBe(AVISO_DESACTIVAR_LEGACY)
    expect(confirmacionCambiosSistema({ rutasLegacyActivas: true })).toBeNull()
    expect(AVISO_DESACTIVAR_LEGACY).toContain('dejará de poder inscribir')
  })
})

describe('sistema: presentación', () => {
  it('estado de API_UNDC', () => {
    expect(estadoUndcApi({ configurada: false, ultimoEstado: 'OK' })).toEqual({ texto: 'Sin configurar', tono: 'warn' })
    expect(estadoUndcApi({ configurada: true, ultimoEstado: 'OK' })).toEqual({ texto: 'Conectada', tono: 'ok' })
    expect(estadoUndcApi({ configurada: true, ultimoEstado: 'ERROR' })).toEqual({ texto: 'Con error', tono: 'error' })
    expect(estadoUndcApi({ configurada: true, ultimoEstado: null })).toEqual({ texto: 'Sin probar', tono: 'neutral' })
  })

  it('código HTTP y latencia de la prueba', () => {
    expect(codigoHttpPrueba({ codigoHttp: 401 })).toBe('401')
    expect(codigoHttpPrueba({ codigoHttp: null })).toBe('Sin respuesta')
    expect(latenciaPrueba({ latenciaMs: 123.6 })).toBe('124 ms')
    expect(latenciaPrueba({ latenciaMs: 8000 })).toMatch(/^8[,.\s]?000 ms$/)
  })

  it('orígenes autorizados de Google: el panel actual y la URL configurada, sin repetir', () => {
    expect(origenesAutorizados('http://localhost:3001', 'https://panel.ciisic.undc.edu.pe/')).toEqual(['http://localhost:3001', 'https://panel.ciisic.undc.edu.pe'])
    expect(origenesAutorizados('https://panel.ciisic.undc.edu.pe', 'https://panel.ciisic.undc.edu.pe')).toEqual(['https://panel.ciisic.undc.edu.pe'])
    expect(origenesAutorizados('https://panel.ciisic.undc.edu.pe', null)).toEqual(['https://panel.ciisic.undc.edu.pe'])
    expect(origenesAutorizados('', 'no-es-url')).toEqual([])
  })

  it('origen de una URL y aviso si trae ruta', () => {
    expect(origenDe('https://panel.undc.edu.pe:8443/login?x=1')).toBe('https://panel.undc.edu.pe:8443')
    expect(origenDe('javascript:alert(1)')).toBeNull()
    expect(avisoUrlPanel('https://panel.undc.edu.pe/')).toBeNull()
    expect(avisoUrlPanel('https://panel.undc.edu.pe/admin')).toBe('Se guardará solo el origen: https://panel.undc.edu.pe')
    expect(avisoUrlPanel('http://panel.undc.edu.pe/admin')).toBeNull()
  })

  it('describe la última actualización', () => {
    expect(describirActualizacion(config())).toMatch(/^Actualizado por Ana Quispe el .*2026/)
    expect(describirActualizacion(config({ actualizadoPor: null }))).toMatch(/^Actualizado el .*2026/)
  })
})
