<script setup lang="ts">
import type { Meta, ParticipanteRef, Respuesta } from '~/types/api'
import { fechaHoraLima, nombreCompleto } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import { AVISO_CAMBIO_CORREO_GOOGLE, mensajeDesvincularGoogle, tituloVinculoGoogle } from '~/utils/cuentaGoogle'
import { avisoCambioCorreo, cambiaCorreo, camposErrorEdicion, type InscripcionDeParticipante } from '~/utils/participantes'

definePageMeta({ permiso: 'participantes.gestionar' })
useHead({ title: 'Participantes · Panel CIISIC' })

interface ParticipanteDetalle extends ParticipanteRef {
  inscripciones: InscripcionDeParticipante[]
}

const { api } = useApi()
const auth = useAuthStore()
const toast = useToast()
const { confirmar } = useConfirm()
const participantes = ref<ParticipanteRef[]>([])
const meta = ref<Meta | null>(null)
const busqueda = ref('')
const detalle = ref<ParticipanteDetalle | null>(null)
const guardando = ref(false)
const desvinculando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive({ nombres: '', apellidos: '', correo: '', celular: '' })

const puedeRegistrar = computed(() => auth.puede('participantes.gestionar'))
const puedeCortesia = computed(() => auth.puede('inscripciones.cortesia'))
const nuevoAbierto = ref(false)
/** Persona a inscribir como cortesía (`null`: modal cerrado). */
const paraCortesia = ref<ParticipanteRef | null>(null)

/** El correo escrito es otro: el backend avisará al anterior al guardar. */
const correoCambiado = computed(() => detalle.value !== null && cambiaCorreo(detalle.value.correo, form.correo))

async function cargar(pagina = 1) {
  try {
    const r = await api<Respuesta<ParticipanteRef[]>>('participants', { query: { page: pagina, ...(busqueda.value.trim() ? { q: busqueda.value.trim() } : {}) } })
    participantes.value = r.data
    meta.value = r.meta ?? null
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
onMounted(() => cargar())

let temporizador: ReturnType<typeof setTimeout> | undefined
watch(busqueda, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => cargar(), 350)
})

async function abrir(id: number) {
  try {
    detalle.value = (await api<Respuesta<ParticipanteDetalle>>(`participants/${id}`)).data
    Object.assign(form, { nombres: detalle.value.nombres, apellidos: detalle.value.apellidos, correo: detalle.value.correo, celular: detalle.value.celular })
    errores.value = {}
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function guardar() {
  if (!detalle.value) return
  guardando.value = true
  try {
    await api(`participants/${detalle.value.id}`, { method: 'PUT', body: { ...form } })
    toast.exito('Datos actualizados. Las credenciales nuevas usarán estos datos.')
    detalle.value = null
    await cargar(meta.value?.page ?? 1)
  } catch (error) {
    errores.value = camposErrorEdicion(error)
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function desvincularGoogle() {
  const participante = detalle.value
  if (!participante) return
  const ok = await confirmar({ titulo: 'Desvincular Google', mensaje: mensajeDesvincularGoogle(participante, 'PARTICIPANTE'), textoConfirmar: 'Desvincular' })
  if (!ok) return
  desvinculando.value = true
  try {
    const r = await api<Respuesta<ParticipanteRef>>(`participants/${participante.id}`, { method: 'PUT', body: { desvincularGoogle: true } })
    // Solo cambia el vínculo: lo que se esté editando en el formulario sigue sin guardar
    if (detalle.value?.id === participante.id) detalle.value = { ...detalle.value, googleVinculado: r.data.googleVinculado ?? false, googleVinculadoEn: r.data.googleVinculadoEn ?? null }
    toast.exito('Google desvinculado.')
    await cargar(meta.value?.page ?? 1)
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    desvinculando.value = false
  }
}

// ─── Alta de participantes ───

/** Muestra a la persona recién registrada en la lista (buscándola por su documento). */
function alRegistrar(participante: ParticipanteRef) {
  nuevoAbierto.value = false
  toast.exito(`Se registró a ${nombreCompleto(participante)}.${puedeCortesia.value ? ' Puedes darle una inscripción de cortesía desde la lista.' : ''}`)
  if (busqueda.value === participante.numeroDocumento) cargar()
  else busqueda.value = participante.numeroDocumento
}

function abrirExistente(id: number) {
  nuevoAbierto.value = false
  abrir(id)
}

// ─── Inscripción de cortesía ───

/** Tras la cortesía, el detalle abierto de esa persona muestra la inscripción nueva (sin tocar lo que se edita). */
async function alInscribir(participanteId: number) {
  paraCortesia.value = null
  if (detalle.value?.id !== participanteId) return
  try {
    const { inscripciones } = (await api<Respuesta<ParticipanteDetalle>>(`participants/${participanteId}`)).data
    if (detalle.value?.id === participanteId) detalle.value = { ...detalle.value, inscripciones }
  } catch {
    // Se verá al volver a abrir el detalle
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Participantes</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Personas registradas en cualquier evento. Aquí puedes corregir nombres, correo o celular<template v-if="puedeRegistrar">, registrar a quien no se inscribió (ponentes, organizadores)</template><template v-if="puedeCortesia"> y darle una inscripción de cortesía</template>.
        </p>
      </div>
      <AppButton v-if="puedeRegistrar" icon="heroicons:user-plus" @click="nuevoAbierto = true">Nuevo participante</AppButton>
    </div>
    <div class="relative max-w-md">
      <label for="p-buscar" class="sr-only">Buscar</label>
      <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <input id="p-buscar" v-model="busqueda" type="search" class="field-control pl-9" placeholder="Documento, nombres o correo">
    </div>
    <section class="card overflow-hidden">
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Participante</th><th>Documento</th><th>Contacto</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="p in participantes" :key="p.id">
              <td class="font-medium text-white">{{ nombreCompleto(p) }}</td>
              <td class="font-mono text-sm">{{ p.tipoDocumento.toUpperCase() }} {{ p.numeroDocumento }}</td>
              <td class="text-sm">
                {{ p.correo }}
                <AppBadge v-if="p.googleVinculado" tono="ok" class="ml-1" :title="tituloVinculoGoogle(p) ?? undefined">
                  <Icon name="heroicons:link" class="size-3.5" aria-hidden="true" /> Google vinculado
                </AppBadge>
                <p class="text-xs text-slate-500">{{ p.celular || 'Sin celular' }}</p>
              </td>
              <td class="text-right whitespace-nowrap">
                <AppButton
                  v-if="puedeCortesia"
                  size="sm"
                  variant="ghost"
                  icon="heroicons:gift"
                  :aria-label="`Inscribir a ${nombreCompleto(p)} como cortesía`"
                  title="Inscribir como cortesía"
                  @click="paraCortesia = p"
                >
                  Cortesía
                </AppButton>
                <AppButton size="sm" variant="secondary" icon="heroicons:pencil-square" @click="abrir(p.id)">Ver / editar</AppButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppEmpty v-if="!participantes.length" titulo="Sin resultados" icon="heroicons:users" />
      <AppPagination :meta="meta" @cambiar="cargar" />
    </section>

    <AppModal :abierto="detalle !== null" :titulo="detalle ? nombreCompleto(detalle) : ''" :descripcion="detalle ? `${detalle.tipoDocumento.toUpperCase()} ${detalle.numeroDocumento}` : undefined" @cerrar="detalle = null">
      <form id="form-participante" class="grid gap-4 sm:grid-cols-2" @submit.prevent="guardar">
        <AppField label="Nombres" for="pa-nombres" :error="errores.nombres"><input id="pa-nombres" v-model="form.nombres" class="field-control"></AppField>
        <AppField label="Apellidos" for="pa-apellidos" :error="errores.apellidos"><input id="pa-apellidos" v-model="form.apellidos" class="field-control"></AppField>
        <AppField label="Correo" for="pa-correo" :error="errores.correo" :hint="!correoCambiado && detalle?.googleVinculado ? AVISO_CAMBIO_CORREO_GOOGLE : undefined">
          <input id="pa-correo" v-model="form.correo" type="email" class="field-control" :aria-describedby="correoCambiado ? 'pa-correo-aviso' : undefined">
          <!-- Región viva siempre presente (vacía no ocupa espacio) para que se anuncie el aviso -->
          <p
            id="pa-correo-aviso"
            class="text-xs text-amber-200"
            :class="correoCambiado ? 'mt-2 flex gap-1.5 rounded-lg bg-amber-400/10 px-3 py-2 ring-1 ring-amber-400/30 ring-inset' : ''"
            role="status"
          >
            <template v-if="correoCambiado && detalle">
              <Icon name="heroicons:envelope" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>{{ avisoCambioCorreo(detalle.correo, detalle.googleVinculado) }}</span>
            </template>
          </p>
        </AppField>
        <AppField label="Celular" for="pa-celular" :error="errores.celular"><input id="pa-celular" v-model="form.celular" class="field-control"></AppField>
        <div v-if="detalle?.googleVinculado" class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 sm:col-span-2">
          <div class="text-sm">
            <p class="font-medium text-white">Google vinculado</p>
            <p class="text-xs text-slate-400">{{ tituloVinculoGoogle(detalle) }}. Con esa cuenta entra a «Mis inscripciones».</p>
          </div>
          <AppButton size="sm" variant="secondary" icon="heroicons:link-slash" :loading="desvinculando" @click="desvincularGoogle">Desvincular Google</AppButton>
        </div>
      </form>
      <div v-if="detalle?.inscripciones.length" class="mt-6">
        <p class="kicker">Inscripciones</p>
        <ul class="mt-2 space-y-2">
          <li v-for="i in detalle.inscripciones" :key="i.id" class="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2 text-sm">
            <span>{{ i.evento.nombreCorto }} · {{ i.tipoInscripcion ?? '—' }}<span class="block text-xs whitespace-nowrap text-slate-500">{{ fechaHoraLima(i.creadoEn) }}</span></span>
            <AppBadge :estado="i.estado.codigo as 'PENDIENTE'">{{ i.estado.nombre }}</AppBadge>
          </li>
        </ul>
      </div>
      <template #acciones>
        <AppButton v-if="puedeCortesia && detalle" variant="ghost" icon="heroicons:gift" class="sm:mr-auto" @click="paraCortesia = detalle">Inscribir como cortesía</AppButton>
        <AppButton variant="secondary" @click="detalle = null">Cerrar</AppButton>
        <AppButton type="submit" form="form-participante" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>

    <NuevoParticipante :abierto="nuevoAbierto" @cerrar="nuevoAbierto = false" @creado="alRegistrar" @abrir-existente="abrirExistente" />
    <CortesiaParticipante :participante="paraCortesia" @cerrar="paraCortesia = null" @inscrito="alInscribir" />
  </div>
</template>
