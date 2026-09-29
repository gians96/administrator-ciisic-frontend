<script setup lang="ts">
import type { Meta, PeriodoRenovacion, Proveedor, RegistroConsulta, Respuesta, TokenConsulta, UsoConsultas } from '~/types/api'
import { fechaDia, fechaHoraLima, numero } from '~/utils/formato'
import { aErrorApi, mensajeError } from '~/utils/errores'

useHead({ title: 'Consultas DNI · Panel CIISIC' })

const { api } = useApi()
const toast = useToast()
const { confirmar } = useConfirm()

const PROVEEDORES: Array<{ id: Proveedor, nombre: string, url: string }> = [
  { id: 'DECOLECTA', nombre: 'Decolecta', url: 'https://decolecta.com/profile' },
  { id: 'APIPERU', nombre: 'apiperu.dev', url: 'https://apiperu.dev' },
]
const PERIODOS: Array<{ id: PeriodoRenovacion, nombre: string }> = [
  { id: 'MENSUAL', nombre: 'Mensual' },
  { id: 'DIARIO', nombre: 'Diario' },
  { id: 'ANUAL', nombre: 'Anual' },
  { id: 'NINGUNO', nombre: 'No se renueva' },
]
const RESULTADOS: Record<string, { nombre: string, color: string }> = {
  EXITO: { nombre: 'Éxito', color: '#10b981' },
  CACHE: { nombre: 'Caché', color: '#00d9e8' },
  NO_ENCONTRADO: { nombre: 'No encontrado', color: '#64748b' },
  AGOTADO: { nombre: 'Agotado', color: '#fbbf24' },
  TOKEN_INVALIDO: { nombre: 'Token inválido', color: '#ef4444' },
  ERROR: { nombre: 'Error', color: '#f97316' },
  SIN_TOKENS: { nombre: 'Sin tokens', color: '#a855f7' },
}
const nombreProveedor = (id: string | null) => PROVEEDORES.find((p) => p.id === id)?.nombre ?? '—'

const tokens = ref<TokenConsulta[]>([])
const uso = ref<UsoConsultas | null>(null)
const bitacora = ref<RegistroConsulta[]>([])
const metaBitacora = ref<Meta | null>(null)
const cargando = ref(false)

async function cargarTokens() {
  cargando.value = true
  try {
    tokens.value = (await api<Respuesta<TokenConsulta[]>>('lookup-tokens')).data
  } catch (error) {
    toast.error(mensajeError(error))
  } finally {
    cargando.value = false
  }
}

async function cargarUso() {
  try {
    uso.value = (await api<Respuesta<UsoConsultas>>('lookup-tokens/usage', { query: { dias: 30 } })).data
  } catch {
    uso.value = null
  }
}

async function cargarBitacora(pagina = 1) {
  try {
    const r = await api<Respuesta<RegistroConsulta[]>>('lookup-tokens/logs', { query: { page: pagina } })
    bitacora.value = r.data
    metaBitacora.value = r.meta ?? null
  } catch {
    bitacora.value = []
  }
}

async function refrescar() {
  await Promise.all([cargarTokens(), cargarUso(), cargarBitacora(metaBitacora.value?.page ?? 1)])
}
onMounted(refrescar)

const disponibles = computed(() => tokens.value.filter((t) => t.disponible).length)
const capacidadRestante = computed(() => tokens.value.filter((t) => t.disponible).reduce((suma, t) => suma + (t.consultasRestantes ?? 0), 0))
const hayIlimitados = computed(() => tokens.value.some((t) => t.disponible && t.limiteConsultas === null))

// ─── Formulario de token ───
const modal = ref(false)
const editando = ref<TokenConsulta | null>(null)
const guardando = ref(false)
const errores = ref<Record<string, string>>({})
const form = reactive({ proveedor: 'DECOLECTA' as Proveedor, nombre: '', token: '', limiteConsultas: '' as string | number, consultasUsadas: 0, periodoRenovacion: 'MENSUAL' as PeriodoRenovacion, fechaRenovacion: '', prioridad: 100, activo: true })

function aFechaLocal(iso: string | null) {
  if (!iso) return ''
  const fecha = new Date(iso)
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function abrir(token?: TokenConsulta) {
  editando.value = token ?? null
  errores.value = {}
  Object.assign(form, {
    proveedor: token?.proveedor ?? 'DECOLECTA',
    nombre: token?.nombre ?? '',
    token: '',
    limiteConsultas: token?.limiteConsultas ?? '',
    consultasUsadas: token?.consultasUsadas ?? 0,
    periodoRenovacion: token?.periodoRenovacion ?? 'MENSUAL',
    fechaRenovacion: aFechaLocal(token?.fechaRenovacion ?? null),
    prioridad: token?.prioridad ?? (tokens.value.length + 1) * 10,
    activo: token?.activo ?? true,
  })
  modal.value = true
}

async function guardar() {
  guardando.value = true
  errores.value = {}
  const body: Record<string, unknown> = {
    proveedor: form.proveedor,
    nombre: form.nombre.trim(),
    limiteConsultas: form.limiteConsultas === '' ? null : Number(form.limiteConsultas),
    consultasUsadas: Number(form.consultasUsadas) || 0,
    periodoRenovacion: form.periodoRenovacion,
    fechaRenovacion: form.fechaRenovacion ? new Date(form.fechaRenovacion).toISOString() : null,
    prioridad: Number(form.prioridad) || 0,
    activo: form.activo,
  }
  if (form.token.trim()) body.token = form.token.trim()
  try {
    if (editando.value) await api(`lookup-tokens/${editando.value.id}`, { method: 'PUT', body })
    else await api('lookup-tokens', { method: 'POST', body })
    toast.exito('Token guardado. El valor queda cifrado y no se volverá a mostrar.')
    modal.value = false
    form.token = ''
    await cargarTokens()
  } catch (error) {
    errores.value = aErrorApi(error).fields ?? {}
    toast.error(mensajeError(error))
  } finally {
    guardando.value = false
  }
}

async function alternar(token: TokenConsulta) {
  try {
    await api(`lookup-tokens/${token.id}`, { method: 'PUT', body: { activo: !token.activo } })
    await cargarTokens()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function reiniciar(token: TokenConsulta) {
  const ok = await confirmar({ titulo: 'Reiniciar contador', mensaje: `El contador de «${token.nombre}» volverá a 0 y el token quedará ACTIVO. Úsalo cuando el proveedor ya renovó tu plan.`, textoConfirmar: 'Reiniciar' })
  if (!ok) return
  try {
    await api(`lookup-tokens/${token.id}/reset`, { method: 'POST' })
    toast.exito('Contador reiniciado.')
    await cargarTokens()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

async function eliminar(token: TokenConsulta) {
  const ok = await confirmar({ titulo: 'Eliminar token', mensaje: `¿Eliminar «${token.nombre}»? Su historial de consultas se conserva sin el token.`, textoConfirmar: 'Eliminar', peligro: true })
  if (!ok) return
  try {
    await api(`lookup-tokens/${token.id}`, { method: 'DELETE' })
    toast.exito('Token eliminado.')
    await refrescar()
  } catch (error) {
    toast.error(mensajeError(error))
  }
}

// ─── Probar token / consulta manual ───
const prueba = reactive({ abierto: false, token: null as TokenConsulta | null, numero: '', cargando: false, resultado: '' })

function abrirPrueba(token: TokenConsulta) {
  Object.assign(prueba, { abierto: true, token, numero: '', resultado: '' })
}

async function probar() {
  if (!prueba.token || !/^\d{8}$/.test(prueba.numero)) return
  prueba.cargando = true
  try {
    const r = await api<Respuesta<{ ok: boolean, persona?: { nombres: string, apellidoPaterno: string, apellidoMaterno: string }, falla?: { tipo: string, mensaje: string } }>>(`lookup-tokens/${prueba.token.id}/test`, { method: 'POST', body: { numero: prueba.numero } })
    prueba.resultado = r.data.ok && r.data.persona
      ? `✓ ${r.data.persona.nombres} ${r.data.persona.apellidoPaterno} ${r.data.persona.apellidoMaterno}`
      : `✗ ${r.data.falla?.tipo}: ${r.data.falla?.mensaje}`
    await refrescar()
  } catch (error) {
    prueba.resultado = mensajeError(error)
  } finally {
    prueba.cargando = false
  }
}

const manual = reactive({ numero: '', cargando: false, resultado: '' })
async function consultarManual() {
  if (!/^\d{8}$/.test(manual.numero)) return
  manual.cargando = true
  manual.resultado = ''
  try {
    const r = await api<Respuesta<{ nombres: string, apellidos: string, fuente: string, proveedor: string | null }>>(`document-lookup/dni/${manual.numero}`)
    manual.resultado = `${r.data.nombres} ${r.data.apellidos} · ${r.data.fuente === 'CACHE' ? 'desde caché' : `vía ${nombreProveedor(r.data.proveedor)}`}`
    await Promise.all([cargarTokens(), cargarBitacora()])
  } catch (error) {
    manual.resultado = mensajeError(error)
  } finally {
    manual.cargando = false
  }
}

// ─── Gráfico de uso ───
const serieUso = computed(() => {
  const dias = uso.value?.porDia ?? []
  const claves = Object.keys(RESULTADOS).filter((clave) => dias.some((dia) => Number(dia[clave] ?? 0) > 0))
  return {
    etiquetas: dias.map((dia) => fechaDia(String(dia.fecha))),
    series: claves.map((clave) => ({ label: RESULTADOS[clave]!.nombre, data: dias.map((dia) => Number(dia[clave] ?? 0)), color: RESULTADOS[clave]!.color })),
  }
})

const TONO_ESTADO = { ACTIVO: 'ok', AGOTADO: 'warn', INVALIDO: 'error' } as const
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="kicker">Configuración</p>
        <h1 class="mt-1 text-3xl font-extrabold">Consultas DNI</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          Pool de tokens de Decolecta y apiperu para autocompletar nombres en la landing. Se usan por prioridad (menor número primero); si uno se agota o falla, se pasa automáticamente al siguiente.
        </p>
      </div>
      <AppButton icon="heroicons:plus" @click="abrir()">Agregar token</AppButton>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <AppStat etiqueta="Tokens disponibles" :valor="`${disponibles} / ${tokens.length}`" icon="heroicons:key" :tono="disponibles ? 'ok' : 'error'" />
      <AppStat etiqueta="Consultas restantes" :valor="hayIlimitados ? '∞' : numero(capacidadRestante)" icon="heroicons:identification" detalle="Suma de tokens disponibles con límite" />
      <AppStat etiqueta="Uso (30 días)" :valor="numero(uso?.porDia.reduce((s, d) => s + Object.entries(d).filter(([k]) => k !== 'fecha').reduce((a, [, v]) => a + Number(v), 0), 0))" icon="heroicons:chart-bar" tono="info" />
    </div>

    <p v-if="!cargando && !disponibles" class="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/25" role="alert">
      No hay tokens disponibles: la landing pedirá a los participantes escribir sus nombres a mano.
    </p>

    <section class="card overflow-hidden">
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr><th>Prioridad</th><th>Token</th><th>Uso</th><th>Renovación</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="token in tokens" :key="token.id" :class="token.activo ? '' : 'opacity-60'">
              <td class="text-center font-mono text-white tabular-nums">{{ token.prioridad }}</td>
              <td>
                <p class="font-medium text-white">{{ token.nombre }}</p>
                <p class="text-xs text-slate-400">{{ nombreProveedor(token.proveedor) }} · <span class="font-mono">{{ token.tokenEnmascarado }}</span></p>
                <p v-if="token.ultimoError" class="mt-0.5 max-w-xs truncate text-xs text-red-300" :title="token.ultimoError">{{ token.ultimoError }}</p>
              </td>
              <td class="min-w-44">
                <p class="text-sm tabular-nums">{{ numero(token.consultasUsadas) }}<span class="text-slate-400"> / {{ token.limiteConsultas === null ? '∞' : numero(token.limiteConsultas) }}</span></p>
                <div v-if="token.porcentajeUso !== null" class="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="token.porcentajeUso" aria-valuemin="0" aria-valuemax="100">
                  <div class="h-full rounded-full" :class="token.porcentajeUso >= 90 ? 'bg-red-400' : token.porcentajeUso >= 70 ? 'bg-amber-400' : 'bg-brand-500'" :style="{ width: `${token.porcentajeUso}%` }" />
                </div>
                <p class="mt-0.5 text-xs whitespace-nowrap text-slate-500">Último uso: {{ fechaHoraLima(token.ultimoUsoEn) }}</p>
              </td>
              <td class="text-sm">
                <p>{{ PERIODOS.find((p) => p.id === token.periodoRenovacion)?.nombre }}</p>
                <p class="text-xs whitespace-nowrap text-slate-400">{{ token.fechaRenovacion ? fechaHoraLima(token.fechaRenovacion) : 'Sin fecha' }}</p>
              </td>
              <td>
                <div class="flex flex-col items-start gap-1">
                  <AppBadge :tono="TONO_ESTADO[token.estado]">{{ token.estado.charAt(0) + token.estado.slice(1).toLowerCase() }}</AppBadge>
                  <AppBadge v-if="!token.activo" tono="neutral">Desactivado</AppBadge>
                </div>
              </td>
              <td class="text-right whitespace-nowrap">
                <AppButton size="sm" variant="ghost" icon="heroicons:beaker" @click="abrirPrueba(token)">Probar</AppButton>
                <AppButton size="sm" variant="ghost" icon="heroicons:arrow-path" @click="reiniciar(token)">Reiniciar</AppButton>
                <AppButton size="sm" variant="ghost" :icon="token.activo ? 'heroicons:pause' : 'heroicons:play'" @click="alternar(token)">{{ token.activo ? 'Pausar' : 'Activar' }}</AppButton>
                <AppButton size="sm" variant="ghost" icon="heroicons:pencil-square" aria-label="Editar token" @click="abrir(token)" />
                <AppButton size="sm" variant="ghost" icon="heroicons:trash" aria-label="Eliminar token" @click="eliminar(token)" />
              </td>
            </tr>
            <tr v-if="!cargando && !tokens.length"><td colspan="6" class="py-10 text-center text-slate-400">Agrega tu primer token de Decolecta o apiperu.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid gap-6 xl:grid-cols-5">
      <section class="card p-6 xl:col-span-3">
        <h2 class="text-lg font-bold">Consultas por día</h2>
        <p class="mb-4 text-xs text-slate-400">Últimos 30 días, por resultado</p>
        <BarChart v-if="serieUso.etiquetas.length" :etiquetas="serieUso.etiquetas" :series="serieUso.series" apilado descripcion="Consultas de DNI por día y resultado" />
        <AppEmpty v-else titulo="Sin consultas registradas" icon="heroicons:chart-bar" />
      </section>
      <section class="card p-6 xl:col-span-2">
        <h2 class="text-lg font-bold">Consulta manual</h2>
        <p class="mb-4 text-xs text-slate-400">Consulta un DNI con el pool (usa caché si existe).</p>
        <form class="flex gap-2" @submit.prevent="consultarManual">
          <label for="dni-manual" class="sr-only">DNI</label>
          <input id="dni-manual" v-model="manual.numero" inputmode="numeric" maxlength="8" class="field-control font-mono" placeholder="12345678">
          <AppButton type="submit" icon="heroicons:magnifying-glass" :loading="manual.cargando" :disabled="!/^\d{8}$/.test(manual.numero)">Consultar</AppButton>
        </form>
        <p v-if="manual.resultado" class="mt-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-white">{{ manual.resultado }}</p>
      </section>
    </div>

    <section class="card overflow-hidden">
      <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 class="text-lg font-bold">Bitácora</h2>
          <p class="text-xs text-slate-400">Los DNI se guardan enmascarados.</p>
        </div>
        <AppButton size="sm" variant="secondary" icon="heroicons:arrow-path" @click="refrescar">Actualizar</AppButton>
      </header>
      <div class="relative overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Fecha</th><th>DNI</th><th>Origen</th><th>Token</th><th>Resultado</th><th class="text-right">HTTP</th><th class="text-right">ms</th></tr></thead>
          <tbody>
            <tr v-for="registro in bitacora" :key="registro.id">
              <td class="text-xs whitespace-nowrap">{{ fechaHoraLima(registro.creadoEn) }}</td>
              <td class="font-mono">{{ registro.numero }}</td>
              <td>{{ registro.origen }}</td>
              <td>{{ registro.token ?? (registro.resultado === 'CACHE' ? '—' : nombreProveedor(registro.proveedor)) }}</td>
              <td>
                <span class="inline-flex items-center gap-1.5 text-sm"><span class="size-2 rounded-full" :style="{ background: RESULTADOS[registro.resultado]?.color }" aria-hidden="true" />{{ RESULTADOS[registro.resultado]?.nombre ?? registro.resultado }}</span>
                <p v-if="registro.detalle" class="max-w-xs truncate text-xs text-slate-500" :title="registro.detalle">{{ registro.detalle }}</p>
              </td>
              <td class="text-right tabular-nums">{{ registro.codigoHttp ?? '—' }}</td>
              <td class="text-right tabular-nums">{{ registro.duracionMs ?? '—' }}</td>
            </tr>
            <tr v-if="!bitacora.length"><td colspan="7" class="py-8 text-center text-slate-400">Sin registros.</td></tr>
          </tbody>
        </table>
      </div>
      <AppPagination :meta="metaBitacora" @cambiar="cargarBitacora" />
    </section>

    <AppModal :abierto="modal" :titulo="editando ? 'Editar token' : 'Agregar token'" descripcion="El token se guarda cifrado en el servidor." @cerrar="modal = false">
      <form id="form-token" class="grid gap-4 sm:grid-cols-2" @submit.prevent="guardar">
        <AppField label="Proveedor" for="tk-proveedor" required>
          <select id="tk-proveedor" v-model="form.proveedor" class="field-control">
            <option v-for="proveedor in PROVEEDORES" :key="proveedor.id" :value="proveedor.id">{{ proveedor.nombre }}</option>
          </select>
        </AppField>
        <AppField label="Alias" for="tk-nombre" required :error="errores.nombre" hint="Ej.: Decolecta cuenta congreso">
          <input id="tk-nombre" v-model="form.nombre" class="field-control" maxlength="100">
        </AppField>
        <AppField label="Token" for="tk-token" :required="!editando" :error="errores.token" :hint="editando ? `Actual: ${editando.tokenEnmascarado}. Déjalo vacío para conservarlo.` : `Genéralo en ${PROVEEDORES.find((p) => p.id === form.proveedor)?.url}`" class="sm:col-span-2">
          <input id="tk-token" v-model="form.token" type="password" autocomplete="off" class="field-control font-mono">
        </AppField>
        <AppField label="Límite de consultas" for="tk-limite" :error="errores.limiteConsultas" hint="Vacío = sin límite conocido.">
          <input id="tk-limite" v-model="form.limiteConsultas" type="number" min="1" class="field-control">
        </AppField>
        <AppField label="Consultas ya usadas" for="tk-usadas" hint="Si el token ya tenía consumo este periodo.">
          <input id="tk-usadas" v-model.number="form.consultasUsadas" type="number" min="0" class="field-control">
        </AppField>
        <AppField label="Periodo de renovación" for="tk-periodo">
          <select id="tk-periodo" v-model="form.periodoRenovacion" class="field-control">
            <option v-for="periodo in PERIODOS" :key="periodo.id" :value="periodo.id">{{ periodo.nombre }}</option>
          </select>
        </AppField>
        <AppField label="Próxima renovación" for="tk-renovacion" hint="Fecha en que el proveedor reinicia tu cuota.">
          <input id="tk-renovacion" v-model="form.fechaRenovacion" type="datetime-local" class="field-control">
        </AppField>
        <AppField label="Prioridad" for="tk-prioridad" hint="Menor número = se usa primero.">
          <input id="tk-prioridad" v-model.number="form.prioridad" type="number" min="0" class="field-control">
        </AppField>
        <div class="flex items-end">
          <AppSwitch v-model="form.activo" label="Activo" class="w-full" />
        </div>
      </form>
      <template #acciones>
        <AppButton variant="secondary" @click="modal = false">Cancelar</AppButton>
        <AppButton type="submit" form="form-token" :loading="guardando" :disabled="!form.nombre || (!editando && !form.token)">Guardar</AppButton>
      </template>
    </AppModal>

    <AppModal :abierto="prueba.abierto" titulo="Probar token" :descripcion="prueba.token?.nombre" ancho="sm" @cerrar="prueba.abierto = false">
      <p class="mb-4 text-sm text-slate-400">La prueba consume una consulta real del proveedor.</p>
      <form id="form-prueba" class="flex gap-2" @submit.prevent="probar">
        <label for="dni-prueba" class="sr-only">DNI</label>
        <input id="dni-prueba" v-model="prueba.numero" inputmode="numeric" maxlength="8" class="field-control font-mono" placeholder="DNI de 8 dígitos">
        <AppButton type="submit" :loading="prueba.cargando" :disabled="!/^\d{8}$/.test(prueba.numero)">Probar</AppButton>
      </form>
      <p v-if="prueba.resultado" class="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-white">{{ prueba.resultado }}</p>
    </AppModal>
  </div>
</template>
