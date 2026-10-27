<script setup lang="ts">
import type { CredencialCorreo, EnvioPruebaCorreo, PruebaCredencialCorreo, Respuesta } from '~/types/api'
import { fechaHoraLima } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import {
  avisoApiKeyBrevo,
  avisoCreditos,
  avisoSinRespaldo,
  credencialEnUso,
  cuerpoCredencialCorreo,
  describirPlanBrevo,
  esCorreoValido,
  estadoCredencialCorreo,
  estadoCreditos,
  ETIQUETAS_CAMPOS_CREDENCIAL,
  formularioCredencialCorreo,
  hayCreditos,
  hayPrioridades,
  mensajeDesactivarCredencial,
  mensajeEliminarCredencial,
  necesitaRevisarCreditos,
  nombreProveedor,
  nombreSecreto,
  ordenarCredencialesCorreo,
  ordenTrasMover,
  PROVEEDORES_CORREO,
  remitenteCredencial,
  resumenCreditos,
  textoCreditos,
  validarCredencialCorreo,
  type DireccionOrden,
} from '~/utils/credencialesCorreo'

definePageMeta({ permiso: 'correo.configurar' })
useHead({ title: 'Correo · Panel CIISIC' })

type ResultadoPrueba = Omit<PruebaCredencialCorreo, 'credencial'>

const { api } = useApi()
const auth = useAuthStore()
const toast = useToast()
const { confirmar } = useConfirm()

const credenciales = ref<CredencialCorreo[]>([])
const cargando = ref(false)
const cargado = ref(false)
const errorCarga = ref<string | null>(null)
/** Acciones en curso por credencial: `${id}:${accion}`. */
const enCurso = reactive(new Set<string>())
/** Resultado de la última prueba por credencial (solo en esta vista). */
const resultados = ref<Record<number, ResultadoPrueba>>({})

const ordenadas = computed(() => ordenarCredencialesCorreo(credenciales.value))
/** Backend con la spec 041: conoce el orden de respaldo y el envío por Gmail. Uno anterior no envía `prioridad`. */
const conPrioridad = computed(() => hayPrioridades(credenciales.value))
/** Backend con la spec 042: informa los envíos que le quedan a cada credencial de Brevo. */
const conCreditos = computed(() => hayCreditos(credenciales.value))
const enUsoId = computed(() => credencialEnUso(credenciales.value)?.id ?? null)
const avisoDeCreditos = computed(() => avisoCreditos(credenciales.value))
const revisando = ref(false)
const vista = computed(() => ordenadas.value.map((credencial, posicion) => ({
  credencial,
  posicion,
  estado: estadoCredencialCorreo(credencial),
  creditos: estadoCreditos(credencial),
  detalleCreditos: textoCreditos(credencial),
  enUso: credencial.id === enUsoId.value,
  resultado: resultados.value[credencial.id] ?? null,
  puedeSubir: ordenTrasMover(ordenadas.value, credencial.id, 'arriba') !== null,
  puedeBajar: ordenTrasMover(ordenadas.value, credencial.id, 'abajo') !== null,
})))
const sinRespaldo = computed(() => avisoSinRespaldo(credenciales.value))
const hayPredeterminadaActiva = computed(() => credenciales.value.some((credencial) => credencial.esPredeterminada && credencial.activo))

async function cargar() {
  cargando.value = true
  errorCarga.value = null
  try {
    credenciales.value = (await api<Respuesta<CredencialCorreo[]>>('email-credentials')).data
    cargado.value = true
  } catch (error) {
    errorCarga.value = mensajeError(error)
  } finally {
    cargando.value = false
  }
}

/**
 * Pregunta a Brevo cuántos envíos le quedan a cada credencial activa (no gasta créditos). Al abrir la pantalla se
 * hace sola, sin avisos, si alguna revisión falta o venció; con un backend anterior (404) no pasa nada.
 */
async function revisarCreditos(silencioso = false) {
  revisando.value = true
  try {
    credenciales.value = (await api<Respuesta<CredencialCorreo[]>>('email-credentials/check', { method: 'POST' })).data
    if (!silencioso) toast.exito(`Créditos revisados. ${resumenCreditos(credenciales.value) || 'No hay credenciales de Brevo activas.'}`)
  } catch (error) {
    if (!silencioso) toast.error(mensajeError(error, ETIQUETAS_CAMPOS_CREDENCIAL))
  } finally {
    revisando.value = false
  }
}

onMounted(async () => {
  await cargar()
  if (necesitaRevisarCreditos(credenciales.value)) await revisarCreditos(true)
})

function reemplazar(actualizada: CredencialCorreo | undefined) {
  if (!actualizada) return
  credenciales.value = credenciales.value.map((credencial) => (credencial.id === actualizada.id ? actualizada : credencial))
}

function olvidarResultado(id: number) {
  resultados.value = Object.fromEntries(Object.entries(resultados.value).filter(([clave]) => Number(clave) !== id))
}

function ocupada(credencial: CredencialCorreo, accion?: string): boolean {
  if (accion) return enCurso.has(`${credencial.id}:${accion}`)
  return [...enCurso].some((clave) => clave.startsWith(`${credencial.id}:`))
}

async function alFallar(error: unknown) {
  toast.error(mensajeError(error, ETIQUETAS_CAMPOS_CREDENCIAL))
  if (['EMAIL_CREDENTIAL_NOT_FOUND', 'INVALID_ORDER'].includes(aErrorApi(error).code ?? '')) await cargar()
}

/** Ejecuta una acción sobre la credencial marcándola en curso y mostrando el error si falla. */
async function ejecutar(credencial: CredencialCorreo, accion: string, tarea: () => Promise<void>) {
  const clave = `${credencial.id}:${accion}`
  enCurso.add(clave)
  try {
    await tarea()
  } catch (error) {
    await alFallar(error)
  } finally {
    enCurso.delete(clave)
  }
}

// ─── Alta y edición ───
const modal = ref(false)
const editando = ref<CredencialCorreo | null>(null)
const guardando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive(formularioCredencialCorreo())

/** Sin credenciales registradas (solo si la lista cargó bien): la nueva será la predeterminada. */
const listaVacia = computed(() => cargado.value && !credenciales.value.length)
const esPrimera = computed(() => !editando.value && listaVacia.value)
const avisoApiKey = computed(() => (form.proveedor === 'BREVO' ? avisoApiKeyBrevo(form.apiKey) : null))
const esGmail = computed(() => form.proveedor === 'GMAIL_SMTP')
/** Gmail solo se ofrece si el backend lo conoce: uno anterior descartaría el proveedor y guardaría la contraseña como API key de Brevo. */
const gmailDisponible = computed(() => !credenciales.value.length || conPrioridad.value)
const descripcionPredeterminada = computed(() => {
  if (esPrimera.value) return 'La primera credencial queda como predeterminada automáticamente.'
  if (editando.value?.esPredeterminada) return 'Ya es la predeterminada. Para cambiarla, marca otra credencial.'
  return 'Se usa en los eventos que no eligen una credencial propia.'
})

function abrir(credencial?: CredencialCorreo) {
  editando.value = credencial ?? null
  errores.value = {}
  Object.assign(form, formularioCredencialCorreo(credencial, !credencial && listaVacia.value))
  modal.value = true
}

function cerrarFormulario() {
  modal.value = false
  form.apiKey = '' // la API key escrita no se queda en memoria
}

async function guardar() {
  errores.value = validarCredencialCorreo(form, editando.value)
  if (Object.keys(errores.value).length) return

  const original = editando.value
  const cuerpo = cuerpoCredencialCorreo(form, original)
  if (original && !Object.keys(cuerpo).length) {
    toast.info('No hay cambios que guardar.')
    cerrarFormulario()
    return
  }

  guardando.value = true
  try {
    if (original) await api(`email-credentials/${original.id}`, { method: 'PUT', body: cuerpo })
    else {
      const creada = (await api<Respuesta<CredencialCorreo>>('email-credentials', { method: 'POST', body: cuerpo })).data
      if (form.proveedor === 'GMAIL_SMTP' && creada?.proveedor !== 'GMAIL_SMTP') {
        // Backend anterior a la spec 041: guardó la contraseña de aplicación como una API key de Brevo
        if (creada?.id) await api(`email-credentials/${creada.id}`, { method: 'DELETE' }).catch(() => undefined)
        toast.error('El servidor todavía no admite Gmail (falta desplegar el backend con la spec 041). No se guardó la credencial.')
        cerrarFormulario()
        await cargar()
        return
      }
    }
    toast.exito(original ? 'Credencial actualizada.' : `Credencial guardada. La ${nombreSecreto(form.proveedor)} queda cifrada y no se volverá a mostrar.`)
    if (original) olvidarResultado(original.id)
    cerrarFormulario()
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error, ETIQUETAS_CAMPOS_CREDENCIAL))
    if (aErrorApi(error).code === 'EMAIL_CREDENTIAL_NOT_FOUND') {
      cerrarFormulario()
      await cargar()
    }
  } finally {
    guardando.value = false
  }
}

// ─── Acciones por credencial ───
function probar(credencial: CredencialCorreo) {
  return ejecutar(credencial, 'probar', async () => {
    const { credencial: actualizada, ...resultado } = (await api<Respuesta<PruebaCredencialCorreo>>(`email-credentials/${credencial.id}/test`, { method: 'POST' })).data
    reemplazar(actualizada)
    resultados.value = { ...resultados.value, [credencial.id]: resultado }
    if (resultado.ok) toast.exito(`«${credencial.nombre}» se conectó con ${nombreProveedor(credencial.proveedor)}.`)
    else toast.error(`${nombreProveedor(credencial.proveedor)} rechazó la credencial: ${resultado.error ?? 'error desconocido'}`)
  })
}

/** Sube o baja una credencial de respaldo un lugar; el backend recibe el orden completo. */
function mover(credencial: CredencialCorreo, direccion: DireccionOrden) {
  const ids = ordenTrasMover(ordenadas.value, credencial.id, direccion)
  if (!ids) return Promise.resolve()
  return ejecutar(credencial, 'orden', async () => {
    credenciales.value = (await api<Respuesta<CredencialCorreo[]>>('email-credentials/order', { method: 'PUT', body: { ids } })).data
    toast.exito(`«${credencial.nombre}» quedó con prioridad ${ids.indexOf(credencial.id) + 1}.`)
  })
}

function marcarPredeterminada(credencial: CredencialCorreo) {
  return ejecutar(credencial, 'predeterminada', async () => {
    await api(`email-credentials/${credencial.id}`, { method: 'PUT', body: { esPredeterminada: true } })
    toast.exito(`«${credencial.nombre}» es ahora la credencial predeterminada.`)
    await cargar()
  })
}

async function alternarActivo(credencial: CredencialCorreo) {
  if (credencial.activo) {
    const mensaje = mensajeDesactivarCredencial(credencial)
    if (mensaje && !(await confirmar({ titulo: 'Desactivar credencial', mensaje, textoConfirmar: 'Desactivar' }))) return
  }
  await ejecutar(credencial, 'activo', async () => {
    await api(`email-credentials/${credencial.id}`, { method: 'PUT', body: { activo: !credencial.activo } })
    toast.exito(credencial.activo ? `«${credencial.nombre}» quedó inactiva.` : `«${credencial.nombre}» quedó activa.`)
    await cargar() // la predeterminada pudo cambiar
  })
}

async function eliminar(credencial: CredencialCorreo) {
  const ok = await confirmar({ titulo: 'Eliminar credencial', mensaje: mensajeEliminarCredencial(credencial), textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  await ejecutar(credencial, 'eliminar', async () => {
    await api(`email-credentials/${credencial.id}`, { method: 'DELETE' })
    toast.exito('Credencial eliminada.')
    olvidarResultado(credencial.id)
    await cargar()
  })
}

// ─── Guía de Gmail ───
/** `desdeFormulario`: se abrió sobre el formulario de la credencial, así que no ofrece «Agregar» (borraría lo escrito). */
const guia = reactive({ abierto: false, desdeFormulario: false })

function abrirGuia(desdeFormulario = false) {
  Object.assign(guia, { abierto: true, desdeFormulario })
}

/** Cierra la guía y abre el alta con Gmail elegido. */
function agregarDesdeGuia() {
  guia.abierto = false
  abrir()
  if (gmailDisponible.value) form.proveedor = 'GMAIL_SMTP'
}

// ─── Envío de prueba ───
const envio = reactive({ abierto: false, credencial: null as CredencialCorreo | null, correo: '', enviando: false, error: '', errorCampo: '' })

function abrirEnvio(credencial: CredencialCorreo) {
  Object.assign(envio, { abierto: true, credencial, correo: auth.usuario?.correo ?? '', enviando: false, error: '', errorCampo: '' })
}

async function enviarPrueba() {
  const credencial = envio.credencial
  if (!credencial) return
  const correo = envio.correo.trim()
  envio.error = ''
  envio.errorCampo = esCorreoValido(correo) ? '' : 'Ingresa un correo válido.'
  if (envio.errorCampo) return
  envio.enviando = true
  try {
    const resultado = (await api<Respuesta<EnvioPruebaCorreo>>(`email-credentials/${credencial.id}/send-test`, { method: 'POST', body: { correo } })).data
    reemplazar(resultado.credencial)
    if (resultado.ok) {
      const confirmacion = resultado.messageId ? `${nombreProveedor(credencial.proveedor)} confirmó que lo aceptó (ID ${resultado.messageId}).` : `${nombreProveedor(credencial.proveedor)} lo aceptó.`
      toast.exito(`Correo de prueba enviado a ${correo}. ${confirmacion} Revisa también la carpeta de spam.`)
      envio.abierto = false
    } else {
      envio.error = `${nombreProveedor(credencial.proveedor)} no aceptó el envío: ${resultado.error ?? 'error desconocido'}`
    }
  } catch (error) {
    const e = aErrorApi(error)
    if (e.code === 'EMAIL_CREDENTIAL_NOT_FOUND') {
      envio.abierto = false
      await alFallar(error)
      return
    }
    envio.errorCampo = e.fields?.correo ?? ''
    envio.error = mensajeError(error, ETIQUETAS_CAMPOS_CREDENCIAL)
  } finally {
    envio.enviando = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Correo</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Credenciales con las que se envían los correos de los eventos (aprobación de inscripciones, credenciales y avisos): Brevo por API o Gmail por SMTP. Si una falla o se queda sin créditos, se usa la siguiente por orden de prioridad. Solo un SuperAdmin puede gestionarlas.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton v-if="conCreditos" variant="secondary" icon="heroicons:arrow-path" :loading="revisando" @click="revisarCreditos()">Revisar créditos</AppButton>
        <AppButton variant="secondary" icon="heroicons:book-open" @click="abrirGuia()">Guía de Gmail</AppButton>
        <AppButton icon="heroicons:plus" @click="abrir()">Agregar credencial</AppButton>
      </div>
    </div>

    <section class="flex gap-3 rounded-xl border border-brand-400/25 bg-brand-500/5 p-4 text-sm text-slate-300" aria-labelledby="ayuda-correo">
      <Icon name="heroicons:information-circle" class="mt-0.5 size-5 shrink-0 text-brand-300" aria-hidden="true" />
      <div>
        <h2 id="ayuda-correo" class="sr-only">Cómo funciona</h2>
        <ul class="list-disc space-y-1 pl-4 marker:text-brand-400">
          <li>Los correos salen por la <strong class="text-slate-100">primera credencial activa</strong>; si falla o se queda sin créditos, pasa sola a la siguiente (hasta 3 intentos) con el remitente de esa. Cambia el orden con las flechas; la predeterminada siempre es la primera.</li>
          <li><strong class="text-slate-100">Brevo:</strong> el correo del remitente debe estar verificado en Brevo (Remitentes, dominios e IP dedicadas); si no, rechaza los envíos. El plan gratuito da 300 envíos al día.</li>
          <li><strong class="text-slate-100">Gmail:</strong> el remitente es la cuenta de Gmail y se entra con una contraseña de aplicación (Cuenta de Google → Seguridad e inicio de sesión → Verificación en dos pasos → Contraseñas de aplicaciones). Permite unos 500 envíos al día (2000 en Google Workspace). <button type="button" class="font-semibold text-brand-300 underline underline-offset-2 hover:text-white" @click="abrirGuia()">Ver la guía paso a paso</button></li>
          <li>Cada evento puede elegir su credencial en <strong class="text-slate-100">Eventos → General</strong>; si no elige ninguna, se usa la <strong class="text-slate-100">predeterminada</strong>.</li>
          <li>La API key o la contraseña se guarda cifrada y solo verás sus últimos 4 caracteres. «Probar» la verifica sin enviar correos.</li>
        </ul>
      </div>
    </section>

    <p
      v-if="avisoDeCreditos"
      class="rounded-xl px-4 py-3 text-sm ring-1"
      :class="avisoDeCreditos.tono === 'alerta' ? 'bg-red-500/10 text-red-200 ring-red-400/30' : 'bg-brand-500/5 text-slate-300 ring-brand-400/25'"
      :role="avisoDeCreditos.tono === 'alerta' ? 'alert' : 'status'"
    >
      {{ avisoDeCreditos.texto }}
    </p>

    <p v-if="sinRespaldo" class="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/25" role="status">
      {{ sinRespaldo }}
    </p>

    <p v-if="credenciales.length && !hayPredeterminadaActiva" class="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/25" role="alert">
      No hay una credencial predeterminada activa. Activa una y márcala como predeterminada para los eventos que no eligen credencial.
    </p>

    <div v-if="errorCarga && credenciales.length" class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">
      <p>No se pudo actualizar la lista: {{ errorCarga }}</p>
      <AppButton size="sm" variant="secondary" icon="heroicons:arrow-path" :loading="cargando" @click="cargar">Reintentar</AppButton>
    </div>

    <div v-if="cargando && !credenciales.length" class="card py-14 text-center text-sm text-slate-400" role="status">Cargando credenciales…</div>

    <section v-else-if="errorCarga && !credenciales.length" class="card flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="size-8 text-red-300" aria-hidden="true" />
      <p class="max-w-md text-sm text-red-200">No se pudieron cargar las credenciales: {{ errorCarga }}</p>
      <AppButton variant="secondary" icon="heroicons:arrow-path" @click="cargar">Reintentar</AppButton>
    </section>

    <section v-else-if="listaVacia" class="card">
      <AppEmpty titulo="Aún no hay credenciales de correo" descripcion="Agrega la API key de Brevo y un remitente verificado. La primera credencial queda como predeterminada." icon="heroicons:paper-airplane">
        <AppButton icon="heroicons:plus" @click="abrir()">Agregar credencial</AppButton>
      </AppEmpty>
    </section>

    <div v-else-if="credenciales.length" class="space-y-4">
      <article
        v-for="{ credencial, posicion, estado, creditos, detalleCreditos, enUso, resultado, puedeSubir, puedeBajar } in vista"
        :key="credencial.id"
        class="card p-5"
        :aria-labelledby="`credencial-${credencial.id}`"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <h2 :id="`credencial-${credencial.id}`" class="text-lg font-bold" :class="credencial.activo ? '' : 'text-slate-300'">{{ credencial.nombre }}</h2>
              <AppBadge v-if="credencial.esPredeterminada" tono="brand">
                <Icon name="heroicons:star-solid" class="size-3.5" aria-hidden="true" /> Predeterminada
              </AppBadge>
              <AppBadge tono="neutral">{{ nombreProveedor(credencial.proveedor) }}</AppBadge>
              <AppBadge v-if="conPrioridad" tono="neutral" :title="posicion === 0 ? 'Es la primera: se usa antes que las demás' : 'Se usa cuando fallan las anteriores'">Prioridad {{ posicion + 1 }}</AppBadge>
              <AppBadge :tono="credencial.activo ? 'ok' : 'neutral'">{{ credencial.activo ? 'Activa' : 'Inactiva' }}</AppBadge>
              <AppBadge :tono="estado.tono" :title="credencial.ultimoError ?? undefined">{{ estado.texto }}</AppBadge>
              <AppBadge v-if="creditos" :tono="creditos.tono" :title="detalleCreditos ?? undefined">{{ creditos.texto }}</AppBadge>
              <AppBadge v-if="enUso" tono="brand" title="Es por la que salen los correos ahora: la primera activa con envíos disponibles">
                <Icon name="heroicons:paper-airplane" class="size-3.5" aria-hidden="true" /> Envía ahora
              </AppBadge>
            </div>
            <p class="text-sm text-slate-300"><span class="text-slate-500">Remitente:</span> {{ remitenteCredencial(credencial) }}</p>
            <p class="text-xs text-slate-400">{{ nombreProveedor(credencial.proveedor) }} · {{ nombreSecreto(credencial.proveedor) }} <span class="font-mono text-slate-300">{{ credencial.apiKeyEnmascarada }}</span><span v-if="detalleCreditos"> · {{ detalleCreditos }}</span></p>
          </div>

          <div class="flex flex-wrap gap-2">
            <template v-if="conPrioridad">
              <AppButton
                size="sm"
                variant="ghost"
                icon="heroicons:arrow-up"
                :loading="ocupada(credencial, 'orden')"
                :disabled="!puedeSubir || ocupada(credencial)"
                :aria-label="`Subir la prioridad de ${credencial.nombre}`"
                :title="credencial.esPredeterminada ? 'La predeterminada siempre es la primera' : undefined"
                @click="mover(credencial, 'arriba')"
              />
              <AppButton
                size="sm"
                variant="ghost"
                icon="heroicons:arrow-down"
                :disabled="!puedeBajar || ocupada(credencial)"
                :aria-label="`Bajar la prioridad de ${credencial.nombre}`"
                @click="mover(credencial, 'abajo')"
              />
            </template>
            <AppButton size="sm" variant="secondary" icon="heroicons:signal" :loading="ocupada(credencial, 'probar')" :disabled="ocupada(credencial)" @click="probar(credencial)">
              Probar
            </AppButton>
            <AppButton size="sm" variant="secondary" icon="heroicons:paper-airplane" :disabled="ocupada(credencial)" @click="abrirEnvio(credencial)">
              Enviar prueba
            </AppButton>
            <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" :disabled="ocupada(credencial)" @click="abrir(credencial)">Editar</AppButton>
            <AppButton
              v-if="!credencial.esPredeterminada"
              size="sm"
              variant="ghost"
              icon="heroicons:star"
              :loading="ocupada(credencial, 'predeterminada')"
              :disabled="!credencial.activo || ocupada(credencial)"
              :title="credencial.activo ? undefined : 'Actívala para poder marcarla como predeterminada'"
              @click="marcarPredeterminada(credencial)"
            >
              Marcar como predeterminada
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              :icon="credencial.activo ? 'heroicons:pause' : 'heroicons:play'"
              :loading="ocupada(credencial, 'activo')"
              :disabled="ocupada(credencial)"
              @click="alternarActivo(credencial)"
            >
              {{ credencial.activo ? 'Desactivar' : 'Activar' }}
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              icon="heroicons:trash"
              :loading="ocupada(credencial, 'eliminar')"
              :disabled="ocupada(credencial)"
              :aria-label="`Eliminar la credencial ${credencial.nombre}`"
              @click="eliminar(credencial)"
            />
          </div>
        </div>

        <p v-if="credencial.ultimoEstado === 'ERROR' && credencial.ultimoError" class="mt-3 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-200 ring-1 ring-red-400/25">
          <span class="font-semibold">Último error:</span> {{ credencial.ultimoError }}
          <button v-if="credencial.proveedor === 'GMAIL_SMTP'" type="button" class="ml-1 font-semibold text-red-100 underline underline-offset-2 hover:text-white" @click="abrirGuia()">Ver la guía de Gmail</button>
        </p>

        <dl class="mt-4 grid gap-4 border-t border-white/5 pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs text-slate-500">Última prueba</dt>
            <dd class="mt-0.5 text-slate-200">{{ credencial.ultimaPruebaEn ? fechaHoraLima(credencial.ultimaPruebaEn) : 'Nunca' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Último envío</dt>
            <dd class="mt-0.5 text-slate-200">{{ credencial.ultimoEnvioEn ? fechaHoraLima(credencial.ultimoEnvioEn) : 'Nunca' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Eventos que la usan</dt>
            <dd class="mt-1 flex flex-wrap gap-1.5">
              <NuxtLink
                v-for="evento in credencial.eventos"
                :key="evento.id"
                :to="`/eventos/${evento.id}?tab=general`"
                class="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-200 ring-1 ring-white/15 ring-inset transition hover:bg-white/10 hover:text-white"
              >
                {{ evento.nombreCorto }}
              </NuxtLink>
              <span v-if="!credencial.eventos.length" class="text-slate-400">
                {{ credencial.esPredeterminada ? 'Ninguno la eligió; se usa en los eventos sin credencial propia.' : 'Ninguno' }}
              </span>
            </dd>
          </div>
        </dl>

        <div
          v-if="resultado"
          class="mt-4 rounded-xl p-4 text-sm ring-1 ring-inset"
          :class="resultado.ok ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/25' : 'bg-red-500/10 text-red-100 ring-red-400/25'"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="flex items-center gap-2 font-semibold">
              <Icon :name="resultado.ok ? 'heroicons:check-circle' : 'heroicons:x-circle'" class="size-5 shrink-0" aria-hidden="true" />
              {{ resultado.ok ? (credencial.proveedor === 'GMAIL_SMTP' ? 'Gmail aceptó la contraseña de aplicación' : 'La API key es válida') : 'La prueba falló' }}
            </p>
            <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Ocultar el resultado de la prueba" @click="olvidarResultado(credencial.id)">
              <Icon name="heroicons:x-mark" class="size-4" />
            </button>
          </div>
          <template v-if="resultado.ok && resultado.cuenta">
            <p class="mt-2 text-slate-200">
              Cuenta {{ nombreProveedor(credencial.proveedor) }}: <span class="text-white">{{ resultado.cuenta.correo ?? 'correo no informado' }}</span><span v-if="resultado.cuenta.empresa"> · {{ resultado.cuenta.empresa }}</span>
            </p>
            <ul v-if="resultado.cuenta.planes.length" class="mt-2 flex flex-wrap gap-2" aria-label="Créditos por plan">
              <li v-for="(plan, indice) in resultado.cuenta.planes" :key="indice" class="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-200 tabular-nums ring-1 ring-white/10">
                {{ describirPlanBrevo(plan) }}
              </li>
            </ul>
            <p v-else-if="credencial.proveedor === 'GMAIL_SMTP'" class="mt-2 text-xs text-slate-400">Gmail no informa cuántos envíos quedan: el límite es de unos 500 al día (2000 en Google Workspace).</p>
            <p v-else class="mt-2 text-xs text-slate-400">Brevo no reportó planes ni créditos para esta cuenta.</p>
          </template>
          <p v-else-if="resultado.error" class="mt-2 text-red-200">{{ resultado.error }}</p>
        </div>
      </article>
    </div>

    <AppModal
      :abierto="modal"
      :titulo="editando ? 'Editar credencial' : 'Agregar credencial de correo'"
      :descripcion="`La ${nombreSecreto(form.proveedor)} se guarda cifrada en el servidor; solo se mostrarán sus últimos 4 caracteres.`"
      @cerrar="cerrarFormulario"
    >
      <form id="form-credencial" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="guardar">
        <AppField
          v-if="!editando"
          label="Proveedor"
          for="cr-proveedor"
          :error="errores.proveedor"
          :hint="gmailDisponible ? 'Gmail sirve de respaldo cuando Brevo se queda sin créditos.' : 'Gmail necesita el backend con la spec 041; despliégalo primero.'"
          class="sm:col-span-2"
        >
          <select id="cr-proveedor" v-model="form.proveedor" class="field-control">
            <option v-for="proveedor in PROVEEDORES_CORREO" :key="proveedor.valor" :value="proveedor.valor" :disabled="proveedor.valor === 'GMAIL_SMTP' && !gmailDisponible">{{ proveedor.nombre }}</option>
          </select>
        </AppField>
        <AppField label="Nombre" for="cr-nombre" required :error="errores.nombre" :hint="esGmail ? 'Para reconocerla en el panel (p. ej. Gmail de respaldo).' : 'Para reconocerla en el panel (p. ej. Brevo congreso).'" class="sm:col-span-2">
          <input id="cr-nombre" v-model="form.nombre" class="field-control" maxlength="120" autocomplete="off">
        </AppField>
        <AppField
          :label="esGmail ? 'Contraseña de aplicación de Google' : 'API key de Brevo'"
          for="cr-apikey"
          :required="!editando"
          :error="errores.apiKey"
          :hint="editando
            ? `Actual: ${editando.apiKeyEnmascarada}. Déjala vacía para conservarla.`
            : esGmail
              ? 'En myaccount.google.com/apppasswords (requiere la verificación en dos pasos). Son 16 letras; puedes pegarla con sus espacios.'
              : 'En Brevo: SMTP y API → Claves API → Generar una nueva clave API.'"
          class="sm:col-span-2"
        >
          <input
            id="cr-apikey"
            v-model="form.apiKey"
            type="password"
            autocomplete="new-password"
            spellcheck="false"
            data-1p-ignore
            data-lpignore="true"
            class="field-control font-mono"
            :placeholder="editando ? 'Dejar vacío para conservar' : esGmail ? 'abcd efgh ijkl mnop' : 'xkeysib-…'"
            :aria-describedby="avisoApiKey ? 'cr-apikey-aviso' : undefined"
          >
          <p v-if="avisoApiKey" id="cr-apikey-aviso" class="mt-1 text-xs text-amber-300">{{ avisoApiKey }}</p>
          <button v-if="esGmail" type="button" class="mt-1.5 text-xs font-semibold text-brand-300 underline underline-offset-2 hover:text-white" @click="abrirGuia(true)">¿Cómo creo la contraseña de aplicación? Ver la guía</button>
        </AppField>
        <AppField
          :label="esGmail ? 'Cuenta de Gmail (remitente)' : 'Correo del remitente'"
          for="cr-correo"
          required
          :error="errores.remitenteCorreo"
          :hint="esGmail ? 'La cuenta con la que se inicia sesión: Gmail firma los correos con ella.' : 'Debe estar verificado en Brevo.'"
        >
          <input id="cr-correo" v-model="form.remitenteCorreo" type="email" class="field-control" maxlength="191" autocomplete="off" :placeholder="esGmail ? 'tucuenta@gmail.com' : 'congreso@undc.edu.pe'">
        </AppField>
        <AppField label="Nombre del remitente" for="cr-remitente" :error="errores.remitenteNombre" hint="Opcional (p. ej. CIISIC UNDC).">
          <input id="cr-remitente" v-model="form.remitenteNombre" class="field-control" maxlength="120" autocomplete="off">
        </AppField>
        <div class="space-y-4 rounded-xl bg-white/5 p-4 sm:col-span-2">
          <AppSwitch
            v-model="form.esPredeterminada"
            label="Predeterminada"
            :descripcion="descripcionPredeterminada"
            :disabled="esPrimera || Boolean(editando?.esPredeterminada)"
          />
          <AppSwitch
            v-model="form.activo"
            label="Activa"
            :descripcion="editando?.esPredeterminada ? 'Es la predeterminada: si la desactivas, marca otra como predeterminada.' : 'Solo las credenciales activas envían correos y pueden elegirse en los eventos.'"
          />
          <p v-if="errores.activo || errores.esPredeterminada" class="field-error" role="alert">{{ errores.activo ?? errores.esPredeterminada }}</p>
        </div>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="cerrarFormulario">Cancelar</AppButton>
        <AppButton type="submit" form="form-credencial" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>

    <AppModal
      :abierto="envio.abierto"
      titulo="Enviar correo de prueba"
      :descripcion="envio.credencial ? `Desde ${remitenteCredencial(envio.credencial)}` : undefined"
      ancho="sm"
      @cerrar="envio.abierto = false"
    >
      <form id="form-envio-prueba" class="space-y-4" novalidate @submit.prevent="enviarPrueba">
        <p class="text-sm text-slate-400">
          Se enviará un correo real con la credencial «{{ envio.credencial?.nombre }}», sin usar las de respaldo: prueba solo esta.
          {{ envio.credencial?.proveedor === 'GMAIL_SMTP' ? 'Cuenta dentro del límite diario de envíos de Gmail.' : 'Cuenta como un envío de tu plan de Brevo.' }}
        </p>
        <AppField label="Correo destino" for="envio-correo" required :error="envio.errorCampo || null">
          <input id="envio-correo" v-model="envio.correo" type="email" autocomplete="email" class="field-control" placeholder="tu-correo@undc.edu.pe">
        </AppField>
        <p v-if="envio.error" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">{{ envio.error }}</p>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="envio.abierto = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-envio-prueba" icon="heroicons:paper-airplane" :loading="envio.enviando" :disabled="!esCorreoValido(envio.correo)">
          Enviar prueba
        </AppButton>
      </template>
    </AppModal>

    <GuiaGmailSmtp
      :abierto="guia.abierto"
      :puede-agregar="gmailDisponible"
      :ofrecer-agregar="!guia.desdeFormulario"
      @cerrar="guia.abierto = false"
      @agregar="agregarDesdeGuia"
    />
  </div>
</template>
