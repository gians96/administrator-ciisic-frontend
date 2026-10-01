<script setup lang="ts">
import type { CodigoEstado, InscripcionDetalle, Respuesta } from '~/types/api'
import { fechaDia, fechaHoraLima, modalidadPago, nombreCompleto, soles } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { fechaCorreoVerificado, textoCorreoVerificado } from '~/utils/cuentaGoogle'
import { accionesInscripcion, hayAcciones } from '~/utils/inscripciones'

const props = defineProps<{ inscripcionId: number | null }>()
const emit = defineEmits<{ cerrar: [], actualizada: [detalle: InscripcionDetalle] }>()

const { api, urlArchivo, releerAcceso } = useApi()
const auth = useAuthStore()
const toast = useToast()
const { confirmar } = useConfirm()

const detalle = ref<InscripcionDetalle | null>(null)
const cargando = ref(false)
const procesando = ref<string | null>(null)
const rechazoAbierto = ref(false)
const motivo = ref('')

/** Sin `pagos.ver` el pago llega con sus claves en `null` y sin voucher: no se muestra. */
const conPagos = computed(() => auth.puede('pagos.ver'))
const acciones = computed(() => (detalle.value ? accionesInscripcion(detalle.value.estado.codigo, auth.puede) : null))

const MOTIVOS: Record<string, string> = {
  CORREO_NO_INSTITUCIONAL: 'Correo no institucional',
  DOCUMENTO_NO_SOPORTADO: 'Documento no soportado para verificación',
  NO_ES_ESTUDIANTE: 'No figura como estudiante UNDC',
  EGRESADO: 'Figura como egresado',
  IDENTIDAD_NO_COINCIDE: 'El correo no corresponde al DNI',
  SIN_DATOS_IDENTIDAD: 'Sin nombres oficiales para cruzar',
  SERVICIO_NO_DISPONIBLE: 'API_UNDC no disponible al inscribirse',
  SIN_VERIFICACION: 'Se inscribió sin verificar (estudiante externo)',
}

async function cargar(id: number) {
  cargando.value = true
  try {
    detalle.value = (await api<Respuesta<InscripcionDetalle>>(`inscriptions/${id}`)).data
  } catch (error) {
    toast.error(mensajeError(error))
    emit('cerrar')
  } finally {
    cargando.value = false
  }
}

watch(() => props.inscripcionId, (id) => {
  detalle.value = null
  if (id) cargar(id)
}, { immediate: true })

async function cambiarEstado(estado: CodigoEstado, motivoRechazo?: string) {
  if (!detalle.value) return
  procesando.value = estado
  try {
    const respuesta = await api<Respuesta<InscripcionDetalle>>(`inscriptions/${detalle.value.id}/status`, {
      method: 'PATCH',
      body: { estado, ...(motivoRechazo ? { motivo: motivoRechazo } : {}) },
    })
    detalle.value = respuesta.data
    emit('actualizada', respuesta.data)
    if (estado === 'APROBADO') {
      if (respuesta.data.credencialEnviada === false) toast.error('Inscripción aprobada, pero no se pudo enviar la credencial por correo. Puedes reenviarla.')
      else toast.exito('Inscripción aprobada y credencial enviada.')
    } else {
      toast.exito(`Estado actualizado a «${respuesta.data.estado.nombre}».`)
    }
  } catch (error) {
    toast.error(mensajeError(error))
    // Se le quitó el permiso de cancelar: se relee el acceso ya para ocultar el botón
    if (aErrorApi(error).code === 'STATUS_NOT_ALLOWED') await releerAcceso()
  } finally {
    procesando.value = null
  }
}

async function aprobar() {
  if (!detalle.value) return
  const monto = conPagos.value ? ` por ${soles(detalle.value.pago.monto)}` : ''
  const ok = await confirmar({
    titulo: 'Aprobar inscripción',
    mensaje: `Se aprobará la inscripción de ${nombreCompleto(detalle.value.participante)}${monto} y se enviará su credencial al correo ${detalle.value.participante.correo}.`,
    textoConfirmar: 'Aprobar y enviar credencial',
  })
  if (ok) await cambiarEstado('APROBADO')
}

async function cancelar() {
  if (!detalle.value) return
  const ok = await confirmar({
    titulo: 'Cancelar inscripción',
    mensaje: `¿Cancelar la inscripción de ${nombreCompleto(detalle.value.participante)}? Deja de contar como inscrita y no podrá registrar asistencia. Después se puede volver a cambiar su estado.`,
    textoConfirmar: 'Cancelar inscripción',
    peligro: true,
  })
  if (ok) await cambiarEstado('CANCELADO')
}

async function rechazar() {
  if (motivo.value.trim().length < 3) return
  await cambiarEstado('RECHAZADO', motivo.value.trim())
  rechazoAbierto.value = false
  motivo.value = ''
}

async function reenviar() {
  if (!detalle.value) return
  procesando.value = 'reenviar'
  try {
    const r = await api<Respuesta<{ credencialEnviada: boolean }>>(`inscriptions/${detalle.value.id}/resend-credential`, { method: 'POST' })
    if (r.data.credencialEnviada) toast.exito('Credencial reenviada.')
    else toast.error('No se pudo enviar el correo. Revisa la configuración de Brevo.')
    await cargar(detalle.value.id)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    procesando.value = null
  }
}

const voucherUrl = computed(() => (conPagos.value && detalle.value?.pago.tieneVoucher ? urlArchivo(`inscriptions/${detalle.value.id}/voucher`) : null))
const credencialUrl = computed(() => (detalle.value ? urlArchivo(`inscriptions/${detalle.value.id}/credential`) : null))
const esImagen = computed(() => detalle.value?.pago.voucherMime?.startsWith('image/') ?? false)
const verificacion = computed(() => detalle.value?.verificacion.detalle ?? null)
const correoVerificado = computed(() => textoCorreoVerificado(detalle.value?.verificacion.correo))
</script>

<template>
  <AppModal
    :abierto="inscripcionId !== null"
    :titulo="detalle ? `Inscripción #${detalle.id}` : 'Inscripción'"
    :descripcion="detalle ? nombreCompleto(detalle.participante) : undefined"
    ancho="lg"
    lado="derecha"
    @cerrar="emit('cerrar')"
  >
    <div v-if="cargando || !detalle" class="py-16 text-center text-sm text-slate-400">Cargando…</div>

    <div v-else class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <AppBadge :estado="detalle.estado.codigo">{{ detalle.estado.nombre }}</AppBadge>
        <AppBadge v-if="detalle.verificacion.esEstudianteUndc" tono="brand">
          <Icon name="heroicons:check-badge" class="size-3.5" aria-hidden="true" /> Estudiante UNDC verificado
        </AppBadge>
        <AppBadge v-else-if="detalle.tipoInscripcion?.categoria.esEstudiantil" tono="warn">Estudiante externo · validar</AppBadge>
        <span class="text-xs text-slate-400">Registrada el {{ fechaHoraLima(detalle.creadoEn) }}</span>
      </div>

      <section class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl bg-white/5 p-4">
          <p class="kicker">Participante</p>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-400">Documento</dt><dd class="text-white">{{ detalle.participante.tipoDocumento.toUpperCase() }} {{ detalle.participante.numeroDocumento }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-400">Nombres</dt><dd class="text-right text-white">{{ nombreCompleto(detalle.participante) }}</dd></div>
            <div class="flex justify-between gap-3">
              <dt class="text-slate-400">Correo</dt>
              <dd class="min-w-0 text-right">
                <span class="block truncate text-white">{{ detalle.participante.correo }}</span>
                <span v-if="correoVerificado" class="inline-flex items-center gap-1 text-xs text-emerald-300" :title="fechaCorreoVerificado(detalle.verificacion.correo) ?? undefined">
                  <Icon name="heroicons:check-badge" class="size-3.5 shrink-0" aria-hidden="true" /> {{ correoVerificado }}
                </span>
              </dd>
            </div>
            <div class="flex justify-between gap-3"><dt class="text-slate-400">Celular</dt><dd class="text-white">{{ detalle.participante.celular }}</dd></div>
          </dl>
        </div>
        <div class="rounded-xl bg-white/5 p-4">
          <p class="kicker">Inscripción</p>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-400">Tipo</dt><dd class="text-right text-white">{{ detalle.tipoInscripcion?.nombre ?? '—' }} {{ detalle.tipoInscripcion?.etiqueta ? `· ${detalle.tipoInscripcion.etiqueta}` : '' }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-400">Categoría</dt><dd class="text-white">{{ detalle.tipoInscripcion?.categoria.nombre ?? '—' }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-400">Clasificación</dt><dd class="text-white">{{ detalle.clasificacion?.nombre ?? '—' }}</dd></div>
            <div v-if="conPagos" class="flex justify-between gap-3"><dt class="text-slate-400">Monto</dt><dd class="font-semibold text-white">{{ soles(detalle.pago.monto) }}<span v-if="detalle.pago.descuento" class="ml-1 text-xs text-emerald-300">(−{{ soles(detalle.pago.descuento) }})</span></dd></div>
          </dl>
        </div>
      </section>

      <section v-if="conPagos" class="rounded-xl bg-white/5 p-4">
        <p class="kicker">Pago</p>
        <dl class="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Modalidad</dt><dd class="text-white">{{ modalidadPago(detalle.pago.modalidad, detalle.pago.banco, detalle.pago.billeteraDigital) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Operación</dt><dd class="font-mono text-white">{{ detalle.pago.numeroOperacion ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Tipo</dt><dd class="text-white">{{ detalle.pago.tipoOperacion ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Fecha de pago</dt><dd class="text-white">{{ fechaDia(detalle.pago.fechaPago) }}</dd></div>
        </dl>
        <div class="mt-4">
          <div v-if="voucherUrl" class="overflow-hidden rounded-xl border border-white/10 bg-navy-950">
            <a :href="voucherUrl" target="_blank" rel="noopener" class="block">
              <img v-if="esImagen" :src="voucherUrl" alt="Voucher de pago" class="mx-auto max-h-[28rem] w-auto object-contain">
              <iframe v-else :src="voucherUrl" title="Voucher de pago (PDF)" class="h-[28rem] w-full" />
            </a>
            <p class="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
              Voucher adjunto
              <a :href="voucherUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200">
                Abrir <Icon name="heroicons:arrow-top-right-on-square" class="size-3.5" aria-hidden="true" />
              </a>
            </p>
          </div>
          <p v-else class="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/25">Esta inscripción no tiene voucher adjunto.</p>
        </div>
      </section>

      <section v-if="detalle.tipoInscripcion?.categoria.esEstudiantil" class="rounded-xl bg-white/5 p-4">
        <p class="kicker">Verificación de estudiante</p>
        <dl class="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Resultado</dt><dd class="text-white">{{ detalle.verificacion.esEstudianteUndc ? 'Verificado UNDC' : (MOTIVOS[verificacion?.motivo ?? ''] ?? 'No verificado') }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Código</dt><dd class="text-white">{{ detalle.verificacion.codigoEstudiante ?? verificacion?.codigoEstudiante ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Carrera</dt><dd class="text-right text-white">{{ verificacion?.carrera ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Matriculado</dt><dd class="text-white">{{ verificacion?.matriculadoSemestreActivo === true ? 'Sí' : verificacion?.matriculadoSemestreActivo === false ? 'No' : '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Correo institucional</dt><dd class="text-white">{{ detalle.verificacion.esCorreoInstitucional ? 'Sí' : 'No' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Verificado</dt><dd class="text-white">{{ fechaHoraLima(verificacion?.verificadoEn) }}</dd></div>
        </dl>
      </section>

      <section class="rounded-xl bg-white/5 p-4">
        <p class="kicker">Revisión</p>
        <dl class="mt-3 space-y-1.5 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Revisado por</dt><dd class="text-white">{{ detalle.revision.revisadoPor ? nombreCompleto(detalle.revision.revisadoPor) : '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Fecha de revisión</dt><dd class="text-white">{{ fechaHoraLima(detalle.revision.revisadoEn) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Credencial enviada</dt><dd class="text-white">{{ fechaHoraLima(detalle.revision.credencialEnviadaEn) }}</dd></div>
          <div v-if="detalle.revision.motivoRechazo" class="rounded-lg bg-red-500/10 px-3 py-2 text-red-200">Motivo de rechazo: {{ detalle.revision.motivoRechazo }}</div>
        </dl>
      </section>
    </div>

    <template v-if="detalle && acciones && hayAcciones(acciones)" #acciones>
      <AppButton v-if="acciones.cancelar" variant="ghost" icon="heroicons:no-symbol" :loading="procesando === 'CANCELADO'" @click="cancelar">Cancelar inscripción</AppButton>
      <template v-if="acciones.verCredencial">
        <a
          v-if="credencialUrl"
          :href="credencialUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/15 ring-inset transition hover:bg-white/10"
        >
          <Icon name="heroicons:document-arrow-down" class="size-4" aria-hidden="true" /> Ver credencial
        </a>
        <AppButton v-if="acciones.reenviarCredencial" variant="secondary" icon="heroicons:paper-airplane" :loading="procesando === 'reenviar'" @click="reenviar">Reenviar credencial</AppButton>
      </template>
      <AppButton v-if="acciones.enRevision" variant="secondary" icon="heroicons:eye" :loading="procesando === 'EN_REVISION'" @click="cambiarEstado('EN_REVISION')">
        Marcar en revisión
      </AppButton>
      <AppButton v-if="acciones.rechazar" variant="danger" icon="heroicons:x-circle" @click="rechazoAbierto = true">Rechazar</AppButton>
      <AppButton v-if="acciones.aprobar" variant="success" icon="heroicons:check-circle" :loading="procesando === 'APROBADO'" @click="aprobar">Aprobar</AppButton>
    </template>
  </AppModal>

  <AppModal :abierto="rechazoAbierto" titulo="Rechazar inscripción" descripcion="El motivo queda registrado y visible para el equipo." ancho="sm" @cerrar="rechazoAbierto = false">
    <AppField label="Motivo del rechazo" for="motivo" required hint="Ej.: el monto del voucher no coincide, voucher ilegible, operación duplicada.">
      <textarea id="motivo" v-model="motivo" rows="4" maxlength="500" class="field-control" />
    </AppField>
    <template #acciones>
      <AppButton variant="secondary" @click="rechazoAbierto = false">Cancelar</AppButton>
      <AppButton variant="danger" :disabled="motivo.trim().length < 3" :loading="procesando === 'RECHAZADO'" @click="rechazar">Rechazar</AppButton>
    </template>
  </AppModal>
</template>
