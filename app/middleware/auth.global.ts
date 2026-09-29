import { destinoTrasLogin, redireccionPara } from '~/utils/sesion'

/**
 * Protege todas las páginas salvo el login y aplica el perfil de la sesión: el inscrito solo entra a
 * las páginas `perfil: 'participante'`; el administrador, al resto (las `soloSuperAdmin` según su rol).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.verificado) await auth.cargarSesion()

  if (to.path === '/login') {
    if (auth.tipo) return navigateTo(destinoTrasLogin(auth.tipo, to.query.redirect))
    return
  }

  if (!auth.tipo) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })

  const destino = redireccionPara(auth.tipo, to.meta, auth.esSuperAdmin)
  if (destino && destino !== to.path) return navigateTo(destino)
})
