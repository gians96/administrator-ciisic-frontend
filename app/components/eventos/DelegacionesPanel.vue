<script setup lang="ts">
import type { Categoria, Delegacion, DelegacionDetalle, Respuesta, TarifaDelegacionesAdmin } from '~/types/api'
import { mensajeError } from '~/utils/errores'
import { numero, soles } from '~/utils/formato'
import { esNoDisponible } from '~/utils/portal'
import {
  ETIQUETA_MODALIDAD, enlaceInscripcionDelegacion, tarifaDeAdmin, tarifaDeTipos, textoSaldo, type TarifaDelegaciones,
} from '~/utils/delegaciones'

const props = defineProps<{ eventoId: number }>()

const { api } = useApi()
const toast = useToast()
const { copiar } = useCopiar()

const delegaciones = ref<Delegacion[]>([])
const tarifa = ref<TarifaDelegaciones>(tarifaDeTipos([]))
/** La tarifa tal como la guarda el backend (spec 024); `null` con un backend anterior: la tarjeta es solo de lectura. */
const tarifaAdmin = ref<TarifaDelegacionesAdmin | null>(null)
const cargando = ref(false)

/** Con un backend sin la ruta (404 de ruta) la tarifa se arma con los tipos de la categoría, como antes. */
async function cargarTarifa() {
  try {
    const { data } = await api<Respuesta<TarifaDelegacionesAdmin>>(`events/${props.eventoId}/delegations/tarifa`)
    tarifaAdmin.value = data
    tarifa.value = tarifaDeAdmin(data)
  } catch (error) {
    if (!esNoDisponible(error)) throw error
    const categorias = await api<Respuesta<Categoria[]>>(`events/${props.eventoId}/registration-categories`)
    tarifaAdmin.value = null
    tarifa.value = tarifaDeTipos(categorias.data.find((categoria) => categoria.codigo === 'DELEGACIONES')?.tipos ?? [])
  }
}

async function cargar() {
  cargando.value = true
  try {
    const [lista] = await Promise.all([
      api<Respuesta<Delegacion[]>>(`events/${props.eventoId}/delegations`),
      cargarTarifa(),
    ])
    delegaciones.value = lista.data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}
watch(() => props.eventoId, cargar, { immediate: true })

// ─── Tarifa del evento ───
const tarifaAbierta = ref(false)

async function alGuardarTarifa() {
  tarifaAbierta.value = false
  await cargar()
}

// ─── Alta ───
const altaAbierta = ref(false)

async function alCrear(creada: DelegacionDetalle) {
  altaAbierta.value = false
  await cargar()
  detalleId.value = creada.id
  detalleAbierto.value = true
}

// ─── Detalle ───
const detalleAbierto = ref(false)
const detalleId = ref<number | null>(null)

function abrirDetalle(delegacion: Delegacion) {
  detalleId.value = delegacion.id
  detalleAbierto.value = true
}

// ─── Link del delegado ───
const copiadoId = ref<number | null>(null)
let temporizadorCopia: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(temporizadorCopia))

async function copiarLink(delegacion: Delegacion) {
  if (!(await copiar(enlaceInscripcionDelegacion(delegacion.codigoLink)))) {
    toast.error('No se pudo copiar el link. Revisa los permisos del portapapeles del navegador.')
    return
  }
  copiadoId.value = delegacion.id
  clearTimeout(temporizadorCopia)
  temporizadorCopia = setTimeout(() => { copiadoId.value = null }, 2000)
  toast.exito('Link copiado: envíaselo al delegado por correo.')
}

const totales = computed(() => ({
  grupos: delegaciones.value.length,
  integrantes: delegaciones.value.reduce((suma, d) => suma + d.totalIntegrantes, 0),
  total: delegaciones.value.reduce((suma, d) => suma + d.montoTotal, 0),
  saldo: delegaciones.value.reduce((suma, d) => suma + d.pago.saldo, 0),
}))
</script>

<template>
  <div class="space-y-6">
    <section class="card space-y-4 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="max-w-3xl text-sm text-slate-400">
          Un delegado inscribe a su grupo con su link (oculto en la landing) o tú lo registras aquí. La tarifa es por persona y sin kit; al cruzar el
          mínimo se recalcula para todo el grupo. Cada delegación conserva la tarifa con la que se creó.
        </p>
        <div class="flex shrink-0 flex-wrap gap-2">
          <AppButton v-if="tarifaAdmin" variant="secondary" icon="heroicons:pencil-square" @click="tarifaAbierta = true">Editar tarifa</AppButton>
          <AppButton icon="heroicons:plus" @click="altaAbierta = true">Nueva delegación</AppButton>
        </div>
      </div>
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-white/5 px-4 py-3">
          <dt class="text-xs uppercase tracking-wide text-slate-400">Presencial · menos de {{ numero(tarifa.minIntegrantes) }}</dt>
          <dd class="mt-0.5 text-xl font-bold tabular-nums">{{ soles(tarifa.precioEstandar) }}</dd>
        </div>
        <div class="rounded-xl bg-white/5 px-4 py-3">
          <dt class="text-xs uppercase tracking-wide text-slate-400">Presencial · {{ numero(tarifa.minIntegrantes) }} o más</dt>
          <dd class="mt-0.5 text-xl font-bold tabular-nums">{{ soles(tarifa.precioPromocional) }}</dd>
        </div>
        <div class="col-span-2 rounded-xl bg-white/5 px-4 py-3 sm:col-span-1">
          <dt class="text-xs uppercase tracking-wide text-slate-400">Virtual · todos</dt>
          <dd class="mt-0.5 text-xl font-bold tabular-nums">
            <template v-if="tarifa.virtual">{{ soles(tarifa.virtual.precio) }}</template>
            <span v-else class="text-base font-semibold text-slate-400">{{ tarifaAdmin?.virtual ? 'No se ofrece' : 'Sin tipo creado' }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <dl v-if="delegaciones.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Delegaciones</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ numero(totales.grupos) }}</dd></div>
      <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ numero(totales.integrantes) }}</dd></div>
      <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Total a pagar</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ soles(totales.total) }}</dd></div>
      <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Saldo</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ soles(totales.saldo) }}</dd></div>
    </dl>

    <div v-if="cargando && !delegaciones.length" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
    <AppEmpty v-else-if="!delegaciones.length" titulo="Sin delegaciones" descripcion="Crea una delegación para registrar a su delegado y a su grupo, y obtener el link que le enviarás." icon="heroicons:user-group">
      <AppButton icon="heroicons:plus" @click="altaAbierta = true">Crear la primera delegación</AppButton>
    </AppEmpty>

    <div v-else class="grid gap-4 xl:grid-cols-2">
      <article v-for="delegacion in delegaciones" :key="delegacion.id" class="card flex flex-col gap-4 p-5">
        <header class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-bold">{{ delegacion.nombre }}</h3>
            <p v-if="delegacion.institucion" class="truncate text-sm text-slate-400">{{ delegacion.institucion }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-1">
            <AppBadge :tono="delegacion.modalidad === 'VIRTUAL' ? 'info' : 'brand'">{{ ETIQUETA_MODALIDAD[delegacion.modalidad] }}</AppBadge>
            <AppBadge v-if="!delegacion.activo" tono="error">Inactiva</AppBadge>
          </div>
        </header>

        <p v-if="delegacion.representante.nombre" class="text-sm text-slate-400">
          Delegado: <span class="text-slate-200">{{ delegacion.representante.nombre }}</span>
          <span v-if="delegacion.representante.documento" class="font-mono text-xs"> · {{ delegacion.representante.documento }}</span>
        </p>

        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
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
          <div class="rounded-xl px-3 py-2" :class="delegacion.pago.saldo > 0.005 ? 'bg-amber-400/10' : 'bg-emerald-400/10'">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Saldo</dt>
            <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ soles(delegacion.pago.saldo) }}</dd>
          </div>
        </dl>
        <p class="text-xs text-slate-400">
          {{ delegacion.pago.cantidad }} voucher(s) · {{ textoSaldo(delegacion.pago.saldo) }}
          <template v-if="delegacion.faltanParaPromocional !== null"> · faltan {{ delegacion.faltanParaPromocional }} para la tarifa promocional</template>
        </p>

        <div class="mt-auto flex flex-wrap gap-2">
          <AppButton size="sm" icon="heroicons:user-group" @click="abrirDetalle(delegacion)">Gestionar</AppButton>
          <AppButton size="sm" variant="secondary" :icon="copiadoId === delegacion.id ? 'heroicons:check' : 'heroicons:link'" @click="copiarLink(delegacion)">
            {{ copiadoId === delegacion.id ? 'Copiado' : 'Copiar link' }}
          </AppButton>
        </div>
      </article>
    </div>

    <DelegacionAlta :abierto="altaAbierta" :evento-id="eventoId" :tarifa="tarifa" @cerrar="altaAbierta = false" @creada="alCrear" />
    <DelegacionDetalle :abierto="detalleAbierto" :delegacion-id="detalleId" :tarifa="tarifa" @cerrar="detalleAbierto = false" @cambio="cargar" />
    <TarifaDelegacionesForm v-if="tarifaAdmin" :abierto="tarifaAbierta" :evento-id="eventoId" :tarifa="tarifaAdmin" @cerrar="tarifaAbierta = false" @guardada="alGuardarTarifa" />
  </div>
</template>
