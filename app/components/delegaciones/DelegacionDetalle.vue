<script setup lang="ts">
import type { DelegacionDetalle, PagoDelegacion, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { fechaDia, nombreCompleto, numero, soles } from '~/utils/formato'
import {
  BANCOS, BILLETERAS, ETIQUETA_ESTADO_PAGO, ETIQUETA_MODALIDAD, MAX_VOUCHERS_POR_ENVIO, TONO_ESTADO_PAGO, VOUCHER_ACCEPT,
  enlaceInscripcionDelegacion, filaVacia, filasParaEnviar, formularioPagos, hoyLima, normalizarDni, pagoVacio, textoSaldo, validarPago,
  type FilaEditable, type PagoFormulario,
} from '~/utils/delegaciones'

const props = defineProps<{ abierto: boolean, delegacionId: number | null }>()
const emit = defineEmits<{ cerrar: [], cambio: [] }>()

const { api, urlArchivo } = useApi()
const toast = useToast()
const { copiar } = useCopiar()
const { confirmar } = useConfirm()

const detalle = ref<DelegacionDetalle | null>(null)
const cargando = ref(false)

async function cargar() {
  if (!props.delegacionId) return
  cargando.value = true
  try {
    detalle.value = (await api<Respuesta<DelegacionDetalle>>(`delegations/${props.delegacionId}`)).data
  } catch (error) {
    toast.error(mensajeError(error))
    emit('cerrar')
  } finally {
    cargando.value = false
  }
}

/** El detalle nuevo reemplaza al anterior y avisa a la lista para que se actualice. */
function recibir(nuevo: DelegacionDetalle) {
  detalle.value = nuevo
  emit('cambio')
}

const enlace = computed(() => (detalle.value ? enlaceInscripcionDelegacion(detalle.value.codigoLink) : ''))

async function copiarLink() {
  if (!(await copiar(enlace.value))) {
    toast.error('No se pudo copiar el link. Revisa los permisos del portapapeles del navegador.')
    return
  }
  toast.exito('Link copiado: envíaselo al delegado.')
}

// ─── Aprobar al grupo ───
const aprobando = ref(false)
const porRevisar = computed(() => detalle.value?.inscripciones.filter((i) => ['PENDIENTE', 'EN_REVISION'].includes(i.estado.codigo)).length ?? 0)

async function aprobar() {
  if (!detalle.value) return
  const saldo = detalle.value.pago.saldo
  const aviso = saldo > 0.005 ? ` Ojo: aún falta declarar ${soles(saldo)} en vouchers.` : ''
  const sinVerificar = detalle.value.pagos.some((pago) => pago.estado === 'PENDIENTE')
  const ok = await confirmar({
    titulo: 'Aprobar a toda la delegación',
    mensaje: `Se aprobarán ${porRevisar.value} integrante(s) y se les enviará su credencial por correo, una por una.${aviso}${sinVerificar ? ' Hay vouchers sin verificar.' : ''}`,
    textoConfirmar: 'Aprobar al grupo',
  })
  if (!ok) return
  aprobando.value = true
  try {
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/approve`, { method: 'POST' })
    recibir(respuesta.data)
    toast.exito(`${respuesta.data.aprobadas ?? 0} integrante(s) aprobados. Las credenciales se envían en segundo plano.`)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    aprobando.value = false
  }
}

// ─── Integrantes ───
const filas = ref<FilaEditable[]>([filaVacia()])
const agregando = ref(false)
const erroresIntegrantes = ref<Record<string, string>>({})
const nuevos = computed(() => filasParaEnviar(filas.value))

async function agregarIntegrantes() {
  if (!detalle.value || !nuevos.value.length) {
    toast.error('Escribe al menos un integrante con documento, nombres y correo.')
    return
  }
  agregando.value = true
  erroresIntegrantes.value = {}
  try {
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/inscriptions`, { method: 'POST', body: { participantes: nuevos.value } })
    recibir(respuesta.data)
    filas.value = [filaVacia()]
    const resumen = [
      respuesta.data.registrados ? `${respuesta.data.registrados} registrado(s)` : '',
      respuesta.data.omitidos ? `${respuesta.data.omitidos} ya estaba(n)` : '',
    ].filter(Boolean).join(' · ')
    toast.exito(`Integrantes agregados. ${resumen}`.trim())
  } catch (error) {
    erroresIntegrantes.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    agregando.value = false
  }
}

async function quitar(inscripcionId: number, nombre: string) {
  if (!detalle.value) return
  const ok = await confirmar({ titulo: 'Quitar del grupo', mensaje: `¿Quitar a ${nombre} de la delegación? Se recalcula la tarifa de todos.`, textoConfirmar: 'Quitar', peligro: true })
  if (!ok) return
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/inscriptions/${inscripcionId}`, { method: 'DELETE' })).data)
    toast.exito('Integrante quitado.')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

// ─── Vouchers ───
const pagos = ref<PagoFormulario[]>([pagoVacio()])
const erroresPagos = ref<Record<string, string>[]>([])
const subiendo = ref(false)

function agregarFilaPago() {
  if (pagos.value.length < MAX_VOUCHERS_POR_ENVIO) pagos.value = [...pagos.value, pagoVacio()]
}

function quitarFilaPago(indice: number) {
  const resto = pagos.value.filter((_, i) => i !== indice)
  pagos.value = resto.length ? resto : [pagoVacio()]
}

function alElegirArchivo(pago: PagoFormulario, evento: Event) {
  pago.archivo = (evento.target as HTMLInputElement).files?.[0] ?? null
}

async function subirPagos() {
  if (!detalle.value) return
  const hoy = hoyLima()
  erroresPagos.value = pagos.value.map((pago) => validarPago(pago, hoy))
  if (erroresPagos.value.some((errores) => Object.keys(errores).length)) {
    toast.error('Revisa los datos de los vouchers.')
    return
  }
  subiendo.value = true
  try {
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/payments`, { method: 'POST', body: formularioPagos(pagos.value) })
    recibir(respuesta.data)
    pagos.value = [pagoVacio()]
    erroresPagos.value = []
    toast.exito('Vouchers guardados.')
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    subiendo.value = false
  }
}

const urlVoucher = (pago: PagoDelegacion) => urlArchivo(`delegations/${detalle.value?.id}/payments/${pago.id}/voucher`)
const medioDe = (pago: PagoDelegacion) => (pago.modalidadPago === 'banco' ? `Banco ${pago.banco ?? ''}${pago.tipoOperacion ? ` · ${pago.tipoOperacion}` : ''}` : `Billetera ${pago.billeteraDigital ?? ''}`).trim()

async function marcarPago(pago: PagoDelegacion, estado: 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO', motivo?: string) {
  if (!detalle.value) return
  try {
    await api(`delegations/${detalle.value.id}/payments/${pago.id}`, { method: 'PATCH', body: { estado, motivo: motivo || null } })
    await cargar()
    emit('cambio')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

const rechazando = ref<PagoDelegacion | null>(null)
const motivoRechazo = ref('')

async function confirmarRechazo() {
  if (!rechazando.value) return
  const pago = rechazando.value
  rechazando.value = null
  await marcarPago(pago, 'RECHAZADO', motivoRechazo.value.trim())
  motivoRechazo.value = ''
}

async function eliminarPago(pago: PagoDelegacion) {
  if (!detalle.value) return
  const ok = await confirmar({ titulo: 'Eliminar voucher', mensaje: `¿Eliminar el voucher ${pago.numeroOperacion}? Se borra también su archivo.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/payments/${pago.id}`, { method: 'DELETE' })).data)
    toast.exito('Voucher eliminado.')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

// ─── Datos de la delegación ───
const edicion = reactive({ nombre: '', institucion: '', tipoDocumento: 'dni' as 'dni' | 'ce', numeroDocumento: '', nombres: '', apellidos: '', correo: '', celular: '', activo: true })
const erroresEdicion = ref<Record<string, string>>({})
const guardandoDatos = ref(false)

watch(detalle, (valor) => {
  if (!valor) return
  const [nombres, ...resto] = (valor.representante.nombre ?? '').split(' ')
  Object.assign(edicion, {
    nombre: valor.nombre,
    institucion: valor.institucion ?? '',
    tipoDocumento: valor.representante.tipoDocumento ?? 'dni',
    numeroDocumento: valor.representante.documento ?? '',
    nombres: nombres ?? '',
    apellidos: resto.join(' '),
    correo: valor.representante.email ?? '',
    celular: valor.representante.telefono ?? '',
    activo: valor.activo,
  })
})

async function guardarDatos() {
  if (!detalle.value) return
  guardandoDatos.value = true
  erroresEdicion.value = {}
  try {
    const respuesta = await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}`, {
      method: 'PUT',
      body: {
        nombre: edicion.nombre.trim(),
        institucion: edicion.institucion.trim() || null,
        activo: edicion.activo,
        representante: {
          nombres: edicion.nombres.trim(),
          apellidos: edicion.apellidos.trim(),
          tipoDocumento: edicion.tipoDocumento,
          numeroDocumento: (edicion.tipoDocumento === 'dni' ? normalizarDni(edicion.numeroDocumento) : edicion.numeroDocumento.trim()).toUpperCase(),
          correo: edicion.correo.trim().toLowerCase(),
          celular: edicion.celular.trim(),
        },
      },
    })
    recibir(respuesta.data)
    toast.exito('Datos guardados.')
  } catch (error) {
    erroresEdicion.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardandoDatos.value = false
  }
}

// Al abrir (o cambiar de delegación) se reinician los formularios y se carga el detalle. Va al final: usa todo lo anterior
watch(() => [props.abierto, props.delegacionId] as const, ([abierto, id]) => {
  if (!abierto || !id) return
  detalle.value = null
  filas.value = [filaVacia()]
  pagos.value = [pagoVacio()]
  erroresIntegrantes.value = {}
  erroresPagos.value = []
  void cargar()
}, { immediate: true })
</script>

<template>
  <AppModal :abierto="abierto" :titulo="detalle?.nombre ?? 'Delegación'" descripcion="Integrantes, vouchers y aprobación del grupo." ancho="xl" @cerrar="emit('cerrar')">
    <div v-if="cargando && !detalle" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
    <div v-else-if="detalle" class="space-y-8">
      <!-- Resumen -->
      <section class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <AppBadge :tono="detalle.modalidad === 'VIRTUAL' ? 'info' : 'brand'">{{ ETIQUETA_MODALIDAD[detalle.modalidad] }}</AppBadge>
          <AppBadge v-if="detalle.tipoInscripcion" tono="neutral">{{ detalle.tipoInscripcion.nombre }}</AppBadge>
          <AppBadge v-if="!detalle.activo" tono="error">Inactiva</AppBadge>
          <span v-if="detalle.institucion" class="text-sm text-slate-400">{{ detalle.institucion }}</span>
        </div>
        <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ numero(detalle.totalIntegrantes) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Por persona</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ soles(detalle.precioUnitario) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Total a pagar</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ soles(detalle.pago.totalAPagar) }}</dd>
          </div>
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Declarado</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ soles(detalle.pago.declarado) }}</dd>
            <dd class="text-xs text-slate-400">Verificado {{ soles(detalle.pago.verificado) }}</dd>
          </div>
          <div class="rounded-xl px-4 py-3" :class="detalle.pago.saldo > 0.005 ? 'bg-amber-400/10' : 'bg-emerald-400/10'">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Saldo</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ soles(detalle.pago.saldo) }}</dd>
            <dd class="text-xs" :class="detalle.pago.saldo > 0.005 ? 'text-amber-200' : 'text-emerald-200'">{{ textoSaldo(detalle.pago.saldo) }}</dd>
          </div>
        </dl>
        <p v-if="detalle.faltanParaPromocional !== null" class="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Faltan {{ detalle.faltanParaPromocional }} integrante(s) para la tarifa promocional de {{ soles(detalle.precioPromocional) }} por persona.
        </p>
        <p v-else-if="detalle.modalidad === 'PRESENCIAL' && detalle.totalIntegrantes" class="rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Tarifa promocional aplicada: {{ soles(detalle.precioPromocional) }} por persona desde {{ detalle.minIntegrantes }} integrantes.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="secondary" icon="heroicons:link" @click="copiarLink">Copiar link del delegado</AppButton>
          <AppButton variant="secondary" icon="heroicons:arrow-top-right-on-square" :to="enlace">Abrir link</AppButton>
          <AppButton variant="success" icon="heroicons:check-badge" :disabled="!porRevisar" :loading="aprobando" @click="aprobar">
            Aprobar al grupo ({{ porRevisar }})
          </AppButton>
        </div>
        <p class="truncate font-mono text-xs text-slate-500" :title="enlace">{{ enlace }}</p>
      </section>

      <!-- Vouchers -->
      <section class="space-y-3">
        <h3 class="kicker">Vouchers ({{ detalle.pagos.length }})</h3>
        <div v-if="detalle.pagos.length" class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr><th>Fecha</th><th>Medio</th><th>Operación</th><th class="text-right">Monto</th><th>Estado</th><th class="text-right">Acciones</th></tr>
            </thead>
            <tbody>
              <tr v-for="pago in detalle.pagos" :key="pago.id">
                <td class="whitespace-nowrap">{{ fechaDia(pago.fechaPago) }}</td>
                <td class="whitespace-nowrap text-xs">{{ medioDe(pago) }}</td>
                <td class="font-mono text-xs">{{ pago.numeroOperacion }}</td>
                <td class="text-right tabular-nums">{{ soles(pago.monto) }}</td>
                <td>
                  <AppBadge :tono="TONO_ESTADO_PAGO[pago.estado]">{{ ETIQUETA_ESTADO_PAGO[pago.estado] }}</AppBadge>
                  <p v-if="pago.motivoRechazo" class="mt-1 max-w-48 text-xs text-red-300">{{ pago.motivoRechazo }}</p>
                </td>
                <td class="text-right">
                  <div class="flex flex-wrap justify-end gap-1">
                    <a :href="urlVoucher(pago)" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white ring-1 ring-white/15 ring-inset hover:bg-white/10">
                      <Icon name="heroicons:document-arrow-down" class="size-3.5" aria-hidden="true" /> Ver
                    </a>
                    <AppButton v-if="pago.estado !== 'VERIFICADO'" size="sm" variant="success" @click="marcarPago(pago, 'VERIFICADO')">Verificar</AppButton>
                    <AppButton v-if="pago.estado !== 'RECHAZADO'" size="sm" variant="danger" @click="rechazando = pago">Rechazar</AppButton>
                    <AppButton v-if="pago.estado !== 'PENDIENTE'" size="sm" variant="ghost" @click="marcarPago(pago, 'PENDIENTE')">Pendiente</AppButton>
                    <AppButton v-if="pago.estado !== 'VERIFICADO'" size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar voucher" @click="eliminarPago(pago)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-400">Aún no hay vouchers. Agrégalos abajo o el delegado los sube con su link.</p>

        <details class="rounded-xl bg-white/5 p-4">
          <summary class="cursor-pointer text-sm font-semibold text-slate-200">Agregar vouchers</summary>
          <form class="mt-4 space-y-3" @submit.prevent="subirPagos">
            <div v-for="(pago, indice) in pagos" :key="indice" class="rounded-xl bg-white/5 p-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Voucher {{ indice + 1 }}</p>
                <button v-if="pagos.length > 1" type="button" class="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" :aria-label="`Quitar el voucher ${indice + 1}`" @click="quitarFilaPago(indice)">
                  <Icon name="heroicons:x-mark" class="size-4" aria-hidden="true" />
                </button>
              </div>
              <div class="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <AppField label="Medio" :for="`pago-medio-${indice}`">
                  <select :id="`pago-medio-${indice}`" v-model="pago.modalidadPago" class="field-control">
                    <option value="billetera">Billetera digital</option>
                    <option value="banco">Cuenta bancaria</option>
                  </select>
                </AppField>
                <AppField v-if="pago.modalidadPago === 'billetera'" label="Billetera" :for="`pago-bill-${indice}`">
                  <select :id="`pago-bill-${indice}`" v-model="pago.billeteraDigital" class="field-control">
                    <option v-for="billetera in BILLETERAS" :key="billetera" :value="billetera">{{ billetera }}</option>
                  </select>
                </AppField>
                <template v-else>
                  <AppField label="Banco" :for="`pago-banco-${indice}`">
                    <select :id="`pago-banco-${indice}`" v-model="pago.banco" class="field-control">
                      <option v-for="banco in BANCOS" :key="banco" :value="banco">{{ banco }}</option>
                    </select>
                  </AppField>
                  <AppField label="Tipo de operación" :for="`pago-tipo-${indice}`">
                    <select :id="`pago-tipo-${indice}`" v-model="pago.tipoOperacion" class="field-control">
                      <option value="directo">Directo</option>
                      <option value="interbancario">Interbancario</option>
                    </select>
                  </AppField>
                </template>
                <AppField label="N° de operación" :for="`pago-op-${indice}`" required :error="erroresPagos[indice]?.numeroOperacion">
                  <input :id="`pago-op-${indice}`" v-model="pago.numeroOperacion" class="field-control" maxlength="100">
                </AppField>
                <AppField label="Fecha de pago" :for="`pago-fecha-${indice}`" required :error="erroresPagos[indice]?.fechaPago">
                  <input :id="`pago-fecha-${indice}`" v-model="pago.fechaPago" type="date" class="field-control">
                </AppField>
                <AppField label="Monto del voucher (S/)" :for="`pago-monto-${indice}`" required :error="erroresPagos[indice]?.monto">
                  <input :id="`pago-monto-${indice}`" v-model.number="pago.monto" type="number" min="0" step="0.01" class="field-control">
                </AppField>
                <AppField label="Archivo (PDF, JPG, PNG o WebP, máx. 5 MB)" :for="`pago-archivo-${indice}`" required :error="erroresPagos[indice]?.archivo">
                  <input :id="`pago-archivo-${indice}`" type="file" :accept="VOUCHER_ACCEPT" class="field-control" @change="alElegirArchivo(pago, $event)">
                </AppField>
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <AppButton v-if="pagos.length < MAX_VOUCHERS_POR_ENVIO" type="button" size="sm" variant="secondary" icon="heroicons:plus" @click="agregarFilaPago">Otro voucher</AppButton>
              <span v-else class="text-xs text-slate-400">Máximo {{ MAX_VOUCHERS_POR_ENVIO }} vouchers por envío.</span>
              <AppButton type="submit" icon="heroicons:arrow-up-tray" :loading="subiendo">Guardar vouchers</AppButton>
            </div>
          </form>
        </details>
      </section>

      <!-- Integrantes -->
      <section class="space-y-3">
        <h3 class="kicker">Integrantes ({{ detalle.inscripciones.length }})</h3>
        <div class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr><th>Integrante</th><th>Documento</th><th>Correo</th><th>Estado</th><th class="text-right">Monto</th><th class="text-right"><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              <tr v-for="inscripcion in detalle.inscripciones" :key="inscripcion.id">
                <td class="whitespace-nowrap">{{ nombreCompleto(inscripcion.participante) }}</td>
                <td class="font-mono text-xs">{{ inscripcion.participante.tipoDocumento.toUpperCase() }} {{ inscripcion.participante.numeroDocumento }}</td>
                <td class="text-xs text-slate-400">{{ inscripcion.participante.correo }}</td>
                <td><AppBadge :estado="inscripcion.estado.codigo">{{ inscripcion.estado.nombre }}</AppBadge></td>
                <td class="text-right tabular-nums">{{ soles(inscripcion.monto) }}</td>
                <td class="text-right">
                  <AppButton v-if="inscripcion.estado.codigo !== 'APROBADO'" size="sm" variant="ghost" icon="heroicons:user-minus" :aria-label="`Quitar a ${nombreCompleto(inscripcion.participante)}`" @click="quitar(inscripcion.id, nombreCompleto(inscripcion.participante))" />
                </td>
              </tr>
              <tr v-if="!detalle.inscripciones.length">
                <td colspan="6" class="py-6 text-center text-slate-400">Aún no hay integrantes registrados.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <details class="rounded-xl bg-white/5 p-4" :open="!detalle.inscripciones.length">
          <summary class="cursor-pointer text-sm font-semibold text-slate-200">Agregar integrantes</summary>
          <form class="mt-4 space-y-3" @submit.prevent="agregarIntegrantes">
            <FilasIntegrantes v-model="filas" :errores="erroresIntegrantes" />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs text-slate-400">{{ nuevos.length }} por agregar · la tarifa se recalcula para todo el grupo.</p>
              <AppButton type="submit" icon="heroicons:user-plus" :loading="agregando">Registrar integrantes</AppButton>
            </div>
          </form>
        </details>
      </section>

      <!-- Datos -->
      <details class="rounded-xl bg-white/5 p-4">
        <summary class="cursor-pointer text-sm font-semibold text-slate-200">Datos de la delegación y del delegado</summary>
        <form class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="guardarDatos">
          <AppField label="Nombre de la delegación" for="ed-nombre" required :error="erroresEdicion.nombre">
            <input id="ed-nombre" v-model="edicion.nombre" class="field-control" maxlength="150">
          </AppField>
          <AppField label="Institución" for="ed-institucion" :error="erroresEdicion.institucion">
            <input id="ed-institucion" v-model="edicion.institucion" class="field-control" maxlength="191">
          </AppField>
          <AppField label="Documento del delegado" for="ed-doc" required :error="erroresEdicion['representante.numeroDocumento']">
            <div class="flex gap-1">
              <select v-model="edicion.tipoDocumento" class="field-control w-20" aria-label="Tipo de documento">
                <option value="dni">DNI</option>
                <option value="ce">CE</option>
              </select>
              <input id="ed-doc" v-model="edicion.numeroDocumento" class="field-control min-w-0" maxlength="12">
            </div>
          </AppField>
          <AppField label="Nombres" for="ed-nombres" required :error="erroresEdicion['representante.nombres']">
            <input id="ed-nombres" v-model="edicion.nombres" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Apellidos" for="ed-apellidos" required :error="erroresEdicion['representante.apellidos']">
            <input id="ed-apellidos" v-model="edicion.apellidos" class="field-control" maxlength="120">
          </AppField>
          <AppField label="Correo" for="ed-correo" required :error="erroresEdicion['representante.correo']">
            <input id="ed-correo" v-model="edicion.correo" type="email" class="field-control" maxlength="191">
          </AppField>
          <AppField label="Celular" for="ed-celular" required :error="erroresEdicion['representante.celular']">
            <input id="ed-celular" v-model="edicion.celular" class="field-control" maxlength="15">
          </AppField>
          <div class="md:col-span-2 xl:col-span-3">
            <AppSwitch v-model="edicion.activo" label="Delegación activa" descripcion="Una delegación inactiva no recibe integrantes ni vouchers con su link." />
          </div>
          <div class="md:col-span-2 xl:col-span-3">
            <AppButton type="submit" :loading="guardandoDatos">Guardar datos</AppButton>
          </div>
        </form>
      </details>
    </div>
    <template #acciones>
      <AppButton variant="secondary" @click="emit('cerrar')">Cerrar</AppButton>
    </template>
  </AppModal>

  <AppModal :abierto="rechazando !== null" titulo="Rechazar voucher" :descripcion="rechazando ? `Operación ${rechazando.numeroOperacion} por ${soles(rechazando.monto)}` : ''" ancho="sm" @cerrar="rechazando = null">
    <AppField label="Motivo (opcional)" for="rechazo-motivo">
      <textarea id="rechazo-motivo" v-model="motivoRechazo" rows="3" class="field-control" maxlength="500" placeholder="El monto no coincide con el estado de cuenta" />
    </AppField>
    <template #acciones>
      <AppButton variant="secondary" @click="rechazando = null">Cancelar</AppButton>
      <AppButton variant="danger" @click="confirmarRechazo">Rechazar voucher</AppButton>
    </template>
  </AppModal>
</template>
