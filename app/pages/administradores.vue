<script setup lang="ts">
import type { Administrador, Respuesta } from '~/types/api'
import { fechaHoraLima, nombreCompleto } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import { AVISO_CAMBIO_CORREO_GOOGLE, mensajeDesvincularGoogle, tituloVinculoGoogle } from '~/utils/cuentaGoogle'
import { accesoDe, contrasenaObligatoria, cuerpoAdmin, etiquetaAcceso, MIN_CONTRASENA, OPCIONES_ACCESO, type FormAdmin } from '~/utils/administradores'

definePageMeta({ soloSuperAdmin: true })
useHead({ title: 'Administradores · Panel CIISIC' })

const { api } = useApi()
const auth = useAuthStore()
const toast = useToast()
const { confirmar } = useConfirm()

const admins = ref<Administrador[]>([])
const modal = ref(false)
const editando = ref<Administrador | null>(null)
const guardando = ref(false)
const desvinculando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive<FormAdmin>({ nombres: '', apellidos: '', correo: '', acceso: 'GOOGLE', contrasena: '', rolCodigo: 'ADMIN', activo: true })

const tieneContrasena = computed(() => accesoDe(editando.value) === 'CONTRASENA')
// Tu propia contraseña solo se quita si ya entraste con Google: si no, quedarías sin acceso
const googleBloqueado = computed(() => editando.value?.id === auth.usuario?.id && tieneContrasena.value && !editando.value?.googleVinculado)
const quitaContrasena = computed(() => form.acceso === 'GOOGLE' && tieneContrasena.value)

async function cargar() {
  try {
    admins.value = (await api<Respuesta<Administrador[]>>('admin')).data
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
onMounted(cargar)

function abrir(admin?: Administrador) {
  editando.value = admin ?? null
  errores.value = {}
  Object.assign(form, { nombres: admin?.nombres ?? '', apellidos: admin?.apellidos ?? '', correo: admin?.correo ?? '', acceso: accesoDe(admin), contrasena: '', rolCodigo: admin?.rolCodigo ?? 'ADMIN', activo: admin?.activo ?? true })
  modal.value = true
}

async function guardar() {
  const { body, errores: locales } = cuerpoAdmin(form, editando.value)
  errores.value = locales
  if (Object.keys(locales).length) return
  guardando.value = true
  try {
    if (editando.value) await api(`admin/${editando.value.id}`, { method: 'PUT', body })
    else await api('admin', { method: 'POST', body })
    toast.exito('Administrador guardado.')
    modal.value = false
    await cargar()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function desvincularGoogle(admin: Administrador) {
  const ok = await confirmar({ titulo: 'Desvincular Google', mensaje: mensajeDesvincularGoogle(admin, 'ADMIN'), textoConfirmar: 'Desvincular' })
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
  } finally {
    desvinculando.value = false
  }
}

async function eliminar(admin: Administrador) {
  const ok = await confirmar({ titulo: 'Eliminar administrador', mensaje: `¿Eliminar a ${nombreCompleto(admin)}? Si revisó inscripciones, solo se desactivará para conservar el historial.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    const r = await api<Respuesta<{ desactivado: boolean }>>(`admin/${admin.id}`, { method: 'DELETE' })
    toast.exito(r.data.desactivado ? 'Administrador desactivado (tenía revisiones).' : 'Administrador eliminado.')
    await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Administradores</h1>
        <p class="mt-1 text-sm text-slate-400">Cuentas con acceso al panel. Solo un SuperAdmin puede gestionarlas.</p>
      </div>
      <AppButton icon="heroicons:user-plus" @click="abrir()">Nuevo administrador</AppButton>
    </div>
    <section class="card overflow-hidden">
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acceso</th><th>Estado</th><th>Creado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="admin in admins" :key="admin.id">
              <td class="font-medium text-white">{{ nombreCompleto(admin) }} <AppBadge v-if="admin.id === auth.usuario?.id" tono="brand" class="ml-1">Tú</AppBadge></td>
              <td class="text-sm">
                {{ admin.correo }}
                <AppBadge v-if="admin.googleVinculado" tono="ok" class="ml-1" :title="tituloVinculoGoogle(admin) ?? undefined">
                  <Icon name="heroicons:link" class="size-3.5" aria-hidden="true" /> Google vinculado
                </AppBadge>
              </td>
              <td><AppBadge :tono="admin.rolCodigo === 'SUPERADMIN' ? 'warn' : 'neutral'">{{ admin.rolNombre }}</AppBadge></td>
              <td class="whitespace-nowrap"><AppBadge :tono="accesoDe(admin) === 'GOOGLE' ? 'brand' : 'neutral'">{{ etiquetaAcceso(admin) }}</AppBadge></td>
              <td><AppBadge :tono="admin.activo ? 'ok' : 'neutral'">{{ admin.activo ? 'Activo' : 'Inactivo' }}</AppBadge></td>
              <td class="text-sm whitespace-nowrap">{{ fechaHoraLima(admin.creadoEn) }}</td>
              <td class="text-right whitespace-nowrap">
                <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" @click="abrir(admin)">Editar</AppButton>
                <AppButton v-if="admin.id !== auth.usuario?.id" size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar administrador" @click="eliminar(admin)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal :abierto="modal" :titulo="editando ? 'Editar administrador' : 'Nuevo administrador'" @cerrar="modal = false">
      <form id="form-admin" class="grid gap-4 sm:grid-cols-2" @submit.prevent="guardar">
        <AppField label="Nombres" for="ad-nombres" required :error="errores.nombres"><input id="ad-nombres" v-model="form.nombres" class="field-control"></AppField>
        <AppField label="Apellidos" for="ad-apellidos" required :error="errores.apellidos"><input id="ad-apellidos" v-model="form.apellidos" class="field-control"></AppField>
        <AppField label="Correo" for="ad-correo" required :error="errores.correo" :hint="editando?.googleVinculado ? AVISO_CAMBIO_CORREO_GOOGLE : undefined" class="sm:col-span-2">
          <input id="ad-correo" v-model="form.correo" type="email" autocomplete="off" class="field-control">
        </AppField>
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
          <p v-if="googleBloqueado" class="field-hint">Para dejar tu cuenta solo con Google, primero entra una vez con «Continuar con Google».</p>
          <p v-else-if="quitaContrasena" class="mt-1 text-xs text-amber-300">Al guardar se eliminará su contraseña: solo podrá entrar con Google.</p>
        </fieldset>
        <AppField
          v-if="form.acceso === 'CONTRASENA'"
          :label="tieneContrasena ? 'Nueva contraseña' : 'Contraseña'"
          for="ad-pass"
          :required="contrasenaObligatoria(form.acceso, editando)"
          :error="errores.contrasena"
          :hint="tieneContrasena ? `Déjala vacía para no cambiarla. Mínimo ${MIN_CONTRASENA} caracteres.` : `Mínimo ${MIN_CONTRASENA} caracteres.`"
          class="sm:col-span-2"
        >
          <input id="ad-pass" v-model="form.contrasena" type="password" autocomplete="new-password" :minlength="MIN_CONTRASENA" class="field-control">
        </AppField>
        <AppField label="Rol" for="ad-rol">
          <select id="ad-rol" v-model="form.rolCodigo" class="field-control" :disabled="editando?.id === auth.usuario?.id">
            <option value="ADMIN">Admin</option>
            <option value="SUPERADMIN">SuperAdmin</option>
          </select>
        </AppField>
        <div class="flex items-end">
          <AppSwitch v-model="form.activo" label="Activo" :disabled="editando?.id === auth.usuario?.id" class="w-full" />
        </div>
        <div v-if="editando?.googleVinculado" class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 sm:col-span-2">
          <div class="text-sm">
            <p class="font-medium text-white">Google vinculado</p>
            <p class="text-xs text-slate-400">{{ tituloVinculoGoogle(editando) }}</p>
          </div>
          <AppButton size="sm" variant="secondary" icon="heroicons:link-slash" :loading="desvinculando" @click="desvincularGoogle(editando)">Desvincular Google</AppButton>
        </div>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-admin" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
