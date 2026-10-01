<script setup lang="ts">
import type { TipoSesion } from '~/types/api'
import {
  esCodigoValido,
  esCorreoDeAcceso,
  formatoCuentaRegresiva,
  mensajeErrorCodigo,
  minutosDeVida,
  normalizarCodigo,
  normalizarCorreo,
  pasarAlCodigoTrasError,
  segundosParaReintentar,
} from '~/utils/codigoAcceso'
import { aErrorApi } from '~/utils/errores'

/**
 * Entrada al portal del inscrito con un código de 6 dígitos que llega a su correo (spec 014 del
 * backend), en dos pasos: correo → código. Con `correoFijo` (el staff que pasa a su portal) no se
 * pregunta el correo. La respuesta al pedir el código es la misma exista o no el correo. Al entrar
 * emite `ingreso`; quien lo usa decide a dónde ir.
 */
const props = withDefaults(defineProps<{ correoFijo?: string | null }>(), { correoFijo: null })
const emit = defineEmits<{ ingreso: [tipo: TipoSesion] }>()

const auth = useAuthStore()
const idCorreo = useId()
const idCodigo = useId()
const idAyudaCodigo = useId()
const campoCorreo = ref<HTMLInputElement | null>(null)
const campoCodigo = ref<HTMLInputElement | null>(null)

const paso = ref<'correo' | 'codigo'>('correo')
const correo = ref(props.correoFijo ?? '')
/** Correo al que se pidió el último código (el texto del paso 2 y la verificación usan este). */
const correoEnviado = ref('')
const codigo = ref('')
const enviando = ref(false)
const verificando = ref(false)
const error = ref<string | null>(null)
/** Aviso del paso 2 cuando no se envió uno nuevo (ya había uno reciente). */
const aviso = ref<string | null>(null)
const minutosVida = ref(10)

// Cuenta regresiva para pedir otro código
const reintentarHasta = ref<number | null>(null)
/** Correo al que aplica la espera (la de 60 s es por correo); `null`: a todos (límite por red, pausa). */
const esperaDeCorreo = ref<string | null>(null)
const ahora = ref(Date.now())
let reloj: ReturnType<typeof setInterval> | null = null

const correoEfectivo = computed(() => normalizarCorreo(props.correoFijo ?? correo.value))
const restante = computed(() => {
  if (!reintentarHasta.value || (esperaDeCorreo.value && esperaDeCorreo.value !== correoEfectivo.value)) return 0
  return Math.max(0, Math.ceil((reintentarHasta.value - ahora.value) / 1000))
})
const correoValido = computed(() => esCorreoDeAcceso(correoEfectivo.value))
const codigoCompleto = computed(() => esCodigoValido(codigo.value))

function detenerReloj() {
  if (reloj) clearInterval(reloj)
  reloj = null
}

function esperar(segundos: number | null, deCorreo: string | null) {
  if (!segundos) return
  ahora.value = Date.now()
  reintentarHasta.value = ahora.value + segundos * 1000
  esperaDeCorreo.value = deCorreo
  detenerReloj()
  reloj = setInterval(() => {
    ahora.value = Date.now()
    if (restante.value <= 0) detenerReloj()
  }, 1000)
}

onBeforeUnmount(detenerReloj)

async function enfocarCodigo() {
  await nextTick()
  campoCodigo.value?.focus()
}

async function pedirCodigo() {
  if (!correoValido.value || enviando.value || restante.value > 0) return
  error.value = null
  aviso.value = null
  enviando.value = true
  const destino = correoEfectivo.value
  try {
    const { expiraEnSegundos, reintentarEnSegundos } = await auth.solicitarCodigo(destino)
    correoEnviado.value = destino
    minutosVida.value = minutosDeVida(expiraEnSegundos)
    codigo.value = ''
    paso.value = 'codigo'
    esperar(reintentarEnSegundos, destino)
    await enfocarCodigo()
  } catch (e) {
    const porCorreo = pasarAlCodigoTrasError(e)
    esperar(segundosParaReintentar(e), porCorreo ? destino : null)
    if (porCorreo) {
      // Hace poco se pidió uno para este correo: los dos últimos siguen sirviendo
      correoEnviado.value = destino
      aviso.value = `${aErrorApi(e).message} Si ya te llegó un código, escríbelo aquí.`
      paso.value = 'codigo'
      await enfocarCodigo()
    } else {
      error.value = mensajeErrorCodigo(e)
    }
  } finally {
    enviando.value = false
  }
}

async function verificar() {
  if (!codigoCompleto.value || verificando.value) return
  error.value = null
  verificando.value = true
  try {
    emit('ingreso', await auth.verificarCodigo(correoEnviado.value, codigo.value))
  } catch (e) {
    error.value = mensajeErrorCodigo(e)
    const { code } = aErrorApi(e)
    if (code === 'INVALID_CODE' || code === 'CODE_EXPIRED') {
      codigo.value = ''
      await enfocarCodigo()
    }
  } finally {
    verificando.value = false
  }
}

function alEscribirCodigo(evento: Event) {
  const campo = evento.target as HTMLInputElement
  codigo.value = normalizarCodigo(campo.value)
  campo.value = codigo.value
  // El autocompletado del celular (one-time-code) o pegar el código lo envía solo
  if (codigoCompleto.value) verificar()
}

async function usarOtroCorreo() {
  paso.value = 'correo'
  codigo.value = ''
  error.value = null
  aviso.value = null
  await nextTick()
  campoCorreo.value?.focus()
}
</script>

<template>
  <div>
    <form v-if="paso === 'correo'" class="space-y-4" novalidate @submit.prevent="pedirCodigo">
      <p v-if="correoFijo" class="text-sm text-slate-300">
        Te enviaremos un código de 6 dígitos a <span class="font-medium break-all text-white">{{ correoFijo }}</span>.
      </p>
      <AppField v-else label="Correo con el que te inscribiste" :for="idCorreo" required>
        <input
          :id="idCorreo"
          ref="campoCorreo"
          v-model="correo"
          type="email"
          inputmode="email"
          autocomplete="email"
          required
          class="field-control"
          placeholder="tucorreo@gmail.com"
        >
      </AppField>
      <p v-if="error" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">{{ error }}</p>
      <AppButton type="submit" variant="secondary" class="w-full" icon="heroicons:envelope" :loading="enviando" :disabled="!correoValido || restante > 0">
        {{ restante > 0 ? `Podrás pedir un código en ${formatoCuentaRegresiva(restante)}` : 'Enviarme un código' }}
      </AppButton>
    </form>

    <form v-else class="space-y-4" novalidate @submit.prevent="verificar">
      <p class="text-sm leading-relaxed text-slate-300" aria-live="polite">
        <template v-if="aviso">{{ aviso }}</template>
        <template v-else>
          Si <span class="font-medium break-all text-white">{{ correoEnviado }}</span> está registrado, te llegará un
          código de 6 dígitos en unos segundos. Vence en {{ minutosVida }} minutos; revisa también la carpeta de spam.
        </template>
      </p>
      <AppField label="Código de 6 dígitos" :for="idCodigo" required>
        <input
          :id="idCodigo"
          ref="campoCodigo"
          :value="codigo"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]*"
          required
          :aria-describedby="idAyudaCodigo"
          :aria-invalid="Boolean(error)"
          class="field-control text-center font-mono text-2xl tracking-[0.4em]"
          placeholder="000000"
          @input="alEscribirCodigo"
        >
        <p :id="idAyudaCodigo" class="field-hint">Escribe solo los números; también puedes pegarlo.</p>
      </AppField>
      <p v-if="error" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">{{ error }}</p>
      <AppButton type="submit" class="w-full" :loading="verificando" :disabled="!codigoCompleto">Ingresar a mi portal</AppButton>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          class="font-medium text-brand-300 transition hover:text-brand-200 disabled:cursor-not-allowed disabled:text-slate-500"
          :disabled="restante > 0 || enviando"
          @click="pedirCodigo"
        >
          <span v-if="restante > 0" aria-live="off">Reenviar código en {{ formatoCuentaRegresiva(restante) }}</span>
          <span v-else>{{ enviando ? 'Enviando…' : 'Reenviar código' }}</span>
        </button>
        <button v-if="!correoFijo" type="button" class="text-slate-400 transition hover:text-white" @click="usarOtroCorreo">Usar otro correo</button>
      </div>
    </form>
  </div>
</template>
