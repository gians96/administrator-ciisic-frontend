import { describe, expect, it } from 'vitest'
import { ESPERA_PDF_OCUPADO_MS, esperaParaReintentarDescarga, leerCuerpoDeError, nombreDeArchivo } from '~/utils/descargas'
import { aErrorApi } from '~/utils/errores'

/** Error como el de `$fetch` (ofetch): `data` lee `response._data`. */
function errorFetch(status: number, cuerpo: unknown) {
  const response = { status, _data: cuerpo }
  return {
    response,
    get status() { return response.status },
    get data() { return response._data },
  }
}

describe('portal: descarga de la credencial', () => {
  it('nombre del archivo de Content-Disposition', () => {
    expect(nombreDeArchivo('attachment; filename="credencial-CIISIC2026-12.pdf"', 'x.pdf')).toBe('credencial-CIISIC2026-12.pdf')
    expect(nombreDeArchivo('attachment; filename=credencial.pdf', 'x.pdf')).toBe('credencial.pdf')
    expect(nombreDeArchivo(`attachment; filename="a.pdf"; filename*=UTF-8''credencial-%C3%B1and%C3%BA.pdf`, 'x.pdf')).toBe('credencial-ñandú.pdf')
  })

  it('sin nombre, con rutas o inválido, usa el respaldo o lo limpia', () => {
    expect(nombreDeArchivo(null, 'credencial-12.pdf')).toBe('credencial-12.pdf')
    expect(nombreDeArchivo('attachment', 'credencial-12.pdf')).toBe('credencial-12.pdf')
    expect(nombreDeArchivo('attachment; filename=""', 'credencial-12.pdf')).toBe('credencial-12.pdf')
    expect(nombreDeArchivo('attachment; filename="../../etc/passwd"', 'x.pdf')).toBe('.._.._etc_passwd')
    expect(nombreDeArchivo(`attachment; filename*=UTF-8''%E0%A4%A; filename="b.pdf"`, 'x.pdf')).toBe('b.pdf')
  })

  it('el error que llegó como Blob se lee como JSON (503 PDF_BUSY en vez de un error sin código)', async () => {
    const error = errorFetch(503, new Blob([JSON.stringify({ success: false, code: 'PDF_BUSY', message: 'Ocupado' })], { type: 'application/json' }))
    expect(aErrorApi(error).code).toBe('ERROR')
    await leerCuerpoDeError(error)
    expect(aErrorApi(error)).toMatchObject({ status: 503, code: 'PDF_BUSY' })
  })

  it('un cuerpo que no es JSON (o que no es Blob) se deja como está', async () => {
    const html = errorFetch(502, new Blob(['<html>Bad gateway</html>'], { type: 'text/html' }))
    await leerCuerpoDeError(html)
    expect(aErrorApi(html)).toMatchObject({ status: 502, code: 'ERROR' })
    const json = errorFetch(409, { code: 'NOT_APPROVED' })
    await leerCuerpoDeError(json)
    expect(aErrorApi(json).code).toBe('NOT_APPROVED')
    await expect(leerCuerpoDeError(null)).resolves.toBeUndefined()
    await expect(leerCuerpoDeError(new Error('red'))).resolves.toBeUndefined()
  })

  it('PDF_BUSY se reintenta una sola vez a los 3 s; lo demás se muestra', () => {
    expect(esperaParaReintentarDescarga('PDF_BUSY', 0)).toBe(ESPERA_PDF_OCUPADO_MS)
    expect(esperaParaReintentarDescarga('PDF_BUSY', 1)).toBeNull()
    expect(esperaParaReintentarDescarga('NOT_APPROVED', 0)).toBeNull()
    expect(esperaParaReintentarDescarga('RATE_LIMITED', 0)).toBeNull()
  })
})
