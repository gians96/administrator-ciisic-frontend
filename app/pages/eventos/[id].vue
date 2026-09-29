<script setup lang="ts">
import type { DatosPago, Evento, Respuesta } from '~/types/api'
import { aErrorApi, mensajeError } from '~/utils/errores'

const route = useRoute()
const router = useRouter()
const { api } = useApi()
const auth = useAuthStore()
const store = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()

const id = computed(() => Number(route.params.id))
const evento = ref<Evento | null>(null)
const enviando = ref(false)
const errores = ref<Record<string, string>>({})

const TABS = computed(() => [
  { id: 'general', label: 'General', icon: 'heroicons:cog-6-tooth' },
  { id: 'pago', label: 'Datos de pago', icon: 'heroicons:banknotes' },
  { id: 'tipos', label: 'Categorías y tipos', icon: 'heroicons:tag' },
  { id: 'actividades', label: 'Actividades', icon: 'heroicons:calendar' },
  { id: 'integraciones', label: 'Integraciones', icon: 'heroicons:link' },
  // Tokens para que la landing del evento consuma el backend: solo SuperAdmin
  ...(auth.esSuperAdmin ? [{ id: 'acceso', label: 'Acceso', icon: 'heroicons:key' }] : []),
])
const tab = ref(TABS.value.some((t) => t.id === route.query.tab) ? String(route.query.tab) : 'general')
// Pestaña inexistente o no permitida (p. ej. `?tab=acceso` para un Admin): se corrige la URL
if (route.query.tab && route.query.tab !== tab.value) router.replace({ query: { tab: tab.value } })
watch(tab, (valor) => router.replace({ query: { tab: valor } }))

useHead(() => ({ title: `${evento.value?.nombreCorto ?? 'Evento'} · Panel CIISIC` }))

async function cargar() {
  try {
    evento.value = (await api<Respuesta<Evento>>(`events/${id.value}`)).data
  } catch (error) {
    toast.error(mensajeError(error))
    await navigateTo('/eventos')
  }
}
onMounted(cargar)

async function guardar(datos: Record<string, unknown>) {
  enviando.value = true
  errores.value = {}
  try {
    evento.value = (await api<Respuesta<Evento>>(`events/${id.value}`, { method: 'PUT', body: datos })).data
    toast.exito('Cambios guardados.')
    await store.cargar(true)
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    enviando.value = false
  }
}

async function guardarPago(datosPago: DatosPago) {
  await guardar({ datosPago })
}

async function eliminar() {
  if (!evento.value) return
  const ok = await confirmar({
    titulo: 'Eliminar evento',
    mensaje: `¿Eliminar «${evento.value.nombreCorto}»? Solo es posible si no tiene inscripciones, ponencias ni asistencias. Si ya se usó, cámbialo a «Archivado».`,
    textoConfirmar: 'Eliminar evento',
    peligro: true,
  })
  if (!ok) return
  try {
    await api(`events/${id.value}`, { method: 'DELETE' })
    toast.exito('Evento eliminado.')
    await store.cargar(true)
    await navigateTo('/eventos')
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink to="/eventos" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <Icon name="heroicons:arrow-left" class="size-4" aria-hidden="true" /> Eventos
      </NuxtLink>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-extrabold">{{ evento?.nombreCorto ?? 'Evento' }}</h1>
        <AppBadge v-if="evento?.esPrincipal" tono="warn"><Icon name="heroicons:star-solid" class="size-3.5" aria-hidden="true" /> Principal</AppBadge>
      </div>
      <p v-if="evento" class="mt-1 font-mono text-xs text-slate-500">{{ evento.codigo }}</p>
    </div>

    <AppTabs v-model="tab" :tabs="TABS" />

    <div v-if="!evento" class="py-16 text-center text-sm text-slate-400">Cargando…</div>
    <template v-else>
      <section v-if="tab === 'general'" class="card p-6">
        <EventoForm :key="evento.actualizadoEn" :evento="evento" :enviando="enviando" :errores="errores" @guardar="guardar">
          <template #acciones>
            <AppButton variant="danger" icon="heroicons:trash" @click="eliminar">Eliminar</AppButton>
          </template>
        </EventoForm>
      </section>
      <section v-else-if="tab === 'pago'" class="card p-6">
        <DatosPagoForm :key="evento.actualizadoEn" :datos="evento.datosPago" :enviando="enviando" @guardar="guardarPago" />
      </section>
      <CategoriasTipos v-else-if="tab === 'tipos'" :evento-id="evento.id" />
      <ActividadesPanel v-else-if="tab === 'actividades'" :evento-id="evento.id" />
      <IntegracionesPanel v-else-if="tab === 'integraciones'" :evento-id="evento.id" />
      <TokensAccesoPanel v-else-if="tab === 'acceso' && auth.esSuperAdmin" :evento-id="evento.id" />
    </template>
  </div>
</template>
