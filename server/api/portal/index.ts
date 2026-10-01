/**
 * Raíz del proxy del portal: `/api/portal` → `<backend>/api/v1/me` (perfil del inscrito). La ruta
 * `[...path].ts` no recibe la raíz (sin segmentos), así que esta la atiende con el mismo proxy.
 */
export default defineEventHandler((event) => proxyAutenticado(event, { perfil: 'PARTICIPANTE', prefijo: '/api/v1/me', rutaVaciaPermitida: true }))
