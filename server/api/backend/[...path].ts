/**
 * Proxy autenticado hacia backend-ciisic: `/api/backend/<ruta>` → `<backend>/api/v1/<ruta>`.
 * Solo sesiones de administrador: una sesión de inscrito recibe 403 `FORBIDDEN_PROFILE`.
 * Transmite cuerpos multipart y archivos (vouchers, credenciales, CSV) sin cargarlos en memoria.
 */
export default defineEventHandler((event) => proxyAutenticado(event, { perfil: 'ADMIN', prefijo: '/api/v1' }))
