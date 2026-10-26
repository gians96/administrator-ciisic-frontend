<script setup lang="ts">
definePageMeta({ permiso: 'inscripciones.ver' })
useHead({ title: 'Credencial 3D · Panel CIISIC' })

const auth = useAuthStore()
const eventos = useEventoStore()

/** Ver la lista basta con `inscripciones.ver`; enviar es lo mismo que reenviar la credencial. */
const puedeEnviar = computed(() => auth.puede('credenciales.reenviar'))
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">{{ eventos.seleccionado?.nombreCorto }}</p>
      <h1 class="mt-1 text-3xl font-extrabold">Credencial 3D</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-400">
        Envía a cada inscrito presencial con el pago aprobado el enlace a su credencial digital: ahí ve sus datos y elige las tecnologías que usa.
        Cada persona recibe su propio enlace y queda marcada como «enviado»; la próxima vez eliges solo a quien falta.
        Necesita la URL de la landing en Sistema y una credencial de correo activa en Correo.
      </p>
    </div>

    <PanelEnvio
      canal="credencial"
      :puede-enviar="puedeEnviar"
      texto-enviar="Enviar el enlace"
      que-recibe="Cada persona recibe un correo con el botón «Ver mi credencial» y su enlace personal a la credencial 3D."
    />
  </div>
</template>
