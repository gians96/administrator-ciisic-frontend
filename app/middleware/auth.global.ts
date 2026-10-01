import { destinoTrasLogin, redireccionPara, rutaLoginTrasCierre } from '~/utils/sesion'

/**
 * Protege todas las páginas salvo el login y aplica el perfil de la sesión: el inscrito solo entra a
 * las páginas `perfil: 'participante'`; el staff, a las que su acceso permite (`permiso` de la página).
 * Si la sesión no se pudo verificar (backend caído), va al login con el aviso `SESSION_UNAVAILABLE`
 * (la cookie se conserva y la siguiente navegación lo vuelve a intentar).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.verificado) await auth.cargarSesion()

  if (to.path === '/login') {
    if (!auth.tipo) return
    const router = useRouter()
    return navigateTo(destinoTrasLogin(auth.tipo, to.query.redirect, auth.acceso, (ruta) => router.resolve(ruta).meta))
  }

  if (!auth.tipo) return navigateTo(rutaLoginTrasCierre(auth.verificado ? '' : 'SESSION_UNAVAILABLE', to.fullPath))

  const destino = redireccionPara(auth.tipo, to.meta, auth.acceso, to.path)
  if (destino && destino !== to.path) return navigateTo(destino)
})
