<script setup lang="ts">
import type { CredencialCorreo, Evento, EstadoEvento, Respuesta } from '~/types/api'
import { slug } from '~/utils/formato'
import { mensajeError } from '~/utils/errores'
import {
  describirCredencialEvento,
  etiquetaUsarPredeterminada,
  opcionesCredencialEvento,
  type CredencialCorreoRef,
} from '~/utils/credencialesCorreo'

export interface EventoFormulario {
  codigo: string
  nombre: string
  nombreCorto: string
  descripcion: string
  sede: string
  fechaInicio: string
  fechaFin: string
  inscripcionesInicio: string
  inscripcionesFin: string
  inscripcionesAbiertas: boolean
  estado: EstadoEvento
  esPrincipal: boolean
  dominioInstitucional: string
  correoContacto: string
  telefonoContacto: string
  remitenteNombre: string
  asuntoAprobacion: string
  /** `null` = usar la credencial predeterminada. */
  credencialCorreoId: number | null
  copiarDeEventoId: string
}

const props = defineProps<{ evento?: Evento | null, eventosParaCopiar?: Evento[], enviando?: boolean, errores?: Record<string, string> }>()
const emit = defineEmits<{ guardar: [datos: Record<string, unknown>] }>()
const auth = useAuthStore()
const { api } = useApi()

/** `datetime-local` usa hora local del navegador (Lima para el equipo del congreso). */
function aLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const fecha = new Date(iso)
  const desfase = fecha.getTimezoneOffset() * 60000
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 16)
}

const form = reactive<EventoFormulario>({
  codigo: props.evento?.codigo ?? '',
  nombre: props.evento?.nombre ?? '',
  nombreCorto: props.evento?.nombreCorto ?? '',
  descripcion: props.evento?.descripcion ?? '',
  sede: props.evento?.sede ?? '',
  fechaInicio: props.evento?.fechaInicio ?? '',
  fechaFin: props.evento?.fechaFin ?? '',
  inscripcionesInicio: aLocal(props.evento?.inscripcionesInicio),
  inscripcionesFin: aLocal(props.evento?.inscripcionesFin),
  inscripcionesAbiertas: props.evento?.inscripcionesAbiertas ?? true,
  estado: props.evento?.estado ?? 'BORRADOR',
  esPrincipal: props.evento?.esPrincipal ?? false,
  dominioInstitucional: props.evento?.dominioInstitucional ?? 'undc.edu.pe',
  correoContacto: props.evento?.correoContacto ?? '',
  telefonoContacto: props.evento?.telefonoContacto ?? '',
  remitenteNombre: props.evento?.remitenteNombre ?? '',
  asuntoAprobacion: props.evento?.asuntoAprobacion ?? '',
  credencialCorreoId: props.evento?.credencialCorreoId ?? props.evento?.credencialCorreo?.id ?? null,
  copiarDeEventoId: '',
})

const esNuevo = computed(() => !props.evento)

// ─── Credencial de correo: solo el SuperAdmin puede listarlas y elegir ───
const credenciales = ref<CredencialCorreo[]>([])
const cargandoCredenciales = ref(false)
const errorCredenciales = ref<string | null>(null)
/** El SuperAdmin cambió el selector a mano (ya no se propone la del evento de origen). */
const credencialElegida = ref(false)

/** Evento del que se copia la configuración (solo en el alta). */
const origenCopia = computed(() => (esNuevo.value && form.copiarDeEventoId
  ? props.eventosParaCopiar?.find((origen) => String(origen.id) === form.copiarDeEventoId) ?? null
  : null))

/**
 * Credencial de referencia: la del evento al editar o la del evento de origen al copiar (el backend
 * la copia si no se envía otra). Se conserva en el selector aunque esté inactiva.
 */
const credencialReferencia = computed<CredencialCorreoRef | null>(() => {
  const fuente = esNuevo.value ? origenCopia.value : props.evento
  if (fuente?.credencialCorreo) return fuente.credencialCorreo
  return fuente?.credencialCorreoId ? { id: fuente.credencialCorreoId } : null
})
const opcionesCredencial = computed(() => opcionesCredencialEvento(credenciales.value, credencialReferencia.value))
const etiquetaPredeterminada = computed(() => etiquetaUsarPredeterminada(credenciales.value))
const pistaCredencial = computed(() => {
  const inicio = origenCopia.value && !credencialElegida.value
    ? `Se propone la misma que «${origenCopia.value.nombreCorto}».`
    : 'Cuenta de Brevo con la que se envían los correos del evento.'
  return `${inicio} «Usar la predeterminada» sigue a la que esté marcada como predeterminada; elegir una la fija para este evento.`
})

// Al copiar de otro evento se propone su credencial, igual que hace el backend
watch(origenCopia, (origen) => {
  if (!credencialElegida.value) form.credencialCorreoId = origen?.credencialCorreoId ?? null
})

/** Solo el SuperAdmin envía `credencialCorreoId`; si copia de un evento cuya credencial no se conoce, decide el backend. */
const enviarCredencial = computed(() => auth.esSuperAdmin
  && !(origenCopia.value && !credencialElegida.value && origenCopia.value.credencialCorreoId === undefined))

async function cargarCredenciales() {
  cargandoCredenciales.value = true
  errorCredenciales.value = null
  try {
    credenciales.value = (await api<Respuesta<CredencialCorreo[]>>('email-credentials')).data
  } catch (error) {
    errorCredenciales.value = `No se pudieron cargar las credenciales: ${mensajeError(error)}`
  } finally {
    cargandoCredenciales.value = false
  }
}
onMounted(() => {
  if (auth.esSuperAdmin) cargarCredenciales()
})

const codigoEditado = ref(false)
watch(() => form.nombreCorto, (valor) => {
  if (esNuevo.value && !codigoEditado.value) form.codigo = slug(valor)
})

const nulo = (valor: string) => (valor.trim() ? valor.trim() : null)

function enviar() {
  emit('guardar', {
    codigo: form.codigo.trim(),
    nombre: form.nombre.trim(),
    nombreCorto: form.nombreCorto.trim(),
    descripcion: nulo(form.descripcion),
    sede: nulo(form.sede),
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin,
    inscripcionesInicio: form.inscripcionesInicio ? new Date(form.inscripcionesInicio).toISOString() : null,
    inscripcionesFin: form.inscripcionesFin ? new Date(form.inscripcionesFin).toISOString() : null,
    inscripcionesAbiertas: form.inscripcionesAbiertas,
    estado: form.estado,
    esPrincipal: form.esPrincipal,
    dominioInstitucional: form.dominioInstitucional.trim().toLowerCase(),
    correoContacto: nulo(form.correoContacto),
    telefonoContacto: nulo(form.telefonoContacto),
    remitenteNombre: nulo(form.remitenteNombre),
    asuntoAprobacion: nulo(form.asuntoAprobacion),
    // El Admin no puede elegir credencial: no se envía y el backend conserva la actual (o copia la del origen)
    ...(enviarCredencial.value ? { credencialCorreoId: form.credencialCorreoId } : {}),
    ...(esNuevo.value && form.copiarDeEventoId ? { copiarDeEventoId: Number(form.copiarDeEventoId) } : {}),
  })
}

const e = (campo: string) => props.errores?.[campo] ?? null
</script>

<template>
  <form class="space-y-8" novalidate @submit.prevent="enviar">
    <section class="grid gap-5 md:grid-cols-2">
      <AppField label="Nombre completo" for="ev-nombre" required :error="e('nombre')" class="md:col-span-2">
        <input id="ev-nombre" v-model="form.nombre" class="field-control" maxlength="200" placeholder="IX Congreso Internacional de Ingeniería de Sistemas e Investigación Científica">
      </AppField>
      <AppField label="Nombre corto" for="ev-corto" required :error="e('nombreCorto')" hint="Se usa en correos, credenciales y en el selector del panel.">
        <input id="ev-corto" v-model="form.nombreCorto" class="field-control" maxlength="80" placeholder="IX CIISIC 2027">
      </AppField>
      <AppField label="Código (URL)" for="ev-codigo" required :error="e('codigo')" hint="Minúsculas, números y guiones. La landing lo usa para identificar el evento.">
        <input id="ev-codigo" v-model="form.codigo" class="field-control font-mono" maxlength="60" placeholder="ciisic-ix-2027" @input="codigoEditado = true">
      </AppField>
      <AppField label="Sede" for="ev-sede" :error="e('sede')">
        <input id="ev-sede" v-model="form.sede" class="field-control" maxlength="200">
      </AppField>
      <AppField label="Dominio institucional" for="ev-dominio" :error="e('dominioInstitucional')" hint="Correos de este dominio pueden acceder al precio institucional.">
        <input id="ev-dominio" v-model="form.dominioInstitucional" class="field-control" maxlength="100">
      </AppField>
      <AppField label="Descripción" for="ev-desc" :error="e('descripcion')" class="md:col-span-2">
        <textarea id="ev-desc" v-model="form.descripcion" rows="3" class="field-control" maxlength="5000" />
      </AppField>
    </section>

    <section class="grid gap-5 md:grid-cols-2">
      <h3 class="text-lg font-bold md:col-span-2">Fechas e inscripciones</h3>
      <AppField label="Fecha de inicio" for="ev-inicio" required :error="e('fechaInicio')">
        <input id="ev-inicio" v-model="form.fechaInicio" type="date" class="field-control">
      </AppField>
      <AppField label="Fecha de fin" for="ev-fin" required :error="e('fechaFin')">
        <input id="ev-fin" v-model="form.fechaFin" type="date" class="field-control">
      </AppField>
      <AppField label="Inscripciones desde" for="ev-ins-inicio" hint="Opcional (hora de Lima).">
        <input id="ev-ins-inicio" v-model="form.inscripcionesInicio" type="datetime-local" class="field-control">
      </AppField>
      <AppField label="Inscripciones hasta" for="ev-ins-fin" hint="Opcional (hora de Lima).">
        <input id="ev-ins-fin" v-model="form.inscripcionesFin" type="datetime-local" class="field-control">
      </AppField>
      <AppField label="Estado" for="ev-estado">
        <select id="ev-estado" v-model="form.estado" class="field-control">
          <option value="BORRADOR">Borrador (no visible en la landing)</option>
          <option value="PUBLICADO">Publicado</option>
          <option value="FINALIZADO">Finalizado</option>
          <option value="ARCHIVADO">Archivado</option>
        </select>
      </AppField>
      <div class="space-y-4 rounded-xl bg-white/5 p-4">
        <AppSwitch v-model="form.inscripcionesAbiertas" label="Inscripciones abiertas" descripcion="Interruptor manual; también se respeta la ventana de fechas." />
        <AppSwitch v-model="form.esPrincipal" label="Evento principal" descripcion="Evento por defecto de la landing anterior y del panel." />
      </div>
    </section>

    <section class="grid gap-5 md:grid-cols-2">
      <h3 class="text-lg font-bold md:col-span-2">Contacto y correos</h3>
      <AppField label="Correo de contacto" for="ev-correo" :error="e('correoContacto')">
        <input id="ev-correo" v-model="form.correoContacto" type="email" class="field-control" placeholder="congreso@undc.edu.pe">
      </AppField>
      <AppField label="Teléfono de contacto" for="ev-telefono" :error="e('telefonoContacto')">
        <input id="ev-telefono" v-model="form.telefonoContacto" class="field-control" maxlength="30" placeholder="+51 949 026 908">
      </AppField>
      <AppField label="Nombre del remitente" for="ev-remitente" hint="Nombre que verá el participante en el correo de aprobación.">
        <input id="ev-remitente" v-model="form.remitenteNombre" class="field-control" maxlength="120">
      </AppField>
      <AppField label="Asunto del correo de aprobación" for="ev-asunto">
        <input id="ev-asunto" v-model="form.asuntoAprobacion" class="field-control" maxlength="200" placeholder="Inscripción aprobada">
      </AppField>
      <div class="md:col-span-2">
        <AppField
          v-if="auth.esSuperAdmin"
          label="Credencial de correo"
          for="ev-credencial"
          :error="e('credencialCorreoId') ?? errorCredenciales"
          :hint="pistaCredencial"
        >
          <select
            id="ev-credencial"
            v-model="form.credencialCorreoId"
            class="field-control"
            :disabled="cargandoCredenciales"
            :aria-busy="cargandoCredenciales"
            @change="credencialElegida = true"
          >
            <option :value="null">{{ cargandoCredenciales ? 'Cargando credenciales…' : etiquetaPredeterminada }}</option>
            <option v-for="opcion in opcionesCredencial" :key="opcion.id" :value="opcion.id">{{ opcion.etiqueta }}</option>
          </select>
        </AppField>
        <AppField
          v-else
          label="Credencial de correo"
          for="ev-credencial"
          :hint="origenCopia ? 'Se copia del evento de origen. Solo un SuperAdmin puede cambiarla.' : 'Solo un SuperAdmin puede cambiarla.'"
        >
          <input id="ev-credencial" :value="describirCredencialEvento(credencialReferencia)" class="field-control cursor-default bg-white/5 text-slate-300" readonly>
        </AppField>
        <NuxtLink v-if="auth.esSuperAdmin" to="/correo" class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
          <Icon name="heroicons:paper-airplane" class="size-3.5" aria-hidden="true" /> Gestionar credenciales de correo
        </NuxtLink>
      </div>
    </section>

    <section v-if="esNuevo && eventosParaCopiar?.length" class="rounded-xl border border-brand-400/25 bg-brand-500/5 p-4">
      <AppField label="Copiar categorías y tipos de inscripción de" for="ev-copiar" hint="Útil para crear la siguiente edición con los mismos planes; luego puedes ajustar precios.">
        <select id="ev-copiar" v-model="form.copiarDeEventoId" class="field-control">
          <option value="">No copiar</option>
          <option v-for="origen in eventosParaCopiar" :key="origen.id" :value="String(origen.id)">{{ origen.nombreCorto }}</option>
        </select>
      </AppField>
    </section>

    <div class="flex justify-end gap-2">
      <slot name="acciones" />
      <AppButton type="submit" :loading="enviando" icon="heroicons:check">{{ esNuevo ? 'Crear evento' : 'Guardar cambios' }}</AppButton>
    </div>
  </form>
</template>
