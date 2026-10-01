<script setup lang="ts">
import type { Administrador, AlcanceRol, Respuesta, RolAsignable } from '~/types/api'
import { fechaHoraLima, nombreCompleto } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { AVISO_CAMBIO_CORREO_GOOGLE, mensajeDesvincularGoogle, tituloVinculoGoogle } from '~/utils/cuentaGoogle'
import {
  accesoDe,
  chipsPermisos,
  contrasenaObligatoria,
  cuerpoAdmin,
  descripcionRol,
  ETIQUETAS_CAMPOS_ADMIN,
  etiquetaAcceso,
  formularioDe,
  MIN_CONTRASENA,
  motivoGoogleBloqueado,
  nombrePermiso,
  OPCIONES_ACCESO,
  opcionesEventos,
  permisosIniciales,
  promueveAGlobal,
  puedeEditarCorreo,
  reaccionAlError,
  type FormAdmin,
} from '~/utils/administradores'
import { etiquetaRol, tonoRol } from '~/utils/permisos'

definePageMeta({ permiso: 'administradores.gestionar' })
useHead({ title: 'Equipo y administradores · Panel CIISIC' })

const { api } = useApi()
const auth = useAuthStore()
const eventoStore = useEventoStore()
const toast = useToast()
const { confirmar } = useConfirm()

const admins = ref<Administrador[]>([])
/** Roles que la cuenta puede asignar (`GET /roles`). */
const roles = ref<RolAsignable[]>([])
const rolesCargados = ref(false)
const errorRoles = ref(false)
const modal = ref(false)
const editando = ref<Administrador | null>(null)
const guardando = ref(false)
const desvinculando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive<FormAdmin>(formularioDe())

const esPropia = (admin: Pick<Administrador, 'id'> | null | undefined) => Boolean(admin) && admin?.id === auth.usuario?.id
const propia = computed(() => esPropia(editando.value))
/** Solo el Owner (`sistema.configurar`) cambia el correo y el vínculo con Google de su propia cuenta. */
const correoEditable = computed(() => puedeEditarCorreo(propia.value, auth.puede))

const opcionesRol = computed(() => {
  const opciones = roles.value.map((rol) => ({ codigo: rol.codigo, etiqueta: etiquetaRol(rol.codigo, rol.nombre) }))
  const actual = editando.value
  // El rol actual siempre aparece (p. ej. el tuyo, que no puedes asignar)
  if (actual && !opciones.some((opcion) => opcion.codigo === actual.rolCodigo)) {
    opciones.unshift({ codigo: actual.rolCodigo, etiqueta: etiquetaRol(actual.rolCodigo, actual.rolNombre) })
  }
  return opciones
})
const rolElegido = computed(() => roles.value.find((rol) => rol.codigo === form.rolCodigo) ?? null)
const alcanceRol = computed<AlcanceRol | null>(() => rolElegido.value?.alcance
  ?? (editando.value && form.rolCodigo === editando.value.rolCodigo ? editando.value.alcance ?? null : null))
const elegibles = computed(() => rolElegido.value?.permisosElegibles ?? null)
/** Permisos fijos de un rol por evento sin permisos elegibles (Tesorero). */
const permisosDelRol = computed(() => (alcanceRol.value === 'EVENTO' && rolElegido.value && !rolElegido.value.permisosElegibles
  ? rolElegido.value.permisos.map((permiso) => nombrePermiso(permiso))
  : []))
const opcionesEvento = computed(() => opcionesEventos(eventoStore.eventos, editando.value?.eventos))
const promueve = computed(() => !propia.value && promueveAGlobal(editando.value, alcanceRol.value))

const tieneContrasena = computed(() => accesoDe(editando.value) === 'CONTRASENA')
// Tu propia contraseña solo se quita si ya entraste con Google y sin cambiar el correo: si no, quedarías sin acceso
const motivoGoogle = computed(() => motivoGoogleBloqueado(form, editando.value, propia.value))
const googleBloqueado = computed(() => Boolean(motivoGoogle.value))
const quitaContrasena = computed(() => form.acceso === 'GOOGLE' && tieneContrasena.value && !promueve.value)

const ayudaEventos = computed(() => {
  if (propia.value) return 'No puedes cambiar los eventos de tu propia cuenta.'
  if (editando.value && !editando.value.eventos?.length && !form.eventoIds.length) return 'Esta cuenta no tiene eventos asignados: elige al menos uno para que pueda trabajar.'
  return 'Solo verá y operará estos eventos.'
})
const ayudaPermisos = computed(() => (propia.value
  ? 'No puedes cambiar tus propios permisos.'
  : 'Marcar un permiso agrega los que incluye. «Datos personales»: deja ver nombre, documento, correo y celular de los inscritos.'))

const textoPropia = computed(() => (correoEditable.value
  ? 'Es tu cuenta: puedes cambiar tu nombre, tu correo, tu acceso y tu vínculo con Google, pero no tu rol, tu estado, tus eventos ni tus permisos.'
  : 'Es tu cuenta: puedes cambiar tu nombre y tu acceso (contraseña o Google), pero no tu correo, tu rol, tu estado, tus eventos ni tus permisos.'))

/** Filas de la tabla. «Sin permisos» solo en los roles que se configuran por cuenta (la Comisión). */
const filas = computed(() => admins.value.map((admin) => ({
  admin,
  chips: chipsPermisos(admin.permisos ?? []),
  sinPermisos: !admin.permisos?.length && Boolean(roles.value.find((rol) => rol.codigo === admin.rolCodigo)?.permisosElegibles),
})))

async function cargar() {
  try {
    admins.value = (await api<Respuesta<Administrador[]>>('admin')).data
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function cargarRoles() {
  try {
    roles.value = (await api<Respuesta<RolAsignable[]>>('roles')).data
    rolesCargados.value = true
    errorRoles.value = false
  } catch {
    errorRoles.value = true
  }
}

onMounted(() => {
  cargar()
  cargarRoles()
  eventoStore.cargar().catch(() => undefined)
})

function abrir(admin?: Administrador) {
  editando.value = admin ?? null
  errores.value = {}
  Object.assign(form, formularioDe(admin))
  modal.value = true
  if (!rolesCargados.value) cargarRoles()
  eventoStore.cargar().catch(() => undefined)
}

/** Al elegir la Comisión sin permisos marcados, se preseleccionan los por defecto del rol. */
function alCambiarRol() {
  const rol = rolElegido.value
  if (rol?.permisosElegibles && !form.permisos.length) form.permisos = permisosIniciales(rol)
}

async function reaccionar(error: unknown) {
  const reaccion = reaccionAlError(aErrorApi(error).code)
  if (reaccion === 'cuentas') {
    modal.value = false
    await cargar()
  } else if (reaccion === 'roles') {
    await cargarRoles()
  } else if (reaccion === 'eventos') {
    await eventoStore.recargar().catch(() => undefined)
  }
}

async function guardar() {
  const { body, errores: locales } = cuerpoAdmin(form, editando.value, {
    propia: propia.value,
    alcanceRol: alcanceRol.value,
    permisosElegibles: elegibles.value,
    correoEditable: correoEditable.value,
  })
  errores.value = locales
  if (Object.keys(locales).length) return
  guardando.value = true
  try {
    if (editando.value) await api(`admin/${editando.value.id}`, { method: 'PUT', body })
    else await api('admin', { method: 'POST', body })
    toast.exito(editando.value ? 'Cuenta actualizada.' : 'Cuenta creada.')
    modal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error, ETIQUETAS_CAMPOS_ADMIN))
    await reaccionar(error)
  } finally {
    guardando.value = false
  }
}

async function desvincularGoogle(admin: Administrador) {
  const aviso = esPropia(admin) ? ' Se cerrará tu sesión y tendrás que volver a ingresar.' : ''
  const ok = await confirmar({ titulo: 'Desvincular Google', mensaje: `${mensajeDesvincularGoogle(admin, 'ADMIN')}${aviso}`, textoConfirmar: 'Desvincular' })
  if (!ok) return
  desvinculando.value = true
  try {
    const r = await api<Respuesta<Administrador>>(`admin/${admin.id}`, { method: 'PUT', body: { desvincularGoogle: true } })
    // Solo cambia el vínculo: lo que se esté editando en el formulario sigue sin guardar
    if (editando.value?.id === admin.id) editando.value = r.data
    toast.exito('Google desvinculado.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
    await reaccionar(error)
  } finally {
    desvinculando.value = false
  }
}

async function eliminar(admin: Administrador) {
  const ok = await confirmar({
    titulo: 'Eliminar cuenta',
    mensaje: `¿Eliminar la cuenta de ${nombreCompleto(admin)}? Si revisó inscripciones o registró o anuló asistencias, solo se desactivará para conservar el historial.`,
    textoConfirmar: 'Eliminar',
    peligro: true,
  })
  if (!ok) return
  try {
    const r = await api<Respuesta<{ desactivado: boolean }>>(`admin/${admin.id}`, { method: 'DELETE' })
    toast.exito(r.data.desactivado ? 'Cuenta desactivada (tiene revisiones o asistencias registradas).' : 'Cuenta eliminada.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
    await reaccionar(error)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Equipo y administradores</h1>
        <p class="mt-1 text-sm text-slate-400">
          Cuentas con acceso al panel. Owner y Administrador del sistema trabajan con todos los eventos; Tesorero y Comisión, solo con los asignados.
        </p>
      </div>
      <AppButton icon="heroicons:user-plus" @click="abrir()">Nueva cuenta</AppButton>
    </div>
    <section class="card overflow-hidden">
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th>Nombre</th><th>Correo</th><th>Rol</th><th>Alcance</th><th>Permisos</th><th>Acceso</th><th>Estado</th><th>Creado</th>
              <th><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="{ admin, chips, sinPermisos } in filas" :key="admin.id">
              <td class="font-medium text-white">{{ nombreCompleto(admin) }} <AppBadge v-if="esPropia(admin)" tono="brand" class="ml-1">Tú</AppBadge></td>
              <td class="text-sm">
                {{ admin.correo }}
                <AppBadge v-if="admin.googleVinculado" tono="ok" class="ml-1" :title="tituloVinculoGoogle(admin) ?? undefined">
                  <Icon name="heroicons:link" class="size-3.5" aria-hidden="true" /> Google vinculado
                </AppBadge>
              </td>
              <td class="whitespace-nowrap"><AppBadge :tono="tonoRol(admin.rolCodigo)">{{ etiquetaRol(admin.rolCodigo, admin.rolNombre) }}</AppBadge></td>
              <td>
                <AppBadge v-if="admin.alcance === 'GLOBAL'">
                  <Icon name="heroicons:globe-alt" class="size-3.5" aria-hidden="true" /> Global
                </AppBadge>
                <div v-else-if="admin.alcance === 'EVENTO'" class="flex max-w-56 flex-wrap gap-1">
                  <AppBadge v-for="evento in admin.eventos" :key="evento.id">{{ evento.nombreCorto }}</AppBadge>
                  <AppBadge v-if="!admin.eventos?.length" tono="warn">Sin eventos</AppBadge>
                </div>
                <span v-else class="text-slate-500">—</span>
              </td>
              <td>
                <div v-if="chips.visibles.length" class="flex max-w-xs flex-wrap gap-1">
                  <AppBadge v-for="etiqueta in chips.visibles" :key="etiqueta" class="max-w-56" :title="etiqueta">
                    <span class="truncate">{{ etiqueta }}</span>
                  </AppBadge>
                  <AppBadge v-if="chips.ocultos.length" tono="info" :title="chips.ocultos.join('\n')">+{{ chips.ocultos.length }}</AppBadge>
                </div>
                <AppBadge v-else-if="sinPermisos" tono="warn">Sin permisos</AppBadge>
                <span v-else class="text-xs whitespace-nowrap text-slate-500">Los del rol</span>
              </td>
              <td class="whitespace-nowrap"><AppBadge :tono="accesoDe(admin) === 'GOOGLE' ? 'brand' : 'neutral'">{{ etiquetaAcceso(admin) }}</AppBadge></td>
              <td><AppBadge :tono="admin.activo ? 'ok' : 'neutral'">{{ admin.activo ? 'Activo' : 'Inactivo' }}</AppBadge></td>
              <td class="text-sm whitespace-nowrap">{{ fechaHoraLima(admin.creadoEn) }}</td>
              <td class="text-right whitespace-nowrap">
                <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrir(admin)">Editar</AppButton>
                <AppButton v-if="!esPropia(admin)" size="sm" variant="ghost" icon="heroicons:trash" :aria-label="`Eliminar la cuenta de ${nombreCompleto(admin)}`" @click="eliminar(admin)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal :abierto="modal" :titulo="editando ? 'Editar cuenta' : 'Nueva cuenta'" ancho="lg" @cerrar="modal = false">
      <form id="form-admin" class="grid gap-4 sm:grid-cols-2" @submit.prevent="guardar">
        <p v-if="propia" class="flex gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300 sm:col-span-2">
          <Icon name="heroicons:information-circle" class="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden="true" />
          <span>
            {{ textoPropia }}
            Si cambias tu correo, tu contraseña o tu acceso, se cerrará tu sesión y tendrás que volver a ingresar.
          </span>
        </p>
        <AppField label="Nombres" for="ad-nombres" required :error="errores.nombres"><input id="ad-nombres" v-model="form.nombres" class="field-control"></AppField>
        <AppField label="Apellidos" for="ad-apellidos" required :error="errores.apellidos"><input id="ad-apellidos" v-model="form.apellidos" class="field-control"></AppField>
        <AppField
          label="Correo"
          for="ad-correo"
          required
          :error="errores.correo"
          :hint="!correoEditable ? 'Solo un Owner puede cambiar el correo de su propia cuenta: pídeselo a un Owner.' : editando?.googleVinculado ? AVISO_CAMBIO_CORREO_GOOGLE : undefined"
          class="sm:col-span-2"
        >
          <input id="ad-correo" v-model="form.correo" type="email" autocomplete="off" class="field-control" :disabled="!correoEditable">
        </AppField>

        <AppField
          label="Rol"
          for="ad-rol"
          required
          :error="errores.rolCodigo"
          :hint="propia ? 'No puedes cambiar el rol de tu propia cuenta.' : descripcionRol(rolElegido) ?? undefined"
        >
          <select id="ad-rol" v-model="form.rolCodigo" class="field-control" :disabled="propia || !opcionesRol.length" @change="alCambiarRol">
            <option value="" disabled>Elige un rol</option>
            <option v-for="opcion in opcionesRol" :key="opcion.codigo" :value="opcion.codigo">{{ opcion.etiqueta }}</option>
          </select>
        </AppField>
        <div class="flex items-end">
          <AppSwitch v-model="form.activo" label="Activo" :descripcion="propia ? 'No puedes desactivar tu propia cuenta.' : undefined" :disabled="propia" class="w-full" />
        </div>
        <p v-if="errorRoles" class="flex flex-wrap items-center gap-2 text-xs text-red-300 sm:col-span-2" role="alert">
          No se pudieron cargar los roles que puedes asignar.
          <AppButton size="sm" variant="secondary" icon="heroicons:arrow-path" @click="cargarRoles">Reintentar</AppButton>
        </p>

        <div v-if="permisosDelRol.length" class="rounded-xl bg-white/5 px-4 py-3 sm:col-span-2">
          <p class="text-sm font-medium text-white">Permisos del rol</p>
          <ul class="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
            <li v-for="permiso in permisosDelRol" :key="permiso" class="flex gap-1.5">
              <Icon name="heroicons:check" class="mt-px size-3.5 shrink-0 text-brand-300" aria-hidden="true" /> {{ permiso }}
            </li>
          </ul>
        </div>
        <CasillasEventosCuenta
          v-if="alcanceRol === 'EVENTO'"
          v-model="form.eventoIds"
          :opciones="opcionesEvento"
          :disabled="propia"
          :error="errores.eventoIds"
          :hint="ayudaEventos"
          class="sm:col-span-2"
        />
        <CasillasPermisosCuenta
          v-if="alcanceRol === 'EVENTO' && elegibles"
          v-model="form.permisos"
          :elegibles="elegibles"
          :disabled="propia"
          :error="errores.permisos"
          :hint="ayudaPermisos"
          class="sm:col-span-2"
        />

        <fieldset class="sm:col-span-2">
          <legend class="field-label">Acceso</legend>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="opcion in OPCIONES_ACCESO"
              :key="opcion.valor"
              class="flex gap-3 rounded-xl border px-3.5 py-3 transition"
              :class="[
                form.acceso === opcion.valor ? 'border-brand-500 bg-brand-500/10' : 'border-navy-500 bg-navy-900/80 hover:border-navy-400',
                opcion.valor === 'GOOGLE' && googleBloqueado ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              ]"
            >
              <input v-model="form.acceso" type="radio" name="ad-acceso" :value="opcion.valor" :disabled="opcion.valor === 'GOOGLE' && googleBloqueado" class="mt-0.5 accent-brand-500">
              <span>
                <span class="block text-sm font-medium text-white">{{ opcion.titulo }}</span>
                <span class="block text-xs text-slate-400">{{ opcion.detalle }}</span>
              </span>
            </label>
          </div>
          <p v-if="errores.acceso" class="field-error" role="alert">{{ errores.acceso }}</p>
          <p v-else-if="motivoGoogle" class="field-hint">{{ motivoGoogle }}</p>
          <p v-else-if="quitaContrasena" class="mt-1 text-xs text-amber-300">Al guardar se eliminará su contraseña: solo podrá entrar con Google.</p>
        </fieldset>
        <p v-if="promueve" class="flex gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30 ring-inset sm:col-span-2" role="status">
          <Icon name="heroicons:exclamation-triangle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Al pasar de una cuenta por evento a un rol global se borran su contraseña y su vínculo con Google, y se cierran sus sesiones abiertas.
            Deberá entrar con «Continuar con Google» usando este correo{{ form.acceso === 'CONTRASENA' ? ' o con la contraseña nueva que escribas aquí' : '' }}.
          </span>
        </p>
        <AppField
          v-if="form.acceso === 'CONTRASENA'"
          :label="tieneContrasena ? 'Nueva contraseña' : 'Contraseña'"
          for="ad-pass"
          :required="contrasenaObligatoria(form.acceso, editando, promueve)"
          :error="errores.contrasena"
          :hint="tieneContrasena && !promueve ? `Déjala vacía para no cambiarla. Mínimo ${MIN_CONTRASENA} caracteres.` : `Mínimo ${MIN_CONTRASENA} caracteres.`"
          class="sm:col-span-2"
        >
          <input id="ad-pass" v-model="form.contrasena" type="password" autocomplete="new-password" :minlength="MIN_CONTRASENA" class="field-control">
        </AppField>
        <div v-if="editando?.googleVinculado" class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 sm:col-span-2">
          <div class="text-sm">
            <p class="font-medium text-white">Google vinculado</p>
            <p class="text-xs text-slate-400">{{ tituloVinculoGoogle(editando) }}</p>
            <p v-if="!correoEditable" class="mt-1 text-xs text-slate-400">Solo un Owner puede desvincular el Google de su propia cuenta: pídeselo a un Owner.</p>
          </div>
          <AppButton size="sm" variant="secondary" icon="heroicons:link-slash" :loading="desvinculando" :disabled="!correoEditable" @click="desvincularGoogle(editando)">Desvincular Google</AppButton>
        </div>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-admin" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
