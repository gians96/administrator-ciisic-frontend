import { describe, expect, it } from 'vitest'
import {
  codigoDeNombreArchivo,
  documentoConsulta,
  enlaceCertificado,
  enlaceConsulta,
  enTandas,
  filtrosCertificadosDesdeQuery,
  parametrosApi,
  parametrosCertificados,
  resumenEnvioCertificados,
  tipoLegible,
} from '~/utils/certificados'
import { codigoCertificado, documentoCertificado } from '../server/utils/certificados-publicos'

describe('codigoDeNombreArchivo (igual que el backend)', () => {
  it.each([
    ['1GUdLMfaPT[R][R][R].pdf', '1GUdLMfaPT'],
    ['WBVTYDJEKq.PDF', 'WBVTYDJEKq'],
    ['ABCD1234 [R] (1).pdf', 'ABCD1234'],
    ['carpeta\\2N5y6JhwrS[R][R].pdf', '2N5y6JhwrS'],
  ])('%s → %s', (nombre, codigo) => {
    expect(codigoDeNombreArchivo(nombre)).toBe(codigo)
  })

  it.each(['notas.txt', 'certificado de ana.pdf', '[R].pdf'])('rechaza «%s»', (nombre) => {
    expect(codigoDeNombreArchivo(nombre)).toBeNull()
  })
})

describe('filtros', () => {
  it('lee y escribe la URL sin valores vacíos', () => {
    const filtros = filtrosCertificadosDesdeQuery({ situacion: 'POR_ENTREGAR', q: 'ana', page: '2', sinInscripcion: 'true' })
    expect(filtros).toEqual({ vista: 'certificados', situacion: 'POR_ENTREGAR', q: 'ana', sinInscripcion: true, page: 2 })
    expect(parametrosCertificados(filtros)).toEqual({ situacion: 'POR_ENTREGAR', q: 'ana', sinInscripcion: 'true', page: 2 })
    expect(filtrosCertificadosDesdeQuery({ situacion: 'OTRA', page: '-1' })).toMatchObject({ situacion: '', page: 1 })
  })

  it('la vista de pagados no lleva filtros de certificados y la vista no va a la API', () => {
    const filtros = filtrosCertificadosDesdeQuery({ vista: 'pagados', situacion: 'ENTREGADO', q: 'x' })
    expect(parametrosCertificados(filtros)).toEqual({ vista: 'pagados', q: 'x' })
    expect(parametrosApi(filtros)).toEqual({ q: 'x' })
  })
})

describe('utilidades', () => {
  it('arma los enlaces públicos', () => {
    expect(enlaceCertificado('https://admin.test/', 'AbC12345')).toBe('https://admin.test/certificado/AbC12345')
    expect(enlaceConsulta('https://admin.test')).toBe('https://admin.test/consulta-certificados')
  })

  it('parte en tandas de 10', () => {
    expect(enTandas(Array.from({ length: 23 }, (_, i) => i)).map(t => t.length)).toEqual([10, 10, 3])
  })

  it('valida el DNI y el código de las consultas públicas', () => {
    expect(documentoConsulta('2442123')).toBe('2442123')
    expect(documentoConsulta('123')).toBeNull()
    expect(documentoCertificado(' 15357430 ')).toBe('15357430')
    expect(documentoCertificado('abc')).toBeNull()
    expect(codigoCertificado('WBVTYDJEKq')).toBe('WBVTYDJEKq')
    expect(codigoCertificado('../etc')).toBeNull()
  })

  it('tipo legible', () => {
    expect(tipoLegible('ASISTENTE')).toBe('Asistente')
    expect(tipoLegible('')).toBe('Certificado')
  })

  it('resume el envío', () => {
    const lineas = resumenEnvioCertificados({ resultado: { enviados: 3, yaEnviados: 1, noElegibles: 0, fallidos: 1 }, corte: { tipo: 'detenido' } }, null)
    expect(lineas.map(l => l.tono)).toEqual(['ok', 'warn', 'error', 'warn'])
    expect(lineas[0].texto).toBe('Certificado enviado a 3 personas.')
  })
})
