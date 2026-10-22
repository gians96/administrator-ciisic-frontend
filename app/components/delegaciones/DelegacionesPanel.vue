<script setup lang="ts">
import type { Delegacion, DelegacionDetalle, Respuesta } from '~/types/api'
import { mensajeError } from '~/utils/errores'
import { numero, soles } from '~/utils/formato'
import { enlaceInscripcionDelegacion, enlaceInscripcionIndividual, ETIQUETA_PLAN, planesActivos, resumenPlanes, textoSaldo } from '~/utils/delegaciones'

const props = defineProps<{ eventoId: number }>()

const { api } = useApi()
const toast = useToast()
const auth = useAuthStore()
const { copiar } = useCopiar()

/** Crear una delegación: Owner y Administrador (con planes) o la Comisión elegida (planes apagados hasta que se configuren). */
const puedeCrear = computed(() => auth.puede('delegaciones.gestionar') || auth.puede('delegaciones.inscribir'))

const delegaciones = ref<Delegacion[]>([])
const cargando = ref(false)

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

// ─── Links ───
const copiado = ref<string | null>(null)
let temporizadorCopia: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(temporizadorCopia))

async function copiarLink(clave: string, url: string, aviso: string) {
  if (!(await copiar(url))) {
    toast.error('No se pudo copiar el link. Revisa los permisos del portapapeles del navegador.')
    return
  }
  copiado.value = clave
  clearTimeout(temporizadorCopia)
  temporizadorCopia = setTimeout(() => { copiado.value = null }, 2000)
  toast.exito(aviso)
}

/** Los importes solo llegan con `pagos.ver`: sin ellos no se muestran los totales. */
const conDinero = computed(() => delegaciones.value.some((delegacion) => delegacion.pago !== null))

const totales = computed(() => ({
  grupos: delegaciones.value.length,
  integrantes: delegaciones.value.reduce((suma, d) => suma + d.totalIntegrantes, 0),
  total: delegaciones.value.reduce((suma, d) => suma + (d.montoTotal ?? 0), 0),
  saldo: delegaciones.value.reduce((suma, d) => suma + (d.pago?.saldo ?? 0), 0),
}))
</script>

<template>
  <div class="space-y-6">
    <section class="card space-y-4 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="max-w-3xl text-sm text-slate-400">
          Cada delegación tiene sus propios planes (Con kit, Sin kit y Virtual) con su precio por persona, y cada integrante elige el suyo. El delegado inscribe a su grupo con su link,
          los integrantes pueden inscribirse solos con el link individual (si lo activas), o los registra el staff aquí. El Tesorero valida los pagos.
        </p>
        <AppButton v-if="puedeCrear" icon="heroicons:plus" class="shrink-0" @click="altaAbierta = true">Nueva delegación</AppButton>
      </div>
    </section>

    <dl v-if="delegaciones.length" class="grid grid-cols-2 gap-3" :class="conDinero ? 'sm:grid-cols-4' : 'sm:grid-cols-2'">
      <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Delegaciones</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ numero(totales.grupos) }}</dd></div>
      <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ numero(totales.integrantes) }}</dd></div>
      <template v-if="conDinero">
        <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Total a pagar</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ soles(totales.total) }}</dd></div>
        <div class="rounded-xl bg-white/5 px-4 py-3"><dt class="text-xs uppercase tracking-wide text-slate-400">Saldo</dt><dd class="mt-0.5 text-xl font-bold tabular-nums">{{ soles(totales.saldo) }}</dd></div>
      </template>
    </dl>

    <div v-if="cargando && !delegaciones.length" class="py-10 text-center text-sm text-slate-400">Cargando…</div>
    <AppEmpty v-else-if="!delegaciones.length" titulo="Sin delegaciones" descripcion="Crea una delegación para registrar a su delegado y definir sus planes; obtendrás el link que le enviarás." icon="heroicons:user-group">
      <AppButton v-if="puedeCrear" icon="heroicons:plus" @click="altaAbierta = true">Crear la primera delegación</AppButton>
    </AppEmpty>

    <div v-else class="grid gap-4 xl:grid-cols-2">
      <article v-for="delegacion in delegaciones" :key="delegacion.id" class="card flex flex-col gap-4 p-5">
        <header class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-bold">{{ delegacion.nombre }}</h3>
            <p v-if="delegacion.institucion" class="truncate text-sm text-slate-400">{{ delegacion.institucion }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-1">
            <AppBadge v-for="plan in planesActivos(delegacion.planes)" :key="plan.codigo" :tono="plan.modalidad === 'VIRTUAL' ? 'info' : 'brand'">{{ ETIQUETA_PLAN[plan.codigo] }}</AppBadge>
            <AppBadge v-if="!planesActivos(delegacion.planes).length" tono="warn">Sin planes</AppBadge>
            <AppBadge v-if="delegacion.dominioCorreo" tono="neutral">@{{ delegacion.dominioCorreo }}</AppBadge>
            <AppBadge v-if="!delegacion.activo" tono="error">Inactiva</AppBadge>
          </div>
        </header>

        <p v-if="delegacion.representante.nombre" class="text-sm text-slate-400">
          Delegado: <span class="text-slate-200">{{ delegacion.representante.nombre }}</span>
          <span v-if="delegacion.representante.documento" class="font-mono text-xs"> · {{ delegacion.representante.documento }}</span>
        </p>
        <p v-if="resumenPlanes(delegacion.planes)" class="text-sm text-slate-300">{{ resumenPlanes(delegacion.planes) }}</p>

        <dl class="grid grid-cols-2 gap-3 text-sm" :class="delegacion.pago ? 'sm:grid-cols-3' : 'sm:grid-cols-1'">
          <div class="rounded-xl bg-white/5 px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-slate-400">Integrantes</dt>
            <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ numero(delegacion.totalIntegrantes) }}</dd>
          </div>
          <template v-if="delegacion.pago">
            <div class="rounded-xl bg-white/5 px-3 py-2">
              <dt class="text-xs uppercase tracking-wide text-slate-400">Total</dt>
              <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ soles(delegacion.montoTotal) }}</dd>
            </div>
            <div class="rounded-xl px-3 py-2" :class="delegacion.pago.saldo > 0.005 ? 'bg-amber-400/10' : 'bg-emerald-400/10'">
              <dt class="text-xs uppercase tracking-wide text-slate-400">Saldo</dt>
              <dd class="mt-0.5 text-lg font-bold tabular-nums">{{ soles(delegacion.pago.saldo) }}</dd>
            </div>
          </template>
        </dl>
        <p class="text-xs text-slate-400">
          <template v-if="delegacion.pago">{{ delegacion.pago.cantidad }} voucher(s) · {{ textoSaldo(delegacion.pago.saldo) }}</template>
          <template v-if="delegacion.faltanParaPromocional !== null"> · faltan {{ delegacion.faltanParaPromocional }} para el precio promocional</template>
        </p>

        <div class="mt-auto flex flex-wrap gap-2">
          <AppButton size="sm" icon="heroicons:user-group" @click="abrirDetalle(delegacion)">Gestionar</AppButton>
          <AppButton
            v-if="delegacion.codigoLink"
            size="sm"
            variant="secondary"
            :icon="copiado === `d${delegacion.id}` ? 'heroicons:check' : 'heroicons:link'"
            @click="copiarLink(`d${delegacion.id}`, enlaceInscripcionDelegacion(delegacion.codigoLink), 'Link copiado: envíaselo al delegado.')"
          >
            {{ copiado === `d${delegacion.id}` ? 'Copiado' : 'Link del delegado' }}
          </AppButton>
          <AppButton
            v-if="delegacion.codigoInscripcion"
            size="sm"
            variant="secondary"
            :icon="copiado === `i${delegacion.id}` ? 'heroicons:check' : 'heroicons:user-plus'"
            @click="copiarLink(`i${delegacion.id}`, enlaceInscripcionIndividual(delegacion.codigoInscripcion), 'Link individual copiado: compártelo con los integrantes.')"
          >
            {{ copiado === `i${delegacion.id}` ? 'Copiado' : 'Link individual' }}
          </AppButton>
        </div>
      </article>
    </div>

    <DelegacionAlta :abierto="altaAbierta" :evento-id="eventoId" @cerrar="altaAbierta = false" @creada="alCrear" />
    <DelegacionDetalle :abierto="detalleAbierto" :delegacion-id="detalleId" @cerrar="detalleAbierto = false" @cambio="cargar" />
  </div>
</template>
