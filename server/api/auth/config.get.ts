/**
 * Configuración pública del login que no es Google: hoy, si se ofrece el acceso al portal con un
 * código por correo (`accesoCodigo.disponible` de `GET /v1/auth/config`, spec 014 del backend). Un
 * backend anterior no envía la clave, o si no responde: no se ofrece.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const config = await $fetch(backendUrl(event, '/api/v1/auth/config')).catch(() => null)
  return { accesoCodigo: { disponible: accesoCodigoDisponible(config) } }
})
