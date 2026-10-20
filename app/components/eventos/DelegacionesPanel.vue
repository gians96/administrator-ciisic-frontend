<script setup lang="ts">
import type { Delegacion, DelegacionDetalle, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { numero, soles } from '~/utils/formato'
import {
  MIN_INTEGRANTES_POR_DEFECTO,
  PRECIO_ESTANDAR_POR_DEFECTO,
  PRECIO_PROMOCIONAL_POR_DEFECTO,
  enlaceInscripcionDelegacion,
  parsearParticipantesDelegacion,
  type FilaParticipanteDelegacion,
} from '~/utils/delegaciones'

const props = defineProps<{ eventoId: number }>()

const { api } = useApi()
const toast = useToast()
const { copiar } = useCopiar()

const delegaciones = ref<Delegacion[]>([])
const cargando = ref(false)
const guardando = ref(false)
const errores = ref<Record<string, string>>({})
const copiadoId = ref<number | null>(null)
let temporizadorCopia: ReturnType<typeof setTimeout> | undefined

async function cargar() {
  cargando.value = true
  try {
    delegaciones.value = (await api<Respuesta<Delegacion[]>>(`events/${props.eventoId}/delegations`)).data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}
watch(() => props.eventoId, cargar, { immediate: true })

// ─── Alta de la delegación ───
const crearModal = ref(false)
const form = reactive({
  nombre: '',
  institucion: '',
  representanteNombre: '',
  representanteEmail: '',
  representanteTelefono: '',
  minIntegrantes: MIN_INTEGRANTES_POR_DEFECTO as number | '',
  precioEstandar: PRECIO_ESTANDAR_POR_DEFECTO as number | '',
  precioPromocional: PRECIO_PROMOCIONAL_POR_DEFECTO as number | '',
})

function abrirCrear() {
  errores.value = {}
  Object.assign(form, {
    nombre: '',
    institucion: '',
    representanteNombre: '',
    representanteEmail: '',
    representanteTelefono: '',
    minIntegrantes: MIN_INTEGRANTES_POR_DEFECTO,
    precioEstandar: PRECIO_ESTANDAR_POR_DEFECTO,
    precioPromocional: PRECIO_PROMOCIONAL_POR_DEFECTO,
  })
  crearModal.value = true
}

const numeroOpcional = (valor: number | '') => (valor === '' ? undefined : Number(valor))
const minimoFormulario = computed(() => (form.minIntegrantes === '' ? MIN_INTEGRANTES_POR_DEFECTO : Number(form.minIntegrantes)))
const precioEstandarFormulario = computed(() => (form.precioEstandar === '' ? PRECIO_ESTANDAR_POR_DEFECTO : Number(form.precioEstandar)))
const precioPromocionalFormulario = computed(() => (form.precioPromocional === '' ? PRECIO_PROMOCIONAL_POR_DEFECTO : Number(form.precioPromocional)))

async function guardarDelegacion() {
  guardando.value = true
  errores.value = {}
  try {
    await api(`events/${props.eventoId}/delegations`, {
      method: 'POST',
      body: {
        nombre: form.nombre.trim(),
        institucion: form.institucion.trim() || null,
        representanteNombre: form.representanteNombre.trim() || null,
        representanteEmail: form.representanteEmail.trim() || null,
        representanteTelefono: form.representanteTelefono.trim() || null,
        minIntegrantes: numeroOpcional(form.minIntegrantes),
        precioEstandar: numeroOpcional(form.precioEstandar),
        precioPromocional: numeroOpcional(form.precioPromocional),
      },
    })
    toast.exito('Delegación creada.')
    crearModal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

// ─── Link público ───
async function copiarLink(delegacion: Delegacion) {
  const ok = await copiar(enlaceInscripcionDelegacion(delegacion.codigoLink))
  if (!ok) {
    toast.error('No se pudo copiar el link. Revisa los permisos del portapapeles del navegador.')
    return
  }
  copiadoId.value = delegacion.id
  clearTimeout(temporizadorCopia)
  temporizadorCopia = setTimeout(() => { copiadoId.value = null }, 2000)
  toast.exito('Link de inscripción copiado.')
}

/** Abre el voucher del pago conjunto del grupo (el backend lo sirve al staff). */
function abrirVoucher() {
  if (!detalle.value) return
  window.open(`/api/backend/delegations/${detalle.value.id}/voucher`, '_blank', 'noopener')
}

// ─── Detalle e inscripción ───
const detalleModal = ref(false)
const detalle = ref<DelegacionDetalle | null>(null)
const detalleId = ref<number | null>(null)
const cargandoDetalle = ref(false)
const agregando = ref(false)
const erroresCarga = ref<string[]>([])
const manualErrores = ref<Record<string, string>>({})

async function abrirDetalle(delegacion: Delegacion) {
  detalleId.value = delegacion.id
  detalle.value = null
  erroresCarga.value = []
  manualErrores.value = {}
  detalleModal.value = true
  await cargarDetalle()
}

async function cargarDetalle() {
  if (!detalleId.value) return
  cargandoDetalle.value = true
  try {
    detalle.value = (await api<Respuesta<DelegacionDetalle>>(`delegations/${detalleId.value}`)).data
  } catch (error) {
    toast.error(mensajeError(error))
    detalleModal.value = false
  } finally {
    cargandoDetalle.value = false
  }
}

async function enviar(filas: FilaParticipanteDelegacion[], mensaje: string): Promise<boolean> {
  if (!detalle.value) return false
  agregando.value = true
  manualErrores.value = {}
  erroresCarga.value = []
  try {
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/inscriptions`, {
      method: 'POST',
      body: { participantes: filas },
    })
    detalle.value = respuesta.data
    const resumen = [
      respuesta.data.registrados ? `${respuesta.data.registrados} registrado(s)` : '',
      respuesta.data.omitidos ? `${respuesta.data.omitidos} ya estaba(n)` : '',
    ].filter(Boolean).join(' · ')
    toast.exito(resumen ? `${mensaje} ${resumen}.` : mensaje)
    await cargar()
    return true
  } catch (error) {
    const apiError = aErrorApi(error)
    const campos = Object.entries(apiError.fields ?? {})
    manualErrores.value = Object.fromEntries(campos.map(([campo, texto]) => [campo.replace(/^participantes\[\d+\]\./, ''), texto]))
    erroresCarga.value = campos.map(([, texto]) => texto)
    toast.error(mensajeError(error))
    return false
  } finally {
    agregando.value = false
  }
}

const manual = reactive({ tipoDocumento: 'dni' as 'dni' | 'ce', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '' })

async function agregarManual() {
  const fila: FilaParticipanteDelegacion = {
    tipoDocumento: manual.tipoDocumento,
    numeroDocumento: manual.numeroDocumento.trim(),
    nombres: manual.nombres.trim(),
    apellidos: manual.apellidos.trim(),
    correo: manual.correo.trim().toLowerCase(),
    celular: manual.celular.trim(),
  }
  manualErrores.value = {
    ...(!fila.numeroDocumento ? { numeroDocumento: 'Ingresa el documento.' } : {}),
    ...(!fila.nombres ? { nombres: 'Ingresa los nombres.' } : {}),
    ...(!fila.apellidos ? { apellidos: 'Ingresa los apellidos.' } : {}),
    ...(!fila.correo ? { correo: 'Ingresa el correo.' } : {}),
  }
  if (Object.keys(manualErrores.value).length) return
  const ok = await enviar([fila], 'Integrante registrado.')
  if (ok) Object.assign(manual, { tipoDocumento: 'dni', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '' })
}

const textoMasivo = ref('')
const vistaPrevia = computed(() => parsearParticipantesDelegacion(textoMasivo.value))

async function cargarMasivo() {
  const { filas, errores: erroresTexto } = vistaPrevia.value
  erroresCarga.value = erroresTexto
  if (erroresTexto.length) {
    toast.error(erroresTexto[0] ?? 'Revisa la carga masiva.')
    return
  }
  if (!filas.length) {
    toast.error('Pega al menos una línea con documento, nombres y correo.')
    return
  }
  const ok = await enviar(filas, 'Carga procesada.')
  if (ok) textoMasivo.value = ''
}

const tituloDetalle = computed(() => detalle.value?.nombre ?? 'Delegación')
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-slate-400">
        Cada delegación tiene su propio link para inscribir integrantes. La tarifa por persona es de
        <strong class="text-slate-200">S/ 60</strong> y baja a <strong class="text-slate-200">S/ 50</strong>
        cuando el grupo alcanza el mínimo de integrantes; al cruzar el mínimo se recalcula para todos.
      </p>
      <AppButton icon="heroicons:plus" @click="abrirCrear">Nueva delegación</AppButton>
    </div>

    <div v-if="cargando && !delegaciones.length" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
    <AppEmpty v-else-if="!delegaciones.length" titulo="Sin delegaciones" descripcion="Crea una delegación para generar su link de inscripción y registrar a su grupo." icon="heroicons:user-group">
      <AppButton icon="heroicons:plus" @click="abrirCrear">Crear la primera delegación</AppButton>
    </AppEmpty>

    <div v-else class="grid gap-4 xl:grid-cols-2">
      <article v-for="delegacion in delegaciones" :key="delegacion.id" class="card flex flex-col gap-4 p-5">
        <header class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-bold">{{ delegacion.nombre }}</h3>
            <p v-if="delegacion.institucion" class="text-sm text-slate-400">{{ delegacion.institucion }}</p>
          </div>
          <AppBadge :tono="delegacion.totalIntegrantes >= delegacion.minIntegrantes ? 'ok' : 'neutral'">
            {{ delegacion.totalIntegrantes >= delegacion.minIntegrantes ? 'Tarifa promocional' : 'Tarifa estándar' }}
          </AppBadge>
        </header>

        <p v-if="delegacion.representante.nombre" class="text-sm text-slate-400">
          Representante: <span class="text-slate-200">{{ delegacion.representante.nombre }}</span>
        </p>

        <dl class="grid grid-cols-3 gap-3 text-sm">
          <div class="rounded-xl bg-white/5 px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt>
            <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ numero(delegacion.totalIntegrantes) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Por persona</dt>
            <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ soles(delegacion.precioUnitario) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Total</dt>
            <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ soles(delegacion.montoTotal) }}</dd>
          </div>
        </dl>

        <p class="truncate font-mono text-xs text-slate-500" :title="enlaceInscripcionDelegacion(delegacion.codigoLink)">
          {{ enlaceInscripcionDelegacion(delegacion.codigoLink) }}
        </p>

        <div class="mt-auto flex flex-wrap gap-2">
          <AppButton size="sm" icon="heroicons:user-plus" @click="abrirDetalle(delegacion)">Gestionar inscritos</AppButton>
          <AppButton size="sm" variant="secondary" :icon="copiadoId === delegacion.id ? 'heroicons:check' : 'heroicons:link'" @click="copiarLink(delegacion)">
            {{ copiadoId === delegacion.id ? 'Copiado' : 'Copiar link' }}
          </AppButton>
        </div>
      </article>
    </div>

    <AppModal :abierto="crearModal" titulo="Nueva delegación" descripcion="El link se genera al crearla y se puede copiar desde su tarjeta." ancho="lg" @cerrar="crearModal = false">
      <form id="form-delegacion" class="grid gap-4 md:grid-cols-2" @submit.prevent="guardarDelegacion">
        <AppField label="Nombre de la delegación" for="del-nombre" required :error="errores.nombre">
          <input id="del-nombre" v-model="form.nombre" class="field-control" maxlength="150" placeholder="Delegación de Ingeniería de Sistemas">
        </AppField>
        <AppField label="Institución" for="del-institucion" :error="errores.institucion">
          <input id="del-institucion" v-model="form.institucion" class="field-control" maxlength="191">
        </AppField>
        <AppField label="Representante" for="del-representante" :error="errores.representanteNombre">
          <input id="del-representante" v-model="form.representanteNombre" class="field-control" maxlength="150">
        </AppField>
        <AppField label="Correo del representante" for="del-correo" :error="errores.representanteEmail">
          <input id="del-correo" v-model="form.representanteEmail" type="email" class="field-control" maxlength="191">
        </AppField>
        <AppField label="Teléfono del representante" for="del-telefono" :error="errores.representanteTelefono">
          <input id="del-telefono" v-model="form.representanteTelefono" class="field-control" maxlength="15">
        </AppField>
        <AppField label="Mínimo para la tarifa promocional" for="del-minimo" :error="errores.minIntegrantes" hint="Por defecto, 10 integrantes.">
          <input id="del-minimo" v-model.number="form.minIntegrantes" type="number" min="1" max="1000" class="field-control">
        </AppField>
        <AppField label="Precio estándar (S/)" for="del-estandar" :error="errores.precioEstandar">
          <input id="del-estandar" v-model.number="form.precioEstandar" type="number" min="0" step="0.01" class="field-control">
        </AppField>
        <AppField label="Precio promocional (S/)" for="del-promocional" :error="errores.precioPromocional">
          <input id="del-promocional" v-model.number="form.precioPromocional" type="number" min="0" step="0.01" class="field-control">
        </AppField>
        <p class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300 md:col-span-2">
          Con menos de {{ minimoFormulario }} integrantes se cobra
          <span class="font-semibold text-white">{{ soles(precioEstandarFormulario) }}</span> por persona;
          desde ese mínimo, <span class="font-semibold text-white">{{ soles(precioPromocionalFormulario) }}</span>.
          El total de la delegación se recalcula al agregar integrantes.
        </p>
        <p v-if="errores.body" class="text-sm text-red-300 md:col-span-2">{{ errores.body }}</p>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="crearModal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-delegacion" :loading="guardando">Crear delegación</AppButton>
      </template>
    </AppModal>

    <AppModal :abierto="detalleModal" :titulo="tituloDetalle" descripcion="Inscribe integrantes y revisa la tarifa aplicada." ancho="xl" @cerrar="detalleModal = false">
      <div v-if="cargandoDetalle && !detalle" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
      <template v-else-if="detalle">
        <dl class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ numero(detalle.totalIntegrantes) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Tarifa por persona</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ soles(detalle.precioUnitario) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Total acumulado</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ soles(detalle.montoTotal) }}</dd>
          </div>
        </dl>

        <p class="mt-3 rounded-xl px-4 py-3 text-sm" :class="detalle.totalIntegrantes >= detalle.minIntegrantes ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'">
          <template v-if="detalle.totalIntegrantes < detalle.minIntegrantes">
            Faltan {{ detalle.minIntegrantes - detalle.totalIntegrantes }} integrante(s) para la tarifa promocional de {{ soles(detalle.precioPromocional) }} por persona.
          </template>
          <template v-else>
            Tarifa promocional aplicada: {{ soles(detalle.precioPromocional) }} por persona desde {{ detalle.minIntegrantes }} integrantes.
          </template>
        </p>

        <div v-if="detalle.pago && detalle.pago.numeroOperacion" class="mt-4 rounded-xl bg-white/5 p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Pago del grupo</p>
          <dl class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-400">Modalidad</dt>
              <dd class="mt-0.5 text-sm text-white">{{ detalle.pago.modalidad === 'billetera' ? 'Billetera digital' : 'Cuenta bancaria' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-400">Medio</dt>
              <dd class="mt-0.5 text-sm text-white">{{ detalle.pago.billeteraDigital ?? detalle.pago.banco ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-400">Código de operación</dt>
              <dd class="mt-0.5 font-mono text-sm text-white">{{ detalle.pago.numeroOperacion }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-400">Fecha de pago</dt>
              <dd class="mt-0.5 text-sm text-white">{{ detalle.pago.fechaPago ?? '—' }}</dd>
            </div>
          </dl>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <p class="text-sm text-slate-300">Total pagado: <span class="font-semibold text-white">{{ soles(detalle.pago.montoTotalPagado) }}</span></p>
            <AppButton
              v-if="detalle.pago.tieneVoucher"
              size="sm"
              variant="secondary"
              icon="heroicons:document-text"
              @click="abrirVoucher"
            >
              Ver voucher
            </AppButton>
          </div>
        </div>

        <form class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6" @submit.prevent="agregarManual">
          <AppField label="Documento" for="del-tipo" :error="manualErrores.numeroDocumento">
            <div class="flex gap-1">
              <select id="del-tipo" v-model="manual.tipoDocumento" class="field-control w-24" aria-label="Tipo de documento">
                <option value="dni">DNI</option>
                <option value="ce">CE</option>
              </select>
              <input v-model="manual.numeroDocumento" class="field-control min-w-0" maxlength="12" placeholder="Número" aria-label="Número de documento">
            </div>
          </AppField>
          <AppField label="Nombres" for="del-nombres" :error="manualErrores.nombres">
            <input id="del-nombres" v-model="manual.nombres" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Apellidos" for="del-apellidos" :error="manualErrores.apellidos">
            <input id="del-apellidos" v-model="manual.apellidos" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Correo" for="del-correo-inscrito" :error="manualErrores.correo">
            <input id="del-correo-inscrito" v-model="manual.correo" type="email" class="field-control" maxlength="191">
          </AppField>
          <AppField label="Celular" for="del-celular" :error="manualErrores.celular">
            <input id="del-celular" v-model="manual.celular" class="field-control" maxlength="15">
          </AppField>
          <div class="flex items-end">
            <AppButton type="submit" class="w-full" icon="heroicons:user-plus" :loading="agregando">Agregar</AppButton>
          </div>
        </form>

        <details class="mt-5 rounded-xl bg-white/5 p-4">
          <summary class="cursor-pointer text-sm font-semibold text-slate-200">Carga masiva</summary>
          <p class="mt-2 text-xs text-slate-400">
            Una persona por línea: <span class="font-mono">DNI, Nombres, Apellidos, Correo, Celular</span>.
            También acepta <span class="font-mono">DNI, Nombres completos, Correo</span>. Separa con coma, punto y coma o tabulador.
          </p>
          <textarea v-model="textoMasivo" rows="6" class="field-control mt-2 font-mono text-xs" placeholder="70123456, Ana, Pérez, ana@example.com, 987654321" />
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-slate-400">{{ vistaPrevia.filas.length }} fila(s) válida(s)</p>
            <AppButton type="button" size="sm" icon="heroicons:arrow-up-tray" :loading="agregando" @click="cargarMasivo">
              Registrar integrantes
            </AppButton>
          </div>
          <ul v-if="vistaPrevia.errores.length" class="mt-2 list-disc pl-5 text-xs text-amber-300">
            <li v-for="error in vistaPrevia.errores" :key="error">{{ error }}</li>
          </ul>
        </details>

        <ul v-if="erroresCarga.length" class="mt-3 list-disc pl-5 text-xs text-red-300" role="alert">
          <li v-for="error in erroresCarga" :key="error">{{ error }}</li>
        </ul>

        <div class="mt-6 overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Documento</th>
                <th>Correo</th>
                <th>Estado</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inscripcion in detalle.inscripciones" :key="inscripcion.id">
                <td class="whitespace-nowrap">{{ inscripcion.participante.nombres }} {{ inscripcion.participante.apellidos }}</td>
                <td class="font-mono text-xs">{{ inscripcion.participante.tipoDocumento.toUpperCase() }} {{ inscripcion.participante.numeroDocumento }}</td>
                <td class="text-xs text-slate-400">{{ inscripcion.participante.correo }}</td>
                <td><AppBadge :estado="inscripcion.estado.codigo">{{ inscripcion.estado.nombre }}</AppBadge></td>
                <td class="text-right tabular-nums">{{ soles(inscripcion.monto) }}</td>
              </tr>
              <tr v-if="!detalle.inscripciones.length">
                <td colspan="5" class="py-6 text-center text-slate-400">Aún no hay integrantes registrados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #acciones>
        <AppButton v-if="detalle" variant="secondary" icon="heroicons:link" @click="copiarLink(detalle)">Copiar link</AppButton>
        <AppButton variant="secondary" @click="detalleModal = false">Cerrar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
