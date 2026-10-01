import tailwindcss from '@tailwindcss/vite'

// Panel administrativo: SPA (sin SSR) + servidor Nitro como BFF.
// El JWT del backend vive en una cookie httpOnly y nunca llega a JavaScript del navegador.
export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  ssr: false,
  devtools: { enabled: false },

  modules: ['@pinia/nuxt', '@nuxt/icon', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  // Componentes por nombre de archivo (AppButton, EventoSelector…) sin prefijo de carpeta
  components: [{ path: '~/components', pathPrefix: false }],

  // Tailwind CSS v4 oficial vía su plugin de Vite (sin @nuxtjs/tailwindcss)
  vite: {
    plugins: [tailwindcss()],
  },

  icon: {
    serverBundle: { collections: ['heroicons'] },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Panel CIISIC',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#041d39' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=Poppins:wght@400;500;600&display=swap' },
      ],
    },
  },

  // Única variable de entorno: NUXT_BACKEND_BASE_URL. La cookie de sesión dura lo que el JWT del
  // backend (`expiraEn`) y el resto de la configuración vive en el backend.
  runtimeConfig: {
    // URL interna del backend-ciisic (sin /api/v1). Solo la usa el servidor Nitro.
    backendBaseUrl: 'http://localhost:3010',
  },

  nitro: {
    routeRules: {
      '/api/**': { headers: { 'cache-control': 'no-store' } },
      // wasm de ZXing del escáner (~1 MB): la ruta lleva la versión, así que no cambia nunca
      '/zxing-wasm/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    },
  },

  typescript: {
    strict: true,
  },
})
