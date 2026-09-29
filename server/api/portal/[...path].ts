/**
 * Proxy del portal del inscrito: `/api/portal/<ruta>` → `<backend>/api/v1/me/<ruta>`.
 * Solo sesiones de inscrito: un administrador recibe 403 `FORBIDDEN_PROFILE`.
 */
export default defineEventHandler((event) => proxyAutenticado(event, { perfil: 'PARTICIPANTE', prefijo: '/api/v1/me', rutaVaciaPermitida: true }))
