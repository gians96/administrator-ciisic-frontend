<script setup lang="ts">
import type { Administrador, Respuesta } from '~/types/api'
import { fechaHoraLima, nombreCompleto } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'

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
const errores = ref<Record<string, string>>({})
const form = reactive({ nombres: '', apellidos: '', correo: '', contrasena: '', rolCodigo: 'ADMIN' as 'ADMIN' | 'SUPERADMIN', activo: true })

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
  Object.assign(form, { nombres: admin?.nombres ?? '', apellidos: admin?.apellidos ?? '', correo: admin?.correo ?? '', contrasena: '', rolCodigo: admin?.rolCodigo ?? 'ADMIN', activo: admin?.activo ?? true })
  modal.value = true
}

async function guardar() {
  guardando.value = true
  errores.value = {}
  const body: Record<string, unknown> = { nombres: form.nombres.trim(), apellidos: form.apellidos.trim(), correo: form.correo.trim(), rolCodigo: form.rolCodigo, activo: form.activo }
  if (form.contrasena) body.contrasena = form.contrasena
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
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Creado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="admin in admins" :key="admin.id">
              <td class="font-medium text-white">{{ nombreCompleto(admin) }} <AppBadge v-if="admin.id === auth.usuario?.id" tono="brand" class="ml-1">Tú</AppBadge></td>
              <td class="text-sm">{{ admin.correo }}</td>
              <td><AppBadge :tono="admin.rolCodigo === 'SUPERADMIN' ? 'warn' : 'neutral'">{{ admin.rolNombre }}</AppBadge></td>
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
        <AppField label="Correo" for="ad-correo" required :error="errores.correo" class="sm:col-span-2"><input id="ad-correo" v-model="form.correo" type="email" autocomplete="off" class="field-control"></AppField>
        <AppField :label="editando ? 'Nueva contraseña' : 'Contraseña'" for="ad-pass" :required="!editando" :error="errores.contrasena" :hint="editando ? 'Déjala vacía para no cambiarla. Mínimo 12 caracteres.' : 'Mínimo 12 caracteres.'" class="sm:col-span-2">
          <input id="ad-pass" v-model="form.contrasena" type="password" autocomplete="new-password" minlength="12" class="field-control">
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
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-admin" :loading="guardando">Guardar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
