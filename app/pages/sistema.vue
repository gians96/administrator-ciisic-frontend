<script setup lang="ts">
import type { ConfiguracionSistema, PruebaUndcApi, Respuesta } from '~/types/api'
import { fechaHoraLima } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import {
  AVISO_DESACTIVAR_LEGACY,
  avisoUrlPanel,
  CAMPOS_POR_TARJETA,
  codigoHttpPrueba,
  confirmacionCambiosSistema,
  cuerpoDeTarjeta,
  describirActualizacion,
  erroresDeGuardado,
  erroresDeTarjeta,
  ETIQUETAS_CAMPOS_SISTEMA,
  estadoUndcApi,
  formularioSistema,
  hayCambiosEnTarjeta,
  latenciaPrueba,
  origenDe,
  origenesAutorizados,
  reiniciarTarjeta,
  TIMEOUT_MAXIMO_MS,
  TIMEOUT_MINIMO_MS,
  validarSistema,
  type CampoSistema,
  type TarjetaSistema,
} from '~/utils/configuracionSistema'

definePageMeta({ soloSuperAdmin: true })
useHead({ title: 'Sistema · Panel CIISIC' })

type ResultadoPrueba = Omit<PruebaUndcApi, 'configuracion'>

const TARJETAS: readonly TarjetaSistema[] = ['undc', 'google', 'panel', 'legacy']

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()
const { copiado, copiar } = useCopiar()

/** Origen desde el que se abrió el panel (sugerencia para la URL del panel y para Google). */
const origenPanel = useRequestURL().origin

const config = ref<ConfiguracionSistema | null>(null)
const form = reactive(formularioSistema())
const errores = ref<Record<string, string>>({})
const cargando = ref(false)
const errorCarga = ref<string | null>(null)
const guardando = ref<TarjetaSistema | null>(null)
const probando = ref(false)
/** Resultado de la última prueba de API_UNDC (solo en esta vista). */
const prueba = ref<ResultadoPrueba | null>(null)
const origenCopiado = ref<string | null>(null)

/** Actualiza la configuración y reinicia solo el formulario de las tarjetas indicadas. */
function aplicar(nueva: ConfiguracionSistema, tarjetas: readonly TarjetaSistema[]) {
  config.value = nueva
  for (const tarjeta of tarjetas) reiniciarTarjeta(form, nueva, tarjeta)
}

async function cargar() {
  cargando.value = true
  errorCarga.value = null
  try {
    aplicar((await api<Respuesta<ConfiguracionSistema>>('settings')).data, TARJETAS)
    errores.value = {}
  } catch (error) {
    errorCarga.value = mensajeError(error)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

const cambios = computed(() => Object.fromEntries(
  TARJETAS.map((tarjeta) => [tarjeta, config.value ? hayCambiosEnTarjeta(form, config.value, tarjeta) : false]),
) as Record<TarjetaSistema, boolean>)
const estadoUndc = computed(() => (config.value ? estadoUndcApi(config.value.undcApi) : null))
const origenes = computed(() => origenesAutorizados(origenPanel, config.value?.urlPanel))
const avisoPanel = computed(() => avisoUrlPanel(form.urlPanel))
const sugerirOrigen = computed(() => origenDe(form.urlPanel) !== origenPanel)
const motivoSinPrueba = computed(() => {
  if (!config.value?.undcApi.configurada) return 'Guarda la URL y la API key para poder probar la conexión.'
  if (cambios.value.undc) return 'Guarda los cambios para probar con la nueva configuración.'
  return null
})
const ayudaApiKey = computed(() => {
  if (form.quitarUndcApiKey) return 'La API key guardada se quitará al guardar.'
  const actual = config.value?.undcApi.apiKeyEnmascarada
  return actual ? `Actual: ${actual}. Déjala vacía para conservarla.` : 'Se guarda cifrada; solo se mostrarán sus últimos 4 caracteres.'
})

function limpiarErrores(tarjeta: TarjetaSistema) {
  const campos: readonly string[] = CAMPOS_POR_TARJETA[tarjeta]
  errores.value = Object.fromEntries(Object.entries(errores.value).filter(([campo]) => !campos.includes(campo)))
}

async function enviar(tarjeta: TarjetaSistema, cuerpo: Partial<Record<CampoSistema, unknown>>, mensajeExito: string) {
  guardando.value = tarjeta
  try {
    aplicar((await api<Respuesta<ConfiguracionSistema>>('settings', { method: 'PUT', body: cuerpo })).data, [tarjeta])
    // El backend reinicia el último estado si cambia la URL o la key: la prueba anterior ya no aplica
    if ('undcApiUrl' in cuerpo || 'undcApiKey' in cuerpo) prueba.value = null
    toast.exito(mensajeExito)
  } catch (error) {
    errores.value = { ...errores.value, ...erroresDeGuardado(aErrorApi(error), tarjeta) }
    toast.error(mensajeError(error, ETIQUETAS_CAMPOS_SISTEMA))
  } finally {
    guardando.value = null
  }
}

const MENSAJES_GUARDADO: Readonly<Record<Exclude<TarjetaSistema, 'legacy'>, string>> = {
  undc: 'Conexión con API_UNDC guardada.',
  google: 'Client ID de Google guardado.',
  panel: 'URL del panel guardada.',
}

async function guardar(tarjeta: Exclude<TarjetaSistema, 'legacy'>) {
  const original = config.value
  if (!original) return
  limpiarErrores(tarjeta)
  const invalidos = erroresDeTarjeta(validarSistema(form), tarjeta)
  if (Object.keys(invalidos).length) {
    errores.value = { ...errores.value, ...invalidos }
    return
  }
  const cuerpo = cuerpoDeTarjeta(form, original, tarjeta)
  if (!Object.keys(cuerpo).length) {
    toast.info('No hay cambios que guardar.')
    return
  }
  const aviso = confirmacionCambiosSistema(cuerpo)
  if (aviso && !(await confirmar({ titulo: 'Confirmar cambios', mensaje: aviso, textoConfirmar: 'Guardar', peligro: true }))) return
  await enviar(tarjeta, cuerpo, MENSAJES_GUARDADO[tarjeta])
}

async function cambiarLegacy(activas: boolean) {
  if (!activas && !(await confirmar({ titulo: 'Desactivar la landing anterior', mensaje: AVISO_DESACTIVAR_LEGACY, textoConfirmar: 'Desactivar', peligro: true }))) return
  await enviar('legacy', { rutasLegacyActivas: activas }, activas ? 'Rutas de la landing anterior activadas.' : 'Rutas de la landing anterior desactivadas.')
}

function alternarQuitarKey() {
  form.quitarUndcApiKey = !form.quitarUndcApiKey
  if (form.quitarUndcApiKey) form.undcApiKey = ''
}

async function probar() {
  probando.value = true
  try {
    const { configuracion, ...resultado } = (await api<Respuesta<PruebaUndcApi>>('settings/undc-api/test', { method: 'POST' })).data
    config.value = configuracion
    prueba.value = resultado
    if (resultado.ok) toast.exito('API_UNDC respondió correctamente.')
    else toast.error(`La prueba falló: ${resultado.mensaje}`)
  } catch (error) {
    toast.error(mensajeError(error))
    if (aErrorApi(error).code === 'UNDC_API_NOT_CONFIGURED') await cargar()
  } finally {
    probando.value = false
  }
}

async function copiarOrigen(origen: string) {
  if (await copiar(origen)) origenCopiado.value = origen
  else toast.info(`Tu navegador no permitió copiar. Selecciona el texto y cópialo: ${origen}`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Sistema</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Conexiones y opciones globales del backend. Los cambios se aplican al guardar, sin redesplegar. Solo un SuperAdmin puede verlas.
        </p>
      </div>
      <p v-if="config" class="text-xs text-slate-400">{{ describirActualizacion(config) }}</p>
    </div>

    <div v-if="cargando && !config" class="card py-14 text-center text-sm text-slate-400" role="status">Cargando configuración…</div>

    <section v-else-if="errorCarga && !config" class="card flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="size-8 text-red-300" aria-hidden="true" />
      <p class="max-w-md text-sm text-red-200">No se pudo cargar la configuración: {{ errorCarga }}</p>
      <AppButton variant="secondary" icon="heroicons:arrow-path" @click="cargar">Reintentar</AppButton>
    </section>

    <template v-else-if="config">
      <!-- (1) API UNDC -->
      <section class="card p-6" aria-labelledby="titulo-undc">
        <div class="flex items-start gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-400/20">
            <Icon name="heroicons:academic-cap" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 id="titulo-undc" class="text-lg font-bold">API UNDC</h2>
              <AppBadge v-if="estadoUndc" :tono="estadoUndc.tono">{{ estadoUndc.texto }}</AppBadge>
            </div>
            <p class="mt-0.5 text-sm text-slate-400">Verifica a los estudiantes UNDC cuando se inscriben en una categoría estudiantil.</p>
            <p class="mt-1 text-xs text-slate-400">Última prueba: {{ config.undcApi.ultimaPruebaEn ? fechaHoraLima(config.undcApi.ultimaPruebaEn) : 'Nunca' }}</p>
          </div>
        </div>

        <p v-if="config.undcApi.ultimoEstado === 'ERROR' && config.undcApi.ultimoError" class="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-200 ring-1 ring-red-400/25">
          <span class="font-semibold">Último error:</span> {{ config.undcApi.ultimoError }}
        </p>

        <form id="form-undc" class="mt-5 grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="guardar('undc')">
          <AppField label="URL de API_UNDC" for="si-undc-url" :error="errores.undcApiUrl" hint="La de la API (https://api-jp.episundc.pe), no la de SIGENET (jp.episundc.pe). https; http solo para localhost. Vacía = sin conexión." class="sm:col-span-2">
            <input id="si-undc-url" v-model="form.undcApiUrl" type="url" class="field-control font-mono" maxlength="255" autocomplete="off" spellcheck="false" placeholder="https://api-jp.episundc.pe">
          </AppField>
          <AppField label="API key" for="si-undc-key" :error="errores.undcApiKey" :hint="ayudaApiKey">
            <div class="flex items-center gap-2">
              <input
                id="si-undc-key"
                v-model="form.undcApiKey"
                type="password"
                autocomplete="new-password"
                spellcheck="false"
                data-1p-ignore
                data-lpignore="true"
                maxlength="500"
                class="field-control min-w-0 flex-1 font-mono"
                :placeholder="form.quitarUndcApiKey ? 'Se quitará al guardar' : config.undcApi.apiKeyEnmascarada ? 'Dejar vacío para conservar' : 'Pega la API key'"
                :disabled="form.quitarUndcApiKey"
              >
              <AppButton
                v-if="config.undcApi.apiKeyEnmascarada"
                size="sm"
                variant="ghost"
                :icon="form.quitarUndcApiKey ? 'heroicons:arrow-uturn-left' : 'heroicons:trash'"
                @click="alternarQuitarKey"
              >
                {{ form.quitarUndcApiKey ? 'Deshacer' : 'Quitar key' }}
              </AppButton>
            </div>
          </AppField>
          <AppField label="Tiempo de espera (ms)" for="si-undc-timeout" :error="errores.undcApiTimeoutMs" :hint="`Entre ${TIMEOUT_MINIMO_MS} y ${TIMEOUT_MAXIMO_MS} ms. Recomendado: 15000 (API_UNDC puede tardar varios segundos al consultar SIVIRENO).`">
            <input
              id="si-undc-timeout"
              v-model.number="form.undcApiTimeoutMs"
              type="number"
              inputmode="numeric"
              :min="TIMEOUT_MINIMO_MS"
              :max="TIMEOUT_MAXIMO_MS"
              step="500"
              class="field-control tabular-nums"
            >
          </AppField>
        </form>

        <div
          v-if="prueba"
          class="mt-5 rounded-xl p-4 text-sm ring-1 ring-inset"
          :class="prueba.ok ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/25' : 'bg-red-500/10 text-red-100 ring-red-400/25'"
          role="status"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="flex items-start gap-2 font-semibold">
              <Icon :name="prueba.ok ? 'heroicons:check-circle' : 'heroicons:x-circle'" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              {{ prueba.mensaje }}
            </p>
            <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Ocultar el resultado de la prueba" @click="prueba = null">
              <Icon name="heroicons:x-mark" class="size-4" />
            </button>
          </div>
          <dl class="mt-2 flex flex-wrap gap-x-6 gap-y-1 pl-7 text-xs">
            <div class="flex gap-1.5">
              <dt class="text-slate-400">Código HTTP:</dt>
              <dd class="font-mono">{{ codigoHttpPrueba(prueba) }}</dd>
            </div>
            <div class="flex gap-1.5">
              <dt class="text-slate-400">Latencia:</dt>
              <dd class="tabular-nums">{{ latenciaPrueba(prueba) }}</dd>
            </div>
          </dl>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-white/5 pt-4">
          <p v-if="motivoSinPrueba" class="mr-auto text-xs text-slate-400">{{ motivoSinPrueba }}</p>
          <AppButton variant="secondary" icon="heroicons:signal" :loading="probando" :disabled="Boolean(motivoSinPrueba) || guardando === 'undc'" @click="probar">
            Probar conexión
          </AppButton>
          <AppButton type="submit" form="form-undc" icon="heroicons:check" :loading="guardando === 'undc'" :disabled="!cambios.undc || probando">Guardar</AppButton>
        </div>
      </section>

      <!-- (2) Google -->
      <section class="card p-6" aria-labelledby="titulo-google">
        <div class="flex items-start gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-400/20">
            <Icon name="heroicons:finger-print" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 id="titulo-google" class="text-lg font-bold">Inicio de sesión con Google</h2>
              <AppBadge :tono="config.google.configurado ? 'ok' : 'neutral'">{{ config.google.configurado ? 'Configurado' : 'Sin configurar' }}</AppBadge>
            </div>
            <p class="mt-0.5 text-sm text-slate-400">
              Permite entrar al panel con Google (administradores e inscritos a «Mis inscripciones») y verificar el correo en la landing.
            </p>
          </div>
        </div>

        <form id="form-google" class="mt-5" novalidate @submit.prevent="guardar('google')">
          <AppField label="Client ID de Google" for="si-google" :error="errores.googleClientId" hint="No es secreto: no hace falta client secret. Vacío desactiva el inicio de sesión con Google.">
            <input
              id="si-google"
              v-model="form.googleClientId"
              class="field-control font-mono"
              maxlength="255"
              autocomplete="off"
              spellcheck="false"
              placeholder="123456789012-abc123….apps.googleusercontent.com"
            >
          </AppField>
        </form>

        <div class="mt-5 rounded-xl bg-white/5 p-4">
          <h3 class="text-sm font-semibold text-white">Orígenes autorizados a registrar en Google Cloud</h3>
          <p class="mt-1 text-xs text-slate-400">
            En Google Cloud → APIs y servicios → Credenciales → tu client ID (tipo «Aplicación web») → «Orígenes autorizados de JavaScript».
          </p>
          <ul class="mt-3 space-y-2">
            <li v-for="origen in origenes" :key="origen" class="flex items-center justify-between gap-3 rounded-lg bg-navy-900/60 px-3 py-2">
              <div class="min-w-0">
                <p class="truncate font-mono text-sm text-slate-100">{{ origen }}</p>
                <p class="text-xs text-slate-500">{{ origen === origenPanel ? 'Este panel' : 'URL del panel configurada' }}</p>
              </div>
              <AppButton
                size="sm"
                variant="ghost"
                :icon="copiado && origenCopiado === origen ? 'heroicons:check' : 'heroicons:clipboard-document'"
                :aria-label="`Copiar ${origen}`"
                @click="copiarOrigen(origen)"
              >
                {{ copiado && origenCopiado === origen ? 'Copiado' : 'Copiar' }}
              </AppButton>
            </li>
          </ul>
          <p class="mt-3 flex gap-2 text-xs text-slate-300">
            <Icon name="heroicons:information-circle" class="size-4 shrink-0 text-brand-300" aria-hidden="true" />
            Agrega también el dominio de cada landing de evento (el que ven los participantes al inscribirse): la landing usa este mismo client ID para verificar el correo.
          </p>
        </div>

        <div class="mt-5 flex justify-end border-t border-white/5 pt-4">
          <AppButton type="submit" form="form-google" icon="heroicons:check" :loading="guardando === 'google'" :disabled="!cambios.google">Guardar</AppButton>
        </div>
      </section>

      <!-- (3) URL del panel -->
      <section class="card p-6" aria-labelledby="titulo-panel">
        <div class="flex items-start gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-400/20">
            <Icon name="heroicons:globe-alt" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h2 id="titulo-panel" class="text-lg font-bold">URL del panel</h2>
            <p class="mt-0.5 text-sm text-slate-400">
              La landing la usa para el enlace de inicio de sesión (<span class="font-mono">/login</span>) y para «Ver mi inscripción» después de inscribirse.
            </p>
          </div>
        </div>

        <form id="form-panel" class="mt-5" novalidate @submit.prevent="guardar('panel')">
          <AppField label="URL pública del panel" for="si-panel" :error="errores.urlPanel" :hint="avisoPanel ?? 'Solo el origen (https://dominio). Vacía = la landing no muestra esos enlaces.'">
            <input id="si-panel" v-model="form.urlPanel" type="url" class="field-control font-mono" maxlength="255" autocomplete="off" spellcheck="false" :placeholder="origenPanel">
          </AppField>
          <button
            v-if="sugerirOrigen"
            type="button"
            class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200"
            @click="form.urlPanel = origenPanel"
          >
            <Icon name="heroicons:light-bulb" class="size-3.5" aria-hidden="true" /> Usar el origen actual: <span class="font-mono">{{ origenPanel }}</span>
          </button>
        </form>

        <div class="mt-5 flex justify-end border-t border-white/5 pt-4">
          <AppButton type="submit" form="form-panel" icon="heroicons:check" :loading="guardando === 'panel'" :disabled="!cambios.panel">Guardar</AppButton>
        </div>
      </section>

      <!-- (4) Landing anterior -->
      <section class="card p-6" aria-labelledby="titulo-legacy">
        <div class="flex items-start gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-400/20">
            <Icon name="heroicons:archive-box" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 id="titulo-legacy" class="text-lg font-bold">Landing anterior</h2>
              <AppBadge :tono="config.rutasLegacy.activas ? 'warn' : 'neutral'">{{ config.rutasLegacy.activas ? 'Rutas activas' : 'Rutas desactivadas' }}</AppBadge>
            </div>
            <p class="mt-0.5 text-sm text-slate-400">
              Rutas antiguas del backend que usa la landing anterior (sin token de acceso) para inscribir y enviar mensajes. Desactívalas cuando la landing de cada evento use la API del sitio.
            </p>
          </div>
        </div>

        <div class="mt-5 rounded-xl bg-white/5 p-4">
          <AppSwitch
            :model-value="config.rutasLegacy.activas"
            label="Rutas de la landing anterior"
            :descripcion="config.rutasLegacy.activas ? 'Activas: la landing anterior todavía puede inscribir.' : 'Desactivadas: responden «ruta retirada» (410) y la landing anterior no puede inscribir.'"
            :disabled="guardando === 'legacy'"
            @update:model-value="cambiarLegacy"
          />
        </div>
      </section>
    </template>
  </div>
</template>
