<script setup lang="ts">
import { aErrorApi } from '~/utils/errores'
import { avisoLogin, destinoTrasLogin } from '~/utils/sesion'

definePageMeta({ layout: 'blank' })
useHead({ title: 'Iniciar sesión · Panel CIISIC' })

const auth = useAuthStore()
const route = useRoute()
const correo = ref('')
const contrasena = ref('')
const enviando = ref(false)
const entrandoConGoogle = ref(false)
const error = ref<string | null>(avisoLogin(route.query.motivo))
const botonGoogle = ref<{ reiniciar: () => Promise<void> } | null>(null)

async function ingresar() {
  error.value = null
  enviando.value = true
  try {
    const tipo = await auth.login(correo.value.trim(), contrasena.value)
    await navigateTo(destinoTrasLogin(tipo, route.query.redirect))
  } catch (e) {
    error.value = aErrorApi(e).message
  } finally {
    enviando.value = false
  }
}

async function ingresarConGoogle(credential: string) {
  error.value = null
  entrandoConGoogle.value = true
  try {
    const tipo = await auth.loginGoogle(credential)
    await navigateTo(destinoTrasLogin(tipo, route.query.redirect))
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
        <p v-if="error" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">{{ error }}</p>
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
