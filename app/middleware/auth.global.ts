/** Protege todas las páginas salvo el login; los administradores de SuperAdmin se validan por página. */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.verificado) await auth.cargarSesion()

  if (to.path === '/login') {
    if (auth.usuario) return navigateTo('/')
    return
  }

  if (!auth.usuario) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })

  if (to.meta.soloSuperAdmin && !auth.esSuperAdmin) return navigateTo('/')
})
