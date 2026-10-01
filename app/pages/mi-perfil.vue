<script setup lang="ts">
import { aErrorApi } from '~/utils/errores'
import { errorCelularPerfil, esPerfilAmpliado, nombreTipoDocumento, normalizarCelularPerfil } from '~/utils/miPerfil'
import { esNoDisponible, MENSAJE_PRONTO_DISPONIBLE, type PerfilPortal } from '~/utils/portal'

/**
 * Perfil del inscrito (`GET /me` y `PATCH /me/profile`, spec 014): nombres, documento y correo de solo
 * lectura (son su identidad y la llave de su sesión), el celular editable y la foto opcional del
 * fotocheck (`PortalFotoPerfil`). Con un backend anterior a la 014 solo llegan los datos de identidad:
 * el celular y la foto se muestran como «pronto disponible».
 */
definePageMeta({ layout: 'participante', perfil: 'participante' })
useHead({ title: 'Mi perfil · CIISIC' })

const { portal } = usePortal()
const toast = useToast()

const perfil = ref<PerfilPortal | null>(null)
const estado = ref<'cargando' | 'listo' | 'no-disponible' | 'error'>('cargando')
const error = ref<string | null>(null)

const celular = ref('')
const errorCelular = ref<string | null>(null)
const guardandoCelular = ref(false)
const idCelular = useId()

const ampliado = computed(() => (perfil.value ? esPerfilAmpliado(perfil.value) : false))
const celularCambio = computed(() => normalizarCelularPerfil(celular.value) !== normalizarCelularPerfil(perfil.value?.celular ?? ''))

async function cargar() {
  estado.value = 'cargando'
  error.value = null
  try {
    const { data } = await portal<{ data: PerfilPortal }>('')
    perfil.value = data
    celular.value = data.celular ?? ''
    errorCelular.value = null
    estado.value = 'listo'
  } catch (e) {
    if (esNoDisponible(e)) {
      estado.value = 'no-disponible'
      return
    }
    if (aErrorApi(e).status === 401) return
    error.value = aErrorApi(e).message
    estado.value = 'error'
  }
}

async function guardarCelular() {
  errorCelular.value = errorCelularPerfil(celular.value)
  if (errorCelular.value) return
  guardandoCelular.value = true
  try {
    const { data } = await portal<{ data: PerfilPortal }>('profile', { method: 'PATCH', body: { celular: normalizarCelularPerfil(celular.value) } })
    perfil.value = data
    celular.value = data.celular ?? ''
    toast.exito('Guardamos tu celular.')
  } catch (e) {
    const { status, fields, message } = aErrorApi(e)
    if (status === 401) return
    if (esNoDisponible(e)) errorCelular.value = MENSAJE_PRONTO_DISPONIBLE
    else if (fields?.celular) errorCelular.value = fields.celular
    else toast.error(message)
  } finally {
    guardandoCelular.value = false
  }
}

function alCambiarFoto(foto: { tiene: boolean, actualizadaEn?: string | null }) {
  if (perfil.value) perfil.value = { ...perfil.value, foto: { tiene: foto.tiene, actualizadaEn: foto.actualizadaEn ?? null } }
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="kicker">Portal del inscrito</p>
      <h1 class="mt-1 text-3xl font-extrabold">Mi perfil</h1>
      <p class="mt-2 text-sm text-slate-400">Tus datos de inscripción, tu celular y la foto de tu fotocheck.</p>
    </div>

    <PortalEstado v-if="estado === 'cargando'" estado="cargando" texto="Cargando tu perfil…" />
    <PortalEstado v-else-if="estado === 'error'" estado="error" :texto="error" @reintentar="cargar" />
    <PortalEstado v-else-if="estado === 'no-disponible' || !perfil" estado="no-disponible" icon="heroicons:user-circle" />

    <template v-else>
      <section class="card p-5 sm:p-6" aria-labelledby="perfil-datos">
        <h2 id="perfil-datos" class="text-lg font-bold">Tus datos</h2>
        <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs tracking-wider text-slate-500 uppercase">Nombres</dt>
            <dd class="mt-1 text-slate-200">{{ perfil.nombres }}</dd>
          </div>
          <div>
            <dt class="text-xs tracking-wider text-slate-500 uppercase">Apellidos</dt>
            <dd class="mt-1 text-slate-200">{{ perfil.apellidos }}</dd>
          </div>
          <div>
            <dt class="text-xs tracking-wider text-slate-500 uppercase">{{ nombreTipoDocumento(perfil.tipoDocumento) }}</dt>
            <dd class="mt-1 font-mono text-slate-200">{{ perfil.numeroDocumento }}</dd>
          </div>
          <div>
            <dt class="text-xs tracking-wider text-slate-500 uppercase">Correo</dt>
            <dd class="mt-1 break-all text-slate-200">{{ perfil.correo }}</dd>
            <dd v-if="perfil.google" class="mt-0.5 text-xs text-slate-400">
              {{ perfil.google.vinculado ? 'Vinculado a tu cuenta de Google.' : 'Sin cuenta de Google vinculada: entras con un código a este correo.' }}
            </dd>
          </div>
        </dl>
        <p class="mt-5 flex gap-2 rounded-xl bg-white/5 px-4 py-3 text-xs text-slate-400 ring-1 ring-white/10">
          <Icon name="heroicons:lock-closed" class="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span>
            Tus nombres, tu documento y tu correo no se cambian aquí: identifican tu inscripción, y tu correo es con el que
            entras al portal y recibes tu credencial. Si hay un error, escribe a la organización del evento.
          </span>
        </p>
      </section>

      <section class="card p-5 sm:p-6" aria-labelledby="perfil-celular">
        <h2 id="perfil-celular" class="text-lg font-bold">Celular</h2>
        <p v-if="!ampliado" class="mt-2 text-sm text-slate-400">
          {{ MENSAJE_PRONTO_DISPONIBLE }} Por ahora, si necesitas cambiarlo, escribe a la organización del evento.
        </p>
        <form v-else class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start" novalidate @submit.prevent="guardarCelular">
          <div class="sm:max-w-xs sm:flex-1">
            <label :for="idCelular" class="sr-only">Número de celular</label>
            <input
              :id="idCelular"
              v-model="celular"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              maxlength="20"
              class="field-control"
              placeholder="987654321"
              :aria-invalid="Boolean(errorCelular)"
              :aria-describedby="`${idCelular}-ayuda`"
              :disabled="guardandoCelular"
              @input="errorCelular = null"
            >
            <p v-if="errorCelular" :id="`${idCelular}-ayuda`" class="field-error" role="alert">{{ errorCelular }}</p>
            <p v-else :id="`${idCelular}-ayuda`" class="field-hint">Para que la organización pueda contactarte. Con el código de país si no es de Perú.</p>
          </div>
          <AppButton type="submit" icon="heroicons:check" :loading="guardandoCelular" :disabled="!celularCambio">Guardar celular</AppButton>
        </form>
      </section>

      <section class="card p-5 sm:p-6" aria-labelledby="perfil-foto">
        <h2 id="perfil-foto" class="text-lg font-bold">Foto para tu fotocheck</h2>
        <p v-if="!ampliado || !perfil.foto" class="mt-2 text-sm text-slate-400">{{ MENSAJE_PRONTO_DISPONIBLE }}</p>
        <PortalFotoPerfil v-else class="mt-4" :foto="perfil.foto" @cambio="alCambiarFoto" />
      </section>
    </template>
  </div>
</template>
