<script setup lang="ts">
import { MENSAJES_POR_CODIGO } from '~/utils/errores'
import { inicioPara, RUTA_SIN_ACCESO } from '~/utils/permisos'

// Sin `permiso`: es el destino de las cuentas de staff sin ninguna sección del panel
definePageMeta({ layout: 'blank' })
useHead({ title: 'Sin acceso · Panel CIISIC' })

const auth = useAuthStore()
const eventos = useEventoStore()
const toast = useToast()
const reintentando = ref(false)
const saliendo = ref(false)

// Una cuenta que ya puede abrir alguna sección no se queda aquí
const inicioActual = inicioPara(auth.acceso)
if (inicioActual !== RUTA_SIN_ACCESO) navigateTo(inicioActual, { replace: true })

/** Vuelve a leer los permisos (p. ej. si acaban de asignarle eventos o permisos) y entra si ya puede. */
async function reintentar() {
  reintentando.value = true
  try {
    const lectura = await auth.refrescarAcceso(true)
    if (lectura === 'CERRADA') return navigateTo('/login')
    // El backend no respondió: no se sabe si ya tiene permisos
    if (lectura === 'NO_DISPONIBLE') return toast.error(MENSAJES_POR_CODIGO.SESSION_UNAVAILABLE ?? 'No se pudo verificar tu cuenta.')
    const inicio = inicioPara(auth.acceso)
    if (inicio !== RUTA_SIN_ACCESO) {
      // Los eventos asignados pudieron cambiar junto con los permisos
      if (eventos.cargado) await eventos.recargar().catch(() => undefined)
      return navigateTo(inicio)
    }
    toast.info('Tu cuenta todavía no tiene permisos ni eventos asignados en el panel.')
  } finally {
    reintentando.value = false
  }
}

async function salir() {
  saliendo.value = true
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center px-4 py-10">
    <section class="card w-full max-w-md p-8 text-center sm:p-10">
      <span class="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">
        <Icon name="heroicons:lock-closed" class="size-8" aria-hidden="true" />
      </span>
      <p class="kicker">Panel CIISIC</p>
      <h1 class="mt-2 text-2xl font-extrabold">Tu cuenta no tiene acceso a ninguna sección</h1>
      <p class="mt-3 text-sm text-slate-400">
        Hola{{ auth.usuario ? `, ${auth.usuario.nombres}` : '' }}. Tu cuenta aún no tiene permisos ni eventos asignados en el
        panel. Pide a un Owner o a un Administrador del sistema que te los asigne y luego pulsa «Volver a intentar».
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <AppButton icon="heroicons:arrow-path" :loading="reintentando" :disabled="saliendo" @click="reintentar">Volver a intentar</AppButton>
        <AppButton variant="secondary" icon="heroicons:arrow-right-on-rectangle" :loading="saliendo" @click="salir">Cerrar sesión</AppButton>
      </div>
    </section>
  </div>
</template>
