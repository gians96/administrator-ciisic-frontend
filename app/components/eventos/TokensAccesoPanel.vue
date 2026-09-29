<script setup lang="ts">
import type { Respuesta, TokenAcceso, TokenAccesoCreado } from '~/types/api'
import { fechaHoraLima, nombreCompleto } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'
import {
  calcularExpiracionToken,
  cuerpoTokenAcceso,
  estadoEfectivoTokenAcceso,
  ESTADOS_TOKEN_ACCESO,
  ETIQUETAS_CAMPOS_TOKEN,
  hoyEnLima,
  mensajeRevocarToken,
  OPCIONES_EXPIRACION_TOKEN,
  ordenarTokensAcceso,
  prefijoVisibleToken,
  validarTokenAcceso,
  VARIABLE_TOKEN_LANDING,
  venceProntoTokenAcceso,
  type FormularioTokenAcceso,
} from '~/utils/tokensAcceso'

/**
 * Tokens de acceso del evento (solo SuperAdmin): la landing del evento los usa desde su servidor
 * para consumir el backend. El valor completo llega una sola vez al generarlo y solo vive en el
 * estado local de este componente mientras el diálogo está abierto (nunca en Pinia ni localStorage).
 */
const props = defineProps<{ eventoId: number }>()

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()
const { copiado, copiar, reiniciar: reiniciarCopia } = useCopiar()

const tokens = ref<TokenAcceso[]>([])
const cargando = ref(false)
const cargado = ref(false)
const errorCarga = ref<string | null>(null)
const revocando = ref<number | null>(null)

const vista = computed(() => {
  const ahora = new Date()
  return ordenarTokensAcceso(tokens.value, ahora).map((token) => {
    const estado = estadoEfectivoTokenAcceso(token, ahora)
    return { token, estado, insignia: ESTADOS_TOKEN_ACCESO[estado], vencePronto: venceProntoTokenAcceso(token, ahora) }
  })
})

async function cargar() {
  cargando.value = true
  errorCarga.value = null
  try {
    tokens.value = (await api<Respuesta<TokenAcceso[]>>(`events/${props.eventoId}/access-tokens`)).data
    cargado.value = true
  } catch (error) {
    errorCarga.value = mensajeError(error)
  } finally {
    cargando.value = false
  }
}
watch(() => props.eventoId, () => {
  tokens.value = []
  cargado.value = false
  cargar()
}, { immediate: true })

// ─── Generar ───
const modal = ref(false)
const generando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive<FormularioTokenAcceso>({ nombre: '', expiracion: 'nunca', fecha: '' })
const pistaExpiracion = computed(() => {
  if (form.expiracion === 'nunca') return 'Opcional. Sin expiración, el token sigue activo hasta que lo revoques.'
  if (form.expiracion === 'fecha') return undefined
  return `Vencerá el ${fechaHoraLima(calcularExpiracionToken(form.expiracion, ''))} (hora de Lima).`
})

function abrir() {
  Object.assign(form, { nombre: '', expiracion: 'nunca', fecha: '' })
  errores.value = {}
  modal.value = true
}

async function generar() {
  errores.value = validarTokenAcceso(form)
  if (Object.keys(errores.value).length) return
  generando.value = true
  try {
    const { token, ...registro } = (await api<Respuesta<TokenAccesoCreado>>(`events/${props.eventoId}/access-tokens`, { method: 'POST', body: cuerpoTokenAcceso(form) })).data
    // La fila de la lista nunca incluye el valor en claro
    tokens.value = [registro, ...tokens.value.filter((existente) => existente.id !== registro.id)]
    modal.value = false
    mostrarToken(registro.nombre, token)
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error, ETIQUETAS_CAMPOS_TOKEN))
  } finally {
    generando.value = false
  }
}

// ─── Token en claro (una sola vez) ───
const tokenPlano = ref<string | null>(null)
const tokenNombre = ref('')
const tokenCopiado = ref(false)
const campoToken = ref<HTMLInputElement | null>(null)

function mostrarToken(nombre: string, valor: string) {
  tokenNombre.value = nombre
  tokenCopiado.value = false
  reiniciarCopia()
  tokenPlano.value = valor
}

function descartarToken() {
  tokenPlano.value = null
  tokenNombre.value = ''
  tokenCopiado.value = false
  reiniciarCopia()
}

function seleccionarToken() {
  campoToken.value?.select()
}

async function copiarToken() {
  if (!tokenPlano.value) return
  if (await copiar(tokenPlano.value)) {
    tokenCopiado.value = true
    return
  }
  seleccionarToken()
  toast.info('No se pudo copiar automáticamente. El token quedó seleccionado: cópialo con Ctrl+C.')
}

async function cerrarToken() {
  if (!tokenCopiado.value) {
    const ok = await confirmar({
      titulo: '¿Cerrar sin copiar el token?',
      mensaje: 'Aún no copiaste el token. Si cierras este diálogo no podrás volver a verlo y tendrás que generar otro.',
      textoConfirmar: 'Cerrar sin copiar',
      peligro: true,
    })
    if (!ok) return
  }
  descartarToken()
}

onBeforeUnmount(descartarToken)

// ─── Revocar ───
async function revocar(token: TokenAcceso) {
  const ok = await confirmar({ titulo: 'Revocar token', mensaje: mensajeRevocarToken(token), textoConfirmar: 'Revocar', peligro: true })
  if (!ok) return
  revocando.value = token.id
  try {
    const actualizado = (await api<Respuesta<TokenAcceso | null>>(`access-tokens/${token.id}`, { method: 'DELETE' })).data
    toast.exito(`Token «${token.nombre}» revocado.`)
    if (actualizado) tokens.value = tokens.value.map((existente) => (existente.id === token.id ? actualizado : existente))
    else await cargar()
  } catch (error) {
    toast.error(mensajeError(error))
    if (aErrorApi(error).code === 'ACCESS_TOKEN_NOT_FOUND') await cargar()
  } finally {
    revocando.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="max-w-2xl space-y-1 text-sm text-slate-400">
        <p>
          Tokens para que la <strong class="text-slate-200">landing de este evento</strong> consulte el backend desde su servidor. Cada token solo sirve para este evento y se muestra completo una única vez, al generarlo.
        </p>
        <p>Si un token se filtra, revócalo y genera otro.</p>
      </div>
      <AppButton icon="heroicons:key" @click="abrir">Generar token</AppButton>
    </div>

    <div v-if="errorCarga && tokens.length" class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">
      <p>No se pudo actualizar la lista: {{ errorCarga }}</p>
      <AppButton size="sm" variant="secondary" icon="heroicons:arrow-path" :loading="cargando" @click="cargar">Reintentar</AppButton>
    </div>

    <section class="card overflow-hidden" aria-labelledby="titulo-tokens-acceso">
      <h3 id="titulo-tokens-acceso" class="sr-only">Tokens de acceso del evento</h3>

      <div v-if="tokens.length" class="relative overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Prefijo</th>
              <th scope="col">Estado</th>
              <th scope="col">Último uso</th>
              <th scope="col">Expira</th>
              <th scope="col">Creado</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="{ token, estado, insignia, vencePronto } in vista" :key="token.id">
              <td class="font-medium" :class="estado === 'ACTIVO' ? 'text-white' : 'text-slate-400'">{{ token.nombre }}</td>
              <td class="font-mono text-xs whitespace-nowrap text-slate-300">{{ prefijoVisibleToken(token.prefijo) }}</td>
              <td>
                <AppBadge :tono="insignia.tono">{{ insignia.texto }}</AppBadge>
                <p v-if="estado === 'REVOCADO' && token.revocadoEn" class="mt-0.5 text-xs whitespace-nowrap text-slate-500">{{ fechaHoraLima(token.revocadoEn) }}</p>
              </td>
              <td class="text-sm whitespace-nowrap">{{ token.ultimoUsoEn ? fechaHoraLima(token.ultimoUsoEn) : 'Nunca' }}</td>
              <td class="text-sm whitespace-nowrap">
                {{ token.expiraEn ? fechaHoraLima(token.expiraEn) : 'Sin expiración' }}
                <p v-if="vencePronto" class="mt-0.5 text-xs text-amber-300">Vence pronto</p>
              </td>
              <td class="text-sm whitespace-nowrap">
                {{ fechaHoraLima(token.creadoEn) }}
                <p class="mt-0.5 text-xs text-slate-500">{{ token.creadoPor ? `por ${nombreCompleto(token.creadoPor)}` : '—' }}</p>
              </td>
              <td class="text-right whitespace-nowrap">
                <AppButton
                  v-if="estado === 'ACTIVO'"
                  size="sm"
                  variant="danger"
                  icon="heroicons:no-symbol"
                  :loading="revocando === token.id"
                  :aria-label="`Revocar el token ${token.nombre}`"
                  @click="revocar(token)"
                >
                  Revocar
                </AppButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="cargando" class="py-12 text-center text-sm text-slate-400" role="status">Cargando tokens…</div>
      <div v-else-if="errorCarga" class="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
        <Icon name="heroicons:exclamation-triangle" class="size-8 text-red-300" aria-hidden="true" />
        <p class="max-w-md text-sm text-red-200">No se pudieron cargar los tokens: {{ errorCarga }}</p>
        <AppButton variant="secondary" icon="heroicons:arrow-path" @click="cargar">Reintentar</AppButton>
      </div>
      <AppEmpty
        v-else-if="cargado"
        titulo="Aún no hay tokens de acceso"
        descripcion="Genera uno y configúralo en la landing del evento para que pueda consultar el backend."
        icon="heroicons:key"
      />
    </section>

    <AppModal :abierto="modal" titulo="Generar token de acceso" descripcion="Para la landing de este evento." ancho="sm" @cerrar="modal = false">
      <form id="form-token-acceso" class="space-y-4" novalidate @submit.prevent="generar">
        <AppField label="Nombre" for="ta-nombre" required :error="errores.nombre" hint="Para reconocerlo después (p. ej. Landing producción).">
          <input id="ta-nombre" v-model="form.nombre" class="field-control" maxlength="120" autocomplete="off">
        </AppField>
        <AppField
          label="Expiración"
          for="ta-expiracion"
          :error="form.expiracion === 'fecha' ? null : errores.expiraEn"
          :hint="pistaExpiracion"
        >
          <select id="ta-expiracion" v-model="form.expiracion" class="field-control">
            <option v-for="opcion in OPCIONES_EXPIRACION_TOKEN" :key="opcion.id" :value="opcion.id">{{ opcion.nombre }}</option>
          </select>
        </AppField>
        <AppField
          v-if="form.expiracion === 'fecha'"
          label="Fecha de expiración"
          for="ta-fecha"
          required
          :error="errores.expiraEn"
          hint="Vence al final de ese día (hora de Lima)."
        >
          <input id="ta-fecha" v-model="form.fecha" type="date" :min="hoyEnLima()" class="field-control">
        </AppField>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-token-acceso" icon="heroicons:key" :loading="generando">Generar</AppButton>
      </template>
    </AppModal>

    <AppModal :abierto="tokenPlano !== null" titulo="Token generado" :descripcion="tokenNombre" @cerrar="cerrarToken">
      <div class="space-y-4">
        <p id="token-aviso" class="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200 ring-1 ring-amber-400/25">
          <Icon name="heroicons:exclamation-triangle" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          Copia este token ahora; no se volverá a mostrar.
        </p>
        <AppField label="Token de acceso" for="token-valor">
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              id="token-valor"
              ref="campoToken"
              :value="tokenPlano ?? ''"
              readonly
              spellcheck="false"
              autocomplete="off"
              class="field-control font-mono text-xs"
              aria-describedby="token-aviso token-instruccion"
              @focus="seleccionarToken"
              @copy="tokenCopiado = true"
            >
            <AppButton autofocus :icon="copiado ? 'heroicons:check' : 'heroicons:clipboard-document'" @click="copiarToken">
              {{ copiado ? 'Copiado' : 'Copiar' }}
            </AppButton>
          </div>
        </AppField>
        <p class="sr-only" role="status">{{ copiado ? 'Token copiado al portapapeles.' : '' }}</p>
        <div id="token-instruccion" class="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p>
            Configúralo en la landing del evento como variable de entorno
            <code class="rounded bg-navy-900 px-1.5 py-0.5 font-mono text-xs text-brand-200">{{ VARIABLE_TOKEN_LANDING }}</code>
            (solo servidor).
          </p>
          <p class="mt-2 text-xs text-slate-400">No lo expongas en el navegador ni lo subas al repositorio.</p>
        </div>
      </div>
      <template #acciones>
        <AppButton :variant="tokenCopiado ? 'primary' : 'secondary'" icon="heroicons:check" @click="cerrarToken">
          {{ tokenCopiado ? 'Listo, ya lo copié' : 'Cerrar' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
