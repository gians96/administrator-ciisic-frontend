<script setup lang="ts">
import type { CodigoPlan, DelegacionDetalle, InscripcionDelegacion, PagoDelegacion, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { fechaDia, nombreCompleto, numero, soles } from '~/utils/formato'
import {
  BANCOS, BILLETERAS, cambiosDePlanes, cantidadesPorPlan, enlaceInscripcionDelegacion, enlaceInscripcionIndividual, errorDeDominio, errorDeMinimo, estimarGrupo,
  ETIQUETA_ESTADO_PAGO, ETIQUETA_PLAN, filaVacia, filasParaEnviar, formularioDePlanes, formularioPagos, hoyLima, MAX_VOUCHERS_POR_ENVIO, medioDePago, normalizarDni,
  normalizarDominio, pagoVacio, planesActivos, planPorDefecto, puedeEliminarVoucher, TONO_ESTADO_PAGO, validarPlanes, VOUCHER_ACCEPT,
  type Cifra, type FilaEditable, type FormularioPlanes, type PagoFormulario,
} from '~/utils/delegaciones'

const props = defineProps<{ abierto: boolean, delegacionId: number | null }>()
const emit = defineEmits<{ cerrar: [], cambio: [] }>()

const { api } = useApi()
const toast = useToast()
const auth = useAuthStore()
const { copiar } = useCopiar()
const { confirmar } = useConfirm()

// Cada botón sigue al permiso de su acción (spec 029): el Tesorero valida, la Comisión inscribe y solo Owner y Administrador configuran
const puedeGestionar = computed(() => auth.puede('delegaciones.gestionar'))
const puedeInscribir = computed(() => auth.puede('delegaciones.inscribir'))
const puedeValidar = computed(() => auth.puede('inscripciones.validar'))
const puedeVerVouchers = computed(() => auth.puede('pagos.ver'))

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

const activos = computed(() => (detalle.value ? planesActivos(detalle.value.planes) : []))
const codigosActivos = computed<CodigoPlan[]>(() => activos.value.map((plan) => plan.codigo))
const planUnico = computed(() => (detalle.value ? planPorDefecto(detalle.value.planes) : ''))

// ─── Links ───
const enlace = computed(() => (detalle.value?.codigoLink ? enlaceInscripcionDelegacion(detalle.value.codigoLink) : ''))
const enlaceIndividual = computed(() => (detalle.value?.codigoInscripcion ? enlaceInscripcionIndividual(detalle.value.codigoInscripcion) : ''))

async function copiarEnlace(url: string, aviso: string) {
  if (!(await copiar(url))) {
    toast.error('No se pudo copiar el link. Revisa los permisos del portapapeles del navegador.')
    return
  }
  toast.exito(aviso)
}

// ─── Aprobar al grupo ───
const aprobando = ref(false)
const porRevisar = computed(() => detalle.value?.inscripciones.filter((i) => ['PENDIENTE', 'EN_REVISION'].includes(i.estado.codigo)).length ?? 0)

async function aprobar() {
  if (!detalle.value) return
  const saldo = detalle.value.pago?.saldo ?? 0
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

/** Lo que costará el grupo con los integrantes que ya tiene más los que están por agregarse (solo con `pagos.ver`). */
const estimadoNuevos = computed(() => {
  const d = detalle.value
  if (!d || !nuevos.value.length) return null
  const cantidades = cantidadesPorPlan(filas.value, planUnico.value)
  for (const plan of d.planes) cantidades[plan.codigo] = (cantidades[plan.codigo] ?? 0) + plan.integrantes
  return estimarGrupo(d.planes, cantidades, d.minIntegrantes)
})

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
    filas.value = [filaVacia(planUnico.value)]
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
  const ok = await confirmar({ titulo: 'Quitar del grupo', mensaje: `¿Quitar a ${nombre} de la delegación? Se recalcula el precio de su plan para todos.`, textoConfirmar: 'Quitar', peligro: true })
  if (!ok) return
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/inscriptions/${inscripcionId}`, { method: 'DELETE' })).data)
    toast.exito('Integrante quitado.')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

/** Planes a los que se puede mover un integrante: los activos y el que ya tiene (aunque esté apagado). */
function planesDestino(inscripcion: InscripcionDelegacion): CodigoPlan[] {
  const actuales = new Set<CodigoPlan>(codigosActivos.value)
  if (inscripcion.plan) actuales.add(inscripcion.plan)
  return [...actuales]
}

const puedeCambiarPlan = (inscripcion: InscripcionDelegacion) => puedeInscribir.value && !['RECHAZADO', 'CANCELADO'].includes(inscripcion.estado.codigo)

async function cambiarPlan(inscripcion: InscripcionDelegacion, evento: Event) {
  if (!detalle.value) return
  const plan = (evento.target as HTMLSelectElement).value as CodigoPlan
  if (plan === inscripcion.plan) return
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/inscriptions/${inscripcion.id}`, { method: 'PATCH', body: { plan } })).data)
    toast.exito(`Ahora es «${ETIQUETA_PLAN[plan]}».`)
  } catch (error) {
    toast.error(mensajeError(error))
    // El selector vuelve al plan que tiene
    await cargar()
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

// El voucher que se está viendo en el visor (sobre este detalle, sin abrir otra pestaña)
const viendoId = ref<number | null>(null)

// Quien configura o quien revisa los pagos (Tesorero) borra un voucher que no esté verificado
const puedeEliminar = (pago: PagoDelegacion) => puedeEliminarVoucher(pago.estado, { gestionar: puedeGestionar.value, validar: puedeValidar.value })

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

// ─── Planes y precios (solo Owner y Administrador) ───
const edicionPlanes = ref<FormularioPlanes>(formularioDePlanes([]))
const edicionMinimo = ref<Cifra>('')
const erroresPlanes = ref<Record<string, string>>({})
const guardandoPlanes = ref(false)

watch(detalle, (valor) => {
  if (!valor) return
  edicionPlanes.value = formularioDePlanes(valor.planes)
  edicionMinimo.value = valor.minIntegrantes
  erroresPlanes.value = {}
})

async function guardarPlanes() {
  if (!detalle.value) return
  erroresPlanes.value = validarPlanes(edicionPlanes.value)
  const minimo = errorDeMinimo(edicionMinimo.value)
  if (minimo) erroresPlanes.value.minIntegrantes = minimo
  if (Object.keys(erroresPlanes.value).length) {
    toast.error('Revisa los planes: hay campos por corregir.')
    return
  }
  const planes = cambiosDePlanes(edicionPlanes.value, detalle.value.planes)
  const cambiaMinimo = typeof edicionMinimo.value === 'number' && edicionMinimo.value !== detalle.value.minIntegrantes
  if (!planes && !cambiaMinimo) {
    toast.info('No hay cambios en los planes.')
    return
  }
  const integrantes = detalle.value.totalIntegrantes
  if (integrantes > 0) {
    const ok = await confirmar({
      titulo: 'Cambiar los planes de la delegación',
      mensaje: `Se recalcula el precio de los ${numero(integrantes)} integrante(s) del grupo y el saldo de la delegación cambia.`,
      textoConfirmar: 'Guardar planes',
    })
    if (!ok) return
  }
  guardandoPlanes.value = true
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/config`, {
      method: 'PUT',
      body: { ...(planes ? { planes } : {}), ...(cambiaMinimo ? { minIntegrantes: edicionMinimo.value } : {}) },
    })).data)
    toast.exito('Planes guardados.')
  } catch (error) {
    erroresPlanes.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardandoPlanes.value = false
  }
}

// ─── Links y correo (solo Owner y Administrador) ───
const edicionDominio = ref('')
const edicionIndividual = ref(false)
const errorDominio = ref<string | null>(null)
const guardandoLinks = ref(false)

watch(detalle, (valor) => {
  if (!valor) return
  edicionDominio.value = valor.dominioCorreo ?? ''
  edicionIndividual.value = valor.inscripcionIndividual
  errorDominio.value = null
})

async function guardarLinks() {
  if (!detalle.value) return
  errorDominio.value = errorDeDominio(edicionDominio.value)
  if (errorDominio.value) return
  const dominio = normalizarDominio(edicionDominio.value)
  const cuerpo: Record<string, string | boolean | null> = {}
  if (dominio !== (detalle.value.dominioCorreo ?? '')) cuerpo.dominioCorreo = dominio || null
  if (edicionIndividual.value !== detalle.value.inscripcionIndividual) cuerpo.inscripcionIndividual = edicionIndividual.value
  if (!Object.keys(cuerpo).length) {
    toast.info('No hay cambios en los links ni en el dominio.')
    return
  }
  guardandoLinks.value = true
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/config`, { method: 'PUT', body: cuerpo })).data)
    toast.exito('Links y dominio guardados.')
  } catch (error) {
    errorDominio.value = aErrorApi(error).fields?.dominioCorreo ?? null
    toast.error(mensajeError(error))
  } finally {
    guardandoLinks.value = false
  }
}

async function regenerar(cual: 'delegado' | 'individual') {
  if (!detalle.value) return
  const ok = await confirmar({
    titulo: cual === 'delegado' ? 'Regenerar el link del delegado' : 'Regenerar el link individual',
    mensaje: 'El link anterior deja de funcionar: tendrás que enviar el nuevo.',
    textoConfirmar: 'Regenerar',
    peligro: true,
  })
  if (!ok) return
  try {
    recibir((await api<Respuesta<DelegacionDetalle>>(`delegations/${detalle.value.id}/links/regenerate`, { method: 'POST', body: { enlace: cual } })).data)
    toast.exito('Link nuevo generado. Cópialo para enviarlo.')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

// Al abrir (o cambiar de delegación) se reinician los formularios y se carga el detalle. Va al final: usa todo lo anterior
watch(() => [props.abierto, props.delegacionId] as const, ([abierto, id]) => {
  if (!abierto || !id) return
  detalle.value = null
  viendoId.value = null
  filas.value = [filaVacia()]
  pagos.value = [pagoVacio()]
  erroresIntegrantes.value = {}
  erroresPagos.value = []
  void cargar()
}, { immediate: true })

// Con un solo plan activo las filas nuevas ya lo traen elegido
watch(planUnico, (plan) => {
  for (const fila of filas.value) if (!fila.plan) fila.plan = plan
})
</script>

<template>
  <AppModal :abierto="abierto" :titulo="detalle?.nombre ?? 'Delegación'" descripcion="Planes, integrantes, vouchers y aprobación del grupo." ancho="xl" @cerrar="emit('cerrar')">
    <div v-if="cargando && !detalle" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
    <div v-else-if="detalle" class="space-y-8">
      <!-- Resumen -->
      <section class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <AppBadge v-for="plan in activos" :key="plan.codigo" :tono="plan.modalidad === 'VIRTUAL' ? 'info' : 'brand'">{{ ETIQUETA_PLAN[plan.codigo] }}</AppBadge>
          <AppBadge v-if="!activos.length" tono="warn">Sin planes activos</AppBadge>
          <AppBadge v-if="detalle.dominioCorreo" tono="neutral">@{{ detalle.dominioCorreo }}</AppBadge>
          <AppBadge v-if="detalle.inscripcionIndividual" tono="neutral">Link individual</AppBadge>
          <AppBadge v-if="!detalle.activo" tono="error">Inactiva</AppBadge>
          <span v-if="detalle.institucion" class="text-sm text-slate-400">{{ detalle.institucion }}</span>
        </div>
        <dl class="grid gap-3 sm:grid-cols-2" :class="detalle.pago ? 'lg:grid-cols-4' : 'lg:grid-cols-2'">
          <div class="rounded-xl bg-white/5 px-4 py-3">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt>
            <dd class="mt-0.5 text-2xl font-bold tabular-nums">{{ numero(detalle.totalIntegrantes) }}</dd>
          </div>
          <template v-if="detalle.pago">
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
          </template>
        </dl>

        <ul class="grid gap-3 sm:grid-cols-3">
          <li v-for="plan in detalle.planes" :key="plan.codigo" class="rounded-xl px-4 py-3" :class="plan.activo ? 'bg-white/5' : 'bg-white/[.02] opacity-70'">
            <p class="flex items-center justify-between gap-2 text-sm font-semibold text-white">
              {{ ETIQUETA_PLAN[plan.codigo] }}
              <AppBadge :tono="plan.activo ? 'ok' : 'neutral'">{{ plan.activo ? 'Activo' : 'Apagado' }}</AppBadge>
            </p>
            <p class="mt-1 text-sm text-slate-300">
              <template v-if="plan.precioUnitario !== null">
                <span class="font-bold tabular-nums text-white">{{ soles(plan.precioUnitario) }}</span> por persona
                <span v-if="plan.precioPromocional !== null && plan.precioPromocional < (plan.precio ?? 0)" class="block text-xs text-slate-400">
                  {{ soles(plan.precio) }} · {{ soles(plan.precioPromocional) }} desde {{ numero(detalle.minIntegrantes) }}
                </span>
              </template>
              <template v-else>—</template>
            </p>
            <p class="text-xs text-slate-400">{{ numero(plan.integrantes) }} integrante(s)</p>
          </li>
        </ul>
        <p v-if="detalle.faltanParaPromocional !== null" class="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Faltan {{ detalle.faltanParaPromocional }} integrante(s) para el precio promocional.
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <template v-if="enlace">
            <AppButton variant="secondary" icon="heroicons:link" @click="copiarEnlace(enlace, 'Link copiado: envíaselo al delegado.')">Copiar link del delegado</AppButton>
            <AppButton variant="secondary" icon="heroicons:arrow-top-right-on-square" :to="enlace">Abrir link</AppButton>
          </template>
          <AppButton v-if="enlaceIndividual" variant="secondary" icon="heroicons:user-plus" @click="copiarEnlace(enlaceIndividual, 'Link individual copiado: compártelo con los integrantes.')">Copiar link individual</AppButton>
          <AppButton v-if="puedeValidar" variant="success" icon="heroicons:check-badge" :disabled="!porRevisar" :loading="aprobando" @click="aprobar">
            Aprobar al grupo ({{ porRevisar }})
          </AppButton>
        </div>
        <p v-if="enlace" class="truncate font-mono text-xs text-slate-500" :title="enlace">{{ enlace }}</p>
      </section>

      <!-- Vouchers -->
      <section v-if="detalle.pago" class="space-y-3">
        <h3 class="kicker">Vouchers ({{ detalle.pagos.length }})</h3>
        <template v-if="detalle.pagos.length">
          <div class="relative hidden overflow-x-auto md:block">
            <table class="table-base">
              <thead>
                <tr><th>Fecha</th><th>Medio</th><th>Operación</th><th class="text-right">Monto</th><th>Estado</th><th class="text-right">Acciones</th></tr>
              </thead>
              <tbody>
                <tr v-for="pago in detalle.pagos" :key="pago.id">
                  <td class="whitespace-nowrap">{{ fechaDia(pago.fechaPago) }}</td>
                  <td class="whitespace-nowrap text-xs">{{ medioDePago(pago) }}</td>
                  <td class="font-mono text-xs">{{ pago.numeroOperacion }}</td>
                  <td class="text-right tabular-nums">{{ soles(pago.monto) }}</td>
                  <td>
                    <AppBadge :tono="TONO_ESTADO_PAGO[pago.estado]">{{ ETIQUETA_ESTADO_PAGO[pago.estado] }}</AppBadge>
                    <p v-if="pago.motivoRechazo" class="mt-1 max-w-48 text-xs text-red-300">{{ pago.motivoRechazo }}</p>
                  </td>
                  <td>
                    <AccionesVoucher
                      class="justify-end"
                      :pago="pago"
                      :puede-ver="puedeVerVouchers"
                      :puede-validar="puedeValidar"
                      :puede-eliminar="puedeEliminar(pago)"
                      @ver="viendoId = pago.id"
                      @verificar="marcarPago(pago, 'VERIFICADO')"
                      @rechazar="rechazando = pago"
                      @pendiente="marcarPago(pago, 'PENDIENTE')"
                      @eliminar="eliminarPago(pago)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Móvil: una tarjeta por voucher -->
          <ul class="space-y-2 md:hidden">
            <li v-for="pago in detalle.pagos" :key="pago.id" class="rounded-xl bg-white/5 p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="break-all font-mono text-sm text-white">{{ pago.numeroOperacion }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">{{ fechaDia(pago.fechaPago) }} · {{ medioDePago(pago) }}</p>
                </div>
                <p class="shrink-0 font-semibold tabular-nums text-white">{{ soles(pago.monto) }}</p>
              </div>
              <div class="mt-2">
                <AppBadge :tono="TONO_ESTADO_PAGO[pago.estado]">{{ ETIQUETA_ESTADO_PAGO[pago.estado] }}</AppBadge>
                <p v-if="pago.motivoRechazo" class="mt-1 text-xs text-red-300">{{ pago.motivoRechazo }}</p>
              </div>
              <AccionesVoucher
                class="mt-3"
                :pago="pago"
                :puede-ver="puedeVerVouchers"
                :puede-validar="puedeValidar"
                :puede-eliminar="puedeEliminar(pago)"
                @ver="viendoId = pago.id"
                @verificar="marcarPago(pago, 'VERIFICADO')"
                @rechazar="rechazando = pago"
                @pendiente="marcarPago(pago, 'PENDIENTE')"
                @eliminar="eliminarPago(pago)"
              />
            </li>
          </ul>
        </template>
        <p v-else class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-400">Aún no hay vouchers. El delegado los sube con su link{{ puedeInscribir ? ' o puedes agregarlos abajo' : '' }}.</p>

        <details v-if="puedeInscribir" class="rounded-xl bg-white/5 p-4">
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
        <div class="relative hidden overflow-x-auto md:block">
          <table class="table-base">
            <thead>
              <tr><th>Integrante</th><th>Documento</th><th>Correo</th><th>Plan</th><th>Estado</th><th class="text-right">Monto</th><th class="text-right"><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              <tr v-for="inscripcion in detalle.inscripciones" :key="inscripcion.id">
                <td class="whitespace-nowrap">{{ nombreCompleto(inscripcion.participante) }}</td>
                <td class="font-mono text-xs">{{ inscripcion.participante.tipoDocumento.toUpperCase() }} {{ inscripcion.participante.numeroDocumento }}</td>
                <td class="text-xs text-slate-400">{{ inscripcion.participante.correo }}</td>
                <td class="whitespace-nowrap">
                  <select v-if="puedeCambiarPlan(inscripcion)" :value="inscripcion.plan ?? ''" class="field-control min-w-36 py-1 text-xs" :aria-label="`Plan de ${nombreCompleto(inscripcion.participante)}`" @change="cambiarPlan(inscripcion, $event)">
                    <option v-if="!inscripcion.plan" value="" disabled>Sin plan</option>
                    <option v-for="plan in planesDestino(inscripcion)" :key="plan" :value="plan">{{ ETIQUETA_PLAN[plan] }}</option>
                  </select>
                  <span v-else class="text-xs">{{ inscripcion.plan ? ETIQUETA_PLAN[inscripcion.plan] : '—' }}</span>
                </td>
                <td><AppBadge :estado="inscripcion.estado.codigo">{{ inscripcion.estado.nombre }}</AppBadge></td>
                <td class="text-right tabular-nums">{{ soles(inscripcion.monto) }}</td>
                <td class="text-right">
                  <AppButton v-if="puedeInscribir && inscripcion.estado.codigo !== 'APROBADO'" size="sm" variant="ghost" icon="heroicons:user-minus" :aria-label="`Quitar a ${nombreCompleto(inscripcion.participante)}`" @click="quitar(inscripcion.id, nombreCompleto(inscripcion.participante))" />
                </td>
              </tr>
              <tr v-if="!detalle.inscripciones.length">
                <td colspan="7" class="py-6 text-center text-slate-400">Aún no hay integrantes registrados.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Móvil: una tarjeta por integrante -->
        <ul class="space-y-2 md:hidden">
          <li v-for="inscripcion in detalle.inscripciones" :key="inscripcion.id" class="rounded-xl bg-white/5 p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium text-white">{{ nombreCompleto(inscripcion.participante) }}</p>
                <p class="font-mono text-xs text-slate-400">{{ inscripcion.participante.tipoDocumento.toUpperCase() }} {{ inscripcion.participante.numeroDocumento }}</p>
                <p class="break-all text-xs text-slate-400">{{ inscripcion.participante.correo }}</p>
              </div>
              <AppBadge :estado="inscripcion.estado.codigo">{{ inscripcion.estado.nombre }}</AppBadge>
            </div>
            <div class="mt-3 flex items-center justify-between gap-2">
              <select v-if="puedeCambiarPlan(inscripcion)" :value="inscripcion.plan ?? ''" class="field-control min-w-0 flex-1 py-1 text-xs" :aria-label="`Plan de ${nombreCompleto(inscripcion.participante)}`" @change="cambiarPlan(inscripcion, $event)">
                <option v-if="!inscripcion.plan" value="" disabled>Sin plan</option>
                <option v-for="plan in planesDestino(inscripcion)" :key="plan" :value="plan">{{ ETIQUETA_PLAN[plan] }}</option>
              </select>
              <span v-else class="text-xs text-slate-300">{{ inscripcion.plan ? ETIQUETA_PLAN[inscripcion.plan] : '—' }}</span>
              <span class="shrink-0 text-sm font-semibold tabular-nums text-white">{{ soles(inscripcion.monto) }}</span>
              <AppButton v-if="puedeInscribir && inscripcion.estado.codigo !== 'APROBADO'" size="sm" variant="ghost" icon="heroicons:user-minus" :aria-label="`Quitar a ${nombreCompleto(inscripcion.participante)}`" @click="quitar(inscripcion.id, nombreCompleto(inscripcion.participante))" />
            </div>
          </li>
          <li v-if="!detalle.inscripciones.length" class="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-slate-400">Aún no hay integrantes registrados.</li>
        </ul>

        <details v-if="puedeInscribir" class="rounded-xl bg-white/5 p-4" :open="!detalle.inscripciones.length && activos.length > 0">
          <summary class="cursor-pointer text-sm font-semibold text-slate-200">Agregar integrantes</summary>
          <p v-if="!activos.length" class="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            La delegación aún no tiene planes activos: un Owner o Administrador debe configurar sus precios para poder inscribir integrantes.
          </p>
          <form v-else class="mt-4 space-y-3" @submit.prevent="agregarIntegrantes">
            <FilasIntegrantes v-model="filas" :planes="codigosActivos" :dominio="detalle.dominioCorreo" :errores="erroresIntegrantes" />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs text-slate-400">
                {{ nuevos.length }} por agregar · el precio de cada plan se recalcula para todo el grupo.
                <template v-if="estimadoNuevos"> Total estimado: <strong class="text-slate-200">{{ soles(estimadoNuevos.total) }}</strong>.</template>
              </p>
              <AppButton type="submit" icon="heroicons:user-plus" :loading="agregando">Registrar integrantes</AppButton>
            </div>
          </form>
        </details>
      </section>

      <!-- Planes y precios -->
      <details v-if="puedeGestionar" class="rounded-xl bg-white/5 p-4" :open="!activos.length">
        <summary class="cursor-pointer text-sm font-semibold text-slate-200">Planes y precios</summary>
        <form class="mt-4 space-y-4" @submit.prevent="guardarPlanes">
          <p class="text-sm text-slate-400">Cada integrante elige uno de los planes activos. Apagar un plan no toca a quienes ya lo tienen; cambiar un precio recalcula a todos los de ese plan.</p>
          <PlanesEditor v-model="edicionPlanes" v-model:min-integrantes="edicionMinimo" :errores="erroresPlanes" prefijo="det" />
          <AppButton type="submit" :loading="guardandoPlanes">Guardar planes</AppButton>
        </form>
      </details>

      <!-- Links y correo -->
      <details v-if="puedeGestionar" class="rounded-xl bg-white/5 p-4">
        <summary class="cursor-pointer text-sm font-semibold text-slate-200">Links y correo institucional</summary>
        <form class="mt-4 space-y-4" @submit.prevent="guardarLinks">
          <div class="grid gap-4 md:grid-cols-2">
            <AppField label="Dominio del correo" for="lk-dominio" :error="errorDominio" hint="Con unac.edu.pe, en los links solo se aceptan correos @unac.edu.pe (en el individual basta escribir lo de antes de la @). Vacío = cualquier correo. El staff puede inscribir otros.">
              <input id="lk-dominio" v-model="edicionDominio" class="field-control" maxlength="100" placeholder="unac.edu.pe" autocomplete="off">
            </AppField>
            <div class="self-start pt-6">
              <AppSwitch v-model="edicionIndividual" label="Cada integrante se inscribe con su link" descripcion="Apagado, solo el delegado (o el staff) inscribe a los integrantes." />
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <AppButton type="submit" :loading="guardandoLinks">Guardar</AppButton>
            <AppButton type="button" variant="secondary" icon="heroicons:arrow-path" @click="regenerar('delegado')">Regenerar link del delegado</AppButton>
            <AppButton v-if="detalle.inscripcionIndividual" type="button" variant="secondary" icon="heroicons:arrow-path" @click="regenerar('individual')">Regenerar link individual</AppButton>
          </div>
          <p v-if="enlaceIndividual" class="truncate font-mono text-xs text-slate-500" :title="enlaceIndividual">{{ enlaceIndividual }}</p>
        </form>
      </details>

      <!-- Datos -->
      <details v-if="puedeInscribir" class="rounded-xl bg-white/5 p-4">
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

  <VisorVoucher
    v-if="detalle"
    :abierto="viendoId !== null"
    :delegacion-id="detalle.id"
    :pagos="detalle.pagos"
    :pago-id="viendoId"
    :puede-validar="puedeValidar"
    @cerrar="viendoId = null"
    @cambiar="viendoId = $event"
    @verificar="marcarPago($event, 'VERIFICADO')"
    @rechazar="rechazando = $event"
  />

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
