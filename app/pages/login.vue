<script setup lang="ts">
import type { TipoSesion } from '~/types/api'
import { aErrorApi } from '~/utils/errores'
import { avisoLogin, destinoTrasLogin } from '~/utils/sesion'

definePageMeta({ layout: 'blank' })
useHead({ title: 'Iniciar sesión · Panel CIISIC' })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const correo = ref('')
const contrasena = ref('')
const enviando = ref(false)
const entrandoConGoogle = ref(false)
const error = ref<string | null>(avisoLogin(route.query.motivo))
const botonGoogle = ref<{ reiniciar: () => Promise<void> } | null>(null)
/** Se llegó porque el backend no respondió al verificar la sesión: la cookie puede seguir siendo válida. */
const sesionSinVerificar = ref(route.query.motivo === 'SESSION_UNAVAILABLE')
const verificando = ref(false)

/** Vuelve a `redirect` si la cuenta puede abrirla; si no, a su página de inicio. */
function destino(tipo: TipoSesion) {
  return destinoTrasLogin(tipo, route.query.redirect, auth.acceso, (ruta) => router.resolve(ruta).meta)
}

/** Vuelve a leer la sesión guardada; si sigue abierta, entra sin pedir la contraseña. */
async function reintentarSesion() {
  verificando.value = true
  try {
    const lectura = await auth.cargarSesion()
    if (lectura === 'VIGENTE' && auth.tipo) return navigateTo(destino(auth.tipo))
    if (lectura === 'CERRADA') {
      // No había sesión: solo queda ingresar
      sesionSinVerificar.value = false
      error.value = null
    }
  } finally {
    verificando.value = false
  }
}

async function ingresar() {
  error.value = null
  sesionSinVerificar.value = false
  enviando.value = true
  try {
    const tipo = await auth.login(correo.value.trim(), contrasena.value)
    await navigateTo(destino(tipo))
  } catch (e) {
    error.value = aErrorApi(e).message
  } finally {
    enviando.value = false
  }
}

async function ingresarConGoogle(credential: string) {
  error.value = null
  sesionSinVerificar.value = false
  entrandoConGoogle.value = true
  try {
    const tipo = await auth.loginGoogle(credential)
    await navigateTo(destino(tipo))
  } catch (e) {
    error.value = aErrorApi(e).message
    // El nonce es de un solo uso: se pide uno nuevo para el siguiente intento
    await botonGoogle.value?.reiniciar().catch(() => undefined)
  } finally {
    entrandoConGoogle.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center px-4 py-10">
    <section class="card w-full max-w-md p-8 sm:p-10">
      <div class="mb-8 text-center">
        <span class="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
          <Icon name="heroicons:cpu-chip" class="size-8" aria-hidden="true" />
        </span>
        <p class="kicker">Congreso CIISIC · UNDC</p>
        <h1 class="mt-2 text-3xl font-extrabold">Panel administrativo</h1>
        <p class="mt-2 text-sm text-slate-400">Ingresa con tu cuenta de administrador.</p>
      </div>

      <form class="space-y-5" novalidate @submit.prevent="ingresar">
        <AppField label="Correo" for="correo" required>
          <input id="correo" v-model="correo" type="email" autocomplete="username" required class="field-control" placeholder="admin@undc.edu.pe">
        </AppField>
        <AppField label="Contraseña" for="contrasena" required>
          <input id="contrasena" v-model="contrasena" type="password" autocomplete="current-password" required class="field-control">
        </AppField>
        <div v-if="error" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">
          <p>{{ error }}</p>
          <AppButton v-if="sesionSinVerificar" size="sm" variant="secondary" icon="heroicons:arrow-path" class="mt-3" :loading="verificando" @click="reintentarSesion">
            Reintentar
          </AppButton>
        </div>
        <AppButton type="submit" class="w-full" :loading="enviando" :disabled="!correo || !contrasena || entrandoConGoogle">Ingresar</AppButton>
      </form>

      <ClientOnly>
        <BotonGoogle ref="botonGoogle" class="mt-6" @credencial="ingresarConGoogle">
          <template #antes>
            <div class="mb-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
              <span class="h-px flex-1 bg-white/10" />
              o continúa con Google
              <span class="h-px flex-1 bg-white/10" />
            </div>
          </template>
          <template #despues>
            <p v-if="entrandoConGoogle" class="mt-3 text-center text-sm text-slate-300" aria-live="polite">Validando tu cuenta de Google…</p>
            <p class="mt-4 text-center text-xs leading-relaxed text-slate-400">
              ¿Te inscribiste a un evento? Entra con la cuenta de Google del correo que usaste al inscribirte
              para ver el estado de tu inscripción.
            </p>
          </template>
        </BotonGoogle>
      </ClientOnly>
    </section>
  </div>
</template>
