/**
 * Proxy autenticado hacia backend-ciisic: `/api/backend/<ruta>` → `<backend>/api/v1/<ruta>`.
 * Agrega el Bearer desde la cookie httpOnly y transmite cuerpos multipart y archivos
 * (vouchers, credenciales, CSV) sin cargarlos en memoria.
 */
const RUTA_VALIDA = /^[\w\-./]+$/

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const token = tokenDeSesion(event)
  if (!token) {
    throw createError({ statusCode: 401, data: { success: false, code: 'SESSION_EXPIRED', message: 'Tu sesión expiró. Inicia sesión nuevamente.' } })
  }

  const path = getRouterParam(event, 'path') ?? ''
  if (!path || !RUTA_VALIDA.test(path) || path.split('/').some((segmento) => segmento === '..' || segmento === '.')) {
    throw createError({ statusCode: 400, data: { success: false, code: 'BAD_PATH', message: 'Ruta inválida' } })
  }

  const { search } = getRequestURL(event)
  const target = backendUrl(event, `/api/v1/${path}${search}`)

  return proxyRequest(event, target, {
    headers: {
      authorization: `Bearer ${token}`,
      cookie: '',
    },
    onResponse(proxyEvent, response) {
      // Si el backend invalida el token, se cierra la sesión del panel
      if (response.status === 401) cerrarSesion(proxyEvent)
    },
  })
})
