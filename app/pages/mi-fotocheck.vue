<script setup lang="ts">
import { idDeConsulta } from '~/utils/asistencia'
import { aErrorApi } from '~/utils/errores'
import { fechaHoraLima } from '~/utils/formato'
import {
  almacenDelNavegador,
  borrarFotocheckGuardado,
  esFalloDeConexion,
  guardarFotocheck,
  inscripcionElegida,
  inscripcionesConFotocheck,
  leerFotocheckGuardado,
  motivoSinFotocheck,
} from '~/utils/fotocheck'
import type { InscripcionPortal } from '~/utils/misInscripciones'
import { esNoDisponible, type FotocheckPortal } from '~/utils/portal'
import { hoyEnLima } from '~/utils/tokensAcceso'

/**
 * Fotocheck virtual (`GET /me/inscriptions/:id/badge`, spec 014): el de la inscripción aprobada (con
 * varias, un selector por evento; `?inscripcion=` lo elige desde «Mis inscripciones»). Se guarda en el
 * dispositivo para verlo sin conexión (`app/utils/fotocheck.ts`) y mantiene la pantalla encendida
 * mientras está visible. Con un backend anterior a la 014 la ruta no existe: «pronto disponible».
 */
definePageMeta({ layout: 'participante', perfil: 'participante' })
useHead({ title: 'Mi fotocheck · CIISIC' })

type Estado = 'cargando' | 'listo' | 'sin-fotocheck' | 'no-disponible' | 'error'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { portal, fotoEnDatos } = usePortal()

const estado = ref<Estado>('cargando')
const error = ref<string | null>(null)
const inscripciones = ref<InscripcionPortal[]>([])
const seleccionada = ref<number | null>(null)
const fotocheck = ref<FotocheckPortal | null>(null)
const foto = ref<string | null>(null)
/** Se está mostrando la copia guardada en el dispositivo (sin conexión): cuándo se guardó. */
const guardadoEn = ref<string | null>(null)
const idSelector = useId()

const opciones = computed(() => inscripcionesConFotocheck(inscripciones.value, hoyEnLima()))
const inscripcionActual = computed(() => inscripciones.value.find((inscripcion) => inscripcion.id === seleccionada.value) ?? null)
const motivo = computed(() => motivoSinFotocheck(inscripciones.value))

/** Evita que una respuesta tardía (otra inscripción elegida antes) pise a la última. */
let solicitud = 0

/** Muestra la copia guardada si es de esta persona (y de `inscripcionId`, si se indica). */
function mostrarGuardado(inscripcionId?: number): boolean {
  const guardado = leerFotocheckGuardado(almacenDelNavegador(), auth.participante?.id)
  if (!guardado || (inscripcionId !== undefined && guardado.fotocheck.inscripcionId !== inscripcionId)) return false
  fotocheck.value = guardado.fotocheck
  foto.value = guardado.foto
  guardadoEn.value = guardado.guardadoEn
  seleccionada.value = guardado.fotocheck.inscripcionId
  estado.value = 'listo'
  return true
}

async function abrir(inscripcionId: number) {
  const numero = ++solicitud
  seleccionada.value = inscripcionId
  estado.value = 'cargando'
  error.value = null
  try {
    const { data } = await portal<{ data: FotocheckPortal }>(`inscriptions/${inscripcionId}/badge`)
    const fotoEnDatosActual = data.foto?.tiene ? await fotoEnDatos().catch(() => null) : null
    if (numero !== solicitud) return
    fotocheck.value = data
    foto.value = fotoEnDatosActual
    guardadoEn.value = null
    estado.value = 'listo'
    const participanteId = auth.participante?.id
    if (participanteId) guardarFotocheck(almacenDelNavegador(), { participanteId, guardadoEn: new Date().toISOString(), fotocheck: data, foto: fotoEnDatosActual })
  } catch (e) {
    if (numero !== solicitud) return
    if (esNoDisponible(e)) {
      estado.value = 'no-disponible'
      return
    }
    if (esFalloDeConexion(e) && mostrarGuardado(inscripcionId)) return
    const { code, status, message } = aErrorApi(e)
    // Ya no está aprobada o ya no es suya: la copia guardada de esa inscripción no vale
    if (code === 'NOT_APPROVED' || code === 'INSCRIPTION_NOT_FOUND') {
      const almacen = almacenDelNavegador()
      if (leerFotocheckGuardado(almacen, auth.participante?.id)?.fotocheck.inscripcionId === inscripcionId) borrarFotocheckGuardado(almacen)
    }
    if (status === 401) return
    error.value = message
    estado.value = 'error'
  }
}

async function cargar() {
  const numero = ++solicitud
  estado.value = 'cargando'
  error.value = null
  try {
    const { data } = await portal<{ data: InscripcionPortal[] }>('inscriptions')
    if (numero !== solicitud) return
    inscripciones.value = data
  } catch (e) {
    if (numero !== solicitud) return
    if (esFalloDeConexion(e) && mostrarGuardado()) return
    if (aErrorApi(e).status === 401) return
    error.value = aErrorApi(e).message
    estado.value = 'error'
    return
  }

  // La copia de una inscripción que ya no tiene fotocheck (cancelada, de otra persona) se borra
  const almacen = almacenDelNavegador()
  const guardado = leerFotocheckGuardado(almacen, auth.participante?.id)
  if (guardado && !opciones.value.some((inscripcion) => inscripcion.id === guardado.fotocheck.inscripcionId)) borrarFotocheckGuardado(almacen)

  const elegida = inscripcionElegida(opciones.value, idDeConsulta(route.query.inscripcion))
  if (!elegida) {
    estado.value = 'sin-fotocheck'
    return
  }
  await abrir(elegida.id)
}

function alElegirInscripcion(evento: Event) {
  const id = Number((evento.target as HTMLSelectElement).value)
  if (!Number.isSafeInteger(id) || id === seleccionada.value) return
  router.replace({ query: { ...route.query, inscripcion: String(id) } })
  abrir(id)
}

// ─── Pantalla encendida mientras se muestra el fotocheck ───

let bloqueo: WakeLockSentinel | null = null
let pidiendoBloqueo = false

async function mantenerPantalla() {
  if (bloqueo || pidiendoBloqueo || estado.value !== 'listo' || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
  pidiendoBloqueo = true
  try {
    const nuevo = await navigator.wakeLock.request('screen')
    nuevo.addEventListener('release', () => {
      if (bloqueo === nuevo) bloqueo = null
    })
    bloqueo = nuevo
    // Cambió mientras se pedía (se fue de la página o dejó de verse el fotocheck)
    if (estado.value !== 'listo' || document.visibilityState !== 'visible') soltarPantalla()
  } catch {
    // Sin permiso, batería baja o navegador sin soporte: el fotocheck se muestra igual
  } finally {
    pidiendoBloqueo = false
  }
}

function soltarPantalla() {
  const actual = bloqueo
  bloqueo = null
  actual?.release().catch(() => undefined)
}

/** El navegador suelta el bloqueo al ocultar la pestaña: se vuelve a pedir al regresar. */
function alCambiarVisibilidad() {
  if (document.visibilityState === 'visible') mantenerPantalla()
}

watch(estado, (valor) => {
  if (valor === 'listo') mantenerPantalla()
  else soltarPantalla()
})

onMounted(() => {
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  cargar()
})
onBeforeUnmount(() => {
  solicitud++
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  soltarPantalla()
})
// Una navegación dentro de la página (otro `?inscripcion=` desde el historial) vuelve a elegir
watch(() => route.query.inscripcion, (valor) => {
  const id = idDeConsulta(valor)
  if (id && id !== seleccionada.value && opciones.value.some((inscripcion) => inscripcion.id === id)) abrir(id)
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Con el fotocheck en pantalla, en el celular el encabezado solo lo leen los lectores de pantalla
         (la barra superior ya dice «Fotocheck»): así el QR queda a la vista sin desplazarse -->
    <div :class="{ 'sr-only sm:not-sr-only': estado === 'listo' }">
      <p class="kicker">Portal del inscrito</p>
      <h1 class="mt-1 text-3xl font-extrabold">Mi fotocheck</h1>
      <p class="mt-2 text-sm text-slate-400">
        Muéstralo en el ingreso de cada actividad: el equipo escanea el QR para registrar tu asistencia.
      </p>
    </div>

    <div v-if="opciones.length > 1 && !guardadoEn && estado !== 'no-disponible'" class="mx-auto max-w-sm">
      <label :for="idSelector" class="field-label max-sm:sr-only">Evento</label>
      <select :id="idSelector" class="field-control" :value="seleccionada ?? ''" :disabled="estado === 'cargando'" @change="alElegirInscripcion">
        <option v-for="inscripcion in opciones" :key="inscripcion.id" :value="inscripcion.id">
          {{ inscripcion.evento.nombreCorto || inscripcion.evento.nombre }}
        </option>
      </select>
    </div>

    <PortalEstado v-if="estado === 'cargando'" estado="cargando" texto="Cargando tu fotocheck…" />

    <PortalEstado v-else-if="estado === 'error'" estado="error" :texto="error" @reintentar="cargar" />

    <PortalEstado
      v-else-if="estado === 'no-disponible'"
      estado="no-disponible"
      icon="heroicons:identification"
      texto="El fotocheck virtual estará disponible pronto. Mientras tanto, descarga tu credencial en PDF desde «Mis inscripciones»."
    >
      <AppButton variant="secondary" size="sm" icon="heroicons:ticket" to="/mis-inscripciones">Ir a mis inscripciones</AppButton>
    </PortalEstado>

    <div v-else-if="estado === 'sin-fotocheck'" class="card">
      <AppEmpty icon="heroicons:identification" :titulo="motivo.titulo" :descripcion="motivo.descripcion">
        <AppButton variant="secondary" size="sm" icon="heroicons:ticket" to="/mis-inscripciones">Ver mis inscripciones</AppButton>
      </AppEmpty>
    </div>

    <template v-else-if="fotocheck">
      <div v-if="guardadoEn" class="mx-auto flex max-w-sm items-start gap-3 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/30" role="status">
        <Icon name="heroicons:signal-slash" class="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <p>Sin conexión con el servidor: es el fotocheck guardado en este dispositivo ({{ fechaHoraLima(guardadoEn) }}). El QR sigue sirviendo.</p>
          <button type="button" class="mt-1 font-semibold text-amber-200 underline underline-offset-2 hover:text-white" @click="cargar">Volver a intentar</button>
        </div>
      </div>

      <PortalTarjetaFotocheck :fotocheck="fotocheck" :foto="foto" />

      <div class="mx-auto max-w-sm space-y-4">
        <ul class="space-y-2 text-sm text-slate-400">
          <li class="flex gap-2 sm:hidden">
            <Icon name="heroicons:qr-code" class="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden="true" />
            Muéstralo en el ingreso de cada actividad: el equipo escanea el QR para registrar tu asistencia.
          </li>
          <li class="flex gap-2">
            <Icon name="heroicons:sun" class="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden="true" />
            Sube el brillo de la pantalla para que el QR se lea al primer intento.
          </li>
          <li class="flex gap-2">
            <Icon name="heroicons:clock" class="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden="true" />
            La hora «en vivo» muestra al equipo que es tu portal y no una captura de pantalla.
          </li>
          <li v-if="!fotocheck.foto?.tiene" class="flex gap-2">
            <Icon name="heroicons:camera" class="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden="true" />
            <span>Agrega tu foto en <NuxtLink to="/mi-perfil" class="font-medium text-brand-300 underline underline-offset-2 hover:text-brand-200">Mi perfil</NuxtLink> para que te identifiquen más rápido.</span>
          </li>
        </ul>

        <PortalBotonDescarga
          v-if="inscripcionActual?.credencial.disponible && !guardadoEn"
          :ruta="`inscriptions/${inscripcionActual.id}/credential`"
          :respaldo="`credencial-${inscripcionActual.id}.pdf`"
          texto="Descargar credencial (PDF)"
          variante="secondary"
          ancho
        />
      </div>
    </template>
  </div>
</template>
